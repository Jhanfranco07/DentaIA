import subprocess
import time

def ejecutar(sql,record,container,db):
 def start(name,text):
  p=subprocess.Popen(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf8')
  p.stdin.write("SET application_name='"+name+"'; "+text+'\n');p.stdin.close();p.stdin=None
  return p
 def wait(name,event,seconds=20):
  limit=time.monotonic()+seconds
  while time.monotonic()<limit:
   if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='"+name+"' AND "+event+';').stdout.strip()=='1':return True
   time.sleep(.05)
  return False
 def end(p):
  o,e=p.communicate(timeout=30);return p.returncode,o,e
 def reset(g,seconds=3600):
  sql("UPDATE clinical.clinical_access_grants SET revoked_at=clock_timestamp() WHERE patient_id=qa3.id(41) AND membership_id=qa3.id(34) AND revoked_at IS NULL; INSERT INTO clinical.clinical_access_grants(id,patient_id,membership_id,purpose,policy_version,expires_at) VALUES(qa3.id("+str(g)+"),qa3.id(41),qa3.id(34),'academic_shared_history_qa','QA-NO-CLINICO-v1',clock_timestamp()+make_interval(secs=>"+str(seconds)+")); INSERT INTO clinical.clinical_grant_resources VALUES(qa3.id("+str(g)+"),qa3.id(51));")
 kind='concurrencia SQL RPC'
 reset(171)
 p=start('c3_read_first',"BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));SELECT pg_sleep(2);COMMIT;")
 ready=wait('c3_read_first',"wait_event='PgSleep'")
 q=start('c3_revoke_second',"BEGIN;SELECT qa3.as_user(1);SET LOCAL ROLE authenticated;SELECT public.revoke_clinical_access(qa3.id(171));COMMIT;")
 blocked=wait('c3_revoke_second',"wait_event_type='Lock'",1);a=end(p);b=end(q)
 future=sql("BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));COMMIT;").stdout
 record('Lectura primero: revocación espera; nueva consulta denegada',ready and blocked and a[0]==b[0]==0 and '"ok": true' in a[1] and '"status": 403' in future,dict(espera_observada=blocked),kind)
 reset(172)
 p=start('c3_revoke_first',"BEGIN;SELECT qa3.as_user(1);SET LOCAL ROLE authenticated;SELECT public.revoke_clinical_access(qa3.id(172));SELECT pg_sleep(2);COMMIT;")
 ready=wait('c3_revoke_first',"wait_event='PgSleep'")
 q=start('c3_read_second',"BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));COMMIT;")
 blocked=wait('c3_read_second',"wait_event_type='Lock'",1);a=end(p);b=end(q)
 record('Revocación primero: consulta espera y no entrega contenido',ready and blocked and a[0]==b[0]==0 and '"status": 403' in b[1] and '"entries"'not in b[1],dict(espera_observada=blocked),kind)
 reset(173)
 p=start('c3_parallel_one',"BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));SELECT pg_sleep(4);COMMIT;")
 ready=wait('c3_parallel_one',"wait_event='PgSleep'")
 q=start('c3_parallel_two',"BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));SELECT pg_sleep(2);COMMIT;")
 parallel=wait('c3_parallel_two',"wait_event='PgSleep'",1)
 simultaneous=sql("SELECT count(*) FROM pg_stat_activity WHERE application_name IN ('c3_parallel_one','c3_parallel_two') AND wait_event='PgSleep';").stdout.strip()=='2'
 a=end(p);b=end(q)
 record('Dos consultas simultáneas autorizadas son compatibles',ready and parallel and simultaneous and a[0]==b[0]==0,dict(dos_sesiones=simultaneous),kind)
 p=start('c3_suspend',"BEGIN;UPDATE clinical.clinic_memberships SET status='suspended' WHERE id=qa3.id(34);SELECT pg_sleep(2);COMMIT;")
 ready=wait('c3_suspend',"wait_event='PgSleep'")
 q=start('c3_after_suspend',"BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));COMMIT;")
 blocked=wait('c3_after_suspend',"wait_event_type='Lock'",1);a=end(p);b=end(q)
 record('Suspensión concurrente de membresía invalida la consulta',ready and blocked and a[0]==b[0]==0 and '"status": 403' in b[1],dict(espera_observada=blocked),kind)
 sql("UPDATE clinical.clinic_memberships SET status='active' WHERE id=qa3.id(34);")
 p=start('c3_verification',"BEGIN;INSERT INTO clinical.professional_verifications(professional_id,reviewed_by,decision,reference,reason) VALUES(qa3.id(24),qa3.id(6),'rejected','QA','QA');SELECT pg_sleep(2);COMMIT;")
 ready=wait('c3_verification',"wait_event='PgSleep'")
 q=start('c3_after_verification',"BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));COMMIT;")
 blocked=wait('c3_after_verification',"wait_event_type='Lock'",1);a=end(p);b=end(q)
 record('Rechazo profesional concurrente se serializa con la consulta',ready and blocked and a[0]==b[0]==0 and '"status": 403' in b[1],dict(espera_observada=blocked),kind)
 sql("INSERT INTO clinical.professional_verifications(professional_id,reviewed_by,decision,reference,reason) VALUES(qa3.id(24),qa3.id(6),'approved','QA','QA');")
 reset(174,2)
 p=start('c3_expiry_holder',"BEGIN;SELECT id FROM clinical.patient_records WHERE id=qa3.id(41) FOR UPDATE;SELECT pg_sleep(4);COMMIT;")
 ready=wait('c3_expiry_holder',"wait_event='PgSleep'")
 q=start('c3_expiry_read',"BEGIN;SELECT qa3.as_user(4);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));COMMIT;")
 blocked=wait('c3_expiry_read',"wait_event_type='Lock'",1);a=end(p);b=end(q)
 record('Permiso vencido durante espera se rechaza con reloj real',ready and blocked and a[0]==b[0]==0 and '"status": 403' in b[1],dict(espera_observada=blocked),kind)
 reset(175)
 p=start('c3_session_holder',"BEGIN;SELECT id FROM clinical.patient_records WHERE id=qa3.id(41) FOR UPDATE;SELECT pg_sleep(4);COMMIT;")
 ready=wait('c3_session_holder',"wait_event='PgSleep'")
 q=start('c3_session_read',"BEGIN;SELECT qa3.as_user(4,2);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(34));COMMIT;")
 blocked=wait('c3_session_read',"wait_event_type='Lock'",1);a=end(p);b=end(q)
 record('Expiración SQL del JWT durante espera impide contenido',ready and blocked and a[0]==b[0]==0 and '"status": 401' in b[1] and '"entries"'not in b[1],dict(espera_observada=blocked),kind)
 expiry=sql("SELECT clock_timestamp()+interval '1 hour';").stdout.strip()
 query="SELECT public.grant_clinical_access(qa3.id(179),qa3.id(35),ARRAY[qa3.id(51)],'"+expiry+"'::timestamptz,'QA-NO-CLINICO-v1',true);"
 p=start('c3_duplicate_one',"BEGIN;SELECT qa3.as_user(1);SET LOCAL ROLE authenticated;"+query+"SELECT pg_sleep(2);COMMIT;")
 ready=wait('c3_duplicate_one',"wait_event='PgSleep'")
 q=start('c3_duplicate_two',"BEGIN;SELECT qa3.as_user(1);SET LOCAL ROLE authenticated;"+query+"COMMIT;")
 blocked=wait('c3_duplicate_two',"wait_event_type='Lock'",1);a=end(p);b=end(q)
 count=sql("SELECT count(*) FROM clinical.clinical_access_grants WHERE id=qa3.id(179);").stdout.strip()
 record('Dos concesiones simultáneas con misma clave son idempotentes',ready and blocked and a[0]==b[0]==0 and '"status": 201'in a[1] and '"status": 200'in b[1] and count=='1',dict(espera_observada=blocked,filas=count),kind)
 # Persistencia de una denegación fuera de un bloque de pruebas reversible.
 out=sql("BEGIN;SELECT qa3.as_user(5);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(35));COMMIT;").stdout
 import json
 saved=json.loads(next(line for line in out.splitlines()if line.startswith('{')))
 record('Concesión persiste tras COMMIT y funciona en conexión nueva',saved['ok']and len(saved['entries'])==1,None,'persistencia SQL RPC')
 sql("BEGIN;SELECT qa3.as_user(1);SET LOCAL ROLE authenticated;SELECT public.revoke_clinical_access(qa3.id(179));COMMIT;")
 out=sql("BEGIN;SELECT qa3.as_user(5);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(41),qa3.id(35));COMMIT;").stdout
 saved=json.loads(next(line for line in out.splitlines()if line.startswith('{')))
 record('Revocación persiste tras COMMIT y bloquea una conexión nueva',saved['status']==403 and 'entries'not in saved,None,'persistencia SQL RPC')
 # Otro paciente sin autorización: denegación y evento durables.
 out=sql("BEGIN;SELECT qa3.as_user(5);SET LOCAL ROLE authenticated;SELECT public.get_authorized_clinical_history(qa3.id(42),qa3.id(35));COMMIT;").stdout
 response=json.loads(next(line for line in out.splitlines()if line.startswith('{')))
 n=sql("SELECT count(*) FROM clinical.clinical_access_audit WHERE request_id='"+response['requestId']+"' AND outcome='denied' AND patient_id IS NULL;").stdout.strip()
 record('Denegación conserva auditoría tras COMMIT real',response['status']==403 and n=='1',dict(eventos=n),'auditoría SQL persistente')
