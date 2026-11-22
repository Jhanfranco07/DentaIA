-- Isolated PostgreSQL fixture for the columns, grants and RLS used by BM25.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table auth.users (
  id uuid primary key, aud text default 'authenticated', is_anonymous boolean default false,
  confirmed_at timestamptz default now(), banned_until timestamptz, deleted_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb
);
grant usage on schema auth to anon, authenticated, service_role;

create table public.dentists (
  id uuid primary key, slug text unique not null, name text not null, specialty text not null, district text not null,
  consultation_price numeric default 0, currency text default 'PEN', initials text default ' QA',
  avatar_color text default '#fff', description text default '', is_demo boolean default false,
  is_active boolean default true, created_at timestamptz default now()
);
create table public.dentist_services (
  id uuid primary key default gen_random_uuid(), dentist_id uuid not null references public.dentists(id),
  name text not null, description text, sort_order integer not null default 0, is_active boolean not null default true
);
create table public.dentist_public_locations (
  id uuid primary key default gen_random_uuid(), dentist_id uuid not null references public.dentists(id),
  practice_name text not null, practice_address text not null, latitude double precision not null,
  longitude double precision not null, created_at timestamptz default now(), publication_status text not null default 'published'
);
create table public.dentist_reviews (
  id uuid primary key default gen_random_uuid(), dentist_id uuid not null references public.dentists(id),
  rating smallint not null, comment text default '', created_at timestamptz default now(),
  moderation_status text default 'published'
);
create table public.directory_demo_locations (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, district text not null,
  city text default 'Lima', country text default 'Perú', latitude double precision, longitude double precision,
  is_demo boolean default true, is_published boolean default true, requests_enabled boolean default false,
  public_label text default 'Solo referencia'
);
create table public.profiles (id uuid primary key references auth.users, full_name text not null);
create table public.appointment_requests (
  id uuid primary key, user_id uuid not null references auth.users, dentist_id uuid references public.dentists,
  contact_name text not null, contact_email text default 'test@example.test', preferred_date date not null, preferred_time time,
  message text not null default '', status text not null default 'requested', is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.dentists enable row level security;
alter table public.dentist_services enable row level security;
alter table public.dentist_public_locations enable row level security;
alter table public.dentist_reviews enable row level security;
alter table public.directory_demo_locations enable row level security;
alter table public.profiles enable row level security;
alter table public.appointment_requests enable row level security;
grant select on public.dentists, public.dentist_services, public.directory_demo_locations to anon, authenticated;
grant select (id, dentist_id, practice_name, practice_address, latitude, longitude, created_at)
  on public.dentist_public_locations to anon, authenticated;
grant select (id, dentist_id, rating, comment, created_at) on public.dentist_reviews to anon, authenticated;
grant select on public.appointment_requests, public.profiles to authenticated;
grant insert, update on public.appointment_requests to authenticated;
create policy read_dentist on public.dentists for select to anon, authenticated using (is_active);
create policy read_services on public.dentist_services for select to anon, authenticated using (is_active);
create policy read_location on public.dentist_public_locations for select to anon, authenticated using (
  publication_status = 'published' and exists (select 1 from public.dentists d where d.id = dentist_id and not d.is_demo)
);
create policy read_reviews on public.dentist_reviews for select to anon, authenticated using (
  moderation_status = 'published' and exists (select 1 from public.dentists d where d.id = dentist_id)
);
create policy read_demo on public.directory_demo_locations for select to anon, authenticated
  using (is_demo and is_published and not requests_enabled);
create policy read_profiles on public.profiles for select to authenticated using (id = auth.uid());
create policy read_requests on public.appointment_requests for select to authenticated using (user_id = auth.uid());
create policy insert_requests on public.appointment_requests for insert to authenticated with check (user_id = auth.uid());
create policy cancel_requests on public.appointment_requests for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'cancelled');

insert into auth.users (id, raw_app_meta_data, banned_until) values
  ('aa000000-0000-4000-8000-000000000001', '{"dentaia":{"version":1,"estado":"activo","roles":["paciente"]}}', null),
  ('aa000000-0000-4000-8000-000000000002', '{"dentaia":{"version":1,"estado":"suspendido","roles":["odontologo"]}}', now() + interval '1 day'),
  ('aa000000-0000-4000-8000-000000000003', '{}', null),
  ('aa000000-0000-4000-8000-000000000004', '{"dentaia":{"version":1,"estado":"activo","roles":["paciente","paciente"]}}', null);
insert into public.profiles values
  ('aa000000-0000-4000-8000-000000000001', 'Lucía Cárdenas'),
  ('aa000000-0000-4000-8000-000000000002', 'Lucía Márquez del Castillo'),
  ('aa000000-0000-4000-8000-000000000004', 'Cárdenas');
insert into public.dentists (id, slug, name, specialty, district, description, is_active) values
  ('bb000000-0000-4000-8000-000000000001', 'luz', 'Luz Cuadrante', 'Ortodoncia', 'Lima', 'Atención especializada', true),
  ('bb000000-0000-4000-8000-000000000002', 'eva', 'Eva Espejo', 'Odontología general', 'Cusco', 'Cuadrante de referencia', true),
  ('bb000000-0000-4000-8000-000000000003', 'oculto', 'Secretoautorizado', 'Ortodoncia', 'Lima', '', false);
insert into public.dentist_services (dentist_id,name,is_active) values
  ('bb000000-0000-4000-8000-000000000001','Blanqueamiento dental',true),
  ('bb000000-0000-4000-8000-000000000001','Claveborrador',false);
insert into public.dentist_public_locations (dentist_id,practice_name,practice_address,latitude,longitude,publication_status) values
  ('bb000000-0000-4000-8000-000000000001','Luz visible','Avenida publicada',-12.05,-77.043,'published'),
  ('bb000000-0000-4000-8000-000000000001','Punto privado','Dirección privada',-12.05,-77.04,'hidden'),
  ('bb000000-0000-4000-8000-000000000002','Eva visible','Avenida distante',-13.53,-71.96,'published');
insert into public.directory_demo_locations (slug,name,district,latitude,longitude) values
  ('odontologo-demo-s6-09','Centro Odontológico Universidad Wiener','Lima',-12.069504,-77.037002);
insert into public.dentist_reviews (dentist_id, rating, moderation_status) values
  ('bb000000-0000-4000-8000-000000000001',5,'published'),
  ('bb000000-0000-4000-8000-000000000001',1,'pending');
insert into public.appointment_requests (id,user_id,dentist_id,contact_name,preferred_date,message,status,created_at) values
  ('cc000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001',
    'Lucía Cárdenas','2030-03-08','Horario matutino','requested','2026-01-01'),
  ('cc000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000002',
    'Lucía Cárdenas','2030-03-09','Horario','cancelled','2026-01-02'),
  ('cc000000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000001',
    'Privadocontacto','2030-03-10','Privadomensaje','requested','2026-01-03');
