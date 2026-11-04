// Misma plantilla de configuración, UUID de fixtures locales, siempre ROLLBACK.
import{execFileSync}from'node:child_process';import{randomUUID}from'node:crypto';
import{academicConfiguration}from'./academic-activation-sql.mjs';import{saveReport}from'./academic-private.mjs';
const C='supabase_db_DentaIA-arquitectura-fase2-qa',DB='dentaia_academic_activation_test';
const management=s=>execFileSync('docker',['exec','-i',C,'psql','-X','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8'}).trim();
if(management("SELECT count(*) FROM pg_database WHERE datname='dentaia_academic_activation_test';")==='0'){
 management("CREATE DATABASE dentaia_academic_activation_test TEMPLATE dentaia_arch_qa_fase8;COMMENT ON DATABASE dentaia_academic_activation_test IS 'DENTAIA_ACADEMIC_ACTIVATION_SYNTHETIC_ONLY';");
}
const sql=s=>{try{return execFileSync('docker',['exec','-i',C,'psql','-X','-U','postgres','-d',DB,'-Atq','-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch{return null;}};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),Q=x=>"'"+x+"'";
const r={patients:[id(41),id(42)],professionals:[id(23),id(24)],memberships:[id(33),id(34)],clinics:[id(11),id(12)]};
for(const[k,t]of Object.entries({encounters:'clinical.clinical_encounters',entries:'clinical.clinical_entries',documents:'clinical.clinical_documents',requests:'public.appointment_requests',dentists:'public.dentists'}))r[k]=JSON.parse(sql('SELECT jsonb_agg(id ORDER BY id) FROM '+t+';'));
const actors=[1,2,3,4,5].map(id),source=academicConfiguration(actors,r);
// Solo copia QA nueva: no cambia el banco de evidencia anterior. Cada ensayo revierte.
const normalize="UPDATE clinical.clinical_documents SET availability='unavailable',bucket_id=NULL,object_path=NULL,mime_type=NULL,size_bytes=NULL;TRUNCATE clinical.clinical_grant_resources,clinical.clinical_access_grants CASCADE;";
const report={fecha:'2026-11-03',entorno:'PostgreSQL local; misma plantilla con UUID de fixtures locales; claims SQL, no JWT',pruebas:[]};
function check(name,actor,mutation,expected){
 const query="BEGIN;"+normalize+source+mutation+"SELECT set_config('request.jwt.claims',"+Q(JSON.stringify(actor?{sub:actor}:{}))+",true);SET LOCAL ROLE dentaia_clinical_executor;SELECT CASE WHEN (clinical_service.configuration()->>'enabled')::boolean="+expected+" THEN 'CHECK_PASS' ELSE 'CHECK_FAIL' END;ROLLBACK;";
 const out=sql(query),ok=out?.includes('CHECK_PASS')&&!out?.includes('CHECK_FAIL');report.pruebas.push({nombre:name,aprobada:!!ok});console.log((ok?'PASS ':'FAIL ')+name);
}
if(sql("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database();")!=='DENTAIA_ACADEMIC_ACTIVATION_SYNTHETIC_ONLY')throw new Error('LOCAL_FIXTURE_MARKER_REQUIRED');
check('Actor permitido y dataset acotado se habilita bajo rol tecnico',actors[0],'',true);
check('Actor ajeno falla cerrado',randomUUID(),'',false);check('Sin actor falla cerrado',null,'',false);
check('Atencion no inventariada bloquea dataset',actors[0],`INSERT INTO clinical.clinical_encounters(id,patient_id,membership_id,attended_at) VALUES('${randomUUID()}','${r.patients[0]}','${r.memberships[0]}',now());`,false);
check('Entrada no inventariada bloquea dataset',actors[0],`INSERT INTO clinical.clinical_entries(id,encounter_id,kind,information_state,description) VALUES('${randomUUID()}','${r.encounters[0]}','diagnosis','recorded','Extra sintetico local');`,false);
check('Documento no inventariado bloquea dataset',actors[0],`INSERT INTO clinical.clinical_documents(id,encounter_id,kind,title,availability) VALUES('${randomUUID()}','${r.encounters[0]}','exam','Extra sintetico','unavailable');`,false);
check('Solicitud fuera de inventario bloquea dataset',actors[0],`INSERT INTO public.appointment_requests(id,user_id,dentist_id,contact_name,contact_email,preferred_date) VALUES('${randomUUID()}','${actors[0]}','${r.dentists[0]}','QA Ficticio','qa@dentaia.test',CURRENT_DATE+1);`,false);
report.aprobadas=report.pruebas.filter(x=>x.aprobada).length;report.fallidas=report.pruebas.length-report.aprobadas;report.configuracionOriginalCerrada=sql("SELECT clinical_service.configuration()->>'enabled';")==='false';saveReport('ACTIVACION_PRUEBAS_LOCALES.json',report);if(report.fallidas||!report.configuracionOriginalCerrada)process.exitCode=1;
