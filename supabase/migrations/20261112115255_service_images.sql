-- Public bucket for service images. Objects are downloaded by plain URL.
-- There are deliberately no policies on storage.objects: anon and authenticated
-- can neither list nor write, and only server code using service_role uploads.
-- supabase/config.toml mirrors these settings so the CLI can upload the local
-- seed files; keep the two in sync.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-images',
  'service-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
);


-- One row per image of a service. `path` is the object key inside the
-- service-images bucket, by convention <organization_id>/<service_id>/<image_id>.<ext>.
create table public.service_images (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete restrict,
  path text not null unique,
  alt_text text,
  created_at timestamptz not null default now(),
  constraint service_images_path_not_blank check (char_length(btrim(path)) > 0),
  constraint service_images_path_no_leading_slash check (path !~ '^/'),
  constraint service_images_alt_text_not_blank check (
    alt_text is null or char_length(btrim(alt_text)) > 0
  )
);

create index service_images_service_id_idx
  on public.service_images (service_id);


create function private.prevent_service_image_service_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.service_id is distinct from old.service_id then
    raise exception 'Service image service assignments are immutable';
  end if;

  return new;
end;
$$;

create trigger service_images_prevent_service_change
before update of service_id on public.service_images
for each row execute function private.prevent_service_image_service_change();

create function private.ensure_service_image_organization_active()
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

create trigger service_images_ensure_organization_active
before insert on public.service_images
for each row execute function private.ensure_service_image_organization_active();

revoke all on function private.prevent_service_image_service_change() from public, anon, authenticated;
revoke all on function private.ensure_service_image_organization_active() from public, anon, authenticated;


revoke all on table public.service_images from anon, authenticated;

-- created_at is exposed to anon, unlike on other tables: it is the only way to
-- order the images of a service until an explicit sort order exists.
grant select (id, service_id, path, alt_text, created_at) on table public.service_images to anon;
grant select on table public.service_images to authenticated;
grant select, insert, update, delete on table public.service_images to service_role;


alter table public.service_images enable row level security;

create policy "Anonymous users can read service images"
on public.service_images for select
to anon
using (true);

create policy "Members can read images of their organization services"
on public.service_images for select
to authenticated
using (
  exists (
    select 1
    from public.services
    where services.id = service_images.service_id
      and services.organization_id = (select private.current_organization_id())
  )
);
