-- DI-207 / BORRADOR: CONSULTA EN MODO SOLO LECTURA (service_role únicamente).
-- No aplicar en producción sin QA de permisos. Requiere los dos archivos previos.
create or replace function public.consultar_seguimiento_rutina(
  p_actor_user_id uuid,
  p_membership_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $func$
declare
  v_roles jsonb;
  v_activo boolean;
  v_professional_user uuid;
  v_consentimientos jsonb := '[]'::jsonb;
  v_propuestas jsonb := '[]'::jsonb;
  v_plan jsonb;
  v_catalogo jsonb := '[]'::jsonb;
begin
  select coalesce(u.raw_app_meta_data #> '{dentaia,roles}', '[]'::jsonb),
    coalesce(u.raw_app_meta_data #>> '{dentaia,estado}', '') = 'activo'
  into v_roles,v_activo from auth.users u where u.id=p_actor_user_id;
  if not coalesce(v_activo,false) then
    raise exception 'ACCESO_DENEGADO' using errcode='42501';
  end if;

  if p_membership_id is null and v_roles ? 'paciente' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,'estado',c.status,'vence',c.expires_at,
      'membresiaId',c.membership_id,'profesional',coalesce(d.name,'Profesional verificado')
    ) order by c.created_at desc), '[]'::jsonb) into v_consentimientos
    from public.routine_followup_consents c
    join clinical.clinic_memberships cm on cm.id=c.membership_id
    join clinical.professional_accounts pa on pa.id=cm.professional_id
    left join public.dentists d on d.id=pa.dentist_id and d.is_demo=false
    where c.patient_id=p_actor_user_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'consentimientoId',p.consent_id,'estado',p.status,
      'planId',p.plan_id,'planTitulo',plan.title,'creado',p.created_at,
      'aceptadaEn',case when p.status in ('aceptada','revocada') then p.responded_at else null end,
      'revocadaEn',p.revoked_at,
      'actividades',coalesce((select jsonb_agg(jsonb_build_object('id',pa.activity_id,'titulo',a.title,'momento',a.time_of_day) order by a.sort_order)
       from public.routine_proposal_activities pa
       join public.oral_care_routine_activities a on a.id=pa.activity_id
       where pa.proposal_id=p.id),'[]'::jsonb)
    ) order by p.created_at desc), '[]'::jsonb) into v_propuestas
    from public.routine_plan_proposals p
    join public.oral_care_routine_plans plan on plan.id=p.plan_id
    where p.patient_id=p_actor_user_id;

    select jsonb_build_object('planId',p.plan_id,'propuestaId',p.id,
      'actividades',coalesce((select jsonb_agg(a.activity_id)
        from public.routine_proposal_activities a where a.proposal_id=p.id),'[]'::jsonb)
    ) into v_plan
    from public.routine_plan_proposals p
    join public.routine_followup_consents c on c.id=p.consent_id
    join public.oral_care_routine_plans plan on plan.id=p.plan_id
    join clinical.clinic_memberships cm on cm.id=c.membership_id
    join clinical.professional_accounts pa on pa.id=cm.professional_id
    where p.patient_id=p_actor_user_id and p.status='aceptada'
      and c.status='aprobado' and c.expires_at>now()
      and cm.status='active' and pa.status='verified'
      and cm.valid_from<=now() and (cm.valid_until is null or cm.valid_until>now())
      and plan.published and plan.valid_from<=(now() at time zone 'America/Lima')::date
      and (plan.valid_until is null or plan.valid_until>=(now() at time zone 'America/Lima')::date)
    limit 1;

    return jsonb_build_object('ok',true,'tipo','paciente',
      'consentimientos',v_consentimientos,'propuestas',v_propuestas,'planActivo',v_plan);
  end if;

  if p_membership_id is not null and v_roles ? 'odontologo' then
    select pa.user_id into v_professional_user
    from clinical.clinic_memberships cm
    join clinical.professional_accounts pa on pa.id=cm.professional_id
    where cm.id=p_membership_id and cm.status='active' and pa.status='verified'
      and cm.valid_from<=now() and (cm.valid_until is null or cm.valid_until>now());
    if v_professional_user is distinct from p_actor_user_id then
      raise exception 'ACCESO_DENEGADO' using errcode='42501';
    end if;
    -- Solo solicitudes del contexto clínico que pertenece al actor.
    select coalesce(jsonb_agg(jsonb_build_object(
      'consentimientoId',c.id,'pacienteRegistroId',pr.id,'estado',c.status,
      'vence',c.expires_at,'propuestas',coalesce((
        select jsonb_agg(jsonb_build_object('id',p.id,'estado',p.status,'planId',p.plan_id))
        from public.routine_plan_proposals p where p.consent_id=c.id
      ),'[]'::jsonb),
      'progresoHoy',case when c.status='aprobado' then (
        select jsonb_build_object(
          'completadas',(select count(distinct m.activity_id)
            from public.patient_routine_completions m
            join public.routine_proposal_activities a on a.proposal_id=p.id and a.activity_id=m.activity_id
            where m.patient_id=c.patient_id and m.plan_id=p.plan_id
              and m.completion_date=(now() at time zone 'America/Lima')::date),
          'total',(select count(*) from public.routine_proposal_activities a where a.proposal_id=p.id)
        )
        from public.routine_plan_proposals p
        where p.consent_id=c.id and p.status='aceptada'
        limit 1
      ) else null end
    ) order by c.created_at desc), '[]'::jsonb) into v_consentimientos
    from public.routine_followup_consents c
    join clinical.patient_records pr on pr.user_id=c.patient_id and pr.status='active'
    where c.membership_id=p_membership_id and c.status in ('pendiente','aprobado') and c.expires_at>now();

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',plan.id,'titulo',plan.title,'actividades',coalesce((
         select jsonb_agg(jsonb_build_object('id',a.id,'titulo',a.title,'momento',a.time_of_day)
           order by a.sort_order)
         from public.oral_care_routine_activities a where a.plan_id=plan.id
      ),'[]'::jsonb)
    ) order by plan.version desc),'[]'::jsonb) into v_catalogo
    from public.oral_care_routine_plans plan
    where plan.published and plan.valid_from<=(now() at time zone 'America/Lima')::date
      and (plan.valid_until is null or plan.valid_until>=(now() at time zone 'America/Lima')::date);

    return jsonb_build_object('ok',true,'tipo','odontologo','solicitudes',v_consentimientos,'catalogo',v_catalogo);
  end if;
  raise exception 'ACCESO_DENEGADO' using errcode='42501';
end;
$func$;

revoke all on function public.consultar_seguimiento_rutina(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.consultar_seguimiento_rutina(uuid,uuid)
  to service_role;
