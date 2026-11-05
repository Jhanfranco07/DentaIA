-- Propuesta local para mapa público y reseñas con interacción elegible.
-- No aplicar a Supabase remoto sin revisión y autorización.
begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table public.dentist_public_locations (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.dentists(id) on delete restrict,
  clinic_id uuid not null references clinical.clinics(id) on delete restrict,
  practice_name text not null check (length(btrim(practice_name)) between 1 and 160),
  practice_address text not null check (length(btrim(practice_address)) between 1 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  practice_location extensions.geography(point, 4326)
    generated always as (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) stored,
  publication_status text not null default 'pending'
    check (publication_status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dentist_public_locations_unique_clinic unique (dentist_id, clinic_id)
);

create index dentist_public_locations_published_geo_gist
  on public.dentist_public_locations using gist (practice_location)
  where publication_status = 'published';
create index dentist_public_locations_public_profile
  on public.dentist_public_locations (dentist_id, clinic_id)
  where publication_status = 'published';

alter table public.dentist_public_locations enable row level security;
revoke all on table public.dentist_public_locations from public, anon, authenticated, service_role;
grant select (id, dentist_id, practice_name, practice_address, latitude, longitude, created_at)
  on table public.dentist_public_locations to anon, authenticated;
create policy dentist_public_locations_read_published
  on public.dentist_public_locations for select to anon, authenticated
  using (
    publication_status = 'published'
    and exists (
      select 1 from public.dentists as dentist
      where dentist.id = dentist_id and dentist.is_active is true
    )
  );

comment on table public.dentist_public_locations is
  'Ubicaciones de consultorios revisadas y publicadas explícitamente. Sin permisos de escritura desde Data API; no almacena ubicación del paciente.';
comment on column public.dentist_public_locations.clinic_id is
  'Relación interna con clinical.clinics; deliberadamente no se expone en la proyección pública.';
comment on column public.dentist_public_locations.practice_location is
  'Geografía del consultorio derivada de coordenadas revisadas y con índice GiST.';

create table public.dentist_reviews (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.dentists(id) on delete restrict,
  appointment_request_id uuid not null references public.appointment_requests(id) on delete restrict,
  author_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (length(btrim(comment)) between 10 and 1200),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'published', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  constraint dentist_reviews_one_per_interaction unique (appointment_request_id)
);

create index dentist_reviews_published_by_dentist_date
  on public.dentist_reviews (dentist_id, created_at desc)
  where moderation_status = 'published';
create index dentist_reviews_published_by_dentist_rating
  on public.dentist_reviews (dentist_id, rating desc, created_at desc)
  where moderation_status = 'published';

alter table public.dentist_reviews enable row level security;
revoke all on table public.dentist_reviews from public, anon, authenticated, service_role;
grant select (id, dentist_id, rating, comment, created_at)
  on table public.dentist_reviews to anon, authenticated;
grant insert (dentist_id, appointment_request_id, rating, comment)
  on table public.dentist_reviews to authenticated;

create policy dentist_reviews_read_published
  on public.dentist_reviews for select to anon, authenticated
  using (moderation_status = 'published');

create policy dentist_reviews_create_after_completed_visit
  on public.dentist_reviews for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and moderation_status = 'pending'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'paciente'
    and not (coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'odontologo')
    and exists (
      select 1
      from public.appointment_requests as request
      where request.id = appointment_request_id
        and request.dentist_id = dentist_id
        and request.user_id = (select auth.uid())
        and request.is_demo is false
        and request.status = 'completed'
    )
  );

create table public.dentist_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.dentist_reviews(id) on delete restrict,
  reporter_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  category text not null check (category in ('inapropiado', 'spam', 'suplantacion', 'otro')),
  details text not null default '' check (length(details) <= 500),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint dentist_review_reports_one_per_user unique (review_id, reporter_user_id)
);

alter table public.dentist_review_reports enable row level security;
revoke all on table public.dentist_review_reports from public, anon, authenticated, service_role;
grant insert (review_id, category, details)
  on table public.dentist_review_reports to authenticated;

create policy dentist_review_reports_create_for_published_review
  on public.dentist_review_reports for insert to authenticated
  with check (
    reporter_user_id = (select auth.uid())
    and moderation_status = 'pending'
    and exists (
      select 1 from public.dentist_reviews as review
      where review.id = review_id
        and review.moderation_status = 'published'
    )
  );

comment on table public.dentist_reviews is
  'Una reseña por solicitud elegible; publicación controlada por moderación confiable. Las solicitudes académicas no califican.';
comment on table public.dentist_review_reports is
  'Reportes privados de reseñas publicadas. No contiene datos clínicos y no es legible desde el cliente.';

commit;
