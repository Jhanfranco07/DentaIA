begin;

-- Entidad de demostración separada de dentists, clinics, memberships y ubicaciones verificadas.
-- Las coordenadas representan un punto geográfico aproximado de La Molina, no un domicilio.
create table public.directory_demo_locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  name text not null check (length(btrim(name)) between 3 and 120),
  district text not null check (length(btrim(district)) between 2 and 100),
  city text not null check (length(btrim(city)) between 2 and 100),
  country text not null check (length(btrim(country)) between 2 and 100),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_demo boolean not null default true check (is_demo is true),
  is_published boolean not null default false,
  requests_enabled boolean not null default false check (requests_enabled is false),
  public_label text not null check (public_label = 'DEMO — Clínica ficticia, no ofrece atención real'),
  created_at timestamptz not null default now()
);

comment on table public.directory_demo_locations is
  'Puntos cartográficos académicos sin vínculo a odontólogos, clínicas, membresías, domicilios ni solicitudes reales.';
comment on column public.directory_demo_locations.latitude is
  'Coordenada cartográfica representativa de demostración; no es evidencia de domicilio ni ubicación de consultorio.';
comment on column public.directory_demo_locations.longitude is
  'Coordenada cartográfica representativa de demostración; no es evidencia de domicilio ni ubicación de consultorio.';

alter table public.directory_demo_locations enable row level security;
revoke all on table public.directory_demo_locations from public, anon, authenticated, service_role;
grant select (id, slug, name, district, city, country, latitude, longitude, is_demo, is_published, requests_enabled, public_label)
  on table public.directory_demo_locations to anon, authenticated;
create policy directory_demo_locations_read_published
  on public.directory_demo_locations for select to anon, authenticated
  using (is_demo is true and is_published is true and requests_enabled is false);

commit;
