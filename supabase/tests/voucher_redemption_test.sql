begin;
select plan(7);

insert into public.organizations (id, name)
values ('15000000-0000-0000-0000-000000000001', 'Redemption Organization One');

insert into auth.users (id, email)
values ('25000000-0000-0000-0000-000000000001', 'vr-staff1@example.com');

insert into public.profiles (id, username)
values ('25000000-0000-0000-0000-000000000001', 'vr-staff1');

insert into public.organization_members (user_id, organization_id, role)
values ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'staff');

insert into public.voucher_code_attempts (id, user_id)
values ('65000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001');

select has_table('public', 'voucher_code_attempts', 'voucher_code_attempts exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.voucher_code_attempts'::regclass),
  'voucher_code_attempts has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.voucher_code_attempts', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.voucher_code_attempts', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'public.voucher_code_attempts', 'select')
  and not has_any_column_privilege('authenticated', 'public.voucher_code_attempts', 'select'),
  'anon and authenticated have no access to code attempts'
);
select ok(
  has_table_privilege('service_role', 'public.voucher_code_attempts', 'select')
  and has_table_privilege('service_role', 'public.voucher_code_attempts', 'insert'),
  'service_role can read and record code attempts'
);
select has_index(
  'public',
  'voucher_code_attempts',
  'voucher_code_attempts_user_id_attempted_at_idx',
  array['user_id', 'attempted_at'],
  'attempts are indexed by member and time'
);
select throws_ok(
  $$insert into public.voucher_code_attempts (user_id) values ('25000000-0000-0000-0000-000000000099')$$,
  '23503',
  null,
  'an attempt must belong to an organization member'
);

set local role authenticated;
set local request.jwt.claim.sub = '25000000-0000-0000-0000-000000000001';

select throws_ok(
  $$select id from public.voucher_code_attempts$$,
  '42501',
  null,
  'a member cannot read their own code attempts'
);

reset role;

select * from finish();
rollback;
