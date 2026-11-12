begin;
select plan(33);

insert into public.organizations (id, name)
values
  ('12000000-0000-0000-0000-000000000001', 'Image Organization One'),
  ('12000000-0000-0000-0000-000000000002', 'Image Organization Two'),
  ('12000000-0000-0000-0000-000000000003', 'Image Organization Three');

insert into auth.users (id, email)
values
  ('22000000-0000-0000-0000-000000000001', 'si-admin1@example.com'),
  ('22000000-0000-0000-0000-000000000002', 'si-admin2@example.com'),
  ('22000000-0000-0000-0000-000000000003', 'si-staff1@example.com'),
  ('22000000-0000-0000-0000-000000000004', 'si-outsider@example.com');

insert into public.profiles (id, username)
values
  ('22000000-0000-0000-0000-000000000001', 'si-admin1'),
  ('22000000-0000-0000-0000-000000000002', 'si-admin2'),
  ('22000000-0000-0000-0000-000000000003', 'si-staff1'),
  ('22000000-0000-0000-0000-000000000004', 'si-outsider');

insert into public.organization_members (user_id, organization_id, role)
values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'admin'),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'admin'),
  ('22000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000001', 'staff');

insert into public.services (id, organization_id, name)
values
  ('42000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'Image Service One'),
  ('42000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'Image Service Two'),
  ('42000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000003', 'Image Service Three'),
  ('42000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000001', 'Image Service To Delete');

-- The first image is deliberately second in sort order.
insert into public.service_images (id, service_id, path, alt_text, sort_order)
values
  ('62000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'test/one/first.jpg', 'First image', 1),
  ('62000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'test/one/second.png', null, 0),
  ('62000000-0000-0000-0000-000000000005', '42000000-0000-0000-0000-000000000004', 'test/delete/first.jpg', null, 0);

-- No sort_order given, so the default applies.
insert into public.service_images (id, service_id, path, alt_text)
values
  ('62000000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000002', 'test/two/first.jpg', 'Other organization image');

-- Organization Three stops working with us after its service was created.
update public.organizations
set deactivated_at = now()
where id = '12000000-0000-0000-0000-000000000003';

-- Schema and privileges

select has_table('public', 'service_images', 'service_images exists');

select ok(
  not has_table_privilege('anon', 'public.service_images', 'select')
  and not has_table_privilege('anon', 'public.service_images', 'insert')
  and not has_table_privilege('anon', 'public.service_images', 'update')
  and not has_table_privilege('anon', 'public.service_images', 'delete')
  and not has_any_column_privilege('anon', 'public.service_images', 'insert')
  and not has_any_column_privilege('anon', 'public.service_images', 'update')
  and has_column_privilege('anon', 'public.service_images', 'id', 'select')
  and has_column_privilege('anon', 'public.service_images', 'service_id', 'select')
  and has_column_privilege('anon', 'public.service_images', 'path', 'select')
  and has_column_privilege('anon', 'public.service_images', 'alt_text', 'select')
  and has_column_privilege('anon', 'public.service_images', 'sort_order', 'select')
  and has_column_privilege('anon', 'public.service_images', 'created_at', 'select'),
  'anon has only column-level select on service images'
);
select ok(
  has_table_privilege('authenticated', 'public.service_images', 'select')
  and not has_table_privilege('authenticated', 'public.service_images', 'insert')
  and not has_table_privilege('authenticated', 'public.service_images', 'update')
  and not has_table_privilege('authenticated', 'public.service_images', 'delete')
  and not has_any_column_privilege('authenticated', 'public.service_images', 'insert')
  and not has_any_column_privilege('authenticated', 'public.service_images', 'update'),
  'authenticated users can only select service images'
);
select ok(
  has_table_privilege('service_role', 'public.service_images', 'select')
  and has_table_privilege('service_role', 'public.service_images', 'insert')
  and has_table_privilege('service_role', 'public.service_images', 'update')
  and has_table_privilege('service_role', 'public.service_images', 'delete'),
  'service_role can select, insert, update and delete service images'
);
select ok(
  not has_function_privilege('anon', 'private.ensure_service_image_organization_active()', 'execute')
  and not has_function_privilege('authenticated', 'private.ensure_service_image_organization_active()', 'execute'),
  'anon and authenticated cannot execute the service image trigger function'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.service_images'::regclass),
  'service_images has RLS enabled'
);

-- Storage bucket

select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'service-images'$$,
  $$values (true, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])$$,
  'the service-images bucket is public, limited to 5 MiB and to image types'
);
select is_empty(
  $$select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles && array['public', 'anon', 'authenticated']::name[]$$,
  'no storage.objects policy lets anon or authenticated list or write objects'
);

-- Constraints and triggers

select throws_ok(
  $$insert into public.service_images (service_id, path) values ('42000000-0000-0000-0000-000000000002', 'test/one/first.jpg')$$,
  '23505',
  null,
  'image paths are unique'
);
select throws_ok(
  $$insert into public.service_images (service_id, path) values ('42000000-0000-0000-0000-000000000001', '   ')$$,
  '23514',
  null,
  'image paths cannot be blank'
);
select throws_ok(
  $$insert into public.service_images (service_id, path) values ('42000000-0000-0000-0000-000000000001', '/test/one/third.jpg')$$,
  '23514',
  null,
  'image paths cannot start with a slash'
);
select throws_ok(
  $$insert into public.service_images (service_id, path, alt_text) values ('42000000-0000-0000-0000-000000000001', 'test/one/third.jpg', '  ')$$,
  '23514',
  null,
  'alt text cannot be blank when present'
);
select throws_ok(
  $$insert into public.service_images (service_id, path, sort_order) values ('42000000-0000-0000-0000-000000000001', 'test/one/third.jpg', -1)$$,
  '23514',
  null,
  'sort order cannot be negative'
);
select results_eq(
  $$select sort_order from public.service_images where id = '62000000-0000-0000-0000-000000000003'$$,
  array[0],
  'sort order defaults to 0'
);
select throws_ok(
  $$insert into public.service_images (service_id, path) values ('42000000-0000-0000-0000-000000000003', 'test/three/first.jpg')$$,
  'P0001',
  'Organization is deactivated',
  'images cannot be added for a deactivated organization'
);
select lives_ok(
  $$delete from public.services where id = '42000000-0000-0000-0000-000000000004'$$,
  'a service with images can be deleted'
);
select is_empty(
  $$select id from public.service_images where id = '62000000-0000-0000-0000-000000000005'$$,
  'deleting a service deletes its image rows'
);

-- Anonymous users

-- The "read all" check filters to this file's fixture ID prefix, because the
-- database may already hold rows from supabase/seed.sql.
set local role anon;

select results_eq(
  $$select id::text || ':' || path || ':' || coalesce(alt_text, '') || ':' || sort_order::text || ':' || (created_at is not null)::text
    from public.service_images where id::text like '62000000-%' order by id$$,
  array[
    '62000000-0000-0000-0000-000000000001:test/one/first.jpg:First image:1:true',
    '62000000-0000-0000-0000-000000000002:test/one/second.png::0:true',
    '62000000-0000-0000-0000-000000000003:test/two/first.jpg:Other organization image:0:true'
  ],
  'anonymous users read all service images'
);
select throws_ok(
  $$insert into public.service_images (service_id, path) values ('42000000-0000-0000-0000-000000000001', 'test/one/anon.jpg')$$,
  '42501',
  null,
  'anonymous users cannot insert service images'
);
select throws_ok(
  $$update public.service_images set alt_text = 'changed' where id = '62000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot update service images'
);
select throws_ok(
  $$delete from public.service_images where id = '62000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'anonymous users cannot delete service images'
);

-- Organization admin

set local role authenticated;
set local request.jwt.claim.sub = '22000000-0000-0000-0000-000000000001';

select results_eq(
  $$select id::text from public.service_images order by sort_order, created_at$$,
  array['62000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001'],
  'an admin reads only images of their organization services, in sort order'
);
select throws_ok(
  $$insert into public.service_images (service_id, path) values ('42000000-0000-0000-0000-000000000001', 'test/one/admin.jpg')$$,
  '42501',
  null,
  'an admin cannot insert service images directly'
);
select throws_ok(
  $$update public.service_images set alt_text = 'changed' where id = '62000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'an admin cannot update service images directly'
);
select throws_ok(
  $$delete from public.service_images where id = '62000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'an admin cannot delete service images directly'
);

-- Organization staff

set local request.jwt.claim.sub = '22000000-0000-0000-0000-000000000003';

select results_eq(
  $$select id::text from public.service_images order by id$$,
  array['62000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000002'],
  'staff read only images of their organization services'
);

-- Other organization admin

set local request.jwt.claim.sub = '22000000-0000-0000-0000-000000000002';

select results_eq(
  $$select id::text from public.service_images order by id$$,
  array['62000000-0000-0000-0000-000000000003'],
  'another organization admin reads only their own organization images'
);

-- User without a membership

set local request.jwt.claim.sub = '22000000-0000-0000-0000-000000000004';

select is_empty(
  $$select id from public.service_images$$,
  'a user without a membership reads no service images'
);

-- Service role writes (the future upload Edge Function uses this role)

reset role;
set local role service_role;

select lives_ok(
  $$insert into public.service_images (id, service_id, path) values ('62000000-0000-0000-0000-000000000004', '42000000-0000-0000-0000-000000000002', 'test/two/second.png')$$,
  'service_role can insert a service image'
);
select lives_ok(
  $$update public.service_images set alt_text = 'Described later', sort_order = 3 where id = '62000000-0000-0000-0000-000000000004'$$,
  'service_role can update a service image'
);
select results_eq(
  $$select alt_text || ':' || sort_order::text from public.service_images where id = '62000000-0000-0000-0000-000000000004'$$,
  array['Described later:3'],
  'the service_role update is persisted'
);
select lives_ok(
  $$update public.service_images set service_id = '42000000-0000-0000-0000-000000000001' where id = '62000000-0000-0000-0000-000000000004'$$,
  'service_role can move an image to another service'
);
select lives_ok(
  $$delete from public.service_images where id = '62000000-0000-0000-0000-000000000004'$$,
  'service_role can delete a service image'
);

reset role;

select * from finish();
rollback;
