-- DI-207 / BORRADOR NO APLICADO. Requiere migración y pruebas RLS reales.
-- Ejecutar DESPUÉS del esquema DI-207-propuesta-esquema-rutinas.sql.
-- Una sola transacción por operación. Solo invocable por service_role del BFF.
create or replace function public.operar_seguimiento_rutina(
  p_actor_user_id uuid,
  p_accion text,
  p_membership_id uuid default null,
  p_patient_user_id uuid default null,
  p_consent_id uuid default null,
  p_proposal_id uuid default null,
  p_plan_id uuid default null,
  p_activity_ids uuid[] default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $func$
declare
  v_consent public.routine_followup_consents%rowtype;
  v_proposal public.routine_plan_proposals%rowtype;
  v_professional_user uuid;
  v_patient_record uuid;
  v_consent_id uuid;
  v_proposal_id uuid;
  v_actor_roles jsonb;
  v_actor_active boolean;
begin
  if p_actor_user_id is null or p_accion is null then
    raise exception 'SOLICITUD_INVALIDA' using errcode = '22023';
  end if;

  -- Se comprueban los metadatos administrados del servidor, no user_metadata.
  select coalesce(u.raw_app_meta_data #> '{dentaia,roles}', '[]'::jsonb),
    coalesce(u.raw_app_meta_data #>> '{dentaia,estado}', '') = 'activo'
  into v_actor_roles, v_actor_active
  from auth.users u where u.id = p_actor_user_id;
  if not coalesce(v_actor_active,false) then
    raise exception 'ACCESO_DENEGADO' using errcode = '42501';
  end if;

  if p_accion = 'invitar' then
    if not (v_actor_roles ? 'odontologo') or p_membership_id is null or p_patient_user_id is null then
      raise exception 'ACCESO_DENEGADO' using errcode = '42501';
    end if;
    select pa.user_id into v_professional_user
    from clinical.clinic_memberships cm
    join clinical.professional_accounts pa on pa.id=cm.professional_id
    where cm.id=p_membership_id and cm.status='active' and pa.status='active'
      and cm.valid_from<=now() and (cm.valid_until is null or cm.valid_until>now());
    if v_professional_user is distinct from p_actor_user_id then
      raise exception 'ACCESO_DENEGADO' using errcode = '42501';
    end if;
    select pr.id into v_patient_record from clinical.patient_records pr
    where pr.user_id=p_patient_user_id and pr.status='active';
    -- No se permiten invitaciones por tanteo de UUID:
    -- debe existir autorización clínica vigente de ese paciente en esa membresía.
    if v_patient_record is null or not exists (
      select 1 from clinical.clinical_access_grants grant_
      where grant_.patient_id=v_patient_record and grant_.membership_id=p_membership_id
        and grant_.revoked_at is null and grant_.expires_at>now()
    ) then
      raise exception 'ACCESO_DENEGADO' using errcode = '42501';
    end if;
    insert into public.routine_followup_consents(patient_id,membership_id,expires_at)
    values(p_patient_user_id,p_membership_id,now()+interval '14 days')
    returning id into v_consent_id;
    insert into clinical.routine_followup_audit(consent_id,actor_user_id,action)
    values(v_consent_id,p_actor_user_id,'solicitud');
    return jsonb_build_object('ok',true,'consentId',v_consent_id);
  end if;

  if p_accion in ('aprobar_seguimiento','revocar_seguimiento','proponer_plan') then
    select * into v_consent from public.routine_followup_consents c
    where c.id=p_consent_id for update;
    if not found then raise exception 'ACCESO_DENEGADO' using errcode='42501'; end if;
  elsif p_accion in ('aceptar_plan','rechazar_plan','revocar_plan') then
    select * into v_proposal from public.routine_plan_proposals p
    where p.id=p_proposal_id for update;
    if not found then raise exception 'ACCESO_DENEGADO' using errcode='42501'; end if;
    select * into v_consent from public.routine_followup_consents c
    where c.id=v_proposal.consent_id for update;
    if not found then raise exception 'ACCESO_DENEGADO' using errcode='42501'; end if;
  else
    raise exception 'SOLICITUD_INVALIDA' using errcode='22023';
  end if;

  if p_accion = 'revocar_seguimiento' then
    if v_consent.patient_id <> p_actor_user_id or not (v_actor_roles ? 'paciente')
       or v_consent.status <> 'aprobado' then
      raise exception 'ACCESO_DENEGADO' using errcode='42501';
    end if;
    update public.routine_followup_consents
      set status='revocado', revoked_at=now() where id=v_consent.id;
    update public.routine_plan_proposals
      set status='revocada', revoked_at=now()
      where consent_id=v_consent.id and status='aceptada';
    insert into clinical.routine_followup_audit(consent_id,actor_user_id,action)
    values(v_consent.id,p_actor_user_id,p_accion);
    return jsonb_build_object('ok',true,'consentId',v_consent.id);
  end if;

  -- Toda aprobación o propuesta exige vínculo clínico vigente.
  select pa.user_id into v_professional_user
  from clinical.clinic_memberships cm
  join clinical.professional_accounts pa on pa.id=cm.professional_id
  where cm.id=v_consent.membership_id and cm.status='active' and pa.status='active'
    and cm.valid_from<=now() and (cm.valid_until is null or cm.valid_until>now());
  if v_professional_user is null or v_consent.expires_at<=now() then
    raise exception 'ACCESO_DENEGADO' using errcode='42501';
  end if;

  if p_accion = 'aprobar_seguimiento' then
    if not (v_actor_roles ? 'paciente') or v_consent.patient_id<>p_actor_user_id
       or v_consent.status<>'pendiente' then
      raise exception 'ACCESO_DENEGADO' using errcode='42501';
    end if;
    update public.routine_followup_consents
      set status='aprobado', approved_at=now() where id=v_consent.id;
  elsif p_accion = 'proponer_plan' then
    if not (v_actor_roles ? 'odontologo') or v_professional_user<>p_actor_user_id
       or v_consent.status<>'aprobado' or p_plan_id is null
       or coalesce(cardinality(p_activity_ids),0) not between 1 and 20
       or exists (select 1 from unnest(p_activity_ids) as a(id) where a.id is null)
       or not exists (
         select 1 from public.oral_care_routine_plans plan
         where plan.id=p_plan_id and plan.published and plan.valid_from<=current_date
           and (plan.valid_until is null or plan.valid_until>=current_date)
       )
       or (select count(distinct a.id)
           from public.oral_care_routine_activities a
           where a.plan_id=p_plan_id and a.id=any(p_activity_ids)) <> cardinality(p_activity_ids)
    then
      raise exception 'ACCESO_DENEGADO' using errcode='42501';
    end if;
    insert into public.routine_plan_proposals(consent_id,patient_id,plan_id,proposed_by)
    values(v_consent.id,v_consent.patient_id,p_plan_id,p_actor_user_id)
    returning id into v_proposal_id;
    insert into public.routine_proposal_activities(proposal_id,plan_id,activity_id)
    select v_proposal_id,p_plan_id,unnest(p_activity_ids);
    insert into clinical.routine_followup_audit(consent_id,proposal_id,actor_user_id,action)
    values(v_consent.id,v_proposal_id,p_actor_user_id,p_accion);
    return jsonb_build_object('ok',true,'proposalId',v_proposal_id);
  else
    if not (v_actor_roles ? 'paciente') or v_consent.patient_id<>p_actor_user_id
       or v_consent.status<>'aprobado' or v_proposal.patient_id<>p_actor_user_id then
      raise exception 'ACCESO_DENEGADO' using errcode='42501';
    end if;
    if p_accion in ('aceptar_plan','rechazar_plan') then
      if v_proposal.status<>'propuesta' then
        raise exception 'ACCESO_DENEGADO' using errcode='42501';
      end if;
      if p_accion='aceptar_plan' then
        update public.routine_plan_proposals
        set status='revocada', revoked_at=now()
        where patient_id=p_actor_user_id and status='aceptada';
      end if;
      update public.routine_plan_proposals set
        status=case when p_accion='aceptar_plan' then 'aceptada' else 'rechazada' end,
        responded_at=now()
      where id=v_proposal.id;
    elsif p_accion='revocar_plan' then
      if v_proposal.status<>'aceptada' then
        raise exception 'ACCESO_DENEGADO' using errcode='42501';
      end if;
      update public.routine_plan_proposals set status='revocada',revoked_at=now()
      where id=v_proposal.id;
    end if;
  end if;

  insert into clinical.routine_followup_audit(consent_id,proposal_id,actor_user_id,action)
  values(v_consent.id,v_proposal.id,p_actor_user_id,p_accion);
  return jsonb_build_object('ok',true,'consentId',v_consent.id,'proposalId',v_proposal.id);
end;
$func$;

revoke all on function public.operar_seguimiento_rutina(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid[])
  from public, anon, authenticated;
grant execute on function public.operar_seguimiento_rutina(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid[])
  to service_role;
