-- Pruebas transaccionales reales de PostgreSQL 17, con datos exclusivamente ficticios.
-- Detener inmediatamente ante cualquier fallo.
do $$
begin
  if has_function_privilege('authenticated',
    'public.operar_seguimiento_rutina(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid[])','EXECUTE')
    or has_function_privilege('anon',
    'public.consultar_seguimiento_rutina(uuid,uuid)','EXECUTE') then
      raise exception 'ERROR QA: RPC privilegiada expuesta';
  end if;
  if has_table_privilege('authenticated','public.routine_followup_consents','INSERT')
     or has_table_privilege('authenticated','public.routine_plan_proposals','UPDATE')
     or has_table_privilege('anon','public.routine_proposal_activities','SELECT') then
      raise exception 'ERROR QA: privilegio directo incorrecto';
  end if;
end $$;

set role service_role;

-- Profesional A invita a paciente A con autorización clínica previa.
select public.operar_seguimiento_rutina(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','invitar',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '33333333-3333-4333-8333-333333333333'
);
do $$
declare v_denied boolean:=false;
begin
  begin
    -- Profesional B no puede invitar a paciente B si no hay vínculo clínico.
    perform public.operar_seguimiento_rutina(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','invitar',
      '99999999-9999-4999-8999-999999999999',
      '44444444-4444-4444-8444-444444444444'
    );
  exception when sqlstate '42501' then v_denied:=true;
  end;
  if not v_denied then raise exception 'ERROR QA: invitación sin vínculo aceptada'; end if;
end $$;

-- Paciente B no puede aprobar un consentimiento de paciente A.
do $$
declare v_denied boolean:=false;
begin
  begin
    perform public.operar_seguimiento_rutina(
      '22222222-2222-4222-8222-222222222222',
      'aprobar_seguimiento', p_consent_id => (
        select id from public.routine_followup_consents limit 1
      )
    );
  exception when sqlstate '42501' then v_denied:=true;
  end;
  if not v_denied then raise exception 'ERROR QA: aprobación ajena aceptada'; end if;
end $$;

-- Sin el consentimiento del paciente, el profesional no puede proponer.
do $$
declare v_denied boolean:=false;
begin
  begin
    perform public.operar_seguimiento_rutina(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'proponer_plan', p_consent_id => (
        select id from public.routine_followup_consents limit 1
      ), p_plan_id => '55555555-5555-4555-8555-555555555555',
      p_activity_ids => array['66666666-6666-4666-8666-666666666661']::uuid[]
    );
  exception when sqlstate '42501' then v_denied:=true;
  end;
  if not v_denied then raise exception 'ERROR QA: propuesta sin consentimiento'; end if;
end $$;

select public.operar_seguimiento_rutina(
  '11111111-1111-4111-8111-111111111111',
  'aprobar_seguimiento',
  p_consent_id => (select id from public.routine_followup_consents limit 1)
);

-- Profesional A propone SOLO dos de las tres actividades existentes.
select public.operar_seguimiento_rutina(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','proponer_plan',
  p_consent_id => (select id from public.routine_followup_consents limit 1),
  p_plan_id => '55555555-5555-4555-8555-555555555555',
  p_activity_ids => array[
    '66666666-6666-4666-8666-666666666661',
    '66666666-6666-4666-8666-666666666662'
  ]::uuid[]
);
select public.operar_seguimiento_rutina(
  '11111111-1111-4111-8111-111111111111',
  'aceptar_plan',
  p_proposal_id => (select id from public.routine_plan_proposals limit 1)
);

do $$
declare v_plan jsonb;
begin
  v_plan := public.consultar_seguimiento_rutina(
    '11111111-1111-4111-8111-111111111111')->'planActivo';
  if v_plan is null or jsonb_array_length(v_plan->'actividades')<>2 then
    raise exception 'ERROR QA: selección de dos actividades no aplicada';
  end if;
end $$;

insert into public.patient_routine_completions(patient_id,plan_id,activity_id,completion_date)
values (
 '11111111-1111-4111-8111-111111111111',
 '55555555-5555-4555-8555-555555555555',
 '66666666-6666-4666-8666-666666666661',
 (now() at time zone 'America/Lima')::date
);
do $$
declare v_data jsonb;
begin
  v_data := public.consultar_seguimiento_rutina(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  if v_data->'solicitudes'->0->'progresoHoy'->>'completadas' <> '1'
     or v_data->'solicitudes'->0->'progresoHoy'->>'total' <> '2' then
    raise exception 'ERROR QA: progreso profesional incorrecto';
  end if;
end $$;

reset role;

-- Políticas RLS reales bajo un rol PostgreSQL autenticado.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims',
  '{"app_metadata":{"dentaia":{"estado":"activo","roles":["paciente"]}}}',true);
do $$
begin
  if (select count(*) from public.routine_followup_consents) <> 1 then
    raise exception 'ERROR QA: paciente A no ve su consentimiento';
  end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims',
  '{"app_metadata":{"dentaia":{"estado":"activo","roles":["paciente"]}}}',true);
do $$
begin
  if (select count(*) from public.routine_followup_consents) <> 0
    or (select count(*) from public.routine_plan_proposals) <> 0 then
    raise exception 'ERROR QA: paciente B ve información ajena';
  end if;
end $$;
rollback;

set role service_role;
-- Una revocación elimina acceso profesional y activa el plan general por defecto.
select public.operar_seguimiento_rutina(
  '11111111-1111-4111-8111-111111111111',
  'revocar_seguimiento',
  p_consent_id => (select id from public.routine_followup_consents limit 1)
);
do $$
begin
  if public.consultar_seguimiento_rutina('11111111-1111-4111-8111-111111111111')
    ->'planActivo' <> 'null'::jsonb then
    raise exception 'ERROR QA: plan activo después de revocación';
  end if;
  if jsonb_array_length(public.consultar_seguimiento_rutina(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc')->'solicitudes')<>0 then
    raise exception 'ERROR QA: profesional conserva acceso tras revocación';
  end if;
end $$;
reset role;
select 'DI-207: pruebas PostgreSQL sintéticas finalizadas' as resultado;
