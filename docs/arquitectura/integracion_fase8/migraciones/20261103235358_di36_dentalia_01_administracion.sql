-- FASE 8: PROPUESTA. Requiere respaldo verificado y aprobación final externa.
-- No aplicar por db push. GUC de aprobación es una guarda operativa, NO prueba criptográfica del proyecto.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $fase8$ DECLARE signature text; BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'TRUSTED_MIGRATION_OPERATOR_REQUIRED'; END IF;
 IF current_database()='postgres' THEN
  IF current_setting('dentaia.integration_target',true) IS DISTINCT FROM 'vwmdknzjyvmsdqpepykz'
   OR current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_final_approved' THEN
   RAISE EXCEPTION 'EXPLICIT_TARGET_AND_FINAL_APPROVAL_REQUIRED'; END IF;
 ELSIF current_database()='dentaia_arch_qa_fase8' THEN
  IF current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_local_simulation'
   OR (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'DENTAIA_PHASE8_SYNTHETIC_ONLY'
  THEN RAISE EXCEPTION 'LOCAL_SIMULATION_MARKER_REQUIRED'; END IF;
 ELSE RAISE EXCEPTION 'TARGET_DATABASE_NOT_APPROVED'; END IF;
 SELECT f.fingerprint INTO signature FROM (SELECT md5(jsonb_build_object(
'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'ordinal',ordinal_position,'type',data_type,'nullable',is_nullable,'default',column_default) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid,true)) ORDER BY c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
'indexes',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
'formatted',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
'acl',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'acl',c.relacl) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
'columnAcl',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'acl',a.attacl) ORDER BY c.relname,a.attname) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
'policies',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) ORDER BY tablename,policyname) FROM pg_policies WHERE schemaname='public')
)::text) AS fingerprint) f;
 IF signature IS DISTINCT FROM '2aea91388f533f07548047d93acf2ebf' THEN RAISE EXCEPTION 'PUBLIC_SCHEMA_DRIFT_ABORT'; END IF;
END $fase8$;
DO $$ BEGIN IF to_regnamespace('dentaia_admin') IS NOT NULL THEN RAISE EXCEPTION 'ADMIN_SCHEMA_ALREADY_EXISTS'; END IF; END $$;
-- DI-151 PARTE 2. PROPUESTA NO APLICADA. Revisar en una base aislada antes de aprobar.
-- No llama HTTP/Auth Admin: la actualización de un campo Auth y su auditoría
-- ocurren en la MISMA transacción PostgreSQL. No altera tablas/políticas de Auth.



create schema dentaia_admin;
revoke all on schema dentaia_admin from public, anon, authenticated, service_role;

create table dentaia_admin.revisiones_roles (
  usuario_id uuid primary key,
  revision integer not null check (revision >= 0)
);
create table dentaia_admin.aprobaciones_roles (
  id uuid primary key,
  actor_id uuid not null,
  objetivo_id uuid not null,
  aprobado_por uuid not null,
  operacion text not null check (operacion in ('asignar','revocar')),
  rol text not null check (rol in ('paciente','odontologo','superusuario')),
  revision_esperada integer not null check (revision_esperada >= 0),
  asignacion_esperada jsonb,
  creada_en timestamptz not null default clock_timestamp(),
  vence_en timestamptz not null,
  consumida_por uuid,
  check (aprobado_por <> actor_id and aprobado_por <> objetivo_id and actor_id <> objetivo_id),
  check (vence_en > creada_en)
);
create table dentaia_admin.auditoria_roles (
  actor_id uuid not null,
  solicitud_id uuid not null,
  objetivo_id uuid not null,
  aprobacion_id uuid not null,
  peticion jsonb not null,
  anterior jsonb,
  posterior jsonb,
  resultado jsonb not null,
  registrada_en timestamptz not null default clock_timestamp(),
  primary key (actor_id, solicitud_id)
);
-- Sin FK a usuarios para conservar la evidencia tras bajas y no bloquear Auth.
-- Ninguna tabla nueva es accesible al cliente ni al rol de servicio directamente.
alter table dentaia_admin.revisiones_roles enable row level security;
alter table dentaia_admin.aprobaciones_roles enable row level security;
alter table dentaia_admin.auditoria_roles enable row level security;
revoke all on all tables in schema dentaia_admin from public, anon, authenticated, service_role;

create function dentaia_admin.asignacion_valida(a jsonb) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select case when jsonb_typeof(a) = 'object' and a->'version' = '1'::jsonb
    and a->>'estado' = 'activo' and jsonb_typeof(a->'roles') = 'array'
    then (select count(*) = 3 from jsonb_object_keys(a))
      and jsonb_array_length(a->'roles') between 1 and 3
      and not exists (select 1 from jsonb_array_elements(a->'roles') as elementos(r)
        where r not in ('"paciente"'::jsonb,'"odontologo"'::jsonb,'"superusuario"'::jsonb))
      and (select count(*) = count(distinct r) from jsonb_array_elements(a->'roles') as elementos(r))
    else false end;
$$;

create function dentaia_admin.cuenta_habilitada(u auth.users) returns boolean
language sql stable security invoker set search_path = '' as $$
  select u.id is not null and u.aud = 'authenticated' and u.is_anonymous is false
    and u.confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= statement_timestamp());
$$;

create function dentaia_admin.auditoria_inmutable() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'AUDITORIA_INMUTABLE' using errcode = '42501';
end;
$$;
create trigger impedir_edicion_auditoria before update or delete on dentaia_admin.auditoria_roles
for each row execute function dentaia_admin.auditoria_inmutable();

create function dentaia_admin.cambiar_roles_v1(p_contexto jsonb, p_peticion jsonb, p_solicitud uuid)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  actor uuid;
  sesion uuid;
  objetivo uuid;
  expira bigint;
  accion text;
  rol_pedido text;
  aprobacion uuid;
  u_actor auth.users;
  u_objetivo auth.users;
  u_aprobador auth.users;
  permiso dentaia_admin.aprobaciones_roles;
  previa dentaia_admin.auditoria_roles;
  actual jsonb;
  nueva jsonb;
  contador integer;
  esperada integer;
  admins integer;
  codigo text := 'CAMBIO_INVALIDO';
  estado_http integer := 400;
  resultado text := 'rechazado';
  respuesta jsonb;
begin
  -- Solo el backend con credencial privada puede llegar aquí mediante el wrapper.
  -- El contexto proviene de getClaims verificado por el servidor, nunca del body.
  if jsonb_typeof(p_contexto) <> 'object' or jsonb_typeof(p_peticion) <> 'object'
    or (select count(*) from jsonb_object_keys(p_contexto)) <> 3
    or not (p_contexto ?& array['actorId','sesionId','expira'])
    or coalesce(p_contexto->>'actorId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(p_contexto->>'sesionId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(p_contexto->>'expira','') !~ '^[0-9]{1,11}$'
    or coalesce(p_peticion->>'usuarioId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'ENTRADA_INVALIDA' using errcode = '22023';
  end if;
  actor := (p_contexto->>'actorId')::uuid;
  sesion := (p_contexto->>'sesionId')::uuid;
  expira := (p_contexto->>'expira')::bigint;
  objetivo := (p_peticion->>'usuarioId')::uuid;
  accion := p_peticion->>'operacion';
  if accion = 'consultar' then
    if (select count(*) from jsonb_object_keys(p_peticion)) <> 2 or p_solicitud is not null then
      raise exception 'ENTRADA_INVALIDA' using errcode = '22023';
    end if;
  elsif accion in ('asignar','revocar') then
    if p_solicitud is null or (select count(*) from jsonb_object_keys(p_peticion)) <> 6
      or not (p_peticion ?& array['usuarioId','operacion','rol','revisionEsperada','asignacionEsperada','aprobacionId'])
      or coalesce(p_peticion->>'aprobacionId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(p_peticion->>'revisionEsperada','') !~ '^[0-9]{1,10}$'
      or (p_peticion->>'revisionEsperada')::bigint >= 2147483647
      or (p_peticion->'asignacionEsperada' <> 'null'::jsonb and not dentaia_admin.asignacion_valida(p_peticion->'asignacionEsperada')) then
      raise exception 'ENTRADA_INVALIDA' using errcode = '22023';
    end if;
    aprobacion := (p_peticion->>'aprobacionId')::uuid;
    esperada := (p_peticion->>'revisionEsperada')::integer;
    rol_pedido := p_peticion->>'rol';
  else
    raise exception 'ENTRADA_INVALIDA' using errcode = '22023';
  end if;

  -- Serializa todas las operaciones de este protocolo entre procesos/instancias.
  -- No es un mutex de Node. Bloqueo transaccional liberado incluso al abortar.
  perform pg_catalog.pg_advisory_xact_lock(151, 144);
  if accion <> 'consultar' then
    select * into permiso from dentaia_admin.aprobaciones_roles where id = aprobacion for update;
  end if;
  -- Orden fijo incluye al aprobador para impedir su revocación entre validar y escribir.
  perform id from auth.users where id in (actor, objetivo, permiso.aprobado_por) order by id for update;
  select * into u_actor from auth.users where id = actor;
  if not coalesce(dentaia_admin.cuenta_habilitada(u_actor),false)
    or not coalesce(dentaia_admin.asignacion_valida(u_actor.raw_app_meta_data->'dentaia'),false)
    or not (u_actor.raw_app_meta_data->'dentaia'->'roles' @> '["superusuario"]'::jsonb)
    or expira <= extract(epoch from clock_timestamp())
    or not exists (
      select 1 from auth.sessions s join auth.mfa_factors f on f.id = s.factor_id and f.user_id = s.user_id
      join auth.mfa_amr_claims m on m.session_id = s.id
      where s.id = sesion and s.user_id = actor and s.aal::text = 'aal2' and f.status::text = 'verified'
        and (s.not_after is null or s.not_after > clock_timestamp())
        and m.authentication_method = 'totp' and m.updated_at between clock_timestamp() - interval '5 minutes' and clock_timestamp()
      for share of s,f,m
    ) then
    -- Sin datos de resultado previo para un actor revocado o una sesión no vigente.
    respuesta := jsonb_build_object('status',403,'codigo','AUTORIZACION_NO_VIGENTE','resultado','rechazado','revision',null,'asignacion',null);
    if accion <> 'consultar' then
      insert into dentaia_admin.auditoria_roles(actor_id,solicitud_id,objetivo_id,aprobacion_id,peticion,resultado)
        values(actor,p_solicitud,objetivo,aprobacion,p_peticion,respuesta)
        on conflict(actor_id,solicitud_id) do nothing;
    end if;
    return respuesta;
  end if;

  if accion <> 'consultar' then
    select * into previa from dentaia_admin.auditoria_roles where actor_id = actor and solicitud_id = p_solicitud;
    if found then
      if previa.peticion = p_peticion then return previa.resultado; end if;
      return jsonb_build_object('status',409,'codigo','CLAVE_REUTILIZADA','resultado','rechazado','revision',null,'asignacion',null);
    end if;
  end if;
  select * into u_objetivo from auth.users where id = objetivo;
  actual := u_objetivo.raw_app_meta_data->'dentaia';
  select revision into contador from dentaia_admin.revisiones_roles where usuario_id = objetivo;
  contador := coalesce(contador,0);
  if accion = 'consultar' then
    if u_objetivo.id is null or not coalesce(dentaia_admin.cuenta_habilitada(u_objetivo),false) then
      return jsonb_build_object('status',404,'codigo','OBJETIVO_NO_DISPONIBLE','resultado','rechazado','revision',null,'asignacion',null);
    end if;
    if actual is not null and not dentaia_admin.asignacion_valida(actual) then
      return jsonb_build_object('status',409,'codigo','ASIGNACION_NO_GESTIONABLE','resultado','rechazado','revision',null,'asignacion',null);
    end if;
    return jsonb_build_object('status',200,'codigo','ESTADO_ACTUAL','resultado','consultado','revision',contador,'asignacion',actual);
  end if;

  <<validar>>
  begin
    if actor = objetivo then codigo := 'CAMBIO_PROPIO_PROHIBIDO'; estado_http := 403; exit validar; end if;
    if u_objetivo.id is null or not coalesce(dentaia_admin.cuenta_habilitada(u_objetivo),false) then
      codigo := 'OBJETIVO_NO_DISPONIBLE'; estado_http := 404; exit validar;
    end if;
    if jsonb_typeof(u_objetivo.raw_app_meta_data) is distinct from 'object'
      or (actual is not null and not dentaia_admin.asignacion_valida(actual)) then
      codigo := 'ASIGNACION_NO_GESTIONABLE'; estado_http := 409; exit validar;
    end if;
    if rol_pedido = 'superusuario' and accion = 'revocar' and actual->'roles' @> '["superusuario"]'::jsonb then
      select count(*) into admins from auth.users u where dentaia_admin.cuenta_habilitada(u)
        and dentaia_admin.asignacion_valida(u.raw_app_meta_data->'dentaia')
        and u.raw_app_meta_data->'dentaia'->'roles' @> '["superusuario"]'::jsonb;
      if admins <= 1 then codigo := 'ULTIMO_SUPERUSUARIO_PROTEGIDO'; estado_http := 403; exit validar; end if;
    end if;
    if rol_pedido is null or rol_pedido not in ('paciente','odontologo','superusuario') then exit validar; end if;
    if rol_pedido = 'odontologo' and accion = 'asignar' then codigo := 'VERIFICACION_PROFESIONAL_PENDIENTE'; estado_http := 403; exit validar; end if;
    if contador <> esperada or coalesce(actual,'null'::jsonb) <> p_peticion->'asignacionEsperada' then
      codigo := 'VERSION_OBSOLETA'; estado_http := 409; exit validar;
    end if;
    select * into permiso from dentaia_admin.aprobaciones_roles where id = aprobacion for update;
    if not found then codigo := 'APROBACION_NO_VALIDA'; estado_http := 403; exit validar; end if;
    select * into u_aprobador from auth.users where id = permiso.aprobado_por;
    if permiso.actor_id <> actor or permiso.objetivo_id <> objetivo or permiso.operacion <> accion or permiso.rol <> rol_pedido
      or permiso.revision_esperada <> esperada or coalesce(permiso.asignacion_esperada,'null'::jsonb) <> p_peticion->'asignacionEsperada'
      or permiso.aprobado_por in (actor,objetivo) or permiso.consumida_por is not null or permiso.vence_en <= clock_timestamp()
      or not coalesce(dentaia_admin.cuenta_habilitada(u_aprobador),false)
      or not coalesce(dentaia_admin.asignacion_valida(u_aprobador.raw_app_meta_data->'dentaia'),false)
      or not (u_aprobador.raw_app_meta_data->'dentaia'->'roles' @> '["superusuario"]'::jsonb) then
      codigo := 'APROBACION_NO_VALIDA'; estado_http := 403; exit validar;
    end if;
    -- No revelar siquiera esta condición por objetivo antes de validar su aprobación.
    if rol_pedido = 'superusuario' and accion = 'asignar' and not exists (
      select 1 from auth.mfa_factors f where f.user_id = objetivo and f.factor_type::text='totp' and f.status::text='verified' for share of f
    ) then codigo := 'MFA_OBJETIVO_REQUERIDO'; estado_http := 403; exit validar; end if;
    select case when count(*) = 0 then null else jsonb_build_object('version',1,'estado','activo','roles',jsonb_agg(r order by r)) end
      into nueva from (
        select distinct r from jsonb_array_elements_text(coalesce(actual->'roles','[]'::jsonb)) as elementos(r)
        where not (accion = 'revocar' and r = rol_pedido)
        union select rol_pedido where accion = 'asignar'
      ) siguientes;
    if coalesce(nueva,'null'::jsonb) = coalesce(actual,'null'::jsonb) then
      resultado := 'sin_cambios'; codigo := 'SIN_CAMBIOS';
    else
      -- Un único UPDATE bajo lock. Conserva TODOS los namespaces ajenos a dentaia.
      update auth.users set raw_app_meta_data = case when nueva is null then raw_app_meta_data - 'dentaia'
        else jsonb_set(raw_app_meta_data, '{dentaia}', nueva, true) end where id = objetivo;
      contador := contador + 1;
      insert into dentaia_admin.revisiones_roles(usuario_id,revision) values(objetivo,contador)
        on conflict(usuario_id) do update set revision = excluded.revision;
      resultado := 'aplicado'; codigo := 'CAMBIO_APLICADO';
    end if;
    update dentaia_admin.aprobaciones_roles set consumida_por = p_solicitud where id = aprobacion;
    estado_http := 200;
  end validar;

  respuesta := jsonb_build_object('status',estado_http,'codigo',codigo,'resultado',resultado,
    'revision',case when estado_http = 200 then contador else null end,
    'asignacion',case when estado_http = 200 then nueva else null end);
  -- Si falla esta inserción, PostgreSQL revierte metadatos, revisión y aprobación.
  -- No capturar la excepción y no declarar éxito ante una respuesta perdida.
  insert into dentaia_admin.auditoria_roles(actor_id,solicitud_id,objetivo_id,aprobacion_id,peticion,anterior,posterior,resultado)
    values(actor,p_solicitud,objetivo,aprobacion,p_peticion,
      case when dentaia_admin.asignacion_valida(actual) then actual else null end,
      case when estado_http = 200 then nueva else null end,respuesta);
  return respuesta;
end;
$$;

-- Única superficie RPC expuesta. INVOKER delega a función privada acotada.
create function public.dentaia_cambiar_roles_v1(p_contexto jsonb,p_peticion jsonb,p_solicitud uuid)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select dentaia_admin.cambiar_roles_v1(p_contexto,p_peticion,p_solicitud);
$$;
revoke all on all functions in schema dentaia_admin from public, anon, authenticated, service_role;
revoke all on function public.dentaia_cambiar_roles_v1(jsonb,jsonb,uuid) from public, anon, authenticated, service_role;
grant usage on schema dentaia_admin to service_role;
grant execute on function dentaia_admin.cambiar_roles_v1(jsonb,jsonb,uuid) to service_role;
grant execute on function public.dentaia_cambiar_roles_v1(jsonb,jsonb,uuid) to service_role;
-- Las funciones privadas son propiedad del aplicador confiable (postgres), NO de
-- authenticated/service_role. SECURITY DEFINER es necesario para Auth y auditoría
-- sin dar permisos sobre las tablas al cliente. search_path vacío, sin SQL dinámico.
-- No se concede creación de aprobaciones al endpoint ni a service_role.
COMMIT;
