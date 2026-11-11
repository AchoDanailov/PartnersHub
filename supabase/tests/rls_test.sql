begin;
select plan(85);

insert into public.organizations (id, name)
values
  ('10000000-0000-0000-0000-000000000001', 'Organization One'),
  ('10000000-0000-0000-0000-000000000002', 'Organization Two');

insert into auth.users (id, email)
values
  ('20000000-0000-0000-0000-000000000001', 'admin1@example.com'),
  ('20000000-0000-0000-0000-000000000002', 'admin2@example.com'),
  ('20000000-0000-0000-0000-000000000003', 'staff1@example.com'),
  ('20000000-0000-0000-0000-000000000004', 'staff2@example.com'),
  ('20000000-0000-0000-0000-000000000005', 'outsider@example.com');

insert into public.profiles (id, username)
values
  ('20000000-0000-0000-0000-000000000001', 'admin1'),
  ('20000000-0000-0000-0000-000000000002', 'admin2'),
  ('20000000-0000-0000-0000-000000000003', 'staff1'),
  ('20000000-0000-0000-0000-000000000004', 'staff2'),
  ('20000000-0000-0000-0000-000000000005', 'outsider');

insert into public.organization_members (user_id, organization_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'staff'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'staff');

insert into public.services (id, organization_id, name)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Service One'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Service Two');

insert into public.vouchers (
  id,
  redemption_code,
  service_id,
  expires_on,
  status,
  redeemed_by,
  redeemed_at
)
values
  ('50000000-0000-0000-0000-000000000001', 'CODE-1', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'active', null, null),
  ('50000000-0000-0000-0000-000000000002', 'CODE-2', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'redeemed', '20000000-0000-0000-0000-000000000003', '2026-10-29 12:00:00+00'),
  ('50000000-0000-0000-0000-000000000003', 'CODE-3', '40000000-0000-0000-0000-000000000002', '2027-12-31', 'active', null, null),
  ('50000000-0000-0000-0000-000000000004', 'CODE-4', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'cancelled', null, null);

-- Privileges

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select')
  and not has_table_privilege('anon', 'public.profiles', 'insert')
  and not has_table_privilege('anon', 'public.profiles', 'update')
  and not has_table_privilege('anon', 'public.profiles', 'delete')
  and not has_any_column_privilege('anon', 'public.profiles', 'select'),
  'anon has no profile privileges'
);
select ok(
  not has_table_privilege('anon', 'public.organization_members', 'select')
  and not has_table_privilege('anon', 'public.organization_members', 'insert')
  and not has_table_privilege('anon', 'public.organization_members', 'update')
  and not has_table_privilege('anon', 'public.organization_members', 'delete')
  and not has_any_column_privilege('anon', 'public.organization_members', 'select'),
  'anon has no organization member privileges'
);
select ok(
  not has_table_privilege('anon', 'public.organizations', 'select')
  and not has_table_privilege('anon', 'public.organizations', 'insert')
  and not has_table_privilege('anon', 'public.organizations', 'update')
  and not has_table_privilege('anon', 'public.organizations', 'delete'),
  'anon has no table-level organization privileges'
);
select ok(
  not has_table_privilege('anon', 'public.services', 'select')
  and not has_table_privilege('anon', 'public.services', 'insert')
  and not has_table_privilege('anon', 'public.services', 'update')
  and not has_table_privilege('anon', 'public.services', 'delete'),
  'anon has no table-level service privileges'
);
select ok(
  not has_table_privilege('anon', 'public.vouchers', 'select')
  and not has_table_privilege('anon', 'public.vouchers', 'insert')
  and not has_table_privilege('anon', 'public.vouchers', 'update')
  and not has_table_privilege('anon', 'public.vouchers', 'delete'),
  'anon has no table-level voucher privileges'
);
select ok(
  has_column_privilege('anon', 'public.organizations', 'id', 'select')
  and has_column_privilege('anon', 'public.organizations', 'name', 'select')
  and not has_column_privilege('anon', 'public.organizations', 'created_at', 'select'),
  'anon can select only organization id and name'
);
select ok(
  has_column_privilege('anon', 'public.services', 'id', 'select')
  and has_column_privilege('anon', 'public.services', 'organization_id', 'select')
  and has_column_privilege('anon', 'public.services', 'name', 'select')
  and not has_column_privilege('anon', 'public.services', 'created_at', 'select'),
  'anon can select only service id, organization_id and name'
);
select ok(
  has_column_privilege('anon', 'public.vouchers', 'id', 'select')
  and has_column_privilege('anon', 'public.vouchers', 'status', 'select')
  and has_column_privilege('anon', 'public.vouchers', 'expires_on', 'select'),
  'anon can select voucher id, status and expiration date'
);
select ok(
  not has_column_privilege('anon', 'public.vouchers', 'redemption_code', 'select')
  and not has_column_privilege('anon', 'public.vouchers', 'redeemed_by', 'select')
  and not has_column_privilege('anon', 'public.vouchers', 'redeemed_at', 'select')
  and not has_column_privilege('anon', 'public.vouchers', 'service_id', 'select')
  and not has_column_privilege('anon', 'public.vouchers', 'created_at', 'select'),
  'anon cannot select redemption codes, redemption data or other voucher columns'
);
select ok(
  not has_function_privilege('anon', 'private.current_organization_id()', 'execute')
  and not has_function_privilege('anon', 'private.current_organization_role()', 'execute'),
  'anon cannot execute the RLS helper functions'
);
select ok(
  not has_function_privilege('anon', 'public.get_voucher_redemptions()', 'execute')
  and not has_function_privilege('anon', 'private.voucher_redemptions()', 'execute'),
  'anon cannot execute the voucher redemption functions'
);
select ok(
  not has_table_privilege('anon', 'public.organization_vouchers', 'select'),
  'anon cannot read the organization vouchers view'
);

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'insert')
  and not has_table_privilege('authenticated', 'public.profiles', 'update')
  and not has_table_privilege('authenticated', 'public.profiles', 'delete'),
  'authenticated users cannot insert, delete or freely update profiles'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'username', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'id', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update'),
  'authenticated users can update only the username column'
);
select ok(
  not has_table_privilege('authenticated', 'public.organization_members', 'insert')
  and not has_table_privilege('authenticated', 'public.organization_members', 'update')
  and not has_table_privilege('authenticated', 'public.organization_members', 'delete'),
  'authenticated users cannot write organization memberships or roles'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'insert')
  and not has_table_privilege('authenticated', 'public.organizations', 'update')
  and not has_table_privilege('authenticated', 'public.organizations', 'delete'),
  'authenticated users cannot write organizations'
);
select ok(
  not has_table_privilege('authenticated', 'public.services', 'insert')
  and not has_table_privilege('authenticated', 'public.services', 'update')
  and not has_table_privilege('authenticated', 'public.services', 'delete'),
  'authenticated users cannot write services'
);
select ok(
  not has_table_privilege('authenticated', 'public.vouchers', 'insert')
  and not has_table_privilege('authenticated', 'public.vouchers', 'update')
  and not has_table_privilege('authenticated', 'public.vouchers', 'delete')
  and not has_any_column_privilege('authenticated', 'public.vouchers', 'update'),
  'authenticated users cannot write vouchers'
);
select ok(
  not has_table_privilege('authenticated', 'public.vouchers', 'select')
  and has_column_privilege('authenticated', 'public.vouchers', 'id', 'select')
  and has_column_privilege('authenticated', 'public.vouchers', 'service_id', 'select')
  and has_column_privilege('authenticated', 'public.vouchers', 'status', 'select')
  and has_column_privilege('authenticated', 'public.vouchers', 'expires_on', 'select'),
  'authenticated users can select only voucher id, service_id, status and expiration date'
);
select ok(
  not has_column_privilege('authenticated', 'public.vouchers', 'redemption_code', 'select')
  and not has_column_privilege('authenticated', 'public.vouchers', 'redeemed_by', 'select')
  and not has_column_privilege('authenticated', 'public.vouchers', 'redeemed_at', 'select'),
  'authenticated users cannot select redemption codes or redemption data directly'
);
select ok(
  has_table_privilege('authenticated', 'public.organization_vouchers', 'select')
  and not has_table_privilege('authenticated', 'public.organization_vouchers', 'insert')
  and not has_table_privilege('authenticated', 'public.organization_vouchers', 'update')
  and not has_table_privilege('authenticated', 'public.organization_vouchers', 'delete'),
  'authenticated users can only read the organization vouchers view'
);
select ok(
  has_function_privilege('authenticated', 'public.get_voucher_redemptions()', 'execute'),
  'authenticated users can execute the voucher redemptions RPC'
);

select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.organization_vouchers'::regclass),
  'the organization vouchers view runs with the caller privileges'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.get_voucher_redemptions()'::regprocedure),
  'the exposed redemptions RPC is security invoker'
);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.organization_members'::regclass), 'organization_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.organizations'::regclass), 'organizations has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.services'::regclass), 'services has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.vouchers'::regclass), 'vouchers has RLS enabled');

-- Anonymous users

-- The "read all" checks filter to this file's fixture ID prefixes, because the
-- database may already hold rows from supabase/seed.sql.
set local role anon;

select results_eq(
  $$select id::text from public.organizations where id::text like '10000000-%' order by id$$,
  array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'],
  'anonymous users read all organizations'
);
select results_eq(
  $$select id::text from public.services where id::text like '40000000-%' order by id$$,
  array['40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002'],
  'anonymous users read all services'
);
select results_eq(
  $$select id::text || ':' || status::text from public.vouchers where id::text like '50000000-%' order by id$$,
  array[
    '50000000-0000-0000-0000-000000000001:active',
    '50000000-0000-0000-0000-000000000002:redeemed',
    '50000000-0000-0000-0000-000000000003:active',
    '50000000-0000-0000-0000-000000000004:cancelled'
  ],
  'anonymous users read all voucher statuses'
);
select throws_ok($$select redemption_code from public.vouchers$$, '42501', null, 'anonymous users cannot read redemption codes');
select throws_ok($$select redeemed_by, redeemed_at from public.vouchers$$, '42501', null, 'anonymous users cannot read redemption data');
select throws_ok($$select * from public.vouchers$$, '42501', null, 'anonymous users cannot read all voucher columns');
select throws_ok($$select * from public.organization_vouchers$$, '42501', null, 'anonymous users cannot read the organization vouchers view');
select throws_ok($$select * from public.get_voucher_redemptions()$$, '42501', null, 'anonymous users cannot call the redemptions RPC');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anonymous users cannot read profiles');
select throws_ok($$select * from public.organization_members$$, '42501', null, 'anonymous users cannot read organization members');

-- Organization admin

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';

select results_eq(
  $$select id::text from public.organizations order by id$$,
  array['10000000-0000-0000-0000-000000000001'],
  'an admin reads only their organization'
);

select results_eq(
  $$select id::text from public.services order by id$$,
  array['40000000-0000-0000-0000-000000000001'],
  'an admin reads only their organization services'
);

select results_eq(
  $$select id::text from public.organization_vouchers order by id$$,
  array['50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004'],
  'an admin reads only their organization vouchers through the view'
);

select throws_ok(
  $$select redemption_code from public.vouchers$$,
  '42501',
  null,
  'an admin cannot read redemption codes directly'
);

select throws_ok(
  $$select redeemed_by, redeemed_at from public.vouchers$$,
  '42501',
  null,
  'an admin cannot read redemption data directly'
);

select results_eq(
  $$select id::text, redemption_code, redeemed_by::text, redeemed_at from public.get_voucher_redemptions()$$,
  $$values ('50000000-0000-0000-0000-000000000002', 'CODE-2', '20000000-0000-0000-0000-000000000003', '2026-10-29 12:00:00+00'::timestamptz)$$,
  'an admin reads redemption details of their organization redeemed vouchers'
);

select is_empty(
  $$select 1 from public.get_voucher_redemptions() where redemption_code in ('CODE-1', 'CODE-3', 'CODE-4')$$,
  'an admin cannot see codes of active, cancelled or cross-organization vouchers'
);

select results_eq(
  $$select user_id::text from public.organization_members order by user_id$$,
  array['20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'],
  'an admin reads all members of their organization'
);

select results_eq(
  $$select id::text from public.profiles order by id$$,
  array['20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'],
  'an admin reads only their own and their organization member profiles'
);

select lives_ok(
  $$update public.profiles set username = 'admin-one' where id = '20000000-0000-0000-0000-000000000001'$$,
  'an admin can update their own username'
);

select results_eq(
  $$select username from public.profiles where id = '20000000-0000-0000-0000-000000000001'$$,
  array['admin-one'],
  'the admin username update is persisted'
);

update public.profiles set username = 'hijacked' where id = '20000000-0000-0000-0000-000000000003';

select results_eq(
  $$select username from public.profiles where id = '20000000-0000-0000-0000-000000000003'$$,
  array['staff1'],
  'an admin cannot update their organization member usernames'
);

select throws_ok(
  $$update public.profiles set created_at = now() where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'users cannot update profile columns other than username'
);

select throws_ok(
  $$update public.profiles set id = '20000000-0000-0000-0000-000000000005' where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'users cannot change their profile id'
);

select throws_ok(
  $$update public.profiles set username = 'Admin One' where id = '20000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'username updates must stay normalized'
);

select throws_ok(
  $$update public.profiles set username = 'staff1' where id = '20000000-0000-0000-0000-000000000001'$$,
  '23505',
  null,
  'username updates must stay unique'
);

select throws_ok(
  $$insert into public.organizations (name) values ('Unauthorized Organization')$$,
  '42501',
  null,
  'an admin cannot insert an organization directly'
);

select throws_ok(
  $$update public.vouchers set status = 'cancelled' where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'an admin cannot update vouchers directly'
);

-- Organization staff

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';

select results_eq(
  $$select id::text from public.organizations order by id$$,
  array['10000000-0000-0000-0000-000000000001'],
  'staff read only their organization'
);

select results_eq(
  $$select id::text from public.services order by id$$,
  array['40000000-0000-0000-0000-000000000001'],
  'staff read only their organization services'
);

select results_eq(
  $$select id::text || ':' || service_id::text || ':' || status::text || ':' || expires_on::text from public.organization_vouchers order by id$$,
  array[
    '50000000-0000-0000-0000-000000000001:40000000-0000-0000-0000-000000000001:active:2027-12-31',
    '50000000-0000-0000-0000-000000000002:40000000-0000-0000-0000-000000000001:redeemed:2027-12-31',
    '50000000-0000-0000-0000-000000000004:40000000-0000-0000-0000-000000000001:cancelled:2027-12-31'
  ],
  'staff read their organization voucher ids, services, statuses and expiration dates through the view'
);

select results_eq(
  $$select id::text from public.vouchers order by id$$,
  array['50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004'],
  'staff read the same voucher rows from the base table'
);

select throws_ok(
  $$select redemption_code from public.vouchers$$,
  '42501',
  null,
  'staff cannot read redemption codes'
);

select throws_ok(
  $$select redeemed_by, redeemed_at from public.vouchers$$,
  '42501',
  null,
  'staff cannot read redemption data'
);

select is_empty(
  $$select * from public.get_voucher_redemptions()$$,
  'staff get no redemption details from the RPC'
);

select results_eq(
  $$select id::text from public.profiles order by id$$,
  array['20000000-0000-0000-0000-000000000003'],
  'staff read only their own profile'
);

select lives_ok(
  $$update public.profiles set username = 'staff-one' where id = '20000000-0000-0000-0000-000000000003'$$,
  'staff can update their own username'
);

select results_eq(
  $$select username from public.profiles where id = '20000000-0000-0000-0000-000000000003'$$,
  array['staff-one'],
  'the staff username update is persisted'
);

select results_eq(
  $$select user_id::text from public.organization_members order by user_id$$,
  array['20000000-0000-0000-0000-000000000003'],
  'staff read only their own membership'
);

select results_eq(
  $$select private.current_organization_role()::text$$,
  array['staff'],
  'the role helper reports the caller role'
);

select throws_ok(
  $$update public.organization_members set role = 'admin' where user_id = '20000000-0000-0000-0000-000000000003'$$,
  '42501',
  null,
  'staff cannot promote themselves'
);

select throws_ok(
  $$insert into public.organization_members (user_id, organization_id) values ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'staff cannot add organization members'
);

select throws_ok(
  $$update public.vouchers set status = 'redeemed', redeemed_by = '20000000-0000-0000-0000-000000000003', redeemed_at = now() where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'staff cannot redeem vouchers directly'
);

-- Admin of another organization

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';

select results_eq(
  $$select id::text from public.organization_vouchers order by id$$,
  array['50000000-0000-0000-0000-000000000003'],
  'another admin cannot read cross-organization vouchers'
);

select is_empty(
  $$select * from public.get_voucher_redemptions()$$,
  'another admin cannot read cross-organization redemption details'
);

select results_eq(
  $$select id::text from public.profiles order by id$$,
  array['20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004'],
  'another admin cannot read cross-organization profiles'
);

select results_eq(
  $$select user_id::text from public.organization_members order by user_id$$,
  array['20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004'],
  'another admin cannot read cross-organization members'
);

-- User without a membership

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000005';

select is_empty($$select * from public.organizations$$, 'a user without a membership reads no organizations');
select is_empty($$select * from public.services$$, 'a user without a membership reads no services');
select is_empty($$select * from public.organization_vouchers$$, 'a user without a membership reads no vouchers');
select is_empty($$select * from public.get_voucher_redemptions()$$, 'a user without a membership reads no redemption details');
select is_empty($$select * from public.organization_members$$, 'a user without a membership reads no memberships');

select ok(
  (select private.current_organization_id()) is null
  and (select private.current_organization_role()) is null,
  'the RLS helpers return null for a user without a membership'
);

select results_eq(
  $$select id::text from public.profiles$$,
  array['20000000-0000-0000-0000-000000000005'],
  'a user without a membership can still read their own profile'
);

select lives_ok(
  $$update public.profiles set username = 'outsider-renamed' where id = '20000000-0000-0000-0000-000000000005'$$,
  'a user without a membership can update their own username'
);

select results_eq(
  $$select username from public.profiles$$,
  array['outsider-renamed'],
  'the outsider username update is persisted'
);

select * from finish();
rollback;
