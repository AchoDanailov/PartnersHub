-- Local development and CI seed data.
--
-- Loaded automatically after migrations by `npx supabase start` (fresh database)
-- and `npx supabase db reset`. Never run it against a hosted project.
--
-- Every seeded user signs in with the local-only password `password123`.
--
-- Пирин СПА
--   admin:    admin@alpine.example.com
--   staff:    staff-1@alpine.example.com, staff-2@alpine.example.com
--   services: Масаж (3 images), Сауна (2 images)
-- Фитнес клуб Черноморец
--   admin:    admin@harbor.example.com
--   staff:    staff-1@harbor.example.com
--   services: Дневна карта (2 images)
-- Студио Равновесие
--   admin:    admin@cedar.example.com
--   staff:    staff-1@cedar.example.com
--   services: Йога (1 image), Пилатес (no images)
--
-- Voucher QR links are stable: /services/<service_id>?t=<qr_token>, with the
-- tokens in the vouchers insert below (a7000000-0000-4000-8000-0000000000NN).

insert into public.organizations (id, name)
values
  ('a1000000-0000-0000-0000-000000000001', 'Пирин СПА'),
  ('a1000000-0000-0000-0000-000000000002', 'Фитнес клуб Черноморец'),
  ('a1000000-0000-0000-0000-000000000003', 'Студио Равновесие');

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

-- Marketing text is plain text; a blank line separates paragraphs.
insert into public.services (id, organization_id, name, tagline, description)
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Масаж',
    'Час само за вас, с топли камъни и изглед към планината.',
    E'Нашите терапевти съчетават класически масаж с топли базалтови камъни, които отпускат мускулите по-дълбоко от ръцете сами. Започваме с кратък разговор, за да разберем къде носите напрежението, и подбираме натиска и маслата според вас.\n\nСлед процедурата ви очаква билков чай в залата за почивка, с гледка към Рила. Елате петнайсет минути по-рано и оставете телефона в шкафчето.'
  ),
  (
    'a4000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'Сауна',
    'Финландска сауна, ледена баня и тишина между тях.',
    E'Сухата финландска сауна е затоплена до 85 градуса, с ароматни масла от бор и евкалипт. Между сесиите ви чакат ледена баня, душ с тропически дъжд и отоплени шезлонги.\n\nВаучерът важи за два часа в зоната. Хавлии, чехли и халат са включени.'
  ),
  (
    'a4000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000002',
    'Дневна карта',
    'Цял ден фитнес с изглед към морето.',
    E'Дневната карта отключва всички зони на Фитнес клуб Черноморец: свободни тежести, кардио пред панорамните прозорци към залива и групови тренировки по график.\n\nАко тренирате при нас за първи път, треньор на смяна ще ви покаже уредите и ще ви помогне да съставите кратка програма за деня.'
  ),
  (
    'a4000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000003',
    'Йога',
    'Бавно утро в светло студио под арковидния прозорец.',
    E'Класовете следват стил хатха, с внимание към дишането и позите, а не към постиженията. Подходящи са и за хора, които никога не са стъпвали на постелка.\n\nПостелки, блокчета и възглавници за медитация има в студиото. Елате с удобни дрехи и празен стомах.'
  ),
  (
    'a4000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000003',
    'Пилатес',
    null,
    null
  );

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
  redeemed_at,
  qr_token
)
values
  -- Пирин СПА: Масаж
  ('a5000000-0000-0000-0000-000000000001', 'BLV-M4S7A1', 'a4000000-0000-0000-0000-000000000001', 'active', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-0000-0000-000000000002', 'BLV-M4S7A2', 'a4000000-0000-0000-0000-000000000001', 'redeemed', current_date + 90, now() - interval '7 days', 'a2000000-0000-0000-0000-000000000002', now() - interval '2 days', 'a7000000-0000-4000-8000-000000000002'),
  ('a5000000-0000-0000-0000-000000000003', 'BLV-M4S7A3', 'a4000000-0000-0000-0000-000000000001', 'cancelled', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000003'),
  -- Пирин СПА: Сауна
  ('a5000000-0000-0000-0000-000000000004', 'BLV-S4UN41', 'a4000000-0000-0000-0000-000000000002', 'active', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000004'),
  ('a5000000-0000-0000-0000-000000000005', 'BLV-S4UN42', 'a4000000-0000-0000-0000-000000000002', 'active', current_date - 30, now() - interval '60 days', null, null, 'a7000000-0000-4000-8000-000000000005'),
  -- Фитнес клуб Черноморец: Дневна карта
  ('a5000000-0000-0000-0000-000000000006', 'BLV-D4YP51', 'a4000000-0000-0000-0000-000000000003', 'active', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000006'),
  ('a5000000-0000-0000-0000-000000000007', 'BLV-D4YP52', 'a4000000-0000-0000-0000-000000000003', 'redeemed', current_date + 90, now() - interval '7 days', 'a2000000-0000-0000-0000-000000000005', now() - interval '2 days', 'a7000000-0000-4000-8000-000000000007'),
  ('a5000000-0000-0000-0000-000000000008', 'BLV-D4YP53', 'a4000000-0000-0000-0000-000000000003', 'cancelled', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000008'),
  ('a5000000-0000-0000-0000-000000000009', 'BLV-D4YP54', 'a4000000-0000-0000-0000-000000000003', 'active', current_date - 30, now() - interval '60 days', null, null, 'a7000000-0000-4000-8000-000000000009'),
  -- Студио Равновесие: Йога
  ('a5000000-0000-0000-0000-000000000010', 'BLV-Y0G4C1', 'a4000000-0000-0000-0000-000000000004', 'active', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000010'),
  ('a5000000-0000-0000-0000-000000000011', 'BLV-Y0G4C2', 'a4000000-0000-0000-0000-000000000004', 'redeemed', current_date + 90, now() - interval '7 days', 'a2000000-0000-0000-0000-000000000007', now() - interval '2 days', 'a7000000-0000-4000-8000-000000000011'),
  -- Студио Равновесие: Пилатес
  ('a5000000-0000-0000-0000-000000000012', 'BLV-P1L4T1', 'a4000000-0000-0000-0000-000000000005', 'active', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000012'),
  ('a5000000-0000-0000-0000-000000000013', 'BLV-P1L4T2', 'a4000000-0000-0000-0000-000000000005', 'cancelled', current_date + 90, now(), null, null, 'a7000000-0000-4000-8000-000000000013'),
  ('a5000000-0000-0000-0000-000000000014', 'BLV-P1L4T3', 'a4000000-0000-0000-0000-000000000005', 'active', current_date - 30, now() - interval '60 days', null, null, 'a7000000-0000-4000-8000-000000000014');

-- Service images. Each path is a file under supabase/seeding/seed/service-images, at
-- <organization_id>/<service_id>/<image_id>.<ext>.
insert into public.service_images (id, service_id, path, alt_text, sort_order)
values
  ('a6000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001/a6000000-0000-0000-0000-000000000001.jpg', 'Smooth dark massage stones stacked beside a rolled white towel, with mountains in the background', 0),
  ('a6000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001/a6000000-0000-0000-0000-000000000002.png', 'Massage table with folded towels in a bright room with plants and a mountain view', 1),
  ('a6000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001/a6000000-0000-0000-0000-000000000003.jpg', 'Massage oil bottles, a jar and a lit candle on a wooden shelf', 2),
  ('a6000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000002/a6000000-0000-0000-0000-000000000004.jpg', 'Wooden sauna benches with folded towels, a birch whisk and a water bucket', 0),
  ('a6000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000002/a6000000-0000-0000-0000-000000000005.png', 'Sauna stove with hot stones and rising steam, next to a wooden bucket and ladle', 1),
  ('a6000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002/a4000000-0000-0000-0000-000000000003/a6000000-0000-0000-0000-000000000006.png', 'Rack of dumbbells with an exercise ball and two kettlebells in a gym', 0),
  ('a6000000-0000-0000-0000-000000000007', 'a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002/a4000000-0000-0000-0000-000000000003/a6000000-0000-0000-0000-000000000007.jpg', 'Treadmill facing a large window with a view of the sea, a sailboat and a lighthouse at sunrise', 1),
  ('a6000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003/a4000000-0000-0000-0000-000000000004/a6000000-0000-0000-0000-000000000008.jpg', 'Yoga mat with a meditation cushion and blocks in a sunlit studio with an arched window', 0);

-- Questions clients often ask about each service. Only the organization admin
-- reads them.
insert into public.service_faqs (service_id, question, sort_order)
values
  ('a4000000-0000-0000-0000-000000000001', 'Колко продължава масажът?', 0),
  ('a4000000-0000-0000-0000-000000000001', 'Мога ли да избера терапевт?', 1),
  ('a4000000-0000-0000-0000-000000000001', 'Подходящ ли е масажът по време на бременност?', 2),
  ('a4000000-0000-0000-0000-000000000002', 'Трябва ли да нося собствена хавлия?', 0),
  ('a4000000-0000-0000-0000-000000000002', 'Има ли отделни часове за мъже и жени?', 1),
  ('a4000000-0000-0000-0000-000000000003', 'Включени ли са груповите тренировки?', 0),
  ('a4000000-0000-0000-0000-000000000003', 'Има ли шкафчета и душове?', 1),
  ('a4000000-0000-0000-0000-000000000004', 'Нужен ли е опит, за да дойда на клас?', 0),
  ('a4000000-0000-0000-0000-000000000004', 'Мога ли да използвам ваучера за друг ден?', 1);
