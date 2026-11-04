"""Sesiones PostgreSQL reales e independientes; nunca conecta fuera de Docker QA."""
import subprocess
import time

def ejecutar(call, record, container, db):
    def start(name,sql):
        p=subprocess.Popen(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf8')
        p.stdin.write("SET application_name='"+name+"'; "+sql+'\n')
        p.stdin.close();p.stdin=None
        return p
    def wait(name,event,seconds=30):
        limit=time.monotonic()+seconds
        while time.monotonic()<limit:
            s=call("SELECT count(*) FROM pg_stat_activity WHERE application_name='"+name+"' AND "+event+';').stdout.strip()
            if s=='1':return True
            time.sleep(.1)
        return False
    def finish(p):
        out,err=p.communicate(timeout=40)
        return p.returncode,out,err
    def reset(g,expires="interval '1 day'"):
        call("UPDATE clinical.clinical_access_grants SET revoked_at=clock_timestamp() WHERE patient_id=qa.id(41) AND membership_id=qa.id(34) AND revoked_at IS NULL; INSERT INTO clinical.clinical_access_grants(id,patient_id,membership_id,purpose,policy_version,expires_at) VALUES(qa.id("+str(g)+"),qa.id(41),qa.id(34),'qa_test','qa-v1',clock_timestamp()+"+expires+"); INSERT INTO clinical.clinical_grant_resources VALUES(qa.id("+str(g)+"),qa.id(51));")
    def allowed():
        return call("BEGIN;SELECT qa.identity(4); SET LOCAL ROLE authenticated; SELECT qa.history(qa.id(41),qa.id(34),gen_random_uuid())->>'allowed'; COMMIT;").stdout.strip().endswith('true')
    category='concurrencia del prototipo QA'

    reset(171)
    p=start('qa_read_first',"BEGIN;SELECT qa.identity(4);SET LOCAL ROLE authenticated;SELECT qa.history(qa.id(41),qa.id(34),qa.id(971));SELECT pg_sleep(10);COMMIT;")
    ready=wait('qa_read_first',"wait_event='PgSleep'")
    q=start('qa_revoke_second',"BEGIN;SELECT qa.identity(1);SET LOCAL ROLE authenticated;SELECT qa.revoke_grant(qa.id(171),qa.id(972));COMMIT;")
    blocked=wait('qa_revoke_second',"wait_event_type='Lock'",5)
    a=finish(p);b=finish(q)
    record('Lectura primero: revocación espera y nuevas lecturas deniegan',ready and blocked and a[0]==b[0]==0 and '"allowed": true' in a[1] and not allowed(),{'espera_observada':blocked},category)

    reset(172)
    p=start('qa_revoke_first',"BEGIN;SELECT qa.identity(1);SET LOCAL ROLE authenticated;SELECT qa.revoke_grant(qa.id(172),qa.id(973));SELECT pg_sleep(10);COMMIT;")
    ready=wait('qa_revoke_first',"wait_event='PgSleep'")
    q=start('qa_read_second',"BEGIN;SELECT qa.identity(4);SET LOCAL ROLE authenticated;SELECT qa.history(qa.id(41),qa.id(34),qa.id(974));COMMIT;")
    blocked=wait('qa_read_second',"wait_event_type='Lock'",5)
    a=finish(p);b=finish(q)
    record('Revocación primero: lectura espera y revalida denegación',ready and blocked and a[0]==b[0]==0 and '"allowed": false' in b[1],{'espera_observada':blocked},category)

    reset(173)
    p=start('qa_parallel_one',"BEGIN;SELECT qa.identity(4);SET LOCAL ROLE authenticated;SELECT qa.history(qa.id(41),qa.id(34),qa.id(975));SELECT pg_sleep(10);COMMIT;")
    ready=wait('qa_parallel_one',"wait_event='PgSleep'")
    q=start('qa_parallel_two',"BEGIN;SELECT qa.identity(4);SET LOCAL ROLE authenticated;SELECT qa.history(qa.id(41),qa.id(34),qa.id(976));SELECT pg_sleep(4);COMMIT;")
    parallel=wait('qa_parallel_two',"wait_event='PgSleep'",5)
    simultaneous=call("SELECT count(*) FROM pg_stat_activity WHERE application_name IN ('qa_parallel_one','qa_parallel_two') AND wait_event='PgSleep';").stdout.strip()=='2'
    a=finish(p);b=finish(q)
    record('Dos lecturas autorizadas simultáneas usan locks compatibles',ready and parallel and simultaneous and a[0]==b[0]==0,{'dos_sesiones_observadas':simultaneous},category)

    p=start('qa_create_one',"BEGIN;SELECT qa.identity(1);SET LOCAL ROLE authenticated;SELECT qa.grant_access(qa.id(179),qa.id(41),qa.id(35),qa.id(51),qa.id(977));SELECT pg_sleep(10);COMMIT;")
    ready=wait('qa_create_one',"wait_event='PgSleep'")
    q=start('qa_create_two',"BEGIN;SELECT qa.identity(1);SET LOCAL ROLE authenticated;SELECT qa.grant_access(qa.id(179),qa.id(41),qa.id(35),qa.id(51),qa.id(977));COMMIT;")
    blocked=wait('qa_create_two',"wait_event_type='Lock'",5)
    a=finish(p);b=finish(q)
    count=call("SELECT count(*) FROM clinical.clinical_access_grants WHERE id=qa.id(179);").stdout.strip()
    record('Concesión concurrente idempotente crea solo una fila',ready and blocked and a[0]==b[0]==0 and count=='1',{'filas':count},category)

    p=start('qa_suspend_first',"BEGIN;UPDATE clinical.clinic_memberships SET status='suspended' WHERE id=qa.id(34);SELECT pg_sleep(10);COMMIT;")
    ready=wait('qa_suspend_first',"wait_event='PgSleep'")
    q=start('qa_read_suspend',"BEGIN;SELECT qa.identity(4);SET LOCAL ROLE authenticated;SELECT qa.history(qa.id(41),qa.id(34),qa.id(978));COMMIT;")
    blocked=wait('qa_read_suspend',"wait_event_type='Lock'",5)
    a=finish(p);b=finish(q)
    record('Suspensión concurrente de contexto se revalida al leer',ready and blocked and a[0]==b[0]==0 and '"allowed": false' in b[1],{'espera_observada':blocked},category)
    call("UPDATE clinical.clinic_memberships SET status='active' WHERE id=qa.id(34);")

    reset(174,"interval '7 seconds'")
    p=start('qa_expiry_lock',"BEGIN;SELECT id FROM clinical.patient_records WHERE id=qa.id(41) FOR UPDATE;SELECT pg_sleep(10);COMMIT;")
    ready=wait('qa_expiry_lock',"wait_event='PgSleep'")
    q=start('qa_read_expiry',"BEGIN;SELECT qa.identity(4);SET LOCAL ROLE authenticated;SELECT qa.history(qa.id(41),qa.id(34),qa.id(979));COMMIT;")
    blocked=wait('qa_read_expiry',"wait_event_type='Lock'",5)
    a=finish(p);b=finish(q)
    record('Vencimiento durante espera usa reloj real y deniega',ready and blocked and a[0]==b[0]==0 and '"allowed": false' in b[1],{'espera_observada':blocked},category)

    # La suite administrativa original revierte sus filas. Reutilizar solo su
    # preparación adaptada al esquema Auth oficial, dentro de esta base QA.
    from pathlib import Path
    fixture=(Path(__file__).resolve().parent/'admin_adaptado_qa.sql').read_text(encoding='utf8')
    prefix=fixture[:fixture.index('do $$ declare r jsonb; begin')]
    call(prefix+'\nCOMMIT;')
    p=start('qa_admin_same_one',"BEGIN;SELECT public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,20),public.qa_id(300));SELECT pg_sleep(2);COMMIT;")
    ready=wait('qa_admin_same_one',"wait_event='PgSleep'")
    q=start('qa_admin_same_two',"SELECT public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,20),public.qa_id(300));")
    blocked=wait('qa_admin_same_two',"wait_event_type='Lock'",1)
    a=finish(p);b=finish(q)
    n=call("SELECT count(*) FROM dentaia_admin.auditoria_roles WHERE actor_id=public.qa_id(1) AND solicitud_id=public.qa_id(300);").stdout.strip()
    record('DI-151: solicitudes simultáneas con misma clave producen una auditoría',ready and blocked and a[0]==b[0]==0 and '"resultado": "aplicado"' in a[1] and '"resultado": "aplicado"' in b[1] and n=='1',{'auditorias':n,'espera_observada':blocked},'concurrencia administrativa real SQL')

    call("INSERT INTO dentaia_admin.aprobaciones_roles(id,actor_id,objetivo_id,aprobado_por,operacion,rol,revision_esperada,vence_en) SELECT public.qa_id(n),public.qa_id(1),public.qa_id(4),public.qa_id(2),'asignar','paciente',0,clock_timestamp()+interval '1 hour' FROM generate_series(26,27)n;")
    p=start('qa_admin_race_one',"BEGIN;SELECT public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,26),public.qa_id(301));SELECT pg_sleep(2);COMMIT;")
    ready=wait('qa_admin_race_one',"wait_event='PgSleep'")
    q=start('qa_admin_race_two',"SELECT public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,27),public.qa_id(302));")
    blocked=wait('qa_admin_race_two',"wait_event_type='Lock'",1)
    a=finish(p);b=finish(q)
    record('DI-151: dos escrituras de misma revisión rechazan la segunda obsoleta',ready and blocked and a[0]==b[0]==0 and '"resultado": "aplicado"' in a[1] and 'VERSION_OBSOLETA' in b[1],{'espera_observada':blocked},'concurrencia administrativa real SQL')
