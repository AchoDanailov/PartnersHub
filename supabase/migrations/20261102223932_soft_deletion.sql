
alter table public.organizations
  add column deactivated_at timestamptz,
  add constraint organizations_deactivated_after_created check (
    deactivated_at is null or deactivated_at >= created_at
  );

alter table public.organization_members
  add column left_at timestamptz,
  add constraint organization_members_left_after_created check (
    left_at is null or left_at >= created_at
  );

alter table public.profiles
  add column is_anonymized boolean not null default false,
  add constraint profiles_anonymized_username check (
    is_anonymized = starts_with(username, 'anonymized-')
  );

alter table public.vouchers
  add constraint vouchers_expires_after_created check (
    expires_on >= (created_at at time zone 'UTC')::date
  );


drop index public.organization_members_one_admin_per_organization;

create unique index organization_members_one_admin_per_organization
  on public.organization_members (organization_id)
  where role = 'admin' and left_at is null;


create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.organization_members
  where user_id = (select auth.uid())
    and left_at is null;
$$;

create or replace function private.current_organization_role()
returns public.organization_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.organization_members
  where user_id = (select auth.uid())
    and left_at is null;
$$;


create or replace function private.validate_voucher_redeemer_organization()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.redeemed_by is not null then
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
        and organization_members.left_at is null
    ) then
      raise exception 'Voucher redeemer must be a current member of the service organization';
    end if;
  end if;

  return new;
end;
$$;


create function private.ensure_organization_active()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.organizations
    where id = new.organization_id
      and deactivated_at is not null
  ) then
    raise exception 'Organization is deactivated';
  end if;

  return new;
end;
$$;

create function private.ensure_voucher_organization_active()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.services
    join public.organizations
      on organizations.id = services.organization_id
    where services.id = new.service_id
      and organizations.deactivated_at is not null
  ) then
    raise exception 'Organization is deactivated';
  end if;

  return new;
end;
$$;

create trigger services_ensure_organization_active
before insert on public.services
for each row execute function private.ensure_organization_active();

create trigger organization_members_ensure_organization_active
before insert on public.organization_members
for each row execute function private.ensure_organization_active();

create trigger vouchers_ensure_organization_active
before insert on public.vouchers
for each row execute function private.ensure_voucher_organization_active();

revoke all on function private.ensure_organization_active() from public, anon, authenticated;
revoke all on function private.ensure_voucher_organization_active() from public, anon, authenticated;


alter policy "Users can update their own username"
on public.profiles
using ((select auth.uid()) = id and not is_anonymized)
with check ((select auth.uid()) = id and not is_anonymized);


create function public.remove_organization_member(p_actor_id uuid, p_user_id uuid)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  removed_at timestamptz;
begin
  update public.organization_members as target
  set left_at = coalesce(target.left_at, now())
  from public.organization_members as actor
  where target.user_id = p_user_id
    and target.role = 'staff'
    and actor.user_id = p_actor_id
    and actor.role = 'admin'
    and actor.left_at is null
    and actor.organization_id = target.organization_id
  returning target.left_at into removed_at;

  if removed_at is null then
    raise exception 'Only an organization admin can remove a staff member of their organization';
  end if;

  return removed_at;
end;
$$;

revoke all on function public.remove_organization_member(uuid, uuid) from public, anon, authenticated;

grant execute on function public.remove_organization_member(uuid, uuid) to service_role;
