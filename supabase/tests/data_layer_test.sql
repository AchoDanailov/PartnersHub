begin;
select plan(28);

insert into public.organizations (id, name)
values
  ('10000000-0000-0000-0000-000000000001', 'Organization One'),
  ('10000000-0000-0000-0000-000000000002', 'Organization Two'),
  ('10000000-0000-0000-0000-000000000003', 'Organization Three'),
  ('10000000-0000-0000-0000-000000000004', 'Organization Four');

insert into auth.users (id, email)
values
  ('20000000-0000-0000-0000-000000000001', 'admin1@example.com'),
  ('20000000-0000-0000-0000-000000000002', 'admin2@example.com'),
  ('20000000-0000-0000-0000-000000000003', 'staff1@example.com'),
  ('20000000-0000-0000-0000-000000000004', 'staff2@example.com'),
  ('20000000-0000-0000-0000-000000000005', 'admin3@example.com'),
  ('20000000-0000-0000-0000-000000000006', 'uppercase@example.com'),
  ('20000000-0000-0000-0000-000000000007', 'duplicate@example.com'),
  ('20000000-0000-0000-0000-000000000008', 'newcomer@example.com'),
  ('20000000-0000-0000-0000-000000000009', 'staff4@example.com');

insert into public.profiles (id, username)
values
  ('20000000-0000-0000-0000-000000000001', 'admin1'),
  ('20000000-0000-0000-0000-000000000002', 'admin2'),
  ('20000000-0000-0000-0000-000000000003', 'staff1'),
  ('20000000-0000-0000-0000-000000000004', 'staff2'),
  ('20000000-0000-0000-0000-000000000005', 'admin3'),
  ('20000000-0000-0000-0000-000000000008', 'newcomer'),
  ('20000000-0000-0000-0000-000000000009', 'staff4');

insert into public.organization_members (user_id, organization_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'staff'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'staff'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'admin'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000004', 'staff');

-- Memberships

select throws_ok(
  $$insert into public.organization_members (user_id, organization_id) values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002')$$,
  '23505',
  null,
  'a member cannot join a second organization'
);

select throws_ok(
  $$insert into public.organization_members (user_id, organization_id, role) values ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'admin')$$,
  '23505',
  null,
  'an organization cannot have a second admin'
);

insert into public.organization_members (user_id, organization_id)
values ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003');

select is(
  (select role from public.organization_members where user_id = '20000000-0000-0000-0000-000000000008'),
  'staff'::public.organization_role,
  'new members default to the staff role'
);

select throws_ok(
  $$update public.organization_members set organization_id = '10000000-0000-0000-0000-000000000004' where user_id = '20000000-0000-0000-0000-000000000004'$$,
  'P0001',
  null,
  'member organization assignments are immutable'
);

select throws_ok(
  $$update public.organization_members set user_id = '20000000-0000-0000-0000-000000000007' where user_id = '20000000-0000-0000-0000-000000000004'$$,
  'P0001',
  null,
  'member user assignments are immutable'
);

select lives_ok(
  $$update public.organization_members set role = 'admin' where user_id = '20000000-0000-0000-0000-000000000009'$$,
  'staff can be promoted to admin when the organization has no admin'
);

select throws_ok(
  $$update public.organization_members set role = 'admin' where user_id = '20000000-0000-0000-0000-000000000003'$$,
  '23505',
  null,
  'staff cannot be promoted while the organization already has an admin'
);

-- Profiles

select throws_ok(
  $$insert into public.profiles (id, username) values ('20000000-0000-0000-0000-000000000006', 'Uppercase')$$,
  '23514',
  null,
  'usernames must be normalized lowercase'
);

select throws_ok(
  $$insert into public.profiles (id, username) values ('20000000-0000-0000-0000-000000000007', 'admin1')$$,
  '23505',
  null,
  'usernames are unique'
);

-- Services and vouchers

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
  ('50000000-0000-0000-0000-000000000003', 'CODE-3', '40000000-0000-0000-0000-000000000002', '2027-12-31', 'active', null, null);

select ok(
  exists (
    select 1
    from public.vouchers
    where id = '50000000-0000-0000-0000-000000000002'
      and status = 'redeemed'
  ),
  'staff can redeem a voucher for their organization'
);

select lives_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, status, redeemed_by, redeemed_at) values ('CODE-4', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'redeemed', '20000000-0000-0000-0000-000000000001', now())$$,
  'an admin can redeem a voucher for their organization'
);

select lives_ok(
  $$update public.vouchers set status = 'redeemed', redeemed_by = '20000000-0000-0000-0000-000000000003', redeemed_at = now() where id = '50000000-0000-0000-0000-000000000001'$$,
  'an active voucher can be redeemed by an organization member'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, status, redeemed_by, redeemed_at) values ('CODE-5', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'active', '20000000-0000-0000-0000-000000000003', now())$$,
  '23514',
  null,
  'an active voucher cannot contain redemption data'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, status) values ('CODE-5', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'redeemed')$$,
  '23514',
  null,
  'a redeemed voucher requires redemption data'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on) values ('CODE-1', '40000000-0000-0000-0000-000000000001', '2027-12-31')$$,
  '23505',
  null,
  'redemption codes are unique'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, status, redeemed_by, redeemed_at) values ('CODE-5', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'redeemed', '20000000-0000-0000-0000-000000000004', now())$$,
  'P0001',
  null,
  'staff cannot redeem another organization voucher'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, status, redeemed_by, redeemed_at) values ('CODE-5', '40000000-0000-0000-0000-000000000001', '2027-12-31', 'redeemed', '20000000-0000-0000-0000-000000000002', now())$$,
  'P0001',
  null,
  'an admin cannot redeem another organization voucher'
);

select throws_ok(
  $$insert into public.services (organization_id, name) values ('10000000-0000-0000-0000-000000000099', 'Invalid Service')$$,
  '23503',
  null,
  'a service requires an existing organization'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on) values ('CODE-5', '40000000-0000-0000-0000-000000000099', '2027-12-31')$$,
  '23503',
  null,
  'a voucher requires an existing service'
);

select throws_ok(
  $$update public.services set organization_id = '10000000-0000-0000-0000-000000000002' where id = '40000000-0000-0000-0000-000000000001'$$,
  'P0001',
  null,
  'service organization changes cannot invalidate redemption history'
);

select throws_ok(
  $$update public.services set organization_id = '10000000-0000-0000-0000-000000000001' where id = '40000000-0000-0000-0000-000000000002'$$,
  'P0001',
  null,
  'service organization assignments are immutable without redeemed vouchers'
);

select throws_ok(
  $$delete from auth.users where id = '20000000-0000-0000-0000-000000000003'$$,
  '23503',
  null,
  'deleting an Auth user cannot silently erase redemption history'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vouchers'
      and column_name = 'qr'
  ),
  'vouchers do not contain a QR column'
);

select results_eq(
  $$select enumlabel::text collate "default" from pg_enum join pg_type on pg_type.oid = pg_enum.enumtypid where pg_type.typname = 'voucher_status' order by enumsortorder$$,
  array['active', 'redeemed', 'cancelled'],
  'voucher statuses match the agreed lifecycle'
);

select results_eq(
  $$select enumlabel::text collate "default" from pg_enum join pg_type on pg_type.oid = pg_enum.enumtypid where pg_type.typname = 'organization_role' order by enumsortorder$$,
  array['admin', 'staff'],
  'organization roles are admin and staff'
);

-- Service role writes (the future redemption Edge Function uses this role)

set local role service_role;

select throws_ok(
  $$update public.vouchers set status = 'redeemed', redeemed_by = '20000000-0000-0000-0000-000000000003', redeemed_at = now() where id = '50000000-0000-0000-0000-000000000003'$$,
  'P0001',
  null,
  'service_role cannot record a cross-organization redeemer'
);

select lives_ok(
  $$update public.vouchers set status = 'redeemed', redeemed_by = '20000000-0000-0000-0000-000000000004', redeemed_at = now() where id = '50000000-0000-0000-0000-000000000003'$$,
  'service_role can redeem a voucher through the redeemer validation trigger'
);

select results_eq(
  $$select status::text, redeemed_by::text from public.vouchers where id = '50000000-0000-0000-0000-000000000003'$$,
  $$values ('redeemed', '20000000-0000-0000-0000-000000000004')$$,
  'the service_role redemption is persisted'
);

reset role;

select * from finish();
rollback;
