-- Production AI quota, distributed rate limiting and usage observability.
-- Raw IP addresses are never stored; the application sends an HMAC digest.

alter table private.ai_usage_quotas
  add column if not exists daily_tokens integer not null default 0
    check (daily_tokens >= 0),
  add column if not exists month_start date not null
    default date_trunc('month', now() at time zone 'utc')::date,
  add column if not exists monthly_tokens integer not null default 0
    check (monthly_tokens >= 0);

create table if not exists private.ai_identity_rate_limits (
  identity_hash text not null,
  scope text not null,
  minute_bucket timestamptz not null,
  minute_count integer not null default 0 check (minute_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (identity_hash, scope),
  constraint ai_identity_rate_limits_hash_format
    check (identity_hash ~ '^[a-f0-9]{64}$'),
  constraint ai_identity_rate_limits_scope_length
    check (char_length(scope) between 1 and 64)
);

create table if not exists private.ai_usage_events (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_hash text not null,
  agent text not null,
  provider text not null,
  model text not null,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'error')),
  estimated_tokens integer not null check (estimated_tokens > 0),
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  cost_microunits bigint check (cost_microunits is null or cost_microunits >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_type text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_usage_events_hash_format
    check (identity_hash ~ '^[a-f0-9]{64}$'),
  constraint ai_usage_events_agent_length
    check (char_length(agent) between 1 and 64),
  constraint ai_usage_events_provider_length
    check (char_length(provider) between 1 and 32),
  constraint ai_usage_events_model_length
    check (char_length(model) between 1 and 128)
);

create index if not exists ai_usage_events_user_created_idx
  on private.ai_usage_events (user_id, created_at desc);
create index if not exists ai_usage_events_status_created_idx
  on private.ai_usage_events (status, created_at)
  where status = 'pending';

alter table private.ai_identity_rate_limits enable row level security;
alter table private.ai_usage_events enable row level security;
revoke all on table private.ai_identity_rate_limits from public, anon, authenticated;
revoke all on table private.ai_usage_events from public, anon, authenticated;

create or replace function private.reserve_ai_usage(
  p_request_id uuid,
  p_identity_hash text,
  p_scope text,
  p_agent text,
  p_provider text,
  p_model text,
  p_estimated_tokens integer
)
returns table (
  allowed boolean,
  reason text,
  daily_remaining integer,
  daily_tokens_remaining integer,
  monthly_tokens_remaining integer,
  minute_remaining integer,
  identity_minute_remaining integer,
  retry_after_seconds integer,
  budget_warning text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_usage_date date := (now() at time zone 'utc')::date;
  current_month_start date := date_trunc('month', now() at time zone 'utc')::date;
  current_minute timestamptz := date_trunc('minute', now());
  daily_request_limit constant integer := 50;
  user_minute_limit constant integer := 10;
  identity_minute_limit constant integer := 30;
  daily_token_limit constant integer := 200000;
  monthly_token_limit constant integer := 2000000;
  concurrent_limit constant integer := 3;
  quota_daily_count integer;
  quota_minute_count integer;
  quota_daily_tokens integer;
  quota_monthly_tokens integer;
  quota_usage_date date;
  quota_month_start date;
  quota_minute_bucket timestamptz;
  identity_count integer;
  identity_bucket timestamptz;
  pending_count integer;
  warning_message text := '';
  retry_seconds integer := 0;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_request_id is null
    or p_identity_hash !~ '^[a-f0-9]{64}$'
    or char_length(p_scope) not between 1 and 64
    or char_length(p_agent) not between 1 and 64
    or char_length(p_provider) not between 1 and 32
    or char_length(p_model) not between 1 and 128
    or p_estimated_tokens not between 1 and 200000 then
    raise invalid_parameter_value using message = 'Invalid AI quota reservation';
  end if;

  insert into private.ai_usage_quotas (
    user_id, usage_date, daily_count, minute_bucket, minute_count,
    daily_tokens, month_start, monthly_tokens, updated_at
  ) values (
    current_user_id, current_usage_date, 0, current_minute, 0,
    0, current_month_start, 0, now()
  ) on conflict (user_id) do nothing;

  insert into private.ai_identity_rate_limits (
    identity_hash, scope, minute_bucket, minute_count, updated_at
  ) values (
    p_identity_hash, p_scope, current_minute, 0, now()
  ) on conflict (identity_hash, scope) do nothing;

  select
    quota.usage_date,
    quota.daily_count,
    quota.minute_bucket,
    quota.minute_count,
    quota.daily_tokens,
    quota.month_start,
    quota.monthly_tokens
  into
    quota_usage_date,
    quota_daily_count,
    quota_minute_bucket,
    quota_minute_count,
    quota_daily_tokens,
    quota_month_start,
    quota_monthly_tokens
  from private.ai_usage_quotas as quota
  where quota.user_id = current_user_id
  for update;

  select bucket.minute_bucket, bucket.minute_count
  into identity_bucket, identity_count
  from private.ai_identity_rate_limits as bucket
  where bucket.identity_hash = p_identity_hash and bucket.scope = p_scope
  for update;

  if quota_usage_date <> current_usage_date then
    quota_daily_count := 0;
    quota_daily_tokens := 0;
  end if;
  if quota_month_start <> current_month_start then
    quota_monthly_tokens := 0;
  end if;
  if quota_minute_bucket <> current_minute then
    quota_minute_count := 0;
  end if;
  if identity_bucket <> current_minute then
    identity_count := 0;
  end if;

  select count(*)::integer
  into pending_count
  from private.ai_usage_events as event
  where event.user_id = current_user_id
    and event.status = 'pending'
    and event.created_at > now() - interval '2 minutes';

  if quota_daily_count >= daily_request_limit then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from ((current_usage_date + 1)::timestamp at time zone 'utc') - now()))::integer
    );
    return query select false, 'daily_requests', 0,
      greatest(0, daily_token_limit - quota_daily_tokens),
      greatest(0, monthly_token_limit - quota_monthly_tokens),
      greatest(0, user_minute_limit - quota_minute_count),
      greatest(0, identity_minute_limit - identity_count),
      retry_seconds, warning_message;
    return;
  end if;

  if quota_daily_tokens + p_estimated_tokens > daily_token_limit then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from ((current_usage_date + 1)::timestamp at time zone 'utc') - now()))::integer
    );
    return query select false, 'daily_tokens',
      greatest(0, daily_request_limit - quota_daily_count),
      greatest(0, daily_token_limit - quota_daily_tokens),
      greatest(0, monthly_token_limit - quota_monthly_tokens),
      greatest(0, user_minute_limit - quota_minute_count),
      greatest(0, identity_minute_limit - identity_count),
      retry_seconds, warning_message;
    return;
  end if;

  if quota_monthly_tokens + p_estimated_tokens > monthly_token_limit then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from ((current_month_start + interval '1 month')::timestamp at time zone 'utc') - now()))::integer
    );
    return query select false, 'monthly_tokens',
      greatest(0, daily_request_limit - quota_daily_count),
      greatest(0, daily_token_limit - quota_daily_tokens), 0,
      greatest(0, user_minute_limit - quota_minute_count),
      greatest(0, identity_minute_limit - identity_count),
      retry_seconds, warning_message;
    return;
  end if;

  if quota_minute_count >= user_minute_limit then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from ((current_minute + interval '1 minute') - now()))::integer
    );
    return query select false, 'user_minute',
      greatest(0, daily_request_limit - quota_daily_count),
      greatest(0, daily_token_limit - quota_daily_tokens),
      greatest(0, monthly_token_limit - quota_monthly_tokens), 0,
      greatest(0, identity_minute_limit - identity_count), retry_seconds, warning_message;
    return;
  end if;

  if identity_count >= identity_minute_limit then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from ((current_minute + interval '1 minute') - now()))::integer
    );
    return query select false, 'identity_minute',
      greatest(0, daily_request_limit - quota_daily_count),
      greatest(0, daily_token_limit - quota_daily_tokens),
      greatest(0, monthly_token_limit - quota_monthly_tokens),
      greatest(0, user_minute_limit - quota_minute_count), 0,
      retry_seconds, warning_message;
    return;
  end if;

  if pending_count >= concurrent_limit then
    return query select false, 'concurrent',
      greatest(0, daily_request_limit - quota_daily_count),
      greatest(0, daily_token_limit - quota_daily_tokens),
      greatest(0, monthly_token_limit - quota_monthly_tokens),
      greatest(0, user_minute_limit - quota_minute_count),
      greatest(0, identity_minute_limit - identity_count), 30, warning_message;
    return;
  end if;

  if quota_daily_tokens < daily_token_limit * 8 / 10
    and quota_daily_tokens + p_estimated_tokens >= daily_token_limit * 8 / 10 then
    warning_message := 'daily_tokens_80';
  elsif quota_monthly_tokens < monthly_token_limit * 8 / 10
    and quota_monthly_tokens + p_estimated_tokens >= monthly_token_limit * 8 / 10 then
    warning_message := 'monthly_tokens_80';
  end if;

  update private.ai_usage_quotas
  set usage_date = current_usage_date,
      daily_count = quota_daily_count + 1,
      minute_bucket = current_minute,
      minute_count = quota_minute_count + 1,
      daily_tokens = quota_daily_tokens + p_estimated_tokens,
      month_start = current_month_start,
      monthly_tokens = quota_monthly_tokens + p_estimated_tokens,
      updated_at = now()
  where user_id = current_user_id;

  update private.ai_identity_rate_limits
  set minute_bucket = current_minute,
      minute_count = identity_count + 1,
      updated_at = now()
  where identity_hash = p_identity_hash and scope = p_scope;

  insert into private.ai_usage_events (
    request_id, user_id, identity_hash, agent, provider, model, estimated_tokens
  ) values (
    p_request_id, current_user_id, p_identity_hash, p_agent, p_provider, p_model, p_estimated_tokens
  );

  return query select true, '',
    daily_request_limit - quota_daily_count - 1,
    daily_token_limit - quota_daily_tokens - p_estimated_tokens,
    monthly_token_limit - quota_monthly_tokens - p_estimated_tokens,
    user_minute_limit - quota_minute_count - 1,
    identity_minute_limit - identity_count - 1,
    0, warning_message;
end;
$$;

revoke execute on function private.reserve_ai_usage(uuid, text, text, text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.reserve_ai_usage(uuid, text, text, text, text, text, integer)
  to authenticated;

create or replace function public.reserve_ai_usage(
  p_request_id uuid,
  p_identity_hash text,
  p_scope text,
  p_agent text,
  p_provider text,
  p_model text,
  p_estimated_tokens integer
)
returns table (
  allowed boolean,
  reason text,
  daily_remaining integer,
  daily_tokens_remaining integer,
  monthly_tokens_remaining integer,
  minute_remaining integer,
  identity_minute_remaining integer,
  retry_after_seconds integer,
  budget_warning text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.reserve_ai_usage(
    p_request_id,
    p_identity_hash,
    p_scope,
    p_agent,
    p_provider,
    p_model,
    p_estimated_tokens
  );
$$;

revoke execute on function public.reserve_ai_usage(uuid, text, text, text, text, text, integer)
  from public, anon;
grant execute on function public.reserve_ai_usage(uuid, text, text, text, text, text, integer)
  to authenticated;

create or replace function public.finalize_ai_usage(
  p_request_id uuid,
  p_status text,
  p_prompt_tokens integer default null,
  p_completion_tokens integer default null,
  p_total_tokens integer default null,
  p_cost_microunits bigint default null,
  p_duration_ms integer default null,
  p_error_type text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  saved_user_id uuid;
  saved_estimated_tokens integer;
  saved_created_at timestamptz;
  actual_total integer;
  token_delta integer;
begin
  if p_status not in ('success', 'error')
    or coalesce(p_prompt_tokens, 0) < 0
    or coalesce(p_completion_tokens, 0) < 0
    or coalesce(p_total_tokens, 0) < 0
    or coalesce(p_cost_microunits, 0) < 0
    or coalesce(p_duration_ms, 0) < 0 then
    raise invalid_parameter_value using message = 'Invalid AI usage finalization';
  end if;

  select event.user_id, event.estimated_tokens, event.created_at
  into saved_user_id, saved_estimated_tokens, saved_created_at
  from private.ai_usage_events as event
  where event.request_id = p_request_id and event.status = 'pending'
  for update;

  if not found then
    return false;
  end if;

  actual_total := case
    when p_status = 'success' then coalesce(p_total_tokens, saved_estimated_tokens)
    else coalesce(p_total_tokens, 0)
  end;
  token_delta := actual_total - saved_estimated_tokens;

  update private.ai_usage_events
  set status = p_status,
      prompt_tokens = p_prompt_tokens,
      completion_tokens = p_completion_tokens,
      total_tokens = p_total_tokens,
      cost_microunits = p_cost_microunits,
      duration_ms = p_duration_ms,
      error_type = left(p_error_type, 120),
      completed_at = now()
  where request_id = p_request_id;

  update private.ai_usage_quotas
  set daily_tokens = case
        when usage_date = (saved_created_at at time zone 'utc')::date
          then greatest(0, daily_tokens + token_delta)
        else daily_tokens
      end,
      monthly_tokens = case
        when month_start = date_trunc('month', saved_created_at at time zone 'utc')::date
          then greatest(0, monthly_tokens + token_delta)
        else monthly_tokens
      end,
      updated_at = now()
  where user_id = saved_user_id;

  return true;
end;
$$;

revoke execute on function public.finalize_ai_usage(uuid, text, integer, integer, integer, bigint, integer, text)
  from public, anon, authenticated;
grant execute on function public.finalize_ai_usage(uuid, text, integer, integer, integer, bigint, integer, text)
  to service_role;

create or replace function public.ai_usage_summary()
returns table (
  requests_24h bigint,
  errors_24h bigint,
  tokens_month bigint,
  cost_microunits_month bigint,
  stale_pending bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where created_at >= now() - interval '24 hours'),
    count(*) filter (where created_at >= now() - interval '24 hours' and status = 'error'),
    coalesce(sum(total_tokens) filter (
      where created_at >= date_trunc('month', now()) and status = 'success'
    ), 0),
    coalesce(sum(cost_microunits) filter (
      where created_at >= date_trunc('month', now()) and status = 'success'
    ), 0),
    count(*) filter (where status = 'pending' and created_at < now() - interval '2 minutes')
  from private.ai_usage_events;
$$;

revoke execute on function public.ai_usage_summary() from public, anon, authenticated;
grant execute on function public.ai_usage_summary() to service_role;
