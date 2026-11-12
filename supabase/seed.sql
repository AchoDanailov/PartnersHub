-- Local development and CI seed data.
--
-- Loaded automatically after migrations by `npx supabase start` (fresh database)
-- and `npx supabase db reset`. Never run it against a hosted project.
--
-- Every seeded user signs in with the local-only password `password123`.
--
-- Fixed IDs, so tests and smoke checks can reference known rows. The prefixes
-- differ from the pgTAP fixtures in supabase/tests (1x/2x/4x/5x):
--   a1000000-... organizations
--   a2000000-... users (auth.users, auth.identities, profiles, organization_members)
--   a4000000-... services
--   a5000000-... vouchers
--   a6000000-... service images
--
-- Alpine Wellness
--   admin:    admin@alpine.example.com
--   staff:    staff-1@alpine.example.com, staff-2@alpine.example.com
--   services: Massage (3 images), Sauna (2 images)
-- Harbor Fitness
--   admin:    admin@harbor.example.com
--   staff:    staff-1@harbor.example.com
--   services: Day Pass (2 images)
-- Cedar Studio
--   admin:    admin@cedar.example.com
--   staff:    staff-1@cedar.example.com
--   services: Yoga Class (1 image), Pilates Class (no images)

insert into public.organizations (id, name)
values
  ('a1000000-0000-0000-0000-000000000001', 'Alpine Wellness'),
  ('a1000000-0000-0000-0000-000000000002', 'Harbor Fitness'),
  ('a1000000-0000-0000-0000-000000000003', 'Cedar Studio');

-- Confirmed email/password users. GoTrue's password grant fails when the token
-- columns are NULL, so they are set to empty strings.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  seeded.id,
  'authenticated',
  'authenticated',
  seeded.email,
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from (
  values
    ('a2000000-0000-0000-0000-000000000001'::uuid, 'admin@alpine.example.com'),
    ('a2000000-0000-0000-0000-000000000002'::uuid, 'staff-1@alpine.example.com'),
    ('a2000000-0000-0000-0000-000000000003'::uuid, 'staff-2@alpine.example.com'),
    ('a2000000-0000-0000-0000-000000000004'::uuid, 'admin@harbor.example.com'),
    ('a2000000-0000-0000-0000-000000000005'::uuid, 'staff-1@harbor.example.com'),
    ('a2000000-0000-0000-0000-000000000006'::uuid, 'admin@cedar.example.com'),
    ('a2000000-0000-0000-0000-000000000007'::uuid, 'staff-1@cedar.example.com')
) as seeded (id, email);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  users.id,
  users.id,
  users.id::text,
  'email',
  jsonb_build_object(
    'sub', users.id::text,
    'email', users.email,
    'email_verified', true
  ),
  now(),
  now(),
  now()
from auth.users as users
where users.id::text like 'a2000000-%';

insert into public.profiles (id, username)
values
  ('a2000000-0000-0000-0000-000000000001', 'alpine-admin'),
  ('a2000000-0000-0000-0000-000000000002', 'alpine-staff-1'),
  ('a2000000-0000-0000-0000-000000000003', 'alpine-staff-2'),
  ('a2000000-0000-0000-0000-000000000004', 'harbor-admin'),
  ('a2000000-0000-0000-0000-000000000005', 'harbor-staff-1'),
  ('a2000000-0000-0000-0000-000000000006', 'cedar-admin'),
  ('a2000000-0000-0000-0000-000000000007', 'cedar-staff-1');

insert into public.organization_members (user_id, organization_id, role)
values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'admin'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'staff'),
  ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'staff'),
  ('a2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'admin'),
  ('a2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'staff'),
  ('a2000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003', 'admin'),
  ('a2000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000003', 'staff');

insert into public.services (id, organization_id, name)
values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Massage'),
  ('a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Sauna'),
  ('a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'Day Pass'),
  ('a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 'Yoga Class'),
  ('a4000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', 'Pilates Class');

-- Dates are relative to the seeding day so the data does not go stale.
-- Each organization has an active, a redeemed, a cancelled and an expired voucher.
-- An expired voucher stays 'active' with an `expires_on` in the past. It was
-- created before that date to satisfy vouchers_expires_after_created.
insert into public.vouchers (
  id,
  redemption_code,
  service_id,
  status,
  expires_on,
  created_at,
  redeemed_by,
  redeemed_at
)
values
  -- Alpine Wellness: Massage
  ('a5000000-0000-0000-0000-000000000001', 'ALPINE-MASSAGE-0001', 'a4000000-0000-0000-0000-000000000001', 'active', current_date + 90, now(), null, null),
  ('a5000000-0000-0000-0000-000000000002', 'ALPINE-MASSAGE-0002', 'a4000000-0000-0000-0000-000000000001', 'redeemed', current_date + 90, now() - interval '7 days', 'a2000000-0000-0000-0000-000000000002', now() - interval '2 days'),
  ('a5000000-0000-0000-0000-000000000003', 'ALPINE-MASSAGE-0003', 'a4000000-0000-0000-0000-000000000001', 'cancelled', current_date + 90, now(), null, null),
  -- Alpine Wellness: Sauna
  ('a5000000-0000-0000-0000-000000000004', 'ALPINE-SAUNA-0001', 'a4000000-0000-0000-0000-000000000002', 'active', current_date + 90, now(), null, null),
  ('a5000000-0000-0000-0000-000000000005', 'ALPINE-SAUNA-0002', 'a4000000-0000-0000-0000-000000000002', 'active', current_date - 30, now() - interval '60 days', null, null),
  -- Harbor Fitness: Day Pass
  ('a5000000-0000-0000-0000-000000000006', 'HARBOR-DAYPASS-0001', 'a4000000-0000-0000-0000-000000000003', 'active', current_date + 90, now(), null, null),
  ('a5000000-0000-0000-0000-000000000007', 'HARBOR-DAYPASS-0002', 'a4000000-0000-0000-0000-000000000003', 'redeemed', current_date + 90, now() - interval '7 days', 'a2000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  ('a5000000-0000-0000-0000-000000000008', 'HARBOR-DAYPASS-0003', 'a4000000-0000-0000-0000-000000000003', 'cancelled', current_date + 90, now(), null, null),
  ('a5000000-0000-0000-0000-000000000009', 'HARBOR-DAYPASS-0004', 'a4000000-0000-0000-0000-000000000003', 'active', current_date - 30, now() - interval '60 days', null, null),
  -- Cedar Studio: Yoga Class
  ('a5000000-0000-0000-0000-000000000010', 'CEDAR-YOGA-0001', 'a4000000-0000-0000-0000-000000000004', 'active', current_date + 90, now(), null, null),
  ('a5000000-0000-0000-0000-000000000011', 'CEDAR-YOGA-0002', 'a4000000-0000-0000-0000-000000000004', 'redeemed', current_date + 90, now() - interval '7 days', 'a2000000-0000-0000-0000-000000000007', now() - interval '2 days'),
  -- Cedar Studio: Pilates Class
  ('a5000000-0000-0000-0000-000000000012', 'CEDAR-PILATES-0001', 'a4000000-0000-0000-0000-000000000005', 'active', current_date + 90, now(), null, null),
  ('a5000000-0000-0000-0000-000000000013', 'CEDAR-PILATES-0002', 'a4000000-0000-0000-0000-000000000005', 'cancelled', current_date + 90, now(), null, null),
  ('a5000000-0000-0000-0000-000000000014', 'CEDAR-PILATES-0003', 'a4000000-0000-0000-0000-000000000005', 'active', current_date - 30, now() - interval '60 days', null, null);

-- Service images. Each path is an object in the public service-images bucket,
-- following <organization_id>/<service_id>/<image_id>.<ext>. The files live in
-- supabase/seed/service-images and are uploaded by the CLI (see the
-- [storage.buckets.service-images] block in config.toml). They are original
-- illustrations drawn for this repository: no real logos, brands or photos.
-- `created_at` is staggered so ordering by it is stable. Pilates Class has no
-- images on purpose, to cover the empty state.
insert into public.service_images (id, service_id, path, alt_text, created_at)
values
  ('a6000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001/a6000000-0000-0000-0000-000000000001.jpg', 'Smooth dark massage stones stacked beside a rolled white towel, with mountains in the background', now() - interval '8 minutes'),
  ('a6000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001/a6000000-0000-0000-0000-000000000002.png', 'Massage table with folded towels in a bright room with plants and a mountain view', now() - interval '7 minutes'),
  ('a6000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001/a6000000-0000-0000-0000-000000000003.jpg', 'Massage oil bottles, a jar and a lit candle on a wooden shelf', now() - interval '6 minutes'),
  ('a6000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000002/a6000000-0000-0000-0000-000000000004.jpg', 'Wooden sauna benches with folded towels, a birch whisk and a water bucket', now() - interval '5 minutes'),
  ('a6000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000002/a6000000-0000-0000-0000-000000000005.png', 'Sauna stove with hot stones and rising steam, next to a wooden bucket and ladle', now() - interval '4 minutes'),
  ('a6000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002/a4000000-0000-0000-0000-000000000003/a6000000-0000-0000-0000-000000000006.png', 'Rack of dumbbells with an exercise ball and two kettlebells in a gym', now() - interval '3 minutes'),
  ('a6000000-0000-0000-0000-000000000007', 'a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002/a4000000-0000-0000-0000-000000000003/a6000000-0000-0000-0000-000000000007.jpg', 'Treadmill facing a large window with a view of the sea, a sailboat and a lighthouse at sunrise', now() - interval '2 minutes'),
  ('a6000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003/a4000000-0000-0000-0000-000000000004/a6000000-0000-0000-0000-000000000008.jpg', 'Yoga mat with a meditation cushion and blocks in a sunlit studio with an arched window', now() - interval '1 minutes');
