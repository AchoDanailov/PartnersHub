begin;
select plan(52);

-- Fixtures
-- Organization One: active. Organization Two: deactivated after setup.
-- Organization Three: used for admin replacement.

insert into public.organizations (id, name)
values
  ('11000000-0000-0000-0000-000000000001', 'Organization One'),
  ('11000000-0000-0000-0000-000000000002', 'Organization Two'),
  ('11000000-0000-0000-0000-000000000003', 'Organization Three');

insert into auth.users (id, email)
values
  ('21000000-0000-0000-0000-000000000001', 'admin1@example.com'),
  ('21000000-0000-0000-0000-000000000002', 'staff1@example.com'),
  ('21000000-0000-0000-0000-000000000003', 'staff3@example.com'),
  ('21000000-0000-0000-0000-000000000004', 'former@example.com'),
  ('21000000-0000-0000-0000-000000000005', 'admin2@example.com'),
  ('21000000-0000-0000-0000-000000000006', 'staff2@example.com'),
  ('21000000-0000-0000-0000-000000000007', 'admin3@example.com'),
  ('21000000-0000-0000-0000-000000000008', 'newadmin@example.com'),
  ('21000000-0000-0000-0000-000000000009', 'forgotten@example.com'),
  ('21000000-0000-0000-0000-000000000010', 'spare@example.com');

insert into public.profiles (id, username)
values
  ('21000000-0000-0000-0000-000000000001', 'admin1'),
  ('21000000-0000-0000-0000-000000000002', 'staff1'),
  ('21000000-0000-0000-0000-000000000003', 'staff3'),
  ('21000000-0000-0000-0000-000000000004', 'former'),
  ('21000000-0000-0000-0000-000000000005', 'admin2'),
  ('21000000-0000-0000-0000-000000000006', 'staff2'),
  ('21000000-0000-0000-0000-000000000007', 'admin3'),
  ('21000000-0000-0000-0000-000000000008', 'newadmin'),
  ('21000000-0000-0000-0000-000000000009', 'forgotten'),
  ('21000000-0000-0000-0000-000000000010', 'spare');

insert into public.organization_members (user_id, organization_id, role)
values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'admin'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'staff'),
  ('21000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'staff'),
  ('21000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000001', 'staff'),
  ('21000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000002', 'admin'),
  ('21000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000002', 'staff'),
  ('21000000-0000-0000-0000-000000000007', '11000000-0000-0000-0000-000000000003', 'admin');

insert into public.services (id, organization_id, name)
values
  ('41000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Service One'),
  ('41000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Service Two');

insert into public.vouchers (id, redemption_code, service_id, expires_on, status, redeemed_by, redeemed_at)
values
  ('51000000-0000-0000-0000-000000000001', 'SD-1', '41000000-0000-0000-0000-000000000001', '2027-12-31', 'active', null, null),
  ('51000000-0000-0000-0000-000000000002', 'SD-2', '41000000-0000-0000-0000-000000000001', '2027-12-31', 'redeemed', '21000000-0000-0000-0000-000000000004', '2026-10-29 12:00:00+00'),
  ('51000000-0000-0000-0000-000000000003', 'SD-3', '41000000-0000-0000-0000-000000000002', '2027-12-31', 'active', null, null),
  ('51000000-0000-0000-0000-000000000004', 'SD-4', '41000000-0000-0000-0000-000000000002', '2027-12-31', 'active', null, null);

-- The former member leaves after redeeming; Organization Two stops working with us.
update public.organization_members
set left_at = now()
where user_id = '21000000-0000-0000-0000-000000000004';

update public.organizations
set deactivated_at = now()
where id = '11000000-0000-0000-0000-000000000002';

-- Schema

select has_column('public', 'organizations', 'deactivated_at', 'organizations have deactivated_at');
select col_is_null('public', 'organizations', 'deactivated_at', 'deactivated_at is nullable');
select has_column('public', 'organization_members', 'left_at', 'organization members have left_at');
select col_is_null('public', 'organization_members', 'left_at', 'left_at is nullable');
select col_not_null('public', 'profiles', 'is_anonymized', 'is_anonymized is not null');
select col_default_is('public', 'profiles', 'is_anonymized', 'false', 'is_anonymized defaults to false');

-- Constraints

select throws_ok(
  $$update public.organizations set deactivated_at = created_at - interval '1 day' where id = '11000000-0000-0000-0000-000000000003'$$,
  '23514',
  null,
  'an organization cannot be deactivated before it was created'
);

select throws_ok(
  $$update public.organization_members set left_at = created_at - interval '1 day' where user_id = '21000000-0000-0000-0000-000000000002'$$,
  '23514',
  null,
  'a member cannot leave before joining'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, created_at, expires_on) values ('SD-DAY-BEFORE', '41000000-0000-0000-0000-000000000001', '2026-01-01 00:00:00+00', '2025-12-31')$$,
  '23514',
  null,
  'a voucher cannot expire before the day it is created'
);

select lives_ok(
  $$insert into public.vouchers (id, redemption_code, service_id, created_at, expires_on) values ('51000000-0000-0000-0000-000000000005', 'SD-SAME-DAY', '41000000-0000-0000-0000-000000000001', '2026-01-01 00:00:00+00', '2026-01-01')$$,
  'a voucher can expire on the day it is created'
);

select throws_ok(
  $$update public.vouchers set expires_on = '2025-12-31' where id = '51000000-0000-0000-0000-000000000005'$$,
  '23514',
  null,
  'a voucher expiry cannot be moved before its creation date'
);

select throws_ok(
  $$update public.profiles set is_anonymized = true where id = '21000000-0000-0000-0000-000000000010'$$,
  '23514',
  null,
  'an anonymized profile must have an anonymized username'
);

select throws_ok(
  $$update public.profiles set username = 'anonymized-spare' where id = '21000000-0000-0000-0000-000000000010'$$,
  '23514',
  null,
  'a non-anonymized profile cannot use an anonymized username'
);

select lives_ok(
  $$update public.profiles set username = 'anonymized-' || replace(id::text, '-', ''), is_anonymized = true where id = '21000000-0000-0000-0000-000000000009'$$,
  'a profile can be anonymized with a scrubbed username'
);

-- One admin per organization, among current members

select throws_ok(
  $$insert into public.organization_members (user_id, organization_id, role) values ('21000000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000003', 'admin')$$,
  '23505',
  null,
  'an organization cannot have a second current admin'
);

update public.organization_members
set left_at = now()
where user_id = '21000000-0000-0000-0000-000000000007';

select lives_ok(
  $$insert into public.organization_members (user_id, organization_id, role) values ('21000000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000003', 'admin')$$,
  'a replacement admin can be added after the previous admin left'
);

-- Deactivated organizations accept no new records

select throws_ok(
  $$insert into public.services (organization_id, name) values ('11000000-0000-0000-0000-000000000002', 'New Service')$$,
  'P0001',
  'Organization is deactivated',
  'a deactivated organization cannot get new services'
);

select throws_ok(
  $$insert into public.organization_members (user_id, organization_id) values ('21000000-0000-0000-0000-000000000010', '11000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'Organization is deactivated',
  'a deactivated organization cannot get new members'
);

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on) values ('SD-NEW', '41000000-0000-0000-0000-000000000002', '2027-12-31')$$,
  'P0001',
  'Organization is deactivated',
  'a deactivated organization cannot get new vouchers'
);

-- Redemption rules

select lives_ok(
  $$update public.vouchers set status = 'redeemed', redeemed_by = '21000000-0000-0000-0000-000000000006', redeemed_at = now() where id = '51000000-0000-0000-0000-000000000004'$$,
  'a current member of a deactivated organization can still redeem its vouchers'
);

select throws_ok(
  $$update public.vouchers set status = 'redeemed', redeemed_by = '21000000-0000-0000-0000-000000000004', redeemed_at = now() where id = '51000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Voucher redeemer must be a current member of the service organization',
  'a former member cannot redeem vouchers'
);

select ok(
  exists (
    select 1
    from public.vouchers
    where id = '51000000-0000-0000-0000-000000000002'
      and status = 'redeemed'
      and redeemed_by = '21000000-0000-0000-0000-000000000004'
  ),
  'past redemptions of a former member are kept'
);

-- Former member

set local role authenticated;
set local request.jwt.claim.sub = '21000000-0000-0000-0000-000000000004';

select is(private.current_organization_id(), null, 'a former member has no current organization');
select is(private.current_organization_role()::text, null, 'a former member has no current role');
select is_empty($$select 1 from public.organizations$$, 'a former member cannot read their former organization');
select is_empty($$select 1 from public.services$$, 'a former member cannot read services');
select is_empty($$select 1 from public.organization_vouchers$$, 'a former member cannot read vouchers');
select is_empty($$select 1 from public.get_voucher_redemptions()$$, 'a former member cannot read redemptions');
select results_eq(
  $$select username from public.profiles$$,
  array['former'],
  'a former member still reads their own profile'
);
select results_eq(
  $$select organization_id::text, left_at is not null from public.organization_members$$,
  $$values ('11000000-0000-0000-0000-000000000001', true)$$,
  'a former member still reads their own membership with left_at'
);

-- Admin of the active organization

set local request.jwt.claim.sub = '21000000-0000-0000-0000-000000000001';

select results_eq(
  $$select user_id::text, left_at is not null from public.organization_members where user_id = '21000000-0000-0000-0000-000000000004'$$,
  $$values ('21000000-0000-0000-0000-000000000004', true)$$,
  'an admin still sees former members of their organization'
);
select results_eq(
  $$select username from public.profiles where id = '21000000-0000-0000-0000-000000000004'$$,
  array['former'],
  'an admin still sees profiles of former members'
);
select results_eq(
  $$select redeemed_by::text from public.get_voucher_redemptions() where id = '51000000-0000-0000-0000-000000000002'$$,
  array['21000000-0000-0000-0000-000000000004'],
  'an admin still sees redemptions made by former members'
);

select throws_ok(
  $$update public.organization_members set left_at = now() where user_id = '21000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'an admin cannot update memberships directly'
);

-- Removal: only service_role can call it

select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'an admin cannot call the removal directly'
);

-- The actor comes from the argument. The JWT stays the admin's for these cases.

reset role;
set local role service_role;

select isnt(
  public.remove_organization_member('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000003'),
  null,
  'an admin can remove a current staff member of their organization'
);
select results_eq(
  $$select left_at is not null from public.organization_members where user_id = '21000000-0000-0000-0000-000000000003'$$,
  array[true],
  'the removed staff member has left_at set'
);

-- Backdated because now() does not change within this transaction.
reset role;
update public.organization_members
set created_at = '2020-01-01 00:00:00+00', left_at = '2021-01-01 00:00:00+00'
where user_id = '21000000-0000-0000-0000-000000000003';
set local role service_role;

select is(
  public.remove_organization_member('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000003'),
  '2021-01-01 00:00:00+00'::timestamptz,
  'repeating a removal keeps the original left_at'
);
select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000004')$$,
  'P0001',
  null,
  'the JWT does not authorize a removal for a staff actor'
);
select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000006')$$,
  'P0001',
  null,
  'an admin cannot remove members of another organization'
);
select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001')$$,
  'P0001',
  null,
  'an admin cannot remove themselves'
);
select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000003')$$,
  'P0001',
  null,
  'an admin of another organization cannot repeat a removal'
);
select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001')$$,
  'P0001',
  null,
  'staff members cannot remove members'
);
select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000003')$$,
  'P0001',
  null,
  'staff members cannot repeat a removal'
);
select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000007', '21000000-0000-0000-0000-000000000003')$$,
  'P0001',
  null,
  'a former admin cannot remove members'
);

reset role;
set local role authenticated;

-- Staff member of the deactivated organization

set local request.jwt.claim.sub = '21000000-0000-0000-0000-000000000006';

select results_eq(
  $$select id::text from public.organizations$$,
  array['11000000-0000-0000-0000-000000000002'],
  'a member of a deactivated organization still reads it'
);
select results_eq(
  $$select id::text from public.services$$,
  array['41000000-0000-0000-0000-000000000002'],
  'a member of a deactivated organization still reads its services'
);
select results_eq(
  $$select id::text from public.organization_vouchers order by id$$,
  array['51000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000004'],
  'a member of a deactivated organization still reads its vouchers'
);

-- Anonymized profile

set local request.jwt.claim.sub = '21000000-0000-0000-0000-000000000009';

update public.profiles
set username = 'restored'
where id = '21000000-0000-0000-0000-000000000009';

reset role;

select results_eq(
  $$select username from public.profiles where id = '21000000-0000-0000-0000-000000000009'$$,
  array['anonymized-21000000000000000000000000000009'],
  'an anonymized profile cannot update its username'
);

-- Anonymous

set local role anon;

select throws_ok(
  $$select public.remove_organization_member('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'anonymous users cannot remove members'
);
select results_eq(
  $$select id::text from public.organizations where id = '11000000-0000-0000-0000-000000000002'$$,
  array['11000000-0000-0000-0000-000000000002'],
  'anonymous users still see deactivated organizations'
);
select results_eq(
  $$select status::text from public.vouchers where id = '51000000-0000-0000-0000-000000000003'$$,
  array['active'],
  'anonymous users still read voucher status of deactivated organizations'
);

select * from finish();
rollback;
