import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { assertLocal, command, container, sql, status, withShortTokens } from '../http_jwt/local.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'../../..');
const resultsDir=process.argv.includes('--fase8')?join(here,'../integracion_fase8'):process.argv.includes('--fase7')?join(here,'../qa_fase7'):process.argv.includes('--fase6')?join(here,'../versionado_fase6'):here;mkdirSync(resultsDir,{recursive:true});
const base='http://127.0.0.1:3104',id=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const report={fecha:'2026-11-03',inicio:new Date().toISOString(),entorno:'Supabase CLI local + Next.js real',pruebas:[],requests:{auth:0,next:0,rpc:0},tokensGuardados:false,remoto:false};
let nextProcess,serverLog='',childKey;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ensure=(condition,code)=>{if(!condition)throw new Error(code);};
const redact=s=>s.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[JWT_REDACTED]').replace(/cursor=[^\s&]+/g,'cursor=[REDACTED]').replace(/sb_secret_[A-Za-z0-9_-]+/g,'[SECRET_REDACTED]');
async function record(name,fn){try{const detail=await fn();report.pruebas.push({nombre:name,aprobado:true,...detail});console.log('PASS '+name);}catch(e){report.pruebas.push({nombre:name,aprobado:false,error:e.message});console.log('FAIL '+name+' '+e.message);}}
function save(){report.aprobadas=report.pruebas.filter(x=>x.aprobado).length;report.fallidas=report.pruebas.filter(x=>!x.aprobado).length;writeFileSync(join(resultsDir,'REGRESION_HTTP_F4.json'),JSON.stringify(report,null,2)+'\n');const p=join(resultsDir,'INTENTOS_REGRESION_F4.json');const previous=existsSync(p)?JSON.parse(readFileSync(p,'utf8')):[];previous.push(report);writeFileSync(p,JSON.stringify(previous,null,2)+'\n');}
async function counted(input,init){report.requests.auth++;return fetch(input,init);}
const client=(url,key,token)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:counted,...(token?{headers:{Authorization:`Bearer ${token}`}}:{})}});
async function stopNext(){if(nextProcess&&!nextProcess.killed){command('taskkill.exe',['/PID',String(nextProcess.pid),'/T','/F']);}writeFileSync(join(tmpdir(),'DentaIA-fase4-next.log'),redact(serverLog));}

try{
 assertLocal();command('python',[join(here,'../http_jwt/preparar_sql.py'),'bootstrap'],{cwd:root});
 ensure(sql("SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'qa_http_phase' IS DISTINCT FROM '4';")==='0','UNOWNED_LOCAL_ACCOUNTS_ABORTED');
 await withShortTokens(async meta=>{
  report.jwtExpiry=meta;const config=status();ensure(config.anon&&config.admin,'LOCAL_KEYS_MISSING');
  const admin=client(config.url,config.admin);const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});ensure(!listed.error,'LOCAL_USER_LIST_FAILED');
  ensure(listed.data.users.every(u=>u.app_metadata.qa_http_phase==='4'),'UNOWNED_LOCAL_ACCOUNTS_ABORTED');
  const actors={},roles={patient1:'paciente',patient2:'paciente',dentist1:'odontologo',dentist2:'odontologo',nonprofessional:'paciente',superuser:'superusuario'};
  for(const[name,role]of Object.entries(roles)){
   const password=randomBytes(24).toString('base64url')+'aA!9',email=`${name}.phase4@dentaia.test`;
   const old=listed.data.users.find(u=>u.app_metadata.qa_http_actor===name);
   const metadata={...(old?.app_metadata??{}),qa_http_phase:'4',qa_http_actor:name,dentaia:{version:1,estado:'activo',roles:[role]}};
   const prepared=old?await admin.auth.admin.updateUserById(old.id,{password,app_metadata:metadata}):await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:metadata});
   ensure(!prepared.error&&prepared.data.user,'LOCAL_FIXTURE_USER_FAILED');
   const sdk=client(config.url,config.anon);const login=await sdk.auth.signInWithPassword({email,password});ensure(!login.error&&login.data.session,'LOCAL_SIGN_IN_FAILED');
   const claims=await sdk.auth.getClaims(login.data.session.access_token);ensure(!claims.error&&claims.data,'LOCAL_CLAIMS_VERIFICATION_FAILED');
   actors[name]={id:prepared.data.user.id,sdk,password,email,session:login.data.session,metadata};
   report.pruebas.push({nombre:'Login y JWT firmado emitido por Auth local: '+name,aprobado:true,http:200,verificacionSDK:true});
  }
  report.cuentasSinteticas=Object.keys(actors).length;
  command('python',[join(here,'../http_jwt/preparar_sql.py'),'fixtures'],{cwd:root,input:JSON.stringify(Object.fromEntries(Object.entries(actors).map(([k,a])=>[k,a.id])))});
  const frozen=await client(config.url,config.anon).auth.signInWithPassword({email:actors.dentist1.email,password:actors.dentist1.password});ensure(frozen.data.session,'EXPIRY_SESSION_REQUIRED');
  const expiredToken=frozen.data.session.access_token;
  report.jwtAlgorithm=JSON.parse(Buffer.from(expiredToken.split('.')[0],'base64url').toString()).alg;
  async function token(name){const a=actors[name];if(a.session.expires_at*1000-Date.now()<20000){const fresh=await a.sdk.auth.refreshSession({refresh_token:a.session.refresh_token});ensure(!fresh.error&&fresh.data.session,'LOCAL_REFRESH_FAILED');a.session=fresh.data.session;}return a.session.access_token;}
  childKey=randomBytes(32).toString('base64url');
  nextProcess=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3104'],{cwd:root,env:{...process.env,NODE_ENV:'development',DENTAIA_CLINICAL_HTTP_ENABLED:'true',DENTAIA_CLINICAL_SUPABASE_URL:config.url,DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY:config.anon,DENTAIA_CLINICAL_CURSOR_SECRET:childKey,DENTAIA_CLINICAL_CURSOR_TTL_SECONDS:'2',NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.anon,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  nextProcess.stdout.on('data',x=>{serverLog+=redact(x.toString());if(serverLog.length>120000)serverLog=serverLog.slice(-120000);});nextProcess.stderr.on('data',x=>{serverLog+=redact(x.toString());});
  for(let n=0;n<90;n++){try{const r=await fetch(base+`/api/clinical/patients/${id(41)}/history`);if(r.status===401)break;if(n===89)throw new Error('NEXT_NOT_READY');}catch{if(n===89)throw new Error('NEXT_NOT_READY');}await sleep(1000);}
  async function next(path,{actor='dentist1',method='GET',body,headers={},bearer}={}){
   report.requests.next++;
   const r=await fetch(base+path,{method,headers:{...(actor?{Authorization:'Bearer '+(bearer??await token(actor))}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
   const data=await r.json();return{status:r.status,data,headers:r.headers};
  }
  const history=(actor='dentist1',patient=41,member=33,extra='',bearer)=>next(`/api/clinical/patients/${id(patient)}/history?${member===null?'':`membershipId=${id(member)}&`}${extra}`,{actor,bearer});
  const grantBody=(member=33,enc=[51,52],expires=new Date(Date.now()+3600000).toISOString())=>({membershipId:id(member),encounterIds:enc.map(id),expiresAt:expires,policyVersion:'QA-NO-CLINICO-v1',accepted:true});
  const grant=(body=grantBody(),key=randomUUID(),actor='patient1')=>next('/api/clinical/access-grants',{method:'POST',actor,body,headers:{'Idempotency-Key':key}});
  const revoke=(key,actor='patient1')=>next(`/api/clinical/access-grants/${key}/revoke`,{method:'POST',actor,body:{}});
  function check(r,status,count){ensure(r.status===status,'UNEXPECTED_HTTP_STATUS_'+r.status);ensure(r.data.ok===(status<300),'UNEXPECTED_HTTP_RESULT');if(count!==undefined)ensure(r.data.entries?.length===count,'UNEXPECTED_ENTRY_COUNT');if(status>=400)ensure(!('entries'in r.data)&&!('caso'in r.data),'DENIAL_DATA_LEAK');ensure(r.headers.get('cache-control')?.includes('no-store'),'MISSING_NO_STORE');return{http:r.status,...(count===undefined?{}:{registros:count})};}
  try{
   await record('JWT ausente devuelve 401',async()=>check(await next(`/api/clinical/patients/${id(41)}/history`,{actor:null}),401));
   await record('JWT inválido devuelve 401',async()=>check(await history('dentist1',41,33,'','abc.def.ghi'),401));
   const good=await token('dentist1'),parts=good.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.sub=actors.patient1.id;parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');
   await record('JWT manipulado sin nueva firma devuelve 401',async()=>check(await history('dentist1',41,33,'',parts.join('.')),401));
   const mainKey=randomUUID(),mainBody=grantBody();
   await record('Paciente concede autorización propia mediante HTTP',async()=>check(await grant(mainBody,mainKey),201));
   ensure(sql(`SELECT count(*) FROM clinical.clinical_access_grants WHERE id='${mainKey}';`)==='1','BASELINE_GRANT_NOT_PERSISTED');
   await record('Reintento HTTP de concesión respeta idempotencia',async()=>check(await grant(mainBody,mainKey),200));
   await record('Misma clave con contenido diferente devuelve 409',async()=>check(await grant(grantBody(33,[51]),mainKey),409));
   await record('Paciente no concede recursos clínicos de otro paciente',async()=>check(await grant(grantBody(33,[53])),403));
   await record('No se acepta actorId del cuerpo',async()=>check(await grant({...grantBody(),actorId:actors.patient2.id}),400));
   await record('No se acepta rol del cuerpo',async()=>check(await grant({...grantBody(),roles:['superusuario']}),400));
   await record('Clínica/profesional inexistente se rechazan',async()=>check(await grant(grantBody(999)),403));
   await record('Odontólogo autorizado consulta dos clínicas por HTTP',async()=>{const r=await history();check(r,200,2);ensure(new Set(r.data.entries.map(e=>e.origin.clinicId)).size===2,'ORIGIN_LOST');ensure(!JSON.stringify(r.data).includes(id(53)),'OTHER_PATIENT_LEAK');return{http:200,registros:2,clinicas:2};});
   await record('Paciente consulta únicamente su historial propio',async()=>check(await history('patient1',41,null),200,2));
   await record('Acceso cruzado de pacientes denegado',async()=>check(await history('patient2',41,null),403));
   await record('Odontólogo sin autorización de otra clínica denegado',async()=>check(await history('dentist2',41,34),403));
   await record('Usuario sin rol profesional denegado',async()=>check(await history('nonprofessional'),403));
   await record('Superusuario no recibe acceso clínico automático',async()=>check(await history('superuser'),403));
   await record('Contexto ajeno no puede declararse propio',async()=>check(await history('dentist1',41,34),403));
   await record('Contexto propio distinto no hereda concesión',async()=>check(await history('dentist1',41,35),403));
   await record('Paciente inexistente no revela información',async()=>check(await history('dentist1',999,33),403));
   await record('Identificador malformado devuelve 400',async()=>check(await next('/api/clinical/patients/no-uuid/history'),400));
   await record('Consulta duplicada/ambigua devuelve 400',async()=>check(await history('dentist1',41,33,'limit=1&limit=2'),400));
   await record('Cuerpo supera límite devuelve 413',async()=>check(await next('/api/clinical/access-grants',{method:'POST',actor:'patient1',body:'x'.repeat(9000),headers:{'Idempotency-Key':randomUUID()}}),413));
   await record('Origen cruzado en escritura devuelve 403',async()=>check(await next('/api/clinical/access-grants',{method:'POST',actor:'patient1',body:grantBody(),headers:{Origin:'https://example.invalid','Idempotency-Key':randomUUID()}}),403));
   const page=await history('dentist1',41,33,'limit=1');check(page,200,1);ensure(typeof page.data.nextCursor==='string','SIGNED_CURSOR_MISSING');const cursor=page.data.nextCursor;
   await record('Cursor cifrado no contiene fechas o IDs en claro',async()=>{ensure(!cursor.includes(id(41))&&!cursor.includes('2026-10'),'CURSOR_CLEAR_DATA');return{http:200,opaco:true};});
   await record('Cursor firmado pagina sin duplicar registros',async()=>{const r=await history('dentist1',41,33,'limit=1&cursor='+encodeURIComponent(cursor));check(r,200,1);ensure(r.data.entries[0].encounterId!==page.data.entries[0].encounterId,'DUPLICATED_PAGE');return{http:200,registros:1};});
   const changed=cursor.slice(0,-8)+(cursor.at(-8)==='A'?'B':'A')+cursor.slice(-7);
   await record('Cursor manipulado devuelve 400',async()=>check(await history('dentist1',41,33,'limit=1&cursor='+encodeURIComponent(changed)),400));
   await record('Cursor de otra identidad devuelve 400',async()=>check(await history('patient2',41,33,'limit=1&cursor='+encodeURIComponent(cursor)),400));
   await record('Cursor de otro contexto clínico devuelve 400',async()=>check(await history('dentist1',41,35,'limit=1&cursor='+encodeURIComponent(cursor)),400));
   await record('Cursor con otro filtro limit devuelve 400',async()=>check(await history('dentist1',41,33,'limit=2&cursor='+encodeURIComponent(cursor)),400));
   await sleep(2200);
   await record('Cursor realmente vencido devuelve 400',async()=>check(await history('dentist1',41,33,'limit=1&cursor='+encodeURIComponent(cursor)),400));
   const shortKey=randomUUID();check(await grant(grantBody(35,[51],new Date(Date.now()+2000).toISOString()),shortKey),201);
   await record('Alcance limitado no incluye otras atenciones',async()=>check(await history('dentist1',41,35),200,1));
   await sleep(2200);
   await record('Permiso realmente vencido deniega nuevas lecturas',async()=>check(await history('dentist1',41,35),403));
   await record('Paciente no revoca autorización ajena',async()=>check(await revoke(mainKey,'patient2'),403));
   const denied=await history('dentist2',41,34);
   await record('Denegación HTTP conserva auditoría protegida tras commit',async()=>{check(denied,403);ensure(sql(`SELECT count(*) FROM clinical.clinical_access_audit WHERE request_id='${denied.data.requestId}' AND outcome='denied' AND patient_id IS NULL;`)==='1','DENIED_AUDIT_MISSING');return{http:403,eventos:1};});
   const allowed=await history();
   await record('Lectura HTTP permitida deja auditoría antes de entrega',async()=>{check(allowed,200,2);ensure(sql(`SELECT count(*) FROM clinical.clinical_access_audit WHERE request_id='${allowed.data.requestId}' AND outcome='allowed';`)==='1','ALLOWED_AUDIT_MISSING');return{http:200,eventos:1};});
   const stale=await token('dentist1');await admin.auth.admin.updateUserById(actors.dentist1.id,{app_metadata:{...actors.dentist1.metadata,dentaia:{version:1,estado:'activo',roles:['paciente']}}});
   await record('JWT anterior no conserva el rol retirado en Auth',async()=>check(await history('dentist1',41,33,'',stale),403));
   await admin.auth.admin.updateUserById(actors.dentist1.id,{app_metadata:actors.dentist1.metadata});
   sql(`UPDATE clinical.clinic_memberships SET status='suspended' WHERE id='${id(33)}';`);
   await record('Cambio de pertenencia clínica se evalúa en servidor',async()=>check(await history(),403));
   sql(`UPDATE clinical.clinic_memberships SET status='active' WHERE id='${id(33)}';`);
   const edited=await actors.nonprofessional.sdk.auth.updateUser({data:{dentaia:{roles:['odontologo','superusuario']}}});ensure(!edited.error,'LOCAL_USER_METADATA_UPDATE_FAILED');
   await record('user_metadata editable no concede rol profesional',async()=>check(await history('nonprofessional'),403));
   // Fallo artificial exclusivamente en auditoría del stack local marcado.
   sql("CREATE OR REPLACE FUNCTION dentaia_http_qa.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'HTTP_QA_FAILURE'; END $$; CREATE TRIGGER http_qa_failure BEFORE INSERT ON clinical.clinical_access_audit FOR EACH ROW EXECUTE FUNCTION dentaia_http_qa.fail_audit();");
   try{
    await record('Fallo real de auditoría no entrega historial HTTP',async()=>check(await history(),503));
    const failedKey=randomUUID();await record('Fallo de auditoría revierte concesión HTTP',async()=>{check(await grant(grantBody(),failedKey),503);ensure(sql(`SELECT count(*) FROM clinical.clinical_access_grants WHERE id='${failedKey}';`)==='0','FAILED_GRANT_PERSISTED');return{http:503,registros:0};});
    await record('Fallo de auditoría revierte revocación HTTP',async()=>{check(await revoke(mainKey),503);ensure(sql(`SELECT revoked_at IS NULL FROM clinical.clinical_access_grants WHERE id='${mainKey}';`)==='t','FAILED_REVOCATION_PERSISTED');return{http:503};});
   }finally{sql('DROP TRIGGER http_qa_failure ON clinical.clinical_access_audit;');}
   await record('Dos consultas HTTP concurrentes son autorizadas',async()=>{const r=await Promise.all([history(),history()]);r.forEach(x=>check(x,200,2));return{http:[200,200]};});
   // Los tres RPC se invocan también directamente por PostgREST con JWT de usuario.
   async function raw(name,actor,args){report.requests.rpc++;const r=await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.anon,Authorization:'Bearer '+await token(actor),'Content-Type':'application/json'},body:JSON.stringify(args)});return{status:r.status,data:await r.json()};}
   const rawKey=randomUUID();await record('RPC grant por HTTP usa JWT del paciente, no service_role',async()=>{const r=await raw('grant_clinical_access','patient1',{p_id:rawKey,p_membership_id:id(35),p_encounter_ids:[id(51)],p_expires_at:new Date(Date.now()+3600000).toISOString(),p_policy_version:'QA-NO-CLINICO-v1',p_accepted:true});ensure(r.status===200&&r.data.status===201,'RAW_GRANT_FAILED');return{http:200,envelope:201};});
   await record('RPC historial por HTTP respeta alcance autorizado',async()=>{const r=await raw('get_authorized_clinical_history','dentist1',{p_patient_id:id(41),p_membership_id:id(35)});ensure(r.status===200&&r.data.ok&&r.data.entries.length===1,'RAW_HISTORY_FAILED');return{http:200,registros:1};});
   await record('RPC revoke por HTTP usa JWT del propietario',async()=>{const r=await raw('revoke_clinical_access','patient1',{p_id:rawKey});ensure(r.status===200&&r.data.ok,'RAW_REVOKE_FAILED');return{http:200};});
   await record('Next traduce denegación RPC HTTP 200 a HTTP 403',async()=>{const r=await raw('get_authorized_clinical_history','dentist1',{p_patient_id:id(41),p_membership_id:id(35)});ensure(r.status===200&&!r.data.ok&&r.data.status===403,'RAW_DENIAL_FAILED');check(await history('dentist1',41,35),403);return{rpcHttp:200,rpcEnvelope:403,nextHttp:403};});
   // Un lock operador SOLO en el fixture deja las dos solicitudes HTTP solapadas.
   async function holder(key){
    const p=spawn('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{stdio:['pipe','ignore','pipe'],windowsHide:true});
    p.stderr.on('data',()=>{});const finished=new Promise(resolve=>p.on('exit',code=>resolve(code)));
    p.stdin.end(`BEGIN; SET application_name='http4_lock_holder'; SELECT id FROM clinical.clinical_access_grants WHERE id='${key}' FOR UPDATE; SELECT pg_sleep(4); COMMIT;`);
    for(let n=0;n<40;n++){if(sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='http4_lock_holder' AND wait_event='PgSleep';")==='1')return{finished};await sleep(40);}
    throw new Error('HTTP_RACE_HOLDER_NOT_READY');
   }
   async function waitLocks(count){for(let n=0;n<30;n++){if(Number(sql("SELECT count(*) FROM pg_stat_activity WHERE datname='postgres' AND usename='authenticator' AND wait_event_type='Lock';"))>=count)return true;await sleep(40);}return false;}
   await record('HTTP lectura primero: revocación espera y nuevas lecturas fallan',async()=>{
    const key=randomUUID();check(await grant(grantBody(35,[51]),key),201);const{finished:done}=await holder(key);
    const read=history('dentist1',41,35);ensure(await waitLocks(1),'HTTP_READ_WAIT_NOT_OBSERVED');
    const revoked=revoke(key);const observed=await waitLocks(2);const [a,b,code]=await Promise.all([read,revoked,done]);
    ensure(observed&&code===0,'HTTP_RACE_NOT_OBSERVED');check(a,200,1);check(b,200);check(await history('dentist1',41,35),403);return{http:[200,200,403],esperasObservadas:2};
   });
   await record('HTTP revocación primero: lectura espera y no recibe historial',async()=>{
    const key=randomUUID();check(await grant(grantBody(35,[51]),key),201);const{finished:done}=await holder(key);
    const revoked=revoke(key);ensure(await waitLocks(1),'HTTP_REVOKE_WAIT_NOT_OBSERVED');
    const read=history('dentist1',41,35);const observed=await waitLocks(2);const [a,b,code]=await Promise.all([revoked,read,done]);
    ensure(observed&&code===0,'HTTP_RACE_NOT_OBSERVED');check(a,200);check(b,403);return{http:[200,403],esperasObservadas:2};
   });
   await record('Revocación HTTP impide nueva consulta',async()=>{check(await revoke(mainKey),200);return check(await history(),403);});
   await record('Reintento de revocación HTTP conserva estado',async()=>{const a=await revoke(mainKey),b=await revoke(mainKey);check(a,200);check(b,200);ensure(a.data.revokedAt===b.data.revokedAt,'REVOCATION_CHANGED');return{http:[200,200]};});
   // Nueva concesión para verificar cierre de una sesión auténtica sin cerrar las demás.
   check(await grant(),201);const logoutClient=client(config.url,config.anon);const logoutLogin=await logoutClient.auth.signInWithPassword({email:actors.dentist1.email,password:actors.dentist1.password});ensure(logoutLogin.data.session,'LOGOUT_SESSION_MISSING');const logoutToken=logoutLogin.data.session.access_token;
   check(await history('dentist1',41,33,'',logoutToken),200,2);const logout=await logoutClient.auth.signOut({scope:'local'});ensure(!logout.error,'LOCAL_SIGN_OUT_FAILED');
   await record('JWT capturado antes del logout no abre nuevas lecturas',async()=>check(await history('dentist1',41,33,'',logoutToken),401));
   await record('Otra sesión legítima conserva su acceso independiente',async()=>check(await history(),200,2));
   // Caducidad REAL: token emitido por Auth local, sin editar payload ni firmar a mano.
   const exp=JSON.parse(Buffer.from(expiredToken.split('.')[1],'base64url').toString()).exp;
   report.expiryWaitingSeconds=Math.max(0,Math.ceil((exp*1000+1200-Date.now())/1000));console.log('Esperando caducidad real del JWT local; sin imprimir token.');
   while(Date.now()<exp*1000+1200)await sleep(Math.min(1000,exp*1000+1200-Date.now()));
   await record('JWT realmente caducado devuelve HTTP 401',async()=>check(await history('dentist1',41,33,'',expiredToken),401));
  }finally{await stopNext();}
 });
 report.configuracionAuthRestaurada=true;
}catch(e){report.bloqueo=e.message;console.log('BLOQUEO '+e.message);try{await stopNext();}catch{}}
finally{report.configuracionAuthRestaurada=report.jwtExpiry?.restored===true;save();}
console.log(JSON.stringify({aprobadas:report.aprobadas,fallidas:report.fallidas,bloqueo:report.bloqueo??null,authRestaurado:report.configuracionAuthRestaurada??false}));
if(report.bloqueo||report.fallidas)process.exitCode=1;
