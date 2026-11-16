begin;
select plan(20);

insert into public.organizations (id, name)
values
  ('14000000-0000-0000-0000-000000000001', 'Content Organization One'),
  ('14000000-0000-0000-0000-000000000002', 'Content Organization Two'),
  ('14000000-0000-0000-0000-000000000003', 'Content Organization Three');

insert into auth.users (id, email)
values
  ('24000000-0000-0000-0000-000000000001', 'sc-admin1@example.com'),
  ('24000000-0000-0000-0000-000000000002', 'sc-staff1@example.com'),
  ('24000000-0000-0000-0000-000000000003', 'sc-admin2@example.com');

insert into public.profiles (id, username)
values
  ('24000000-0000-0000-0000-000000000001', 'sc-admin1'),
  ('24000000-0000-0000-0000-000000000002', 'sc-staff1'),
  ('24000000-0000-0000-0000-000000000003', 'sc-admin2');

insert into public.organization_members (user_id, organization_id, role)
values
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'admin'),
  ('24000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', 'staff'),
  ('24000000-0000-0000-0000-000000000003', '14000000-0000-0000-0000-000000000002', 'admin');

insert into public.services (id, organization_id, name, tagline, description)
values
  ('44000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'Content Service One', 'Tagline one', 'Description one'),
  ('44000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000002', 'Content Service Two', null, null),
  ('44000000-0000-0000-0000-000000000003', '14000000-0000-0000-0000-000000000003', 'Content Service Three', null, null);

insert into public.service_faqs (id, service_id, question, sort_order)
values
  ('64000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'Question one?', 0),
  ('64000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000001', 'Question two?', 1),
  ('64000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000002', 'Other organization question?', 0);

update public.organizations
set deactivated_at = now()
where id = '14000000-0000-0000-0000-000000000003';

-- Schema and privileges

select ok(
  has_column_privilege('anon', 'public.services', 'tagline', 'select')
  and has_column_privilege('anon', 'public.services', 'description', 'select')
  and not has_column_privilege('anon', 'public.services', 'created_at', 'select'),
  'anon can read the marketing text of services, but not created_at'
);
select ok(
  not has_any_column_privilege('anon', 'public.services', 'update')
  and not has_any_column_privilege('authenticated', 'public.services', 'update'),
  'no one but service_role can change the marketing text'
);
select ok(
  not has_table_privilege('anon', 'public.service_faqs', 'select')
  and not has_any_column_privilege('anon', 'public.service_faqs', 'select'),
  'anon cannot read client questions'
);
select ok(
  has_table_privilege('authenticated', 'public.service_faqs', 'select')
  and not has_table_privilege('authenticated', 'public.service_faqs', 'insert')
  and not has_table_privilege('authenticated', 'public.service_faqs', 'update')
  and not has_table_privilege('authenticated', 'public.service_faqs', 'delete'),
  'authenticated users can only select client questions'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.service_faqs'::regclass),
  'service_faqs has RLS enabled'
);
select ok(
  not has_function_privilege('anon', 'private.ensure_service_faq_organization_active()', 'execute')
  and not has_function_privilege('authenticated', 'private.ensure_service_faq_organization_active()', 'execute'),
  'anon and authenticated cannot execute the client question trigger function'
);

-- Constraints and triggers

select throws_ok(
  $$update public.services set tagline = '  ' where id = '44000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'a tagline cannot be blank when present'
);
select throws_ok(
  $$update public.services set description = '' where id = '44000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'a description cannot be blank when present'
);
select throws_ok(
  $$insert into public.service_faqs (service_id, question, sort_order) values ('44000000-0000-0000-0000-000000000001', '  ', 5)$$,
  '23514',
  null,
  'a question cannot be blank'
);
select throws_ok(
  $$insert into public.service_faqs (service_id, question, sort_order) values ('44000000-0000-0000-0000-000000000001', 'Duplicate position?', 0)$$,
  '23505',
  null,
  'sort order is unique within a service'
);
select throws_ok(
  $$insert into public.service_faqs (service_id, question, sort_order) values ('44000000-0000-0000-0000-000000000003', 'Deactivated?', 0)$$,
  'P0001',
  'Organization is deactivated',
  'questions cannot be added for a deactivated organization'
);
select lives_ok(
  $$update public.service_faqs set sort_order = 1 - sort_order where service_id = '44000000-0000-0000-0000-000000000001'$$,
  'one update can swap two positions'
);

-- Anonymous users

set local role anon;

select results_eq(
  $$select tagline || ':' || description from public.services where id = '44000000-0000-0000-0000-000000000001'$$,
  array['Tagline one:Description one'],
  'anonymous users read the marketing text'
);
select throws_ok(
  $$select id from public.service_faqs$$,
  '42501',
  null,
  'anonymous users cannot read client questions'
);

-- Organization admin

set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-000000000001';

select results_eq(
  $$select id::text from public.service_faqs order by sort_order$$,
  array['64000000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000001'],
  'an admin reads the questions of their organization services, in sort order'
);
select results_eq(
  $$select tagline from public.services where id = '44000000-0000-0000-0000-000000000001'$$,
  array['Tagline one'],
  'members read the marketing text of their services'
);
select throws_ok(
  $$insert into public.service_faqs (service_id, question, sort_order) values ('44000000-0000-0000-0000-000000000001', 'Admin question?', 9)$$,
  '42501',
  null,
  'an admin cannot add questions directly'
);

-- Organization staff

set local request.jwt.claim.sub = '24000000-0000-0000-0000-000000000002';

select is_empty(
  $$select id from public.service_faqs$$,
  'staff cannot read client questions'
);

-- Other organization admin

set local request.jwt.claim.sub = '24000000-0000-0000-0000-000000000003';

select results_eq(
  $$select id::text from public.service_faqs$$,
  array['64000000-0000-0000-0000-000000000003'],
  'another organization admin reads only their own questions'
);

-- Service role writes

reset role;
set local role service_role;

select lives_ok(
  $$insert into public.service_faqs (service_id, question, sort_order) values ('44000000-0000-0000-0000-000000000002', 'Service role question?', 1)$$,
  'service_role can add a question'
);

reset role;

select * from finish();
rollback;
