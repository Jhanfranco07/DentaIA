-- Propuesta local para mapa público y reseñas con interacción elegible.
-- No aplicar a Supabase remoto sin revisión y autorización.
begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create schema dentaia_locations_admin;
revoke all on schema dentaia_locations_admin from public, anon, authenticated, service_role;
comment on schema dentaia_locations_admin is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Esquema privado para auditoría y funciones administrativas.';

create table dentaia_locations_admin.auditoria_ubicaciones (
  solicitud_id uuid primary key,
  actor_id uuid not null,
  operacion text not null check (operacion in ('guardar', 'publicar', 'ocultar', 'retirar')),
  entrada jsonb not null,
  resultado jsonb not null,
  registrada_en timestamptz not null default clock_timestamp()
);
alter table dentaia_locations_admin.auditoria_ubicaciones enable row level security;
revoke all on table dentaia_locations_admin.auditoria_ubicaciones from public, anon, authenticated, service_role;
comment on table dentaia_locations_admin.auditoria_ubicaciones is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Auditoría privada e inmutable de administración de sedes.';

create function dentaia_locations_admin.impedir_edicion_auditoria_ubicaciones()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  raise exception 'AUDITORIA_INMUTABLE' using errcode = '42501';
end
$function$;
revoke all on function dentaia_locations_admin.impedir_edicion_auditoria_ubicaciones() from public, anon, authenticated, service_role;
comment on function dentaia_locations_admin.impedir_edicion_auditoria_ubicaciones() is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Trigger que impide editar auditoría de sedes.';
create trigger impedir_edicion_auditoria_ubicaciones
  before update or delete on dentaia_locations_admin.auditoria_ubicaciones
  for each row execute function dentaia_locations_admin.impedir_edicion_auditoria_ubicaciones();

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
    check (publication_status in ('pending', 'published', 'hidden', 'retired')),
  verified_at timestamptz,
  verified_by uuid,
  verification_reference text check (verification_reference is null or length(btrim(verification_reference)) between 8 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dentist_public_locations_unique_clinic unique (dentist_id, clinic_id),
  constraint dentist_public_locations_published_verified check (
    publication_status <> 'published'
    or (verified_at is not null and verified_by is not null and verification_reference is not null)
  )
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

comment on table public.dentist_public_locations is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Ubicaciones de consultorios revisadas y publicadas explícitamente. Sin permisos de escritura desde Data API; no almacena ubicación del paciente.';
comment on column public.dentist_public_locations.clinic_id is
  'Relación interna con clinical.clinics; deliberadamente no se expone en la proyección pública.';
comment on column public.dentist_public_locations.practice_location is
  'Geografía del consultorio derivada de coordenadas revisadas y con índice GiST.';
comment on column public.dentist_public_locations.verification_reference is
  'Referencia de la evidencia revisada por el superusuario; no se expone al directorio público.';

create function dentaia_locations_admin.membresia_vigente(p_dentist_id uuid, p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1
    from clinical.professional_accounts as professional
    join clinical.clinic_memberships as membership on membership.professional_id = professional.id
    join clinical.clinics as clinic on clinic.id = membership.clinic_id
    where professional.dentist_id = p_dentist_id
      and professional.status = 'verified'
      and membership.clinic_id = p_clinic_id
      and membership.status = 'active'
      and membership.valid_from <= statement_timestamp()
      and (membership.valid_until is null or membership.valid_until > statement_timestamp())
      and clinic.status = 'active'
  );
$function$;
revoke all on function dentaia_locations_admin.membresia_vigente(uuid, uuid) from public, anon, authenticated, service_role;
grant usage on schema dentaia_locations_admin to anon, authenticated;
grant execute on function dentaia_locations_admin.membresia_vigente(uuid, uuid) to anon, authenticated;
comment on function dentaia_locations_admin.membresia_vigente(uuid, uuid) is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Predicado reducido de elegibilidad para RLS, sin devolver datos de membresías.';

create function dentaia_locations_admin.ubicacion_publicable(p_location_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1
    from public.dentist_public_locations as location
    join public.dentists as dentist on dentist.id = location.dentist_id
    where location.id = p_location_id
      and location.publication_status = 'published'
      and dentist.is_active is true
      and dentist.is_demo is false
      and dentaia_locations_admin.membresia_vigente(location.dentist_id, location.clinic_id)
  );
$function$;
revoke all on function dentaia_locations_admin.ubicacion_publicable(uuid) from public, anon, authenticated, service_role;
grant execute on function dentaia_locations_admin.ubicacion_publicable(uuid) to anon, authenticated;
comment on function dentaia_locations_admin.ubicacion_publicable(uuid) is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Predicado de visibilidad de una sede; no revela la clínica ni la membresía.';

create policy dentist_public_locations_read_published
  on public.dentist_public_locations for select to anon, authenticated
  using (dentaia_locations_admin.ubicacion_publicable(id));

create function dentaia_locations_admin.gestionar_ubicacion_v1(
  p_solicitud uuid,
  p_operacion text,
  p_ubicacion_id uuid,
  p_dentist_id uuid,
  p_clinic_id uuid,
  p_practice_name text,
  p_practice_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_verification_reference text
) returns jsonb
language plpgsql volatile security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $function$
declare
  actor uuid := auth.uid();
  claims jsonb := auth.jwt();
  metadata jsonb;
  cuenta auth.users;
  solicitud_previa dentaia_locations_admin.auditoria_ubicaciones;
  solicitud_entrada jsonb;
  respuesta jsonb;
  ubicacion_id uuid;
  perfil_activo boolean;
  perfil_demo boolean;
  membresias integer;
  sesion_id uuid;
begin
  if actor is null or jsonb_typeof(claims) is distinct from 'object'
    or claims->>'sub' is distinct from actor::text
    or claims->>'role' is distinct from 'authenticated'
    or claims->>'aal' is distinct from 'aal2'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
    or (claims->>'exp')::bigint <= extract(epoch from clock_timestamp())
    or coalesce(claims->>'session_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_solicitud is null then
    return jsonb_build_object('ok', false, 'status', 401, 'codigo', 'SESION_INVALIDA');
  end if;
  sesion_id := (claims->>'session_id')::uuid;

  select u.* into cuenta from auth.users as u where u.id = actor for share;
  metadata := cuenta.raw_app_meta_data->'dentaia';
  if cuenta.id is null or cuenta.aud <> 'authenticated' or cuenta.is_anonymous is distinct from false
    or cuenta.confirmed_at is null or cuenta.deleted_at is not null
    or (cuenta.banned_until is not null and cuenta.banned_until > clock_timestamp())
    or jsonb_typeof(metadata) is distinct from 'object' or metadata->>'version' <> '1'
    or metadata->>'estado' <> 'activo' or jsonb_typeof(metadata->'roles') is distinct from 'array'
    or not (metadata->'roles' @> '["superusuario"]'::jsonb)
    or not exists (
      select 1 from auth.sessions as session
      join auth.mfa_factors as factor on factor.id = session.factor_id and factor.user_id = session.user_id
      join auth.mfa_amr_claims as amr on amr.session_id = session.id
      where session.id = sesion_id and session.user_id = actor and session.aal::text = 'aal2'
        and (session.not_after is null or session.not_after > clock_timestamp())
        and factor.status::text = 'verified' and factor.factor_type::text = 'totp'
        and amr.authentication_method = 'totp' and amr.updated_at > clock_timestamp() - interval '5 minutes'
      for share of session, factor, amr
    ) then
    return jsonb_build_object('ok', false, 'status', 403, 'codigo', 'ROL_O_MFA_INSUFICIENTE');
  end if;

  if p_operacion is null or p_operacion not in ('guardar', 'publicar', 'ocultar', 'retirar') then
    return jsonb_build_object('ok', false, 'status', 400, 'codigo', 'OPERACION_INVALIDA');
  end if;
  solicitud_entrada := jsonb_build_object('operacion', p_operacion, 'ubicacionId', p_ubicacion_id,
    'dentistId', p_dentist_id, 'clinicId', p_clinic_id, 'practiceName', p_practice_name,
    'practiceAddress', p_practice_address, 'latitude', p_latitude, 'longitude', p_longitude,
    'verificationReference', p_verification_reference);
  select * into solicitud_previa from dentaia_locations_admin.auditoria_ubicaciones
    where solicitud_id = p_solicitud for update;
  if found then
    if solicitud_previa.actor_id = actor and solicitud_previa.entrada = solicitud_entrada then return solicitud_previa.resultado; end if;
    return jsonb_build_object('ok', false, 'status', 409, 'codigo', 'SOLICITUD_REUTILIZADA');
  end if;

  if p_operacion = 'guardar' then
    if p_ubicacion_id is not null or p_dentist_id is null or p_clinic_id is null
      or p_practice_name is null or length(btrim(p_practice_name)) not between 1 and 160
      or p_practice_address is null or length(btrim(p_practice_address)) not between 1 and 300
      or p_latitude is null or p_longitude is null or p_latitude not between -90 and 90
      or p_longitude not between -180 and 180 or p_verification_reference is not null then
      return jsonb_build_object('ok', false, 'status', 400, 'codigo', 'UBICACION_INVALIDA');
    end if;
    select dentist.is_active, dentist.is_demo into perfil_activo, perfil_demo
      from public.dentists as dentist where dentist.id = p_dentist_id for update;
    if not found or perfil_demo is distinct from false then
      return jsonb_build_object('ok', false, 'status', 403, 'codigo', 'PERFIL_NO_PUBLICABLE');
    end if;
    perform professional.id from clinical.professional_accounts as professional
      where professional.dentist_id = p_dentist_id and professional.status = 'verified' for update;
    perform membership.id from clinical.clinic_memberships as membership
      join clinical.clinics as clinic on clinic.id = membership.clinic_id
      where membership.clinic_id = p_clinic_id and membership.status = 'active'
        and membership.valid_from <= statement_timestamp()
        and (membership.valid_until is null or membership.valid_until > statement_timestamp())
        and clinic.status = 'active' for update of membership, clinic;
    select count(*) into membresias from clinical.professional_accounts as professional
      join clinical.clinic_memberships as membership on membership.professional_id = professional.id
      join clinical.clinics as clinic on clinic.id = membership.clinic_id
      where professional.dentist_id = p_dentist_id and professional.status = 'verified'
        and membership.clinic_id = p_clinic_id and membership.status = 'active'
        and membership.valid_from <= statement_timestamp()
        and (membership.valid_until is null or membership.valid_until > statement_timestamp())
        and clinic.status = 'active';
    if membresias <> 1 then return jsonb_build_object('ok', false, 'status', 403, 'codigo', 'VINCULACION_NO_VIGENTE'); end if;
    insert into public.dentist_public_locations(dentist_id, clinic_id, practice_name, practice_address, latitude, longitude,
      publication_status, verified_at, verified_by, verification_reference, updated_at)
    values (p_dentist_id, p_clinic_id, btrim(p_practice_name), btrim(p_practice_address), p_latitude, p_longitude,
      'pending', null, null, null, clock_timestamp())
    on conflict (dentist_id, clinic_id) do update set practice_name = excluded.practice_name,
      practice_address = excluded.practice_address, latitude = excluded.latitude, longitude = excluded.longitude,
      publication_status = 'pending', verified_at = null, verified_by = null, verification_reference = null,
      updated_at = clock_timestamp()
    returning id into ubicacion_id;
    respuesta := jsonb_build_object('ok', true, 'status', 200, 'codigo', 'UBICACION_PENDIENTE', 'ubicacionId', ubicacion_id);
  elsif p_operacion = 'publicar' then
    if p_ubicacion_id is null or p_dentist_id is not null or p_clinic_id is not null
      or p_practice_name is not null or p_practice_address is not null or p_latitude is not null or p_longitude is not null
      or p_verification_reference is null or length(btrim(p_verification_reference)) not between 8 and 500 then
      return jsonb_build_object('ok', false, 'status', 400, 'codigo', 'EVIDENCIA_INVALIDA');
    end if;
    update public.dentist_public_locations as location set publication_status = 'published',
      verified_at = clock_timestamp(), verified_by = actor, verification_reference = btrim(p_verification_reference),
      updated_at = clock_timestamp()
    where location.id = p_ubicacion_id and location.publication_status in ('pending', 'hidden')
      and exists (select 1 from public.dentists as dentist where dentist.id = location.dentist_id
        and dentist.is_active is true and dentist.is_demo is false)
      and dentaia_locations_admin.membresia_vigente(location.dentist_id, location.clinic_id)
    returning location.id into ubicacion_id;
    if not found then return jsonb_build_object('ok', false, 'status', 403, 'codigo', 'UBICACION_NO_ELEGIBLE'); end if;
    respuesta := jsonb_build_object('ok', true, 'status', 200, 'codigo', 'UBICACION_PUBLICADA', 'ubicacionId', ubicacion_id);
  else
    if p_ubicacion_id is null or p_dentist_id is not null or p_clinic_id is not null
      or p_practice_name is not null or p_practice_address is not null or p_latitude is not null
      or p_longitude is not null or p_verification_reference is not null then
      return jsonb_build_object('ok', false, 'status', 400, 'codigo', 'UBICACION_INVALIDA');
    end if;
    update public.dentist_public_locations set publication_status = case when p_operacion = 'ocultar' then 'hidden' else 'retired' end,
      updated_at = clock_timestamp() where id = p_ubicacion_id returning id into ubicacion_id;
    if not found then return jsonb_build_object('ok', false, 'status', 404, 'codigo', 'UBICACION_NO_ENCONTRADA'); end if;
    respuesta := jsonb_build_object('ok', true, 'status', 200,
      'codigo', case when p_operacion = 'ocultar' then 'UBICACION_OCULTA' else 'UBICACION_RETIRADA' end,
      'ubicacionId', ubicacion_id);
  end if;

  insert into dentaia_locations_admin.auditoria_ubicaciones(solicitud_id, actor_id, operacion, entrada, resultado)
    values(p_solicitud, actor, p_operacion, solicitud_entrada, respuesta);
  return respuesta;
end
$function$;
revoke all on function dentaia_locations_admin.gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text)
  from public, anon, authenticated, service_role;
grant usage on schema dentaia_locations_admin to authenticated;
grant execute on function dentaia_locations_admin.gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text)
  to authenticated;
comment on function dentaia_locations_admin.gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text) is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Único escritor de ubicaciones; exige superusuario AAL2 y membresía profesional vigente.';

create function public.dentaia_gestionar_ubicacion_v1(
  p_solicitud uuid, p_operacion text, p_ubicacion_id uuid, p_dentist_id uuid, p_clinic_id uuid,
  p_practice_name text, p_practice_address text, p_latitude double precision, p_longitude double precision,
  p_verification_reference text
) returns jsonb language sql volatile security invoker set search_path = '' as $function$
  select dentaia_locations_admin.gestionar_ubicacion_v1(p_solicitud, p_operacion, p_ubicacion_id,
    p_dentist_id, p_clinic_id, p_practice_name, p_practice_address, p_latitude, p_longitude, p_verification_reference);
$function$;
revoke all on function public.dentaia_gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text)
  from public, anon, authenticated, service_role;
grant execute on function public.dentaia_gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text)
  to authenticated;
comment on function public.dentaia_gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text) is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Superficie RPC limitada de administración de ubicaciones.';

create table public.dentist_reviews (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.dentists(id) on delete restrict,
  appointment_request_id uuid not null references public.appointment_requests(id) on delete cascade,
  author_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  using (
    moderation_status = 'published'
    and exists (
      select 1 from public.dentists as dentist
      where dentist.id = dentist_id and dentist.is_active is true
    )
  );

create policy dentist_reviews_create_after_completed_visit
  on public.dentist_reviews for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and moderation_status = 'pending'
    and (auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'version') = '1'
    and (auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado') = 'activo'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'paciente'
    and not (coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'odontologo')
    and exists (
      select 1
      from public.appointment_requests as request
      where request.id = appointment_request_id
        and request.dentist_id = dentist_reviews.dentist_id
        and request.user_id = (select auth.uid())
        and request.is_demo is false
        and request.status = 'completed'
    )
  );

-- Comprueba el vínculo privado autor↔perfil sin conceder acceso al esquema clínico.
-- La función no queda expuesta como RPC; solo se invoca desde el trigger.
create function public.prevent_professional_self_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if exists (
    select 1
    from clinical.professional_accounts as professional
    where professional.user_id = (select auth.uid())
      and professional.dentist_id = new.dentist_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'No se permite reseñar el perfil profesional propio.';
  end if;
  return new;
end
$function$;

revoke all on function public.prevent_professional_self_review() from public, anon, authenticated, service_role;
comment on function public.prevent_professional_self_review() is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Trigger-only check that blocks review of the author’s own professional profile.';
create trigger dentist_reviews_prevent_self_review
  before insert on public.dentist_reviews
  for each row execute function public.prevent_professional_self_review();

create table public.dentist_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.dentist_reviews(id) on delete cascade,
  reporter_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Una reseña por solicitud elegible; publicación controlada por moderación confiable. Solo se aceptan solicitudes propias no demo y completed. El esquema académico actual admite exclusivamente is_demo=true y requested/cancelled, por lo que no hay interacciones elegibles hasta implementar una fuente de atenciones reales validada. La reseña y sus reportes se eliminan al borrar la cuenta o la solicitud asociada.';
comment on table public.dentist_review_reports is
  'DentaIA migration 20261105160341_add_dentist_locations_and_reviews. Reportes privados de reseñas publicadas. No contiene datos clínicos y no es legible desde el cliente.';
commit;
