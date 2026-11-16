-- Failed lookups of a typed redemption code, one row per attempt. The
-- redeem-voucher Edge Function counts a member's recent rows to limit guessing.
-- Old rows are not cleaned up yet.

create table public.voucher_code_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.organization_members (user_id) on delete cascade,
  attempted_at timestamptz not null default now()
);

-- Covers the foreign key and the count of a member's recent attempts.
create index voucher_code_attempts_user_id_attempted_at_idx
  on public.voucher_code_attempts (user_id, attempted_at);


revoke all on table public.voucher_code_attempts from anon, authenticated;
grant select, insert, delete on table public.voucher_code_attempts to service_role;

-- No policies on purpose: only service_role reads and writes.
alter table public.voucher_code_attempts enable row level security;
