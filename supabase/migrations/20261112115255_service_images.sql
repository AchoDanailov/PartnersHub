-- Public bucket: files download by plain URL. No storage.objects policies on
-- purpose, so only service_role lists and writes.
-- Keep supabase/config.toml identical: the CLI overwrites the local bucket from it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-images',
  'service-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
);


-- One row per image. `path` is the object key in the service-images bucket:
-- <organization_id>/<service_id>/<image_id>.<ext>. Deleting a row leaves the file.
create table public.service_images (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  path text not null unique,
  alt_text text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint service_images_path_not_blank check (char_length(btrim(path)) > 0),
  constraint service_images_path_no_leading_slash check (path !~ '^/'),
  constraint service_images_alt_text_not_blank check (
    alt_text is null or char_length(btrim(alt_text)) > 0
  ),
  constraint service_images_sort_order_not_negative check (sort_order >= 0),
  -- Deferrable, so one update can swap positions. Its index also covers the foreign key.
  constraint service_images_service_id_sort_order_key
    unique (service_id, sort_order) deferrable
);


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

revoke all on function private.ensure_service_image_organization_active() from public, anon, authenticated;


revoke all on table public.service_images from anon, authenticated;

grant select (id, service_id, path, alt_text, sort_order) on table public.service_images to anon;
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
