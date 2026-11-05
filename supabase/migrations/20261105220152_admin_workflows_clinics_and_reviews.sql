-- Flujos administrativos para membresías clínicas y moderación de reseñas.
-- Solo lectura/escritura mediante RPC acotados con sesión Supabase autenticada,
-- superusuario activo, MFA/AAL2 reciente e idempotencia. No usa service_role.
begin;

do $preflight$
begin
  if to_regclass('clinical.professional_accounts') is null
     or to_regclass('clinical.clinic_memberships') is null
     or to_regclass('clinical.clinics') is null
     or to_regclass('public.dentist_reviews') is null
     or to_regclass('public.dentist_review_reports') is null
     or to_regclass('dentaia_locations_admin.auditoria_ubicaciones') is null then
    raise exception 'PRECONDICION_FALTA: esquema clínico o de ubicaciones no instalado';
  end if;
end
$preflight$;

create schema dentaia_admin_workflows;
revoke all on schema dentaia_admin_workflows from public, anon, authenticated, service_role;

create table dentaia_admin_workflows.audit_events (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation text not null check (operation in ('membership_link','membership_revoke','review_moderate','report_moderate')),
  input jsonb not null,
  result jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
alter table dentaia_admin_workflows.audit_events enable row level security;
revoke all on table dentaia_admin_workflows.audit_events from public, anon, authenticated, service_role;

create function dentaia_admin_workflows.reject_audit_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  raise exception 'AUDITORIA_INMUTABLE' using errcode = '42501';
end
$function$;
revoke all on function dentaia_admin_workflows.reject_audit_mutation() from public, anon, authenticated, service_role;
create trigger audit_events_immutable before update or delete on dentaia_admin_workflows.audit_events
  for each row execute function dentaia_admin_workflows.reject_audit_mutation();

create function dentaia_admin_workflows.admin_session_valid()
returns boolean language plpgsql volatile security definer set search_path = '' as $function$
declare
  actor uuid := auth.uid();
  claims jsonb := auth.jwt();
  session_uuid uuid;
  account auth.users;
  metadata jsonb;
begin
  if actor is null or jsonb_typeof(claims) is distinct from 'object'
    or claims->>'sub' is distinct from actor::text
    or claims->>'role' is distinct from 'authenticated'
    or claims->>'aal' is distinct from 'aal2'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
    or (claims->>'exp')::bigint <= extract(epoch from clock_timestamp())
    or coalesce(claims->>'session_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  session_uuid := (claims->>'session_id')::uuid;
  select u.* into account from auth.users u where u.id = actor;
  metadata := account.raw_app_meta_data->'dentaia';
  return account.id is not null and account.aud = 'authenticated' and account.is_anonymous is false
    and account.confirmed_at is not null and account.deleted_at is null
    and (account.banned_until is null or account.banned_until <= clock_timestamp())
    and jsonb_typeof(metadata) = 'object' and metadata->>'version' = '1' and metadata->>'estado' = 'activo'
    and coalesce(metadata->'roles','[]'::jsonb) ? 'superusuario'
    and exists (
      select 1 from auth.sessions s
      join auth.mfa_factors f on f.id = s.factor_id and f.user_id = s.user_id
      join auth.mfa_amr_claims amr on amr.session_id = s.id
      where s.id = session_uuid and s.user_id = actor and s.aal::text = 'aal2'
        and (s.not_after is null or s.not_after > clock_timestamp())
        and f.status::text = 'verified' and f.factor_type::text = 'totp'
        and amr.authentication_method = 'totp' and amr.updated_at > clock_timestamp() - interval '5 minutes'
    );
end
$function$;
revoke all on function dentaia_admin_workflows.admin_session_valid() from public, anon, authenticated, service_role;

create function dentaia_admin_workflows.manage_clinic_membership_v1(
  p_request_id uuid, p_operation text, p_professional_id uuid, p_clinic_id uuid, p_membership_id uuid
) returns jsonb language plpgsql volatile security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $function$
declare
  actor uuid := auth.uid();
  input_value jsonb;
  previous dentaia_admin_workflows.audit_events;
  result_value jsonb;
  professional clinical.professional_accounts;
  dentist public.dentists;
  clinic clinical.clinics;
  account auth.users;
  active_count integer;
  membership_id uuid;
  location record;
begin
  if not dentaia_admin_workflows.admin_session_valid() then
    return jsonb_build_object('ok', false, 'status', 403, 'codigo', 'ROL_O_MFA_INSUFICIENTE');
  end if;
  if p_operation = 'listar' then
    return jsonb_build_object('ok', true, 'status', 200, 'codigo', 'LISTADO',
      'profesionales', coalesce((
        select jsonb_agg(jsonb_build_object('professionalId', pa.id, 'dentistId', d.id,
          'dentistName', d.name, 'specialty', d.specialty, 'clinicId', c.id, 'clinicName', c.name,
          'membershipId', m.id, 'membershipStatus', m.status, 'validUntil', m.valid_until)
          order by d.name, c.name)
        from clinical.professional_accounts pa
        join auth.users u on u.id = pa.user_id
        join public.dentists d on d.id = pa.dentist_id
        left join clinical.clinic_memberships m on m.professional_id = pa.id
        left join clinical.clinics c on c.id = m.clinic_id
        where pa.status = 'verified' and d.is_active is true and d.is_demo is false
          and u.aud = 'authenticated' and u.confirmed_at is not null and u.deleted_at is null
          and (u.banned_until is null or u.banned_until <= clock_timestamp())
          and u.raw_app_meta_data->'dentaia'->>'estado' = 'activo'
          and coalesce(u.raw_app_meta_data->'dentaia'->'roles','[]'::jsonb) ? 'odontologo'
      ), '[]'::jsonb),
      'clinicas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'location', c.location) order by c.name)
        from clinical.clinics c where c.status = 'active'), '[]'::jsonb),
      'ubicaciones', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'dentistId', l.dentist_id,
        'dentistName',d.name,'clinicId',l.clinic_id,'clinicName',c.name,'practiceName',l.practice_name,
        'practiceAddress',l.practice_address,'latitude',l.latitude,'longitude',l.longitude,'status',l.publication_status,
        'createdAt',l.created_at) order by l.created_at desc)
        from public.dentist_public_locations l join public.dentists d on d.id=l.dentist_id
        join clinical.clinics c on c.id=l.clinic_id where d.is_demo is false), '[]'::jsonb));
  end if;
  if p_operation not in ('vincular','revocar') or p_request_id is null then
    return jsonb_build_object('ok', false, 'status', 400, 'codigo', 'OPERACION_INVALIDA');
  end if;
  input_value := jsonb_build_object('operation',p_operation,'professionalId',p_professional_id,
    'clinicId',p_clinic_id,'membershipId',p_membership_id);
  select * into previous from dentaia_admin_workflows.audit_events where request_id = p_request_id for update;
  if found then
    if previous.actor_id = actor and previous.operation = (case p_operation when 'vincular' then 'membership_link' else 'membership_revoke' end)
      and previous.input = input_value then return previous.result; end if;
    return jsonb_build_object('ok', false, 'status', 409, 'codigo', 'SOLICITUD_REUTILIZADA');
  end if;

  if p_operation = 'vincular' then
    if p_professional_id is null or p_clinic_id is null or p_membership_id is not null then
      return jsonb_build_object('ok', false, 'status', 400, 'codigo', 'VINCULACION_INVALIDA');
    end if;
    select * into professional from clinical.professional_accounts where id = p_professional_id for update;
    select * into dentist from public.dentists where id = professional.dentist_id for share;
    select * into clinic from clinical.clinics where id = p_clinic_id for share;
    select * into account from auth.users where id = professional.user_id for share;
    if professional.id is null or professional.status <> 'verified'
      or dentist.id is null or dentist.is_active is not true or dentist.is_demo is not false
      or clinic.id is null or clinic.status <> 'active'
      or account.id is null or account.aud <> 'authenticated' or account.confirmed_at is null
      or account.deleted_at is not null or (account.banned_until is not null and account.banned_until > clock_timestamp())
      or account.raw_app_meta_data->'dentaia'->>'estado' <> 'activo'
      or not (coalesce(account.raw_app_meta_data->'dentaia'->'roles','[]'::jsonb) ? 'odontologo') then
      return jsonb_build_object('ok', false, 'status', 403, 'codigo', 'PROFESIONAL_O_CLINICA_NO_ELEGIBLE');
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text || ':' || p_clinic_id::text, 0));
    select count(*), (array_agg(id order by valid_from desc))[1] into active_count, membership_id from clinical.clinic_memberships
      where professional_id = p_professional_id and clinic_id = p_clinic_id and status = 'active'
        and valid_from <= clock_timestamp() and (valid_until is null or valid_until > clock_timestamp());
    if active_count > 0 then
      result_value := jsonb_build_object('ok', true, 'status', 200, 'codigo', 'MEMBRESIA_YA_VIGENTE', 'membershipId', membership_id);
    else
      insert into clinical.clinic_memberships(clinic_id, professional_id, status, valid_from, valid_until)
        values (p_clinic_id, p_professional_id, 'active', clock_timestamp(), null) returning id into membership_id;
      result_value := jsonb_build_object('ok', true, 'status', 200, 'codigo', 'MEMBRESIA_VINCULADA', 'membershipId', membership_id);
    end if;
    insert into dentaia_admin_workflows.audit_events(request_id,actor_id,operation,input,result)
      values (p_request_id,actor,'membership_link',input_value,result_value);
    insert into clinical.clinical_access_audit(request_id,actor_user_id,membership_id,operation,outcome,reason_code)
      values (p_request_id,actor,membership_id,'membership_change','allowed',case when active_count > 0 then 'MEMBERSHIP_ALREADY_ACTIVE' else 'MEMBERSHIP_LINKED' end);
    return result_value;
  end if;

  if p_membership_id is null or p_professional_id is null or p_clinic_id is null then
    return jsonb_build_object('ok', false, 'status', 400, 'codigo', 'VINCULACION_INVALIDA');
  end if;
  select * into professional from clinical.professional_accounts where id = p_professional_id for update;
  select * into clinic from clinical.clinics where id = p_clinic_id for share;
  update clinical.clinic_memberships set status = 'inactive', valid_until = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
    where id = p_membership_id and professional_id = p_professional_id and clinic_id = p_clinic_id
      and status = 'active' and valid_from < clock_timestamp() returning id into membership_id;
  if membership_id is null then return jsonb_build_object('ok', false, 'status', 404, 'codigo', 'MEMBRESIA_ACTIVA_NO_ENCONTRADA'); end if;
  for location in update public.dentist_public_locations l set publication_status = 'hidden', updated_at = clock_timestamp()
    where l.dentist_id = professional.dentist_id and l.clinic_id = p_clinic_id and l.publication_status = 'published'
    returning l.id, l.dentist_id, l.clinic_id
  loop
    insert into dentaia_locations_admin.auditoria_ubicaciones(solicitud_id,actor_id,operacion,entrada,resultado)
      values (gen_random_uuid(),actor,'ocultar',jsonb_build_object('operacion','ocultar','ubicacionId',location.id,'causa','MEMBRESIA_REVOCADA'),
        jsonb_build_object('ok',true,'status',200,'codigo','UBICACION_OCULTA','ubicacionId',location.id));
  end loop;
  result_value := jsonb_build_object('ok', true, 'status', 200, 'codigo', 'MEMBRESIA_REVOCADA', 'membershipId', membership_id);
  insert into dentaia_admin_workflows.audit_events(request_id,actor_id,operation,input,result)
    values (p_request_id,actor,'membership_revoke',input_value,result_value);
  insert into clinical.clinical_access_audit(request_id,actor_user_id,membership_id,operation,outcome,reason_code)
    values (p_request_id,actor,membership_id,'membership_change','allowed','MEMBERSHIP_REVOKED');
  return result_value;
end
$function$;

create function dentaia_admin_workflows.moderate_reviews_v1(
  p_request_id uuid, p_operation text, p_review_id uuid, p_report_id uuid, p_status text
) returns jsonb language plpgsql volatile security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $function$
declare
  actor uuid := auth.uid();
  input_value jsonb;
  previous dentaia_admin_workflows.audit_events;
  result_value jsonb;
  affected uuid;
begin
  if not dentaia_admin_workflows.admin_session_valid() then
    return jsonb_build_object('ok',false,'status',403,'codigo','ROL_O_MFA_INSUFICIENTE');
  end if;
  if p_operation = 'listar' then
    return jsonb_build_object('ok',true,'status',200,'codigo','LISTADO',
      'resenas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'dentistId',r.dentist_id,'dentistName',d.name,
        'rating',r.rating,'comment',r.comment,'createdAt',r.created_at,'status',r.moderation_status) order by r.created_at)
        from public.dentist_reviews r join public.dentists d on d.id=r.dentist_id
        where r.moderation_status in ('pending','published','hidden')), '[]'::jsonb),
      'reportes',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'reviewId',p.review_id,'category',p.category,
        'details',p.details,'createdAt',p.created_at,'status',p.moderation_status) order by p.created_at)
        from public.dentist_review_reports p where p.moderation_status='pending'), '[]'::jsonb));
  end if;
  if p_request_id is null or p_operation not in ('resena','reporte') then
    return jsonb_build_object('ok',false,'status',400,'codigo','OPERACION_INVALIDA');
  end if;
  input_value:=jsonb_build_object('operation',p_operation,'reviewId',p_review_id,'reportId',p_report_id,'status',p_status);
  select * into previous from dentaia_admin_workflows.audit_events where request_id=p_request_id for update;
  if found then
    if previous.actor_id=actor and previous.operation=(case p_operation when 'resena' then 'review_moderate' else 'report_moderate' end)
      and previous.input=input_value then return previous.result; end if;
    return jsonb_build_object('ok',false,'status',409,'codigo','SOLICITUD_REUTILIZADA');
  end if;
  if p_operation='resena' then
    if p_review_id is null or p_report_id is not null or p_status not in ('published','rejected','hidden') then
      return jsonb_build_object('ok',false,'status',400,'codigo','MODERACION_INVALIDA');
    end if;
    update public.dentist_reviews set moderation_status=p_status
      where id=p_review_id and moderation_status in ('pending','published','hidden') returning id into affected;
    if affected is null then return jsonb_build_object('ok',false,'status',404,'codigo','RESENA_NO_ENCONTRADA'); end if;
    result_value:=jsonb_build_object('ok',true,'status',200,'codigo','RESENA_MODERADA','id',affected);
    insert into dentaia_admin_workflows.audit_events(request_id,actor_id,operation,input,result)
      values(p_request_id,actor,'review_moderate',input_value,result_value);
    return result_value;
  end if;
  if p_report_id is null or p_review_id is not null or p_status not in ('reviewed','dismissed') then
    return jsonb_build_object('ok',false,'status',400,'codigo','MODERACION_INVALIDA');
  end if;
  update public.dentist_review_reports set moderation_status=p_status
    where id=p_report_id and moderation_status='pending' returning id into affected;
  if affected is null then return jsonb_build_object('ok',false,'status',404,'codigo','REPORTE_NO_ENCONTRADO'); end if;
  result_value:=jsonb_build_object('ok',true,'status',200,'codigo','REPORTE_MODERADO','id',affected);
  insert into dentaia_admin_workflows.audit_events(request_id,actor_id,operation,input,result)
    values(p_request_id,actor,'report_moderate',input_value,result_value);
  return result_value;
end
$function$;

revoke all on function dentaia_admin_workflows.manage_clinic_membership_v1(uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function dentaia_admin_workflows.moderate_reviews_v1(uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant usage on schema dentaia_admin_workflows to authenticated;
grant execute on function dentaia_admin_workflows.manage_clinic_membership_v1(uuid,text,uuid,uuid,uuid) to authenticated;
grant execute on function dentaia_admin_workflows.moderate_reviews_v1(uuid,text,uuid,uuid,text) to authenticated;

create function public.dentaia_manage_clinic_membership_v1(p_request_id uuid,p_operation text,p_professional_id uuid,p_clinic_id uuid,p_membership_id uuid)
returns jsonb language sql volatile security invoker set search_path = '' as $function$
  select dentaia_admin_workflows.manage_clinic_membership_v1(p_request_id,p_operation,p_professional_id,p_clinic_id,p_membership_id)
$function$;
create function public.dentaia_moderate_reviews_v1(p_request_id uuid,p_operation text,p_review_id uuid,p_report_id uuid,p_status text)
returns jsonb language sql volatile security invoker set search_path = '' as $function$
  select dentaia_admin_workflows.moderate_reviews_v1(p_request_id,p_operation,p_review_id,p_report_id,p_status)
$function$;
revoke all on function public.dentaia_manage_clinic_membership_v1(uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.dentaia_moderate_reviews_v1(uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.dentaia_manage_clinic_membership_v1(uuid,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.dentaia_moderate_reviews_v1(uuid,text,uuid,uuid,text) to authenticated;
commit;
