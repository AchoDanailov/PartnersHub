begin;
select plan(18);

insert into public.organizations (id, name)
values ('13000000-0000-0000-0000-000000000001', 'Issuance Organization One');

insert into public.services (id, organization_id, name)
values ('43000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'Issuance Service One');

insert into public.vouchers (id, redemption_code, service_id, expires_on, idempotency_key, qr_token)
values (
  '53000000-0000-0000-0000-000000000001',
  'VI-CODE-1',
  '43000000-0000-0000-0000-000000000001',
  '2099-12-31',
  '63000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001'
);

-- Schema and privileges

select has_column('public', 'vouchers', 'idempotency_key', 'vouchers has idempotency_key');
select col_not_null('public', 'vouchers', 'idempotency_key', 'idempotency_key is required');
select has_column('public', 'vouchers', 'qr_token', 'vouchers has qr_token');
select col_not_null('public', 'vouchers', 'qr_token', 'qr_token is required');

select ok(
  not has_column_privilege('anon', 'public.vouchers', 'idempotency_key', 'select')
  and not has_column_privilege('authenticated', 'public.vouchers', 'idempotency_key', 'select'),
  'anonymous and signed-in users cannot read the idempotency key'
);
select ok(
  not has_column_privilege('anon', 'public.vouchers', 'qr_token', 'select')
  and not has_column_privilege('authenticated', 'public.vouchers', 'qr_token', 'select'),
  'anonymous and signed-in users cannot read the QR token'
);
select ok(
  not has_table_privilege('anon', 'public.vouchers', 'insert')
  and not has_table_privilege('authenticated', 'public.vouchers', 'insert'),
  'only service_role can create vouchers'
);

-- Idempotency key

select lives_ok(
  $$insert into public.vouchers (id, redemption_code, service_id, expires_on) values ('53000000-0000-0000-0000-000000000002', 'VI-CODE-2', '43000000-0000-0000-0000-000000000001', '2099-12-31')$$,
  'a voucher created without a key can be inserted'
);
select isnt(
  (select idempotency_key from public.vouchers where id = '53000000-0000-0000-0000-000000000002'),
  null,
  'a voucher created without a key gets one'
);
select isnt(
  (select qr_token from public.vouchers where id = '53000000-0000-0000-0000-000000000002'),
  null,
  'a voucher gets a QR token by default'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, qr_token) values ('VI-CODE-3', '43000000-0000-0000-0000-000000000001', '2099-12-31', '73000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'two vouchers cannot share a QR token'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, idempotency_key) values ('VI-CODE-3', '43000000-0000-0000-0000-000000000001', '2099-12-31', '63000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'the same idempotency key cannot get a second voucher'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, idempotency_key) values ('VI-CODE-3', '43000000-0000-0000-0000-000000000001', '2099-12-31', null)$$,
  '23502',
  null,
  'the idempotency key cannot be null'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, idempotency_key) values ('VI-CODE-3', '43000000-0000-0000-0000-000000000001', '2099-12-31', 'not-a-uuid')$$,
  '22P02',
  null,
  'the idempotency key must be a UUID'
);

-- Storage bucket

select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'generated-qrs'$$,
  $$values (false, 1048576::bigint, array['image/png'])$$,
  'the generated-qrs bucket is private, limited to 1 MiB and to PNG files'
);
select is_empty(
  $$select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles && array['public', 'anon', 'authenticated']::name[]$$,
  'no storage.objects policy lets anon or authenticated read or write QR codes'
);

-- Members still read only the non-sensitive voucher columns.

set local role authenticated;
select throws_ok(
  $$select idempotency_key from public.vouchers$$,
  '42501',
  null,
  'signed-in users are denied the idempotency key column'
);
select throws_ok(
  $$select qr_token from public.vouchers$$,
  '42501',
  null,
  'signed-in users are denied the QR token column'
);
reset role;

select * from finish();
rollback;
