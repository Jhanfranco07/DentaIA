import json
from pathlib import Path
R=Path(__file__).resolve().parent
cases=[]
def add(name,sql,state=None):
 r=dict(nombre=name,sql=sql)
 if state:r['sqlstate']=state
 cases.append(r)
def read(user,patient,member,allowed,count=0):
 return f"SELECT qa.identity({user}); SET LOCAL ROLE authenticated; DO $$ DECLARE r jsonb; BEGIN r:=qa.history(qa.id({patient}),qa.id({member}),qa.id(901)); ASSERT (r->>'allowed')::boolean={'true' if allowed else 'false'}; ASSERT (r->>'count')::integer={count}; END $$;"
add('Prototipo: paciente accede a sus dos atenciones',read(1,41,34,True,2))
add('Prototipo: paciente no accede a otro paciente',read(2,41,34,False))
add('Prototipo: profesional autorizado solo recibe un recurso',read(4,41,34,True,1))
add('Prototipo: profesional ajeno no accede por ID',read(5,41,35,False))
add('Prototipo: misma clínica no concede acceso general',read(3,41,33,False))
add('Prototipo: autorización vencida deniega',read(3,42,33,False))
add('Prototipo: autorización revocada deniega',read(3,41,33,False))
add('Prototipo: superusuario no recibe historial ajeno',read(6,41,34,False))
add('Prototipo: contexto clínico de otro profesional deniega',read(4,41,33,False))
add('Prototipo: rol Auth retirado se vuelve a consultar',"UPDATE auth.users SET raw_app_meta_data=jsonb_set(raw_app_meta_data,'{dentaia,roles}','[\"paciente\"]') WHERE id=qa.id(4);"+read(4,41,34,False))
add('Prototipo: membresía suspendida deniega',"UPDATE clinical.clinic_memberships SET status='suspended' WHERE id=qa.id(34);"+read(4,41,34,False))
add('Prototipo: cuenta profesional suspendida deniega',"UPDATE clinical.professional_accounts SET status='suspended' WHERE id=qa.id(24);"+read(4,41,34,False))
add('Prototipo: nueva verificación rechazada deniega',"INSERT INTO clinical.professional_verifications(professional_id,reviewed_by,decision,reference,reason,reviewed_at) VALUES(qa.id(24),qa.id(6),'rejected','QA','QA',now()+interval '1 second');"+read(4,41,34,False))
add('Prototipo: consentimiento propio se puede revocar',"SELECT qa.identity(1); SET LOCAL ROLE authenticated; SELECT qa.revoke_grant(qa.id(71),qa.id(910)); RESET ROLE; DO $$ BEGIN ASSERT (SELECT revoked_at IS NOT NULL FROM clinical.clinical_access_grants WHERE id=qa.id(71)); END $$;")
add('Prototipo: revocación ajena se rechaza',"SELECT qa.identity(2); SET LOCAL ROLE authenticated; SELECT qa.revoke_grant(qa.id(71),qa.id(910));",'42501')
add('Prototipo: reintento de revocación conserva fecha',"SELECT qa.identity(1); SET LOCAL ROLE authenticated; DO $$ DECLARE a jsonb; b jsonb; BEGIN a:=qa.revoke_grant(qa.id(71),qa.id(911)); b:=qa.revoke_grant(qa.id(71),qa.id(911)); ASSERT a=b; END $$;")
add('Prototipo: concesión e idempotencia mismo UUID y contenido',"SELECT qa.identity(1); SET LOCAL ROLE authenticated; SELECT qa.grant_access(qa.id(79),qa.id(41),qa.id(35),qa.id(51),qa.id(920)); SELECT qa.grant_access(qa.id(79),qa.id(41),qa.id(35),qa.id(51),qa.id(920)); RESET ROLE; DO $$ BEGIN ASSERT (SELECT count(*)=1 FROM clinical.clinical_access_grants WHERE id=qa.id(79)); END $$;")
add('Prototipo: idempotencia no admite contenido distinto',"SELECT qa.identity(1); SET LOCAL ROLE authenticated; SELECT qa.grant_access(qa.id(79),qa.id(41),qa.id(35),qa.id(51),qa.id(920)); SELECT qa.grant_access(qa.id(79),qa.id(41),qa.id(34),qa.id(51),qa.id(920));",'23505')
add('Prototipo: paciente no concede recurso ajeno',"SELECT qa.identity(1); SET LOCAL ROLE authenticated; SELECT qa.grant_access(qa.id(79),qa.id(41),qa.id(35),qa.id(53),qa.id(920));",'42501')
add('Prototipo: fallo de auditoría impide entregar historial',"SET LOCAL qa.fail_audit='yes'; SELECT qa.identity(4); SET LOCAL ROLE authenticated; SELECT qa.history(qa.id(41),qa.id(34),qa.id(930));",'58000')
add('Prototipo: auditoría denegada persiste sin datos clínicos',read(5,41,35,False)+" RESET ROLE; DO $$ BEGIN ASSERT (SELECT outcome='denied' AND patient_id IS NULL AND grant_id IS NULL FROM clinical.clinical_access_audit WHERE request_id=qa.id(901)); END $$;")
add('Prototipo: auditoría permitida antes de respuesta',read(4,41,34,True,1)+" RESET ROLE; DO $$ BEGIN ASSERT (SELECT count(*)=1 FROM clinical.clinical_access_audit WHERE request_id=qa.id(901) AND outcome='allowed'); END $$;")
add('Prototipo: auditoría no admite edición',read(4,41,34,True,1)+" RESET ROLE; UPDATE clinical.clinical_access_audit SET reason_code='FORGED';",'42501')
add('Prototipo: fallo de auditoría revierte revocación',"SELECT qa.identity(1); SET LOCAL qa.fail_audit='yes'; DO $$ BEGIN BEGIN PERFORM qa.revoke_grant(qa.id(71),qa.id(940)); RAISE EXCEPTION 'FALTA_RECHAZO'; EXCEPTION WHEN SQLSTATE '58000' THEN NULL; END; ASSERT (SELECT revoked_at IS NULL FROM clinical.clinical_access_grants WHERE id=qa.id(71)); END $$;")
(R/'casos_prototipo.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Escenarios de prototipo generados:',len(cases))
