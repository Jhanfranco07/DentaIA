-- Copia adaptada para Auth oficial local. NO migración; solo SQL sintético.
-- Integración PostgreSQL con identidades sintéticas. NO EJECUTADA en esta entrega.
-- Requiere fixtures-auth-local.sql y la migración SOLO en un contenedor desechable.
begin;
set local plpgsql.check_asserts = on;
INSERT INTO auth.users(id,raw_app_meta_data,email_confirmed_at,created_at,updated_at,aud,role) SELECT id,metadata::jsonb,now(),now(),now(),'authenticated','authenticated' FROM (VALUES (public.qa_id(1),'{"provider":"email","dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}'),
  (public.qa_id(2),'{"provider":"email","dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}'),
  (public.qa_id(3),'{"provider":"email","otro":{"conservar":true}}'),
  (public.qa_id(4),'{"provider":"email"}')) v(id,metadata);
INSERT INTO auth.mfa_factors(id,user_id,status,factor_type,created_at,updated_at) VALUES(public.qa_id(10),public.qa_id(1),'verified','totp',now(),now());
INSERT INTO auth.sessions(id,user_id,factor_id,aal,not_after,created_at,updated_at) VALUES(public.qa_id(11),public.qa_id(1),public.qa_id(10),'aal2',now()+interval '1 hour',now(),now());
INSERT INTO auth.mfa_amr_claims(id,session_id,authentication_method,updated_at,created_at) VALUES(gen_random_uuid(),public.qa_id(11),'totp',clock_timestamp(),clock_timestamp());
insert into dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,vence_en)
select public.qa_id(n),public.qa_id(1),public.qa_id(3),public.qa_id(2),'asignar','paciente',0,now()+interval '1 hour'
from generate_series(20,24) n;

do $$ declare r jsonb; begin
  assert not has_function_privilege('anon','public.dentaia_cambiar_roles_v1(jsonb,jsonb,uuid)','EXECUTE');
  assert not has_function_privilege('authenticated','public.dentaia_cambiar_roles_v1(jsonb,jsonb,uuid)','EXECUTE');
  assert has_function_privilege('service_role','public.dentaia_cambiar_roles_v1(jsonb,jsonb,uuid)','EXECUTE');
  assert not has_table_privilege('service_role','dentaia_admin.aprobaciones_roles','INSERT');
  assert not has_table_privilege('authenticated','dentaia_admin.auditoria_roles','SELECT');
  assert (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dentaia_admin' and c.relkind='r');
  r := public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,20),public.qa_id(30));
  assert r->>'resultado' = 'aplicado' and (r->>'revision')::integer = 1;
  assert (select raw_app_meta_data->'dentaia'->'roles' = '["paciente"]'::jsonb from auth.users where id=public.qa_id(3));
  assert (select raw_app_meta_data - 'dentaia' = '{"provider":"email","otro":{"conservar":true}}'::jsonb from auth.users where id=public.qa_id(3));
  assert (select count(*)=1 from dentaia_admin.auditoria_roles);
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,20),public.qa_id(30)) = r;
  assert (select count(*)=1 from dentaia_admin.auditoria_roles);
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,21),public.qa_id(30))->>'codigo' = 'CLAVE_REUTILIZADA';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,21),public.qa_id(31))->>'codigo' = 'VERSION_OBSOLETA';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(1,22),public.qa_id(32))->>'codigo' = 'CAMBIO_PROPIO_PROHIBIDO';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(2,22,0,'{"version":1,"estado":"activo","roles":["superusuario"]}') || '{"operacion":"revocar","rol":"superusuario"}',public.qa_id(33))->>'codigo' = 'APROBACION_NO_VALIDA';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,24) || '{"rol":"superusuario"}',public.qa_id(34))->>'status' = '403';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,24) || '{"rol":"odontologo"}',public.qa_id(35))->>'status' = '403';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,99),public.qa_id(36))->>'codigo' = 'APROBACION_NO_VALIDA';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),jsonb_build_object('usuarioId',public.qa_id(3),'operacion','consultar'),null)->>'revision' = '1';
end $$;

-- Aprobación correcta no sustituye MFA del objetivo en una promoción.
insert into dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,vence_en)
values(public.qa_id(28),public.qa_id(1),public.qa_id(4),public.qa_id(2),'asignar','superusuario',0,now()+interval '1 hour');
do $$ begin
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,28) || '{"rol":"superusuario"}',public.qa_id(41))->>'codigo'='MFA_OBJETIVO_REQUERIDO';
  assert (select consumida_por is null from dentaia_admin.aprobaciones_roles where id=public.qa_id(28));
end $$;
-- Un no-op consume su aprobación una vez, sin incrementar revisión.
insert into dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,asignacion_esperada,vence_en)
values(public.qa_id(29),public.qa_id(1),public.qa_id(3),public.qa_id(2),'asignar','paciente',1,
  '{"version":1,"estado":"activo","roles":["paciente"]}',now()+interval '1 hour');
do $$ declare peticion jsonb; begin
  peticion:=public.qa_peticion(3,29,1,'{"version":1,"estado":"activo","roles":["paciente"]}');
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),peticion,public.qa_id(42))->>'resultado'='sin_cambios';
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),peticion,public.qa_id(43))->>'codigo'='APROBACION_NO_VALIDA';
  assert (select revision=1 from dentaia_admin.revisiones_roles where usuario_id=public.qa_id(3));
end $$;

-- Revocación aprobada del único rol: retira solamente el namespace DentaIA.
insert into dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,asignacion_esperada,vence_en)
values(public.qa_id(25),public.qa_id(1),public.qa_id(3),public.qa_id(2),'revocar','paciente',1,
  '{"version":1,"estado":"activo","roles":["paciente"]}',now()+interval '1 hour');

-- Fallo artificial de auditoría, SOLO en la fixture desechable. Exige rollback total.
create function pg_temp.fallar_auditoria() returns trigger language plpgsql as $$
begin raise exception 'FALLO_QA_AUDITORIA'; end; $$;
create trigger qa_fallo before insert on dentaia_admin.auditoria_roles for each row execute function pg_temp.fallar_auditoria();
do $$ declare peticion jsonb; fallo boolean:=false; begin
  peticion := public.qa_peticion(3,25,1,'{"version":1,"estado":"activo","roles":["paciente"]}') || '{"operacion":"revocar"}';
  begin perform public.dentaia_cambiar_roles_v1(public.qa_contexto(),peticion,public.qa_id(37));
  exception when raise_exception then
    if sqlerrm <> 'FALLO_QA_AUDITORIA' then raise; end if;
    fallo:=true;
  end;
  assert fallo;
  assert (select revision=1 from dentaia_admin.revisiones_roles where usuario_id=public.qa_id(3));
  assert (select raw_app_meta_data ? 'dentaia' from auth.users where id=public.qa_id(3));
  assert (select consumida_por is null from dentaia_admin.aprobaciones_roles where id=public.qa_id(25));
  assert not exists(select 1 from dentaia_admin.auditoria_roles where solicitud_id=public.qa_id(37));
end $$;
drop trigger qa_fallo on dentaia_admin.auditoria_roles;
do $$ declare peticion jsonb; r jsonb; begin
  peticion := public.qa_peticion(3,25,1,'{"version":1,"estado":"activo","roles":["paciente"]}') || '{"operacion":"revocar"}';
  r := public.dentaia_cambiar_roles_v1(public.qa_contexto(),peticion,public.qa_id(37));
  assert r->>'resultado'='aplicado' and r->>'revision'='2';
  assert (select raw_app_meta_data = '{"provider":"email","otro":{"conservar":true}}'::jsonb from auth.users where id=public.qa_id(3));
  assert (select consumida_por=public.qa_id(37) from dentaia_admin.aprobaciones_roles where id=public.qa_id(25));
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),peticion,public.qa_id(37))=r;
end $$;

-- Promoción/revocación administrativa con aprobación distinta de actor/objetivo.
INSERT INTO auth.mfa_factors(id,user_id,status,factor_type,created_at,updated_at) VALUES(public.qa_id(13),public.qa_id(3),'verified','totp',now(),now());
insert into dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,asignacion_esperada,vence_en)
values(public.qa_id(26),public.qa_id(1),public.qa_id(3),public.qa_id(2),'asignar','superusuario',2,null,now()+interval '1 hour'),
  (public.qa_id(27),public.qa_id(1),public.qa_id(3),public.qa_id(2),'revocar','superusuario',3,
  '{"version":1,"estado":"activo","roles":["superusuario"]}',now()+interval '1 hour');
do $$ declare r jsonb; begin
  r := public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,26,2) || '{"rol":"superusuario"}',public.qa_id(39));
  assert r->>'resultado'='aplicado' and r->>'revision'='3';
  assert r->'asignacion'->'roles'='["superusuario"]'::jsonb;
  r := public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,27,3,'{"version":1,"estado":"activo","roles":["superusuario"]}') || '{"rol":"superusuario","operacion":"revocar"}',public.qa_id(40));
  assert r->>'resultado'='aplicado' and r->>'revision'='4';
  assert (select raw_app_meta_data = '{"provider":"email","otro":{"conservar":true}}'::jsonb from auth.users where id=public.qa_id(3));
end $$;

-- Pérdida de autorización y recencia: ni el resultado previo autoriza otra escritura.
update auth.users set raw_app_meta_data='{}' where id=public.qa_id(1);
do $$ begin
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,20),public.qa_id(30))->>'codigo'='AUTORIZACION_NO_VIGENTE';
end $$;
update auth.users set raw_app_meta_data='{"dentaia":{"version":1,"estado":"activo","roles":["superusuario"]}}' where id=public.qa_id(1);
update auth.mfa_amr_claims set updated_at=clock_timestamp()-interval '6 minutes';
do $$ begin
  assert public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,24),public.qa_id(38))->>'codigo'='AUTORIZACION_NO_VIGENTE';
end $$;
rollback;
