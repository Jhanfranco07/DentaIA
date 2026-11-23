-- QA aislada: nunca utiliza números, pacientes ni citas de producción.
-- current_date debe coincidir con la fecha de Lima usada por la transición
-- completar; en UTC, por la noche en Perú, la cita quedaría para mañana.
set time zone 'America/Lima';

do $$
begin
  if has_table_privilege('anon','public.dentist_contact_channels','INSERT')
     or has_table_privilege('authenticated','public.dentist_contact_channels','DELETE')
     or has_function_privilege('anon','public.gestionar_cita_profesional(uuid,text)','EXECUTE') then
    raise exception 'ACCESO_EXCESIVO';
  end if;
end $$;

-- El propietario puede registrar el contacto y publicarlo voluntariamente.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.dentist_contact_channels(
  dentist_id,whatsapp_e164,whatsapp_publicado,consentimiento_publicacion_en
) values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd','+51912345678',true,now()
);
commit;

-- Un segundo odontólogo no puede alterar ese contacto.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$
declare filas integer;
begin
  -- La publicación es visible a todos; la edición es exclusiva del titular.
  if (select count(*) from public.dentist_contact_channels) <> 1 then
    raise exception 'CONTACTO_PUBLICADO_NO_VISIBLE';
  end if;
  update public.dentist_contact_channels set whatsapp_e164='+51900000000'
    where dentist_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  get diagnostics filas=row_count;
  if filas<>0 then raise exception 'EDICION_AJENA_AUTORIZADA'; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.appointment_requests(
  id,user_id,dentist_id,contact_name,contact_email,preferred_date,message,status,is_demo
) values (
  '88888888-8888-4888-8888-888888888888',
  '11111111-1111-4111-8111-111111111111',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Paciente de prueba','prueba@example.invalid',current_date,'Consulta de prueba','requested',false
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$
declare v_id uuid;
begin
  select id into v_id from public.appointment_requests where is_demo=false limit 1;
  perform public.gestionar_cita_profesional(v_id,'confirmar');
  perform public.gestionar_cita_profesional(v_id,'completar');
end $$;
commit;

do $$
begin
  if (select status from public.appointment_requests where is_demo=false limit 1)<>'completed'
  then raise exception 'ATENCION_NO_COMPLETADA'; end if;
end $$;

-- Rechazo de una cita ajena al profesional.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$
declare v_denied boolean:=false;
begin
  begin
    perform public.gestionar_cita_profesional(
      '88888888-8888-4888-8888-888888888888','cancelar');
  exception when sqlstate '42501' then v_denied:=true;
  end;
  if not v_denied then raise exception 'PROFESIONAL_AJENO_ACEPTADO'; end if;
end $$;
rollback;

-- Retirar autorización de WhatsApp debe retirarla de lectura pública.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
update public.dentist_contact_channels
set whatsapp_publicado=false,consentimiento_publicacion_en=null
where dentist_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
commit;
begin;
set local role anon;
do $$
begin
  if (select count(*) from public.dentist_contact_channels)<>0
    then raise exception 'CONTACTO_PRIVADO_VISIBLE'; end if;
end $$;
rollback;
select 'CONTACTO_CITAS_QA_OK' as resultado;
