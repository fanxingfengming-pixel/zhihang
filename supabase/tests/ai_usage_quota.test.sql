begin;

select plan(8);

insert into auth.users (id, email)
values
  ('33333333-3333-3333-3333-333333333333', 'quota-owner@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'quota-other@example.com');

set local role anon;

select throws_ok(
  $$select * from public.consume_ai_quota()$$,
  '42501',
  null,
  'anonymous visitors cannot consume shared AI quota'
);

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$select allowed from public.consume_ai_quota()$$,
  array[true],
  'an authenticated user can consume their first quota unit'
);

select results_eq(
  $$select daily_remaining from public.consume_ai_quota()$$,
  array[48],
  'quota consumption is counted atomically for the current user'
);

select throws_ok(
  $$select * from private.ai_usage_quotas$$,
  '42501',
  null,
  'authenticated users cannot read the private quota table directly'
);

reset role;
update private.ai_usage_quotas
set daily_count = 50,
    usage_date = (now() at time zone 'utc')::date,
    minute_count = 0,
    minute_bucket = date_trunc('minute', now()) - interval '1 minute'
where user_id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$select allowed from public.consume_ai_quota()$$,
  array[false],
  'the daily shared quota rejects additional calls'
);

reset role;
update private.ai_usage_quotas
set daily_count = 2,
    minute_count = 10,
    minute_bucket = date_trunc('minute', now())
where user_id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$select allowed from public.consume_ai_quota()$$,
  array[false],
  'the per-minute quota rejects bursts'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select results_eq(
  $$select allowed from public.consume_ai_quota()$$,
  array[true],
  'another user receives an independent quota bucket'
);

reset role;

select is(
  (select count(*) from private.ai_usage_quotas),
  2::bigint,
  'quota state is isolated by user id'
);

select * from finish();
rollback;
