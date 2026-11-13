-- Where a voucher was sold: the Shopify order, the line item in it, and which
-- unit of that line item (1..quantity). Written by the issue-voucher Edge
-- Function. All three stay null for vouchers that did not come from Shopify.
--
-- The unique constraint makes issuing safe to repeat: a second call for the
-- same order, line item and unit finds the first voucher instead of creating
-- another. Rows with nulls never conflict with each other.
--
-- No grants are added. anon and authenticated only have column-level select
-- on other columns, so these stay hidden from them.
alter table public.vouchers
  add column shopify_order_id text,
  add column shopify_line_item_id text,
  add column shopify_line_item_unit integer,
  add constraint vouchers_shopify_reference_complete check (
    num_nonnulls(shopify_order_id, shopify_line_item_id, shopify_line_item_unit) in (0, 3)
  ),
  add constraint vouchers_shopify_order_id_digits check (
    shopify_order_id ~ '^[0-9]{1,20}$'
  ),
  add constraint vouchers_shopify_line_item_id_digits check (
    shopify_line_item_id ~ '^[0-9]{1,20}$'
  ),
  add constraint vouchers_shopify_line_item_unit_positive check (
    shopify_line_item_unit >= 1
  ),
  add constraint vouchers_shopify_reference_key
    unique (shopify_order_id, shopify_line_item_id, shopify_line_item_unit);


-- Private bucket for the QR code of each voucher, at <voucher_id>.png. A QR
-- code contains the redemption code, so it is as sensitive as that column.
-- No storage.objects policies on purpose, so only service_role reads and writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-qrs',
  'generated-qrs',
  false,
  1048576, -- 1 MiB
  array['image/png']
);
