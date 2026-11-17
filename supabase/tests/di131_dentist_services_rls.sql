begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

do $setup$
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('a1310000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'di131-owner-a@example.test', '', now(), '{}', '{}', now(), now()),
    ('a1310000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'di131-owner-b@example.test', '', now(), '{}', '{}', now(), now()),
    ('a1310000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'di131-reviewer@example.test', '', now(), '{}', '{}', now(), now()),
    ('a1310000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'di131-pending@example.test', '', now(), '{}', '{}', now(), now());

  insert into public.dentists (id, slug, name, specialty, district, consultation_price, initials, avatar_color, description)
  values
    ('b1310000-0000-4000-8000-000000000001', 'di131-owner-a', 'DI131 Owner A', 'General', 'QA', 0, 'AA', '#000000', 'Synthetic'),
    ('b1310000-0000-4000-8000-000000000002', 'di131-owner-b', 'DI131 Owner B', 'General', 'QA', 0, 'BB', '#000000', 'Synthetic'),
    ('b1310000-0000-4000-8000-000000000003', 'di131-pending', 'DI131 Pending', 'General', 'QA', 0, 'PP', '#000000', 'Synthetic');

  insert into clinical.professional_accounts (id, user_id, dentist_id, status)
  values
    ('c1310000-0000-4000-8000-000000000001', 'a1310000-0000-4000-8000-000000000001', 'b1310000-0000-4000-8000-000000000001', 'pending'),
    ('c1310000-0000-4000-8000-000000000002', 'a1310000-0000-4000-8000-000000000002', 'b1310000-0000-4000-8000-000000000002', 'pending'),
    ('c1310000-0000-4000-8000-000000000004', 'a1310000-0000-4000-8000-000000000004', 'b1310000-0000-4000-8000-000000000003', 'pending');

  insert into clinical.professional_verifications (professional_id, reviewed_by, decision, reference, reason)
  values
    ('c1310000-0000-4000-8000-000000000001', 'a1310000-0000-4000-8000-000000000003', 'approved', 'DI131-A', 'Synthetic approval'),
    ('c1310000-0000-4000-8000-000000000002', 'a1310000-0000-4000-8000-000000000003', 'approved', 'DI131-B', 'Synthetic approval');

  update clinical.professional_accounts set status = 'verified'
  where id in ('c1310000-0000-4000-8000-000000000001', 'c1310000-0000-4000-8000-000000000002');

  insert into public.dentist_services (id, dentist_id, name, is_active)
  values
    ('d1310000-0000-4000-8000-000000000001', 'b1310000-0000-4000-8000-000000000001', 'Consulta activa A', true),
    ('d1310000-0000-4000-8000-000000000002', 'b1310000-0000-4000-8000-000000000001', 'Consulta interna A', false),
    ('d1310000-0000-4000-8000-000000000003', 'b1310000-0000-4000-8000-000000000002', 'Consulta activa B', true);
end
$setup$;

select ok((select relrowsecurity from pg_class where oid = 'public.dentist_services'::regclass), 'RLS habilitado para dentist_services');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.dentist_services'::regclass and conname = 'dentist_services_dentist_name_unique'), 'unicidad por odontologo y servicio');

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select is((select count(*)::integer from public.dentist_services), 2, 'visitante solo ve servicios activos');
select throws_ok(
  $$insert into public.dentist_services (dentist_id, name) values ('b1310000-0000-4000-8000-000000000001', 'Intento anonimo')$$,
  '42501', 'permission denied for table dentist_services', 'visitante no administra servicios'
);

reset role;
select set_config('request.jwt.claim.sub', 'a1310000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1310000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.dentist_services where dentist_id = 'b1310000-0000-4000-8000-000000000001'), 2, 'odontologo A verificado ve su servicio inactivo');
select lives_ok(
  $$insert into public.dentist_services (dentist_id, name) values ('b1310000-0000-4000-8000-000000000001', 'Control A')$$,
  'odontologo A verificado crea su servicio'
);
select throws_ok(
  $$insert into public.dentist_services (dentist_id, name) values ('b1310000-0000-4000-8000-000000000002', 'Intento sobre B')$$,
  '42501', 'new row violates row-level security policy for table "dentist_services"', 'odontologo A no crea servicios de B'
);
select is((select count(*)::integer from public.dentist_services where dentist_id = 'b1310000-0000-4000-8000-000000000002' and not is_active), 0, 'odontologo A no ve filas inactivas de B');

reset role;
select set_config('request.jwt.claim.sub', 'a1310000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"a1310000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.dentist_services (dentist_id, name) values ('b1310000-0000-4000-8000-000000000003', 'Intento pendiente')$$,
  '42501', 'new row violates row-level security policy for table "dentist_services"', 'cuenta pendiente no administra servicios'
);

reset role;
select * from finish();
rollback;
