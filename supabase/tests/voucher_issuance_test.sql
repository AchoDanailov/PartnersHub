begin;
select plan(17);

insert into public.organizations (id, name)
values ('13000000-0000-0000-0000-000000000001', 'Issuance Organization One');

insert into public.services (id, organization_id, name)
values ('43000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'Issuance Service One');

insert into public.vouchers (
  id,
  redemption_code,
  service_id,
  expires_on,
  shopify_order_id,
  shopify_line_item_id,
  shopify_line_item_unit
)
values (
  '53000000-0000-0000-0000-000000000001',
  'VI-CODE-1',
  '43000000-0000-0000-0000-000000000001',
  '2099-12-31',
  '5000000000001',
  '13000000000001',
  1
);

-- Schema and privileges

select has_column('public', 'vouchers', 'shopify_order_id', 'vouchers has shopify_order_id');
select has_column('public', 'vouchers', 'shopify_line_item_id', 'vouchers has shopify_line_item_id');
select has_column('public', 'vouchers', 'shopify_line_item_unit', 'vouchers has shopify_line_item_unit');

select ok(
  not has_column_privilege('anon', 'public.vouchers', 'shopify_order_id', 'select')
  and not has_column_privilege('anon', 'public.vouchers', 'shopify_line_item_id', 'select')
  and not has_column_privilege('anon', 'public.vouchers', 'shopify_line_item_unit', 'select'),
  'anonymous users cannot read the Shopify reference'
);
select ok(
  not has_column_privilege('authenticated', 'public.vouchers', 'shopify_order_id', 'select')
  and not has_column_privilege('authenticated', 'public.vouchers', 'shopify_line_item_id', 'select')
  and not has_column_privilege('authenticated', 'public.vouchers', 'shopify_line_item_unit', 'select'),
  'signed-in users cannot read the Shopify reference'
);
select ok(
  not has_table_privilege('anon', 'public.vouchers', 'insert')
  and not has_table_privilege('authenticated', 'public.vouchers', 'insert'),
  'only service_role can create vouchers'
);

-- Shopify reference

select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, shopify_order_id, shopify_line_item_id, shopify_line_item_unit) values ('VI-CODE-2', '43000000-0000-0000-0000-000000000001', '2099-12-31', '5000000000001', '13000000000001', 1)$$,
  '23505',
  null,
  'the same order, line item and unit cannot get a second voucher'
);
select lives_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, shopify_order_id, shopify_line_item_id, shopify_line_item_unit) values ('VI-CODE-3', '43000000-0000-0000-0000-000000000001', '2099-12-31', '5000000000001', '13000000000001', 2)$$,
  'another unit of the same line item gets its own voucher'
);
select lives_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, shopify_order_id, shopify_line_item_id, shopify_line_item_unit) values ('VI-CODE-4', '43000000-0000-0000-0000-000000000001', '2099-12-31', '5000000000001', '13000000000002', 1)$$,
  'another line item of the same order gets its own voucher'
);
select lives_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on) values ('VI-CODE-5', '43000000-0000-0000-0000-000000000001', '2099-12-31'), ('VI-CODE-6', '43000000-0000-0000-0000-000000000001', '2099-12-31')$$,
  'vouchers without a Shopify reference do not conflict with each other'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, shopify_order_id) values ('VI-CODE-7', '43000000-0000-0000-0000-000000000001', '2099-12-31', '5000000000002')$$,
  '23514',
  null,
  'a Shopify reference must be complete'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, shopify_order_id, shopify_line_item_id, shopify_line_item_unit) values ('VI-CODE-7', '43000000-0000-0000-0000-000000000001', '2099-12-31', 'gid://shopify/Order/1', '13000000000003', 1)$$,
  '23514',
  null,
  'a Shopify order ID must be digits only'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, shopify_order_id, shopify_line_item_id, shopify_line_item_unit) values ('VI-CODE-7', '43000000-0000-0000-0000-000000000001', '2099-12-31', '5000000000003', '', 1)$$,
  '23514',
  null,
  'a Shopify line item ID must be digits only'
);
select throws_ok(
  $$insert into public.vouchers (redemption_code, service_id, expires_on, shopify_order_id, shopify_line_item_id, shopify_line_item_unit) values ('VI-CODE-7', '43000000-0000-0000-0000-000000000001', '2099-12-31', '5000000000003', '13000000000003', 0)$$,
  '23514',
  null,
  'a Shopify line item unit starts at 1'
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
  $$select shopify_order_id from public.vouchers$$,
  '42501',
  null,
  'signed-in users are denied the Shopify reference columns'
);
reset role;

select * from finish();
rollback;
