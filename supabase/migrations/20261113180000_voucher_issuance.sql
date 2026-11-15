-- The idempotency key the caller sends with each issue-voucher request. A
-- repeat call with the same idempotency key finds the first voucher instead of
-- creating another. Vouchers created any other way get a random key.
--
-- No grants are added. anon and authenticated only have column-level select
-- on other columns, so this one stays hidden from them.
alter table public.vouchers
  add column idempotency_key uuid not null default gen_random_uuid(),
  add constraint vouchers_idempotency_key_key unique (idempotency_key);


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
