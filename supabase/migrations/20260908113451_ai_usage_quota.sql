create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists private.ai_usage_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_date date not null,
  daily_count integer not null default 0 check (daily_count >= 0),
  minute_bucket timestamptz not null,
  minute_count integer not null default 0 check (minute_count >= 0),
  updated_at timestamptz not null default now()
);

alter table private.ai_usage_quotas enable row level security;
revoke all on table private.ai_usage_quotas from public, anon, authenticated;

create or replace function private.consume_ai_quota()
returns table (
  allowed boolean,
  daily_remaining integer,
  minute_remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_usage_date date := (now() at time zone 'utc')::date;
  current_minute timestamptz := date_trunc('minute', now());
  daily_limit constant integer := 50;
  minute_limit constant integer := 10;
  saved_daily_count integer;
  saved_minute_count integer;
  saved_usage_date date;
  saved_minute_bucket timestamptz;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  insert into private.ai_usage_quotas as quota (
    user_id,
    usage_date,
    daily_count,
    minute_bucket,
    minute_count,
    updated_at
  ) values (
    current_user_id,
    current_usage_date,
    1,
    current_minute,
    1,
    now()
  )
  on conflict (user_id) do update set
    usage_date = excluded.usage_date,
    daily_count = case
      when quota.usage_date = excluded.usage_date then quota.daily_count + 1
      else 1
    end,
    minute_bucket = excluded.minute_bucket,
    minute_count = case
      when quota.minute_bucket = excluded.minute_bucket then quota.minute_count + 1
      else 1
    end,
    updated_at = now()
  where
    (quota.usage_date <> excluded.usage_date or quota.daily_count < daily_limit)
    and (quota.minute_bucket <> excluded.minute_bucket or quota.minute_count < minute_limit)
  returning quota.daily_count, quota.minute_count
  into saved_daily_count, saved_minute_count;

  if found then
    return query select
      true,
      greatest(0, daily_limit - saved_daily_count),
      greatest(0, minute_limit - saved_minute_count),
      0;
    return;
  end if;

  select quota.usage_date, quota.daily_count, quota.minute_bucket, quota.minute_count
  into saved_usage_date, saved_daily_count, saved_minute_bucket, saved_minute_count
  from private.ai_usage_quotas as quota
  where quota.user_id = current_user_id;

  return query select
    false,
    case when saved_usage_date = current_usage_date then greatest(0, daily_limit - saved_daily_count) else daily_limit end,
    case when saved_minute_bucket = current_minute then greatest(0, minute_limit - saved_minute_count) else minute_limit end,
    greatest(1, ceil(extract(epoch from (
      case
        when saved_usage_date = current_usage_date and saved_daily_count >= daily_limit
          then ((current_usage_date + 1)::timestamp at time zone 'utc') - now()
        else (current_minute + interval '1 minute') - now()
      end
    ))))::integer;
end;
$$;

revoke execute on function private.consume_ai_quota() from public, anon, authenticated, service_role;
grant execute on function private.consume_ai_quota() to authenticated;

create or replace function public.consume_ai_quota()
returns table (
  allowed boolean,
  daily_remaining integer,
  minute_remaining integer,
  retry_after_seconds integer
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.consume_ai_quota();
$$;

revoke execute on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;
