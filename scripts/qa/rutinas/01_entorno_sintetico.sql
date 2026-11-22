-- PostgreSQL 17 temporal, únicamente datos sintéticos (nunca producción).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
create schema clinical;
grant usage on schema auth to authenticated, service_role;
grant usage on schema clinical to service_role;

create table auth.users (
  id uuid primary key,
  raw_app_meta_data jsonb not null
);
create function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  $$;
create function auth.jwt() returns jsonb
  language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
  $$;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;

create table public.dentists(id uuid primary key,name text,is_demo boolean not null default false);
create table clinical.professional_accounts(
  id uuid primary key,user_id uuid not null,dentist_id uuid,
  status text not null check(status in('pending','verified','suspended'))
);
create table clinical.clinic_memberships(
  id uuid primary key,clinic_id uuid not null,professional_id uuid not null,
  status text not null, valid_from timestamptz not null, valid_until timestamptz
);
create table clinical.patient_records(
  id uuid primary key,user_id uuid not null,status text not null
);
create table clinical.clinical_access_grants(
  id uuid primary key,patient_id uuid not null,membership_id uuid not null,
  revoked_at timestamptz,expires_at timestamptz not null
);
create table public.oral_care_routine_plans(
  id uuid primary key,plan_key text not null,version integer not null,
  title text not null,published boolean not null,
  valid_from date not null,valid_until date
);
create table public.oral_care_routine_activities(
  id uuid primary key, plan_id uuid not null,activity_key text not null,
  title text not null,time_of_day text not null,sort_order integer not null,
  unique(plan_id,id)
);
create table public.patient_routine_completions(
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,plan_id uuid not null,
  activity_id uuid not null, completion_date date not null
);

insert into auth.users values
('11111111-1111-4111-8111-111111111111',
 '{"dentaia":{"estado":"activo","roles":["paciente"]}}'),
('22222222-2222-4222-8222-222222222222',
 '{"dentaia":{"estado":"activo","roles":["paciente"]}}'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '{"dentaia":{"estado":"activo","roles":["odontologo"]}}'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '{"dentaia":{"estado":"activo","roles":["odontologo"]}}');
insert into public.dentists values
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Odontólogo ficticio A',false);
insert into clinical.professional_accounts values
('abababab-abab-4bab-8bab-abababababab',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','verified'),
('bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'verified');
insert into clinical.clinic_memberships values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'abababab-abab-4bab-8bab-abababababab','active',now()-interval '2 days',null),
('99999999-9999-4999-8999-999999999999',
 'ffffffff-ffff-4fff-8fff-ffffffffffff',
 'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc','active',now()-interval '2 days',null);
insert into clinical.patient_records values
('33333333-3333-4333-8333-333333333333',
 '11111111-1111-4111-8111-111111111111','active'),
('44444444-4444-4444-8444-444444444444',
 '22222222-2222-4222-8222-222222222222','active');
insert into clinical.clinical_access_grants values
('77777777-7777-4777-8777-777777777777',
 '33333333-3333-4333-8333-333333333333',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',null,now()+interval '7 days');
insert into public.oral_care_routine_plans values
('55555555-5555-4555-8555-555555555555','general-preventive',1,
 'Rutina general ficticia',true,current_date-30,null);
insert into public.oral_care_routine_activities values
('66666666-6666-4666-8666-666666666661',
 '55555555-5555-4555-8555-555555555555','cepillado-manana','Cepillado de mañana','morning',1),
('66666666-6666-4666-8666-666666666662',
 '55555555-5555-4555-8555-555555555555','limpieza-interdental','Hilo dental','daytime',2),
('66666666-6666-4666-8666-666666666663',
 '55555555-5555-4555-8555-555555555555','cepillado-noche','Cepillado de noche','evening',3);
grant select,insert on public.patient_routine_completions to service_role;
