-- Pruebas de integración/RLS para la base desechable iniciada con fixtures.
-- Todos los IDs y datos son sintéticos.
\set ON_ERROR_STOP on

-- El DDL crea todos los objetos y protege tablas sensibles por RLS y grants.
do $$ begin
  if not exists (select 1 from pg_extension where extname='postgis') then raise exception 'falta PostGIS'; end if;
  if (select count(*) from pg_class where oid in ('public.dentist_public_locations'::regclass,'public.dentist_reviews'::regclass,'public.dentist_review_reports'::regclass) and relrowsecurity) <> 3 then raise exception 'RLS incompleto'; end if;
  if to_regprocedure('public.dentaia_gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text)') is null then raise exception 'falta RPC'; end if;
  if to_regprocedure('dentaia_locations_admin.membresia_vigente(uuid,uuid)') is null then raise exception 'falta verificador de asociación'; end if;
  if not exists (select 1 from pg_trigger where tgname='impedir_edicion_auditoria_ubicaciones' and not tgisinternal) then raise exception 'falta trigger append-only'; end if;
  if (select count(*) from pg_indexes where schemaname='public' and indexname like 'dentist_public_locations_%') < 3 then raise exception 'índices de sede incompletos'; end if;
  if has_table_privilege('anon','public.dentist_public_locations','INSERT') or has_table_privilege('authenticated','public.dentist_public_locations','UPDATE') then raise exception 'grant de escritura indebido'; end if;
  if has_table_privilege('anon','dentaia_locations_admin.auditoria_ubicaciones','SELECT') then raise exception 'auditoría expuesta'; end if;
end $$;

-- Una consulta pública no revela sedes en estado pending/hidden ni perfiles demo.
set role anon;
do $$ begin
  if (select count(*) from public.dentist_public_locations) <> 0 then raise exception 'lectura pública inesperada'; end if;
  begin
    insert into public.dentist_public_locations(dentist_id,clinic_id,practice_name,practice_address,latitude,longitude)
    values ('44444444-4444-4444-8444-444444444444','77777777-7777-4777-8777-777777777777','X','Y',0,0);
    raise exception 'anon pudo escribir ubicaciones';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Una reseña propia/completada/demo=false y con odontólogo correcto es elegible.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2","exp":2147483647,"session_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","app_metadata":{"dentaia":{"version":"1","estado":"activo","roles":["paciente"]}}}';
set role authenticated;
insert into public.dentist_reviews(dentist_id,appointment_request_id,rating,comment)
values ('44444444-4444-4444-8444-444444444444','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',5,'Atención sintética validada');
do $$ begin
  begin
    insert into public.dentist_reviews(dentist_id,appointment_request_id,rating,comment)
    values ('44444444-4444-4444-8444-444444444444','bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',5,'Asociación incorrecta del profesional');
    raise exception 'permitió odontólogo manipulado';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.dentist_reviews(dentist_id,appointment_request_id,rating,comment)
    values ('44444444-4444-4444-8444-444444444444','cccccccc-1111-4111-8111-cccccccccccc',5,'Solicitud demo no elegible');
    raise exception 'permitió solicitud demo';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Un paciente no puede usar la RPC administrativa.
do $$ declare r jsonb; begin
  r := public.dentaia_gestionar_ubicacion_v1('dddddddd-dddd-4ddd-8ddd-dddddddddddd','guardar',null,
    '44444444-4444-4444-8444-444444444444','77777777-7777-4777-8777-777777777777','Clínica','Dirección sintética',-12.1,-77.1,null);
  if r->>'codigo' <> 'ROL_O_MFA_INSUFICIENTE' then raise exception 'RPC no denegó paciente: %',r; end if;
end $$;

-- Admin sintético AAL2 guarda una sede pendiente, puede publicarla con evidencia y ocultarla.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2","exp":2147483647,"session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}';
set role authenticated;
do $$ declare r jsonb; loc uuid; begin
  r := public.dentaia_gestionar_ubicacion_v1('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','guardar',null,
    '44444444-4444-4444-8444-444444444444','77777777-7777-4777-8777-777777777777','Consultorio sintético','Domicilio sintético QA',-12.1,-77.1,null);
  if r->>'codigo' <> 'UBICACION_PENDIENTE' then raise exception 'guardar falló: %',r; end if;
  loc := (r->>'ubicacionId')::uuid;
  r := public.dentaia_gestionar_ubicacion_v1('ffffffff-ffff-4fff-8fff-ffffffffffff','publicar',loc,null,null,null,null,null,null,'Evidencia sintética QA 001');
  if r->>'codigo' <> 'UBICACION_PUBLICADA' then raise exception 'publicar falló: %',r; end if;
  r := public.dentaia_gestionar_ubicacion_v1('12121212-1212-4212-8212-121212121212','guardar',null,
    '55555555-5555-4555-8555-555555555555','77777777-7777-4777-8777-777777777777','Otro','Sin vínculo',0,0,null);
  if r->>'codigo' <> 'VINCULACION_NO_VIGENTE' then raise exception 'permitió perfil sin vínculo: %',r; end if;
end $$;
reset role;
set role anon;
do $$ begin
  if (select count(*) from public.dentist_public_locations) <> 1 then raise exception 'sede publicada no visible'; end if;
  begin
    update public.dentist_public_locations set practice_address='alterada';
    raise exception 'anon pudo modificar sede';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update clinical.clinic_memberships set valid_until=now()-interval '1 minute' where id='99999999-9999-4999-8999-999999999999';
set role anon;
do $$ begin
  if (select count(*) from public.dentist_public_locations) <> 0 then raise exception 'sede visible sin membresía vigente'; end if;
end $$;
reset role;
update clinical.clinic_memberships set valid_until=null where id='99999999-9999-4999-8999-999999999999';
set role authenticated;
do $$ declare r jsonb; loc uuid; begin
  select id into loc from public.dentist_public_locations limit 1;
  r := public.dentaia_gestionar_ubicacion_v1('13131313-1313-4313-8313-131313131313','ocultar',loc,null,null,null,null,null,null,null);
  if r->>'codigo' <> 'UBICACION_OCULTA' then raise exception 'ocultar falló: %',r; end if;
  if (select count(*) from public.dentist_public_locations) <> 0 then raise exception 'ubicación oculta visible'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from dentaia_locations_admin.auditoria_ubicaciones) <> 3 then raise exception 'auditoría incompleta'; end if;
end $$;

-- La auditoría es append-only incluso para roles cliente.
set role authenticated;
do $$ begin
  begin
    delete from dentaia_locations_admin.auditoria_ubicaciones;
    raise exception 'auditoría modificable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
