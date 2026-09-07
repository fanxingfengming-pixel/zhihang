begin;

select plan(15);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'workspace-owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'workspace-other@example.com');

select ok(
  not has_table_privilege('anon', 'public.user_workspaces', 'select,insert,update,delete'),
  'anonymous visitors hold no workspace privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.user_workspaces', 'select,insert,update,delete'),
  'authenticated users have the operations required by the sync API'
);

set local role anon;

select throws_ok(
  $$select * from public.user_workspaces$$,
  '42501',
  null,
  'anonymous visitors cannot read workspaces'
);

select throws_ok(
  $$insert into public.user_workspaces (user_id, snapshot)
    values ('11111111-1111-1111-1111-111111111111', '{"version": 1}'::jsonb)$$,
  '42501',
  null,
  'anonymous visitors cannot create workspaces'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$insert into public.user_workspaces (user_id, snapshot)
    values ('11111111-1111-1111-1111-111111111111', '{"version": 1}'::jsonb)
    returning user_id$$,
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'an owner can create their workspace'
);

select throws_ok(
  $$insert into public.user_workspaces (user_id, snapshot)
    values ('22222222-2222-2222-2222-222222222222', '{"version": 1}'::jsonb)$$,
  '42501',
  null,
  'an owner cannot create another users workspace'
);

select throws_ok(
  $$update public.user_workspaces
    set user_id = '22222222-2222-2222-2222-222222222222'
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  'an owner cannot reassign their workspace'
);

select results_eq(
  $$select snapshot->>'version'
    from public.user_workspaces
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  array['1'],
  'an owner can read their workspace'
);

select results_eq(
  $$update public.user_workspaces
    set snapshot = '{"version": 1, "updated": true}'::jsonb
    where user_id = '11111111-1111-1111-1111-111111111111'
    returning snapshot->>'updated'$$,
  array['true'],
  'an owner can update their workspace'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$select * from public.user_workspaces$$,
  'another user reads no workspace rows'
);

select is_empty(
  $$update public.user_workspaces
    set snapshot = '{"version": 999}'::jsonb
    returning user_id$$,
  'another user updates no workspace rows'
);

select is_empty(
  $$delete from public.user_workspaces returning user_id$$,
  'another user deletes no workspace rows'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select snapshot->>'updated'
    from public.user_workspaces
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  array['true'],
  'denied cross-user writes leave the owner row unchanged'
);

select throws_ok(
  $$update public.user_workspaces
    set snapshot = '[]'::jsonb
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  '23514',
  null,
  'the database rejects non-object workspace snapshots'
);

select results_eq(
  $$delete from public.user_workspaces
    where user_id = '11111111-1111-1111-1111-111111111111'
    returning user_id$$,
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'an owner can delete their workspace'
);

select * from finish();
rollback;
