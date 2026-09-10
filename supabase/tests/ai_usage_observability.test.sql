begin;

select plan(13);

insert into auth.users (id, email)
values
  ('55555555-5555-4555-8555-555555555555', 'usage-owner@example.com'),
  ('66666666-6666-4666-8666-666666666666', 'usage-other@example.com');

set local role anon;

select throws_ok(
  $$select * from public.reserve_ai_usage(
    '00000000-0000-4000-8000-000000000001', repeat('a', 64), 'shared-ai',
    'free-chat', 'qwen', 'qwen-plus', 1000
  )$$,
  '42501',
  null,
  'anonymous visitors cannot reserve shared AI usage'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select results_eq(
  $$select allowed from public.reserve_ai_usage(
    '00000000-0000-4000-8000-000000000002', repeat('b', 64), 'shared-ai',
    'free-chat', 'qwen', 'qwen-plus', 1000
  )$$,
  array[true],
  'an authenticated user can reserve distributed AI capacity'
);

select throws_ok(
  $$select * from private.ai_usage_events$$,
  '42501',
  null,
  'authenticated users cannot read private usage events'
);

reset role;

select is(
  (select status from private.ai_usage_events where request_id = '00000000-0000-4000-8000-000000000002'),
  'pending',
  'a successful reservation creates a pending usage event'
);

select is(
  (select daily_tokens from private.ai_usage_quotas where user_id = '55555555-5555-4555-8555-555555555555'),
  1000,
  'estimated tokens are reserved atomically'
);

select is(
  (select minute_count from private.ai_identity_rate_limits where identity_hash = repeat('b', 64) and scope = 'shared-ai'),
  1,
  'the hashed network identity receives an independent rate bucket'
);

set local role service_role;

select ok(
  public.finalize_ai_usage(
    '00000000-0000-4000-8000-000000000002', 'success', 250, 150, 400, 320, 1200, null
  ),
  'the service role can finalize actual usage'
);

reset role;

select is(
  (select status from private.ai_usage_events where request_id = '00000000-0000-4000-8000-000000000002'),
  'success',
  'finalization records the terminal status'
);

select is(
  (select daily_tokens from private.ai_usage_quotas where user_id = '55555555-5555-4555-8555-555555555555'),
  400,
  'unused reserved tokens are released after finalization'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select results_eq(
  $$select allowed from public.reserve_ai_usage(
    '00000000-0000-4000-8000-000000000003', repeat('b', 64), 'shared-ai',
    'resume', 'qwen', 'qwen-plus', 1000
  )$$,
  array[true],
  'a second request can reserve estimated capacity'
);

reset role;
set local role service_role;

select ok(
  public.finalize_ai_usage(
    '00000000-0000-4000-8000-000000000003', 'success', 900, 600, 1500, 600, 900, null
  ),
  'actual usage can exceed the initial estimate'
);

reset role;

select is(
  (select daily_tokens from private.ai_usage_quotas where user_id = '55555555-5555-4555-8555-555555555555'),
  1900,
  'quota accounting records actual tokens instead of capping them at the estimate'
);

select results_eq(
  $$select requests_24h, errors_24h, tokens_month, cost_microunits_month, stale_pending
    from public.ai_usage_summary()$$,
  $$values (2::bigint, 0::bigint, 1900::bigint, 920::bigint, 0::bigint)$$,
  'the service-only summary reports requests, tokens and configured cost'
);

select * from finish();
rollback;
