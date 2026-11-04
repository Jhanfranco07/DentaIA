"""Casos SQL directos sobre RPC de Fase 3. No declara éxitos ni ejecuta SQL."""
import json
from pathlib import Path
R=Path(__file__).resolve().parent
tests=[]
def add(name,sql,state=None,kind='SQL RPC'):
 row=dict(nombre=name,sql=sql,tipo=kind)
 if state:row['sqlstate']=state
 tests.append(row)
def identity(user=4):return f'SET LOCAL ROLE authenticated; SELECT qa3.as_user({user}); '
def history(user=4,patient=41,member=34,status=200,count=None):
 m='NULL'if member is None else f'qa3.id({member})'
 return identity(user)+f'SELECT qa3.expect(public.get_authorized_clinical_history(qa3.id({patient}),{m}),{status}'+(''if count is None else f',{count}')+');'
def grant(user=1,gid=79,member=35,enc='ARRAY[qa3.id(51)]',expiry="now()+interval '1 hour'",version="'QA-NO-CLINICO-v1'",accepted='true',status=201):
 return identity(user)+f'SELECT qa3.expect(public.grant_clinical_access(qa3.id({gid}),qa3.id({member}),{enc},{expiry},{version},{accepted}),{status});'
def revoke(user=1,gid=71,status=200):return identity(user)+f'SELECT qa3.expect(public.revoke_clinical_access(qa3.id({gid})),{status});'

add('Paciente consulta su historial propio de dos clínicas',history(1,41,None,200,2))
add('Profesional autorizado consulta dos clínicas con una concesión',history(count=2))
add('Otro profesional solo consulta el recurso autorizado',history(3,41,33,200,1))
add('Unión de concesiones incluye ambos recursos autorizados',"INSERT INTO clinical.clinical_access_grants(id,patient_id,membership_id,purpose,policy_version,expires_at) VALUES(qa3.id(75),qa3.id(41),qa3.id(33),'academic_shared_history_qa','QA-NO-CLINICO-v1',now()+interval '1 hour'); INSERT INTO clinical.clinical_grant_resources VALUES(qa3.id(75),qa3.id(51));"+history(3,41,33,200,2))
add('Paciente no consulta otro paciente',history(2,41,None,403))
add('Misma clínica sin concesión no concede acceso',history(5,41,35,403))
add('Concesión vencida no concede acceso',history(3,42,33,403))
add('Concesión revocada no concede acceso',history(4,42,34,403))
add('Superusuario no obtiene acceso clínico por ser administrador',history(6,41,34,403))
add('Contexto de otro profesional no se puede declarar propio',history(4,41,33,403))
add('Paciente inexistente e ID manipulado deniegan sin contenido',history(4,999,34,403))
add('Profesional suspendido no accede',"UPDATE clinical.professional_accounts SET status='suspended' WHERE id=qa3.id(24);"+history(4,41,34,403))
add('Clínica inactiva no permite lectura',"UPDATE clinical.clinics SET status='inactive' WHERE id=qa3.id(12);"+history(4,41,34,403))
add('Membresía suspendida no permite lectura',"UPDATE clinical.clinic_memberships SET status='suspended' WHERE id=qa3.id(34);"+history(4,41,34,403))
add('Nueva verificación rechazada invalida la consulta',"INSERT INTO clinical.professional_verifications(professional_id,reviewed_by,decision,reference,reason,reviewed_at) VALUES(qa3.id(24),qa3.id(6),'rejected','QA','QA',now()+interval '1 second');"+history(4,41,34,403))
add('Rol Auth retirado se vuelve a verificar',"UPDATE auth.users SET raw_app_meta_data=jsonb_set(raw_app_meta_data,'{dentaia,roles}','[\"paciente\"]') WHERE id=qa3.id(4);"+history(4,41,34,403))
add('user_metadata no eleva privilegios',"UPDATE auth.users SET raw_user_meta_data='{\"dentaia\":{\"roles\":[\"odontologo\"]}}' WHERE id=qa3.id(2);"+history(2,41,34,403))
add('Cuenta suspendida en Auth no accede',"UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=qa3.id(4);"+history(4,41,34,401))
add('Sesión borrada en Auth se rechaza',"DELETE FROM auth.sessions WHERE id=qa3.id(1004);"+history(4,41,34,401))
add('JWT SQL expirado se rechaza',"SELECT qa3.as_user(4,-1); SET LOCAL ROLE authenticated; SELECT qa3.expect(public.get_authorized_clinical_history(qa3.id(41),qa3.id(34)),401);")
add('Sin claims de sesión no se obtiene historial',"SET LOCAL request.jwt.claim.sub=''; SET LOCAL request.jwt.claims='{}'; SET LOCAL ROLE authenticated; SELECT qa3.expect(public.get_authorized_clinical_history(qa3.id(41),qa3.id(34)),401);")
add('Identidad Auth inexistente se rechaza sin error de FK de auditoría',history(999,41,34,401))
add('Versión textual de roles no sustituye la versión numérica canónica',"UPDATE auth.users SET raw_app_meta_data=jsonb_set(raw_app_meta_data,'{dentaia,version}','\"1\"') WHERE id=qa3.id(4);"+history(4,41,34,401))
add('Roles duplicados se rechazan como asignación inválida',"UPDATE auth.users SET raw_app_meta_data=jsonb_set(raw_app_meta_data,'{dentaia,roles}','[\"odontologo\",\"odontologo\"]') WHERE id=qa3.id(4);"+history(4,41,34,401))
add('Roles desconocidos se rechazan como asignación inválida',"UPDATE auth.users SET raw_app_meta_data=jsonb_set(raw_app_meta_data,'{dentaia,roles}','[\"odontologo\",\"root\"]') WHERE id=qa3.id(4);"+history(4,41,34,401))
add('Paciente otorga concesión propia y persistencia interna',grant()+"RESET ROLE; DO $$ BEGIN ASSERT EXISTS(SELECT 1 FROM clinical.clinical_access_grants WHERE id=qa3.id(79) AND patient_id=qa3.id(41)); ASSERT EXISTS(SELECT 1 FROM clinical.clinical_grant_resources WHERE grant_id=qa3.id(79) AND encounter_id=qa3.id(51)); END $$;")
add('Concesión no permite alcance de otro paciente',grant(enc='ARRAY[qa3.id(53)]',status=403))
add('Concesión requiere aceptación explícita',grant(accepted='false',status=400))
add('Concesión requiere versión de política del operador',grant(version="'version-inventada'",status=403))
add('Destinatario con asignación inválida no recibe concesión',"UPDATE auth.users SET raw_app_meta_data=jsonb_set(raw_app_meta_data,'{dentaia,version}','\"1\"') WHERE id=qa3.id(5);"+grant(status=403))
add('Concesión no permite vencimiento pasado',grant(expiry="now()-interval '1 hour'",status=400))
add('Concesión rechaza infinito',grant(expiry="'infinity'::timestamptz",status=400))
add('Concesión no admite recursos duplicados',grant(enc='ARRAY[qa3.id(51),qa3.id(51)]',status=400))
add('Odontólogo sin rol paciente no otorga permisos por otra cuenta',grant(user=4,status=403))
add('Consentimiento fotográfico no concede acceso clínico',history(3,42,33,403))
add('Idempotencia conserva concesión y recursos',grant()+"RESET ROLE;"+grant(status=200)+"RESET ROLE; DO $$ BEGIN ASSERT (SELECT count(*)=1 FROM clinical.clinical_access_grants WHERE id=qa3.id(79)); END $$;")
add('Clave idempotente con otro contenido se rechaza',grant()+"RESET ROLE;"+grant(enc='ARRAY[qa3.id(52)]',status=409))
add('Colisión de clave de otro propietario no revela su concesión',grant(gid=73,status=409))
add('Paciente revoca su propia concesión',revoke()+"RESET ROLE; DO $$ BEGIN ASSERT (SELECT revoked_at IS NOT NULL FROM clinical.clinical_access_grants WHERE id=qa3.id(71)); END $$;")
add('Revocación ajena y desconocida se rechazan igual',revoke(user=2,status=403)+"RESET ROLE;"+revoke(user=2,gid=999,status=403))
add('Reintento de revocación conserva el mismo instante',identity(1)+"DO $$ DECLARE a jsonb;b jsonb; BEGIN a:=public.revoke_clinical_access(qa3.id(71)); b:=public.revoke_clinical_access(qa3.id(71)); ASSERT a->>'revokedAt'=b->>'revokedAt'; END $$;")
add('Revocación impide nuevas consultas',revoke()+"RESET ROLE;"+history(4,41,34,403))
add('Concesión repetida después de revocar no se reactiva',grant()+"RESET ROLE;"+revoke(gid=79)+"RESET ROLE;"+grant(status=200)+"RESET ROLE; DO $$ BEGIN ASSERT (SELECT revoked_at IS NOT NULL FROM clinical.clinical_access_grants WHERE id=qa3.id(79)); END $$;")
add('Paginación keyset no duplica ni omite la segunda atención',identity(4)+"DO $$ DECLARE a jsonb;b jsonb; BEGIN a:=public.get_authorized_clinical_history(qa3.id(41),qa3.id(34),1); PERFORM qa3.expect(a,200,1); ASSERT a->'nextCursor' IS NOT NULL; b:=public.get_authorized_clinical_history(qa3.id(41),qa3.id(34),1,(a->'nextCursor'->>'beforeAt')::timestamptz,(a->'nextCursor'->>'beforeId')::uuid); PERFORM qa3.expect(b,200,1); ASSERT a->'entries'->0->>'encounterId'<>b->'entries'->0->>'encounterId'; END $$;")
add('Cursor manipulado no amplía el alcance',identity(3)+"DO $$ DECLARE r jsonb; BEGIN r:=public.get_authorized_clinical_history(qa3.id(41),qa3.id(33),50,now()+interval '1 year',qa3.id(53)); PERFORM qa3.expect(r,200,1); ASSERT r->'entries'->0->>'encounterId'=qa3.id(52)::text; END $$;")
add('Límite de página inválido se rechaza',identity(4)+"SELECT qa3.expect(public.get_authorized_clinical_history(qa3.id(41),qa3.id(34),0),400);")
add('Página con demasiados objetos no entrega un historial parcial silencioso',"INSERT INTO clinical.clinical_entries(encounter_id,kind,information_state) SELECT qa3.id(51),'diagnosis','not_recorded' FROM generate_series(1,101); SET CONSTRAINTS ALL IMMEDIATE;"+history(status=503))
add('Campos desconocidos y exámenes ausentes no inventan datos',identity(4)+"DO $$ DECLARE r jsonb; BEGIN r:=public.get_authorized_clinical_history(qa3.id(41),qa3.id(34)); ASSERT r->'entries'->0->'diagnoses'->0->>'state'='unknown'; ASSERT r->'entries'->0->'diagnoses'->0->'value'='null'::jsonb; ASSERT r->'entries'->1->'exams'->0->>'availability'='unavailable'; ASSERT r->'entries'->0->'origin'->'professionalName'='null'::jsonb; END $$;")
add('DTO no expone Auth, correos, secretos o rutas Storage',identity(4)+"DO $$ DECLARE r jsonb; BEGIN r:=public.get_authorized_clinical_history(qa3.id(41),qa3.id(34)); ASSERT r::text !~ '(encrypted_password|raw_app_meta_data|session_id|object_path|bucket_id|@|mfa_factors|signedUrl)'; END $$;")
add('Auditoría permitida registra concesiones efectivas',history()+"RESET ROLE; DO $$ BEGIN ASSERT EXISTS(SELECT 1 FROM clinical.clinical_access_audit WHERE actor_user_id=qa3.id(4) AND patient_id=qa3.id(41) AND membership_id=qa3.id(34) AND grant_id=qa3.id(71) AND outcome='allowed'); END $$;")
add('Auditoría denegada preserva contexto propio sin paciente ajeno',history(5,41,35,403)+"RESET ROLE; DO $$ BEGIN ASSERT EXISTS(SELECT 1 FROM clinical.clinical_access_audit WHERE actor_user_id=qa3.id(5) AND membership_id=qa3.id(35) AND patient_id IS NULL AND grant_id IS NULL AND outcome='denied'); END $$;")
add('Anon no ejecuta RPC',"SET LOCAL ROLE anon; SELECT public.get_authorized_clinical_history(NULL);",'42501','ACL')
add('Authenticated no consulta directamente tablas clínicas',identity()+"SELECT * FROM clinical.clinical_encounters;",'42501','ACL')
add('Authenticated no edita auditoría',identity()+"UPDATE clinical.clinical_access_audit SET outcome='allowed';",'42501','ACL')
add('Authenticated no fabrica auditoría',identity()+"INSERT INTO clinical.clinical_access_audit(request_id,operation,outcome,reason_code) VALUES(gen_random_uuid(),'read_history','allowed','FORGED');",'42501','ACL')
add('Authenticated no adopta el rol ejecutor',identity()+"SET LOCAL ROLE dentaia_clinical_executor;",'42501','ACL')
add('Authenticated no modifica roles Auth',identity()+"UPDATE auth.users SET raw_app_meta_data='{}' WHERE id=qa3.id(4);",'42501','ACL')
add('Helpers privados y secretos quedan fuera de permisos cliente',"DO $$ BEGIN ASSERT NOT has_function_privilege('authenticated','clinical_service.identity_context(uuid)','EXECUTE'); ASSERT NOT has_function_privilege('authenticated','clinical_service.configuration()','EXECUTE'); ASSERT NOT has_column_privilege('dentaia_clinical_executor','auth.users','encrypted_password','SELECT'); ASSERT NOT has_column_privilege('dentaia_clinical_executor','clinical.clinical_documents','object_path','SELECT'); ASSERT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dentaia_clinical_executor' AND (rolcanlogin OR rolbypassrls OR rolsuper)); ASSERT NOT has_table_privilege('dentaia_clinical_executor','public.appointment_requests','SELECT'); END $$;",kind='mínimo privilegio')
add('Wrappers públicos son INVOKER; servicio privado usa rol mínimo',"DO $$ BEGIN ASSERT NOT(SELECT prosecdef FROM pg_proc WHERE oid='public.get_authorized_clinical_history(uuid,uuid,integer,timestamptz,uuid)'::regprocedure); ASSERT (SELECT proowner='dentaia_clinical_executor'::regrole AND prosecdef FROM pg_proc WHERE oid='clinical_service.read_history(uuid,uuid,integer,timestamptz,uuid)'::regprocedure); END $$;",kind='mínimo privilegio')
disabled="CREATE OR REPLACE FUNCTION clinical_service.configuration() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $c$ SELECT '{\"enabled\":false}'::jsonb; $c$;"
add('Configuración apagada impide lecturas',disabled+history(status=503))
add('Un GUC del cliente no habilita el servicio apagado',disabled+"SET LOCAL dentaia.clinical.enabled='true';"+history(status=503))
add('Configuración apagada impide nuevas concesiones',disabled+grant(status=503))
add('Apagar nuevas concesiones no impide revocar las propias',disabled+revoke())
add('Cliente no ejecuta configuración reservada al operador',identity()+"SELECT clinical_service.configuration();",'42501','ACL')
fault="CREATE FUNCTION pg_temp.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $q$ BEGIN RAISE EXCEPTION 'QA_AUDIT_FAILURE'; END $q$; CREATE TRIGGER qa_fail BEFORE INSERT ON clinical.clinical_access_audit FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_audit();"
add('Fallo de auditoría impide respuesta clínica',fault+identity()+"SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));",'P0001','auditoría')
add('Fallo de auditoría revierte concesión',fault+"SELECT qa3.as_user(1); SET LOCAL ROLE authenticated; DO $$ BEGIN BEGIN PERFORM public.grant_clinical_access(qa3.id(79),qa3.id(35),ARRAY[qa3.id(51)],now()+interval '1 hour','QA-NO-CLINICO-v1',true); RAISE EXCEPTION 'MISSING_FAILURE'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'CLINICAL_OPERATION_UNAVAILABLE' THEN RAISE; END IF; END; END $$; RESET ROLE; DO $$ BEGIN ASSERT NOT EXISTS(SELECT 1 FROM clinical.clinical_access_grants WHERE id=qa3.id(79)); END $$;",kind='auditoría')
add('Fallo de auditoría revierte revocación',fault+"SELECT qa3.as_user(1); SET LOCAL ROLE authenticated; DO $$ BEGIN BEGIN PERFORM public.revoke_clinical_access(qa3.id(71)); RAISE EXCEPTION 'MISSING_FAILURE'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'CLINICAL_OPERATION_UNAVAILABLE' THEN RAISE; END IF; END; END $$; RESET ROLE; DO $$ BEGIN ASSERT (SELECT revoked_at IS NULL FROM clinical.clinical_access_grants WHERE id=qa3.id(71)); END $$;",kind='auditoría')
for t in tests:
 # Prueba de SET ROLE real desde la misma clase de conexión que utiliza PostgREST.
 if t['nombre']=='Authenticated no adopta el rol ejecutor':t['db_user']='authenticator'
 if t['nombre'] in ['Paciente consulta su historial propio de dos clínicas','Profesional autorizado consulta dos clínicas con una concesión','Otro profesional solo consulta el recurso autorizado','Paciente no consulta otro paciente','Misma clínica sin concesión no concede acceso','Concesión vencida no concede acceso','Concesión revocada no concede acceso','Superusuario no obtiene acceso clínico por ser administrador','Contexto de otro profesional no se puede declarar propio','Paciente inexistente e ID manipulado deniegan sin contenido']:
  t['db_user']='authenticator';t['tipo']='RPC SQL conexión authenticator'
(R/'casos.json').write_text(json.dumps(tests,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Casos generados:',len(tests))
