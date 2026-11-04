import{randomUUID}from'node:crypto';
import{readVault,writeVault,sqlRemote,clients,saveReport,ref,dataset}from'./academic-private.mjs';
const report={fecha:'2026-11-03',ref,dataset,datos:'solo nuevos y sinteticos',migracionesRepetidas:false};
try{
 if(!process.argv.includes('--cargar-lote-autorizado'))throw new Error('EXPLICIT_DATASET_AUTHORIZATION_REQUIRED');
 const v=readVault();if(v.ref!==ref||v.accounts.length!==5||v.accounts.some(a=>!a.id))throw new Error('FIVE_VERIFIED_ACCOUNTS_REQUIRED');
 const a=Object.fromEntries(v.accounts.map(a=>[a.alias,a]));
 if(!v.resources.clinics){v.resources={clinics:[randomUUID(),randomUUID()],dentists:[randomUUID(),randomUUID()],professionals:[randomUUID(),randomUUID()],verifications:[randomUUID(),randomUUID()],memberships:[randomUUID(),randomUUID()],patients:[randomUUID(),randomUUID()],requests:[randomUUID(),randomUUID(),randomUUID()],encounters:[randomUUID(),randomUUID(),randomUUID()],entries:Array.from({length:9},randomUUID),documents:[randomUUID(),randomUUID(),randomUUID()],grants:[randomUUID(),randomUUID(),randomUUID(),randomUUID()]};v.seedAt=new Date().toISOString();v.preferredDate=sqlRemote('SELECT (CURRENT_DATE+1)::text;');writeVault(v);}
 const r=v.resources,Q=x=>x===null?'NULL':typeof x==='boolean'?String(x):typeof x==='number'?String(x):"'"+String(x).replaceAll("'","''")+"'";
 const statements=["BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='30s';", "DO $$ BEGIN IF current_database()<>'postgres' OR to_regnamespace('clinical') IS NULL THEN RAISE EXCEPTION 'APPROVED_SCHEMA_REQUIRED';END IF;END $$;"];
 const insert=(table,row)=>{const fields=Object.keys(row);statements.push('INSERT INTO '+table+'('+fields.join(',')+') VALUES('+fields.map(k=>Q(row[k])).join(',')+') ON CONFLICT DO NOTHING;');};
 for(const u of v.accounts)insert('public.profiles',{id:u.id,full_name:u.name+' - FASE8 FICTICIO'});
 for(let n=0;n<2;n++){
  insert('public.dentists',{id:r.dentists[n],slug:'fase8-demo-'+(n?'b':'a')+'-'+v.batchId.slice(0,8),name:'Odontologo Demo '+(n?'B':'A'),specialty:'General - demostracion',district:'Distrito ficticio',consultation_price:0,currency:'PEN',initials:'QA',avatar_color:'#007f85',description:'Ficha ficticia FASE8, sin validez comercial ni acreditacion profesional.',is_demo:true,is_active:false});
  insert('clinical.clinics',{id:r.clinics[n],name:'Clinica Demo '+(n?'B':'A')+' - FASE8 FICTICIA',location:'Direccion exclusivamente ficticia',status:'active'});
  insert('clinical.professional_accounts',{id:r.professionals[n],user_id:a[n?'odontologo_b':'odontologo_a'].id,dentist_id:r.dentists[n],status:'pending'});
  insert('clinical.professional_verifications',{id:r.verifications[n],professional_id:r.professionals[n],reviewed_by:a.administrador_qa.id,decision:'approved',reference:'FASE8-DEMO-SIN-VALIDEZ-CLINICA',reason:'Fixture academica autorizada; no acredita identidad, licencia ni establecimiento real.'});
  statements.push('UPDATE clinical.professional_accounts SET status=\'verified\' WHERE id='+Q(r.professionals[n])+" AND status='pending';");
  insert('clinical.clinic_memberships',{id:r.memberships[n],clinic_id:r.clinics[n],professional_id:r.professionals[n],status:'active',valid_from:new Date(Date.parse(v.seedAt)-7*86400000).toISOString()});
  insert('clinical.patient_records',{id:r.patients[n],user_id:a[n?'paciente_b':'paciente_a'].id,status:'active'});
 }
 for(let n=0;n<3;n++){
  const owner=n===2?a.paciente_b:a.paciente_a,professional=n===0?0:1;
  insert('public.appointment_requests',{id:r.requests[n],user_id:owner.id,dentist_id:r.dentists[professional],contact_name:owner.name+' FICTICIO',contact_email:owner.email,preferred_date:v.preferredDate,preferred_time:'10:00:00',message:'Solicitud FASE8 sintetica, sin atencion real',status:n===1?'cancelled':'requested',is_demo:true});
  insert('clinical.clinical_encounters',{id:r.encounters[n],patient_id:r.patients[n===2?1:0],membership_id:r.memberships[professional],attended_at:new Date(Date.parse(v.seedAt)-(3-n)*86400000).toISOString(),status:'recorded'});
  for(let k=0;k<3;k++)insert('clinical.clinical_entries',{id:r.entries[n*3+k],encounter_id:r.encounters[n],kind:['background','diagnosis','treatment'][k],information_state:'recorded',description:['Antecedente ficticio','Diagnostico ficticio sin validez medica','Tratamiento simulado no prescriptivo'][k]+' - FASE8 atencion '+(n+1)});
  insert('clinical.clinical_documents',{id:r.documents[n],encounter_id:r.encounters[n],kind:'exam',title:'Examen FASE8 ficticio sin archivo ni resultado real',exam_date:v.seedAt.slice(0,10),availability:'unavailable'});
 }
 for(let n=0;n<4;n++)insert('clinical.clinical_access_grants',{id:r.grants[n],patient_id:r.patients[n<2?0:1],membership_id:r.memberships[n===0||n===2?0:1],purpose:'academic_shared_history_qa',policy_version:'QA-NO-CLINICO-v1',granted_at:new Date(Date.parse(v.seedAt)-(n===2?7200000:0)).toISOString(),expires_at:new Date(Date.parse(v.seedAt)+(n===2?-3600000:86400000)).toISOString(),scope_mode:'selected_encounters'});
 [[0,0],[0,1],[1,1],[2,2],[3,2]].forEach(([g,e])=>insert('clinical.clinical_grant_resources',{grant_id:r.grants[g],encounter_id:r.encounters[e]}));
 for(const u of v.accounts)statements.push('DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='+Q(u.id)+' AND full_name='+Q(u.name+' - FASE8 FICTICIO')+") THEN RAISE EXCEPTION 'FIXTURE_PROFILE_MISMATCH'; END IF; END $$;");
 statements.push('COMMIT;');sqlRemote(statements.join('\n'));
 v.seedCommitted=true;writeVault(v);
 const c=clients(),b=c.user();const signed=await b.auth.signInWithPassword({email:a.paciente_b.email,password:a.paciente_b.password});if(signed.error)throw new Error('FIXTURE_SIGNIN_FAILED');
 // La revocación propia está autorizada aun con lectura/concesión apagadas.
 const rev=await b.rpc('revoke_clinical_access',{p_id:r.grants[3]});if(rev.error||rev.data?.status!==200)throw new Error('OWN_REVOKE_REAL_RPC_FAILED');
 report.revocacionReal={rpc:'revoke_clinical_access',transporteHTTP:200,status:rev.data.status,conJWTPropietario:true};
 report.estados=JSON.parse(sqlRemote('SELECT jsonb_build_object(\'vigentes\',count(*) FILTER(WHERE revoked_at IS NULL AND expires_at>now()),\'vencidas\',count(*) FILTER(WHERE revoked_at IS NULL AND expires_at<=now()),\'revocadas\',count(*) FILTER(WHERE revoked_at IS NOT NULL)) FROM clinical.clinical_access_grants WHERE id=ANY(ARRAY['+r.grants.map(Q).join(',')+']::uuid[]);'));
 if(report.estados.vigentes!==2||report.estados.vencidas!==1||report.estados.revocadas!==1)throw new Error('FIXTURE_GRANT_STATES_MISMATCH');
 const preserved={};for(const[name,baseline]of Object.entries(v.baseline)){const current=JSON.parse(sqlRemote("SELECT jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),''))) FROM "+name+' x WHERE id=ANY(ARRAY['+baseline.ids.map(Q).join(',')+']::uuid[]);'));preserved[name]=current.count===baseline.count&&current.digest===baseline.digest;}
 if(!Object.values(preserved).every(Boolean))throw new Error('ORIGINAL_RECORDS_CHANGED');
 report.originalesConservados=preserved;report.batchId=v.batchId;report.ids=r;report.cuentas=Object.fromEntries(v.accounts.map(x=>[x.alias,{id:x.id,email:x.email,rol:x.role}]));report.conteosLote={perfiles:5,dentistasInactivos:2,clinicas:2,profesionales:2,verificacionesFicticias:2,membresias:2,pacientes:2,solicitudes:3,atenciones:3,entradas:9,examenesSinArchivo:3,concesiones:4,recursos:5};report.clinicaHabilitada=false;
}catch(e){report.error=/^[A-Z_]+$/.test(e.message??'')?e.message:'PRIVATE_FIXTURE_OPERATION_FAILED';process.exitCode=1;}
finally{saveReport('LOTE_ACADEMICO_REAL.json',report);console.log(JSON.stringify({cargado:!!report.conteosLote,estados:report.estados,error:report.error??null,originalesConservados:report.originalesConservados?Object.values(report.originalesConservados).every(Boolean):null}));}
