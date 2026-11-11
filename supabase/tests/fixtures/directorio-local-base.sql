-- Esquema mínimo desechable para ejecutar la migración en PostgreSQL/PostGIS local.
-- No usar contra Supabase remoto.
do $$ begin
  create role anon nologin;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role service_role nologin;
exception when duplicate_object then null;
end $$;
create schema auth;
create schema clinical;
create schema extensions;
create extension postgis with schema extensions;

create table auth.users (
  id uuid primary key, aud text not null default 'authenticated', is_anonymous boolean not null default false,
  confirmed_at timestamptz, deleted_at timestamptz, banned_until timestamptz, raw_app_meta_data jsonb not null default '{}'
);
create table auth.sessions (id uuid primary key, user_id uuid not null, aal text not null, not_after timestamptz, factor_id uuid);
create table auth.mfa_factors (id uuid primary key, user_id uuid not null, status text not null, factor_type text not null);
create table auth.mfa_amr_claims (session_id uuid not null, authentication_method text not null, updated_at timestamptz not null);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create table clinical.clinics (id uuid primary key, status text not null);
create table clinical.professional_accounts (id uuid primary key, user_id uuid not null, dentist_id uuid not null, status text not null);
create table clinical.clinic_memberships (
  id uuid primary key, professional_id uuid not null, clinic_id uuid not null, status text not null,
  valid_from timestamptz not null, valid_until timestamptz
);
create table public.dentists (
  id uuid primary key, name text not null, is_active boolean not null, is_demo boolean not null
);
create table public.appointment_requests (
  id uuid primary key, user_id uuid not null, dentist_id uuid not null, is_demo boolean not null, status text not null
);
create table public.preexisting_sentinel(id integer primary key, note text not null);
insert into public.preexisting_sentinel values (1, 'conservar tras rollback');

grant usage on schema auth, clinical, extensions to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
grant select on auth.users, auth.sessions, auth.mfa_factors, auth.mfa_amr_claims to anon, authenticated, service_role;
grant select on clinical.clinics, clinical.professional_accounts, clinical.clinic_memberships to anon, authenticated, service_role;
grant select on public.dentists, public.appointment_requests to anon, authenticated, service_role;

insert into auth.users values
 ('11111111-1111-4111-8111-111111111111','authenticated',false,now(),null,null,'{"dentaia":{"version":"1","estado":"activo","roles":["superusuario"]}}'),
 ('22222222-2222-4222-8222-222222222222','authenticated',false,now(),null,null,'{"dentaia":{"version":"1","estado":"activo","roles":["paciente"]}}'),
 ('33333333-3333-4333-8333-333333333333','authenticated',false,now(),null,null,'{"dentaia":{"version":"1","estado":"activo","roles":["odontologo"]}}');
insert into auth.mfa_factors values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','verified','totp');
insert into auth.sessions values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','aal2',now()+interval '1 hour','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into auth.mfa_amr_claims values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','totp',now());
insert into public.dentists values
 ('44444444-4444-4444-8444-444444444444','Profesional sintético A',true,false),
 ('55555555-5555-4555-8555-555555555555','Profesional sintético B',true,false),
 ('66666666-6666-4666-8666-666666666666','Perfil demo',true,true);
insert into clinical.clinics values ('77777777-7777-4777-8777-777777777777','active');
insert into clinical.professional_accounts values
 ('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','verified');
insert into clinical.clinic_memberships values
 ('99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777','active',now()-interval '1 day',null);
insert into public.appointment_requests values
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',false,'completed'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',false,'completed'),
 ('cccccccc-1111-4111-8111-cccccccccccc','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',true,'completed');
