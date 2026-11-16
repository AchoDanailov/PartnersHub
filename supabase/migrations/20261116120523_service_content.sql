-- Marketing text shown on public service pages, and the questions clients often
-- ask about a service. The questions are for the organization admin only.

alter table public.services
  add column tagline text,
  add column description text,
  add constraint services_tagline_not_blank check (
    tagline is null or char_length(btrim(tagline)) > 0
  ),
  add constraint services_description_not_blank check (
    description is null or char_length(btrim(description)) > 0
  );

-- authenticated already has a table-level select grant on services.
grant select (tagline, description) on table public.services to anon;


create table public.service_faqs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  question text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint service_faqs_question_not_blank check (char_length(btrim(question)) > 0),
  constraint service_faqs_sort_order_not_negative check (sort_order >= 0),
  -- Deferrable, so one update can swap positions. Its index also covers the foreign key.
  constraint service_faqs_service_id_sort_order_key
    unique (service_id, sort_order) deferrable
);


create function private.ensure_service_faq_organization_active()
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

create trigger service_faqs_ensure_organization_active
before insert on public.service_faqs
for each row execute function private.ensure_service_faq_organization_active();

revoke all on function private.ensure_service_faq_organization_active() from public, anon, authenticated;


revoke all on table public.service_faqs from anon, authenticated;

grant select on table public.service_faqs to authenticated;
grant select, insert, update, delete on table public.service_faqs to service_role;


alter table public.service_faqs enable row level security;

create policy "Admins can read questions of their organization services"
on public.service_faqs for select
to authenticated
using (
  (select private.current_organization_role()) = 'admin'
  and exists (
    select 1
    from public.services
    where services.id = service_faqs.service_id
      and services.organization_id = (select private.current_organization_id())
  )
);
