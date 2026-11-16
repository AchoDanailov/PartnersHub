-- idempotency_key: the key the caller sends with each issue-voucher request. A
-- repeat call with the same idempotency key finds the first voucher instead of
-- creating another. Vouchers created any other way get a random key.
-- qr_token: the random token a voucher's QR code carries instead of its
-- redemption code.

alter table public.vouchers
  add column idempotency_key uuid not null default gen_random_uuid(),
  add column qr_token uuid not null default gen_random_uuid(),
  add constraint vouchers_idempotency_key_key unique (idempotency_key),
  add constraint vouchers_qr_token_key unique (qr_token);


-- Private bucket for the QR code of each voucher, at <voucher_id>.png. A QR
-- code carries the voucher's QR token
-- No storage.objects policies on purpose, so only service_role reads and writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-qrs',
  'generated-qrs',
  false,
  1048576, -- 1 MiB
  array['image/png']
);
