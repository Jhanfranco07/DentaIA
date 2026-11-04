// Plantilla única revisable. No ejecuta SQL ni concede permisos.
export function academicConfiguration(actors,r){
 const list=xs=>{if(!xs.length||xs.some(x=>!/^[a-f0-9-]{36}$/i.test(x)))throw new Error('UUID_ALLOWLIST_REQUIRED');return 'ARRAY['+xs.map(x=>"'"+x+"'").join(',')+']::uuid[]';};
 const users=list(actors),patients=list(r.patients),professionals=list(r.professionals),members=list(r.memberships),clinics=list(r.clinics),encounters=list(r.encounters),entries=list(r.entries),documents=list(r.documents),requests=list(r.requests),dentists=list(r.dentists);
 return `CREATE OR REPLACE FUNCTION clinical_service.configuration() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $academic$
 SELECT jsonb_build_object(
 'enabled',coalesce((coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))=ANY((${users})::text[]),false)
 AND (SELECT count(*) FROM clinical.patient_records WHERE id=ANY(${patients}))=2
 AND (SELECT count(*) FROM clinical.professional_accounts WHERE id=ANY(${professionals}))=2
 AND (SELECT count(*) FROM clinical.clinic_memberships WHERE id=ANY(${members}) AND clinic_id=ANY(${clinics}) AND professional_id=ANY(${professionals}))=2
 AND NOT EXISTS(SELECT 1 FROM clinical.clinic_memberships WHERE professional_id=ANY(${professionals}) AND NOT(id=ANY(${members})))
 AND NOT EXISTS(SELECT 1 FROM clinical.clinical_encounters WHERE patient_id=ANY(${patients}) AND (NOT(id=ANY(${encounters})) OR NOT(membership_id=ANY(${members}))))
 AND NOT EXISTS(SELECT 1 FROM clinical.clinical_entries WHERE encounter_id=ANY(${encounters}) AND NOT(id=ANY(${entries})))
 AND NOT EXISTS(SELECT 1 FROM clinical.clinical_documents WHERE encounter_id=ANY(${encounters}) AND (NOT(id=ANY(${documents})) OR availability<>'unavailable'))
 AND NOT EXISTS(SELECT 1 FROM public.appointment_requests WHERE dentist_id=ANY(${dentists}) AND NOT(id=ANY(${requests})))
 AND NOT EXISTS(SELECT 1 FROM clinical.clinical_access_grants WHERE (membership_id=ANY(${members}) AND NOT(patient_id=ANY(${patients}))) OR (patient_id=ANY(${patients}) AND NOT(membership_id=ANY(${members}))))
 AND NOT EXISTS(SELECT 1 FROM clinical.clinical_grant_resources x JOIN clinical.clinical_access_grants g ON g.id=x.grant_id WHERE g.patient_id=ANY(${patients}) AND NOT(x.encounter_id=ANY(${encounters}))),
 'policyVersion','QA-NO-CLINICO-v1','purpose','academic_shared_history_qa','maxGrantSeconds',86400,'maxResources',100,'maxPage',50,'maxNested',100,
 'environment','academic_remote','dataset','fase8-synthetic-v1');
$academic$;`;
}
