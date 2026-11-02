create schema if not exists private;

create type public.voucher_status as enum (
  'active',
  'redeemed',
  'cancelled'
);

create type public.organization_role as enum (
  'admin',
  'staff'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (char_length(btrim(name)) > 0)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_normalized check (
    char_length(username) > 0
    and username = btrim(username)
    and username = lower(username)
  )
);

create table public.organization_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  role public.organization_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  constraint services_name_not_blank check (char_length(btrim(name)) > 0)
);

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  redemption_code text not null unique,
  service_id uuid not null references public.services (id) on delete restrict,
  expires_on date not null,
  created_at timestamptz not null default now(),
  status public.voucher_status not null default 'active',
  redeemed_by uuid references public.organization_members (user_id) on delete restrict,
  redeemed_at timestamptz,
  constraint vouchers_redemption_code_not_blank check (char_length(btrim(redemption_code)) > 0),
  constraint vouchers_redemption_state_check check (
    (
      status = 'redeemed'
      and redeemed_by is not null
      and redeemed_at is not null
    )
    or (
      status in ('active', 'cancelled')
      and redeemed_by is null
      and redeemed_at is null
    )
  )
);


create index organization_members_organization_id_idx
  on public.organization_members (organization_id);

create unique index organization_members_one_admin_per_organization
  on public.organization_members (organization_id)
  where role = 'admin';

create index services_organization_id_idx
  on public.services (organization_id);

create index vouchers_service_id_idx
  on public.vouchers (service_id);

create index vouchers_redeemed_by_idx
  on public.vouchers (redeemed_by);


create function private.prevent_member_reassignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.organization_id is distinct from old.organization_id then
    raise exception 'Organization member user and organization assignments are immutable';
  end if;

  return new;
end;
$$;

create trigger organization_members_prevent_reassignment
before update of user_id, organization_id on public.organization_members
for each row execute function private.prevent_member_reassignment();

create function private.validate_voucher_redeemer_organization()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.redeemed_by is not null then
    -- Keep both records alive through the FK checks. Their organization
    -- assignments are immutable, so these values cannot change underneath us.
    perform 1
    from public.services
    where id = new.service_id
    for key share;

    perform 1
    from public.organization_members
    where user_id = new.redeemed_by
    for key share;

    if not exists (
      select 1
      from public.services
      join public.organization_members
        on organization_members.organization_id = services.organization_id
      where services.id = new.service_id
        and organization_members.user_id = new.redeemed_by
    ) then
      raise exception 'Voucher redeemer must be a member of the service organization';
    end if;
  end if;

  return new;
end;
$$;

create trigger vouchers_validate_redeemer_organization
before insert or update of service_id, redeemed_by on public.vouchers
for each row execute function private.validate_voucher_redeemer_organization();

create function private.prevent_service_organization_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Service organization assignments are immutable';
  end if;

  return new;
end;
$$;

create trigger services_prevent_organization_change
before update of organization_id on public.services
for each row execute function private.prevent_service_organization_change();


create function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.organization_members
  where user_id = (select auth.uid());
$$;

create function private.current_organization_role()
returns public.organization_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.organization_members
  where user_id = (select auth.uid());
$$;

revoke all on function private.prevent_member_reassignment() from public, anon, authenticated;
revoke all on function private.validate_voucher_redeemer_organization() from public, anon, authenticated;
revoke all on function private.prevent_service_organization_change() from public, anon, authenticated;
revoke all on function private.current_organization_id() from public, anon, authenticated;
revoke all on function private.current_organization_role() from public, anon, authenticated;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.services from anon, authenticated;
revoke all on table public.vouchers from anon, authenticated;


grant usage on schema private to authenticated;
grant execute on function private.current_organization_id() to authenticated;
grant execute on function private.current_organization_role() to authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.organization_members to authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.services to authenticated;

-- Members only get non-sensitive voucher columns. Redemption details are
-- exposed to organization admins through public.get_voucher_redemptions().
grant select (id, service_id, status, expires_on) on table public.vouchers to authenticated;
grant update (username) on table public.profiles to authenticated;

grant select (id, name) on table public.organizations to anon;
grant select (id, organization_id, name) on table public.services to anon;
grant select (id, status, expires_on) on table public.vouchers to anon;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.organization_members to service_role;
grant select, insert, update, delete on table public.organizations to service_role;
grant select, insert, update, delete on table public.services to service_role;
grant select, insert, update, delete on table public.vouchers to service_role;


alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organizations enable row level security;
alter table public.services enable row level security;
alter table public.vouchers enable row level security;

create policy "Users can read own and, as admins, their organization member profiles"
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = id
  or (
    (select private.current_organization_role()) = 'admin'
    and exists (
      select 1
      from public.organization_members
      where organization_members.user_id = profiles.id
        and organization_members.organization_id = (select private.current_organization_id())
    )
  )
);

create policy "Members read own membership; admins read their organization members"
on public.organization_members for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    (select private.current_organization_role()) = 'admin'
    and organization_id = (select private.current_organization_id())
  )
);

create policy "Members can read their own organization"
on public.organizations for select
to authenticated
using (id = (select private.current_organization_id()));

create policy "Members can read services of their organization"
on public.services for select
to authenticated
using (organization_id = (select private.current_organization_id()));

create policy "Members can read vouchers of their organization services"
on public.vouchers for select
to authenticated
using (
  exists (
    select 1
    from public.services
    where services.id = vouchers.service_id
      and services.organization_id = (select private.current_organization_id())
  )
);

create policy "Users can update their own username"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Anonymous users can read organizations"
on public.organizations for select
to anon
using (true);

create policy "Anonymous users can read services"
on public.services for select
to anon
using (true);

create policy "Anonymous users can read voucher statuses"
on public.vouchers for select
to anon
using (true);

-- views

-- Security invoker: the caller's column grants and RLS on public.vouchers apply.
create view public.organization_vouchers
with (security_invoker = true)
as
select id, service_id, status, expires_on
from public.vouchers;

revoke all on table public.organization_vouchers from public, anon, authenticated;
grant select on table public.organization_vouchers to authenticated;
grant select on table public.organization_vouchers to service_role;

-- rpc

-- Security definer so admins can read redemption columns that authenticated
-- has no column grant for. Only redeemed vouchers of the caller's organization are
-- returned, and only when the caller is that organization's admin, so codes of
-- active or cancelled vouchers are never exposed.
create function private.voucher_redemptions()
returns table (
  id uuid,
  service_id uuid,
  redemption_code text,
  redeemed_by uuid,
  redeemed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    vouchers.id,
    vouchers.service_id,
    vouchers.redemption_code,
    vouchers.redeemed_by,
    vouchers.redeemed_at
  from public.vouchers
  join public.services
    on services.id = vouchers.service_id
  where vouchers.status = 'redeemed'
    and services.organization_id = (select private.current_organization_id())
    and (select private.current_organization_role()) = 'admin';
$$;

-- Thin invoker wrapper so the security definer body stays outside the exposed schema.
create function public.get_voucher_redemptions()
returns table (
  id uuid,
  service_id uuid,
  redemption_code text,
  redeemed_by uuid,
  redeemed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.voucher_redemptions();
$$;

revoke all on function private.voucher_redemptions() from public, anon, authenticated;
revoke all on function public.get_voucher_redemptions() from public, anon, authenticated;
grant execute on function private.voucher_redemptions() to authenticated;
grant execute on function public.get_voucher_redemptions() to authenticated;
