// Integración REAL con Dental-IA. Solo cinco cuentas del almacén privado autorizado.
import{createHmac}from'node:crypto';
import{readVault,writeVault,clients,saveReport,ref,dataset}from'./academic-private.mjs';
const report={fecha:new Date().toISOString(),ref,dataset,entorno:'Dental-IA remoto; SDK y JWT reales',pruebas:[]};
const ensure=(v,c)=>{if(!v)throw new Error(c);};
async function check(nombre,fn){try{report.pruebas.push({nombre,aprobada:true,...await fn()});console.log('PASS '+nombre);}catch(e){report.pruebas.push({nombre,aprobada:false,error:/^[A-Z_0-9]+$/.test(e.message)?e.message:'REMOTE_CHECK_FAILED'});console.log('FAIL '+nombre);}}
export function codigoTotp(secret){let bits='';for(const ch of secret.replace(/=+$/,'')){const x='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(ch.toUpperCase());ensure(x>=0,'INVALID_PRIVATE_FACTOR');bits+=x.toString(2).padStart(5,'0');}const key=Buffer.from(bits.match(/.{8}/g).map(x=>parseInt(x,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',key).update(counter).digest(),offset=hash.at(-1)&15;return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
// Export separado para reutilizar el desafío sin volver a enrolar.
export async function elevarAdministrador(v,c){
 const a=v.accounts.find(x=>x.alias==='administrador_qa'),client=c.user();
 ensure(!(await client.auth.signInWithPassword({email:a.email,password:a.password})).error,'ADMIN_SIGNIN_FAILED');
 const factors=await client.auth.mfa.listFactors();ensure(!factors.error,'FACTOR_LIST_FAILED');
 if(!a.factorId){ensure(factors.data.all.length===0,'EXISTING_FACTOR_PRESERVED');const r=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'DentaIA Fase8 QA'});ensure(!r.error,'MFA_ENROLL_FAILED');a.factorId=r.data.id;a.totpSecret=r.data.totp.secret;writeVault(v);}
 ensure(a.totpSecret,'PRIVATE_FACTOR_REQUIRED');
 // Evita empezar un desafío al final de la ventana TOTP.
 if(Date.now()%30000>27000)await new Promise(r=>setTimeout(r,3100));
 const challenged=await client.auth.mfa.challenge({factorId:a.factorId});ensure(!challenged.error,'MFA_CHALLENGE_FAILED');
 const verified=await client.auth.mfa.verify({factorId:a.factorId,challengeId:challenged.data.id,code:codigoTotp(a.totpSecret)});ensure(!verified.error,'MFA_VERIFY_FAILED');
 const aal=await client.auth.mfa.getAuthenticatorAssuranceLevel();ensure(!aal.error&&aal.data.currentLevel==='aal2','AAL2_REQUIRED');
 return client;
}
// No ejecutar al importar desde el banco HTTP.
if(process.argv[1]?.replaceAll('\\','/').endsWith('/validar-cuentas-academicas.mjs')){
 try{
 const v=readVault(),c=clients(),a={};ensure(v.ref===ref&&v.accounts.length===5,'APPROVED_ACCOUNTS_REQUIRED');
 for(const u of v.accounts){await check('Login y firma JWT '+u.alias,async()=>{const client=c.user(),s=await client.auth.signInWithPassword({email:u.email,password:u.password});ensure(!s.error&&s.data.user.id===u.id,'SIGNIN_FAILED');const verified=await client.auth.getClaims();ensure(!verified.error&&verified.data.claims.sub===u.id,'CLAIMS_FAILED');ensure(s.data.user.app_metadata.dentaia.roles.join(',')===u.role,'ROLE_MISMATCH');a[u.alias]=client;return{http:200,rol:u.role};});}
 for(const alias of ['paciente_a','paciente_b'])await check('Perfil y solicitudes propias '+alias,async()=>{const client=a[alias],u=v.accounts.find(x=>x.alias===alias),p=await client.from('profiles').select('id').eq('id',u.id),r=await client.from('appointment_requests').select('id,status').eq('user_id',u.id);ensure(!p.error&&p.data.length===1&&!r.error&&r.data.length===(alias==='paciente_a'?2:1),'OWN_ROWS_MISMATCH');return{http:[p.status,r.status],perfiles:p.data.length,solicitudes:r.data.length};});
 for(const [actor,target]of [['paciente_a','paciente_b'],['paciente_b','paciente_a']])await check('RLS cruzado perfiles y solicitudes '+actor,async()=>{const client=a[actor],other=v.accounts.find(x=>x.alias===target),p=await client.from('profiles').select('id').eq('id',other.id),w=await client.from('profiles').update({full_name:'NO_DEBE_APLICAR_FASE8'}).eq('id',other.id).select('id'),q=await client.from('appointment_requests').select('id').eq('user_id',other.id);ensure(!p.error&&!w.error&&!q.error&&p.data.length===0&&w.data.length===0&&q.data.length===0,'RLS_CROSS_ACCESS');return{http:[p.status,w.status,q.status],filasLeidas:0,filasModificadas:0,dosJWTReales:true};});
 await check('Catálogo público excluye los dos profesionales demo inactivos',async()=>{const r=await c.user().from('dentists').select('id').in('id',v.resources.dentists);ensure(!r.error&&r.data.length===0,'INACTIVE_DIRECTORY_EXPOSED');return{http:r.status,filas:0};});
 await check('Lectura de consentimientos propios sin crear registros innecesarios',async()=>{const r=await a.paciente_a.from('patient_consents').select('id').eq('user_id',v.accounts.find(x=>x.alias==='paciente_a').id);ensure(!r.error&&r.data.length===0,'CONSENT_READ_FAILED');return{http:r.status,filas:0,revocacionClinica:'probada por RPC aparte; no equivale a consentimiento fotográfico'};});
 await check('Administrador: enrolamiento y desafío TOTP real AAL2',async()=>{const client=await elevarAdministrador(v,c),f=await client.auth.mfa.listFactors();ensure(!f.error,'FACTOR_LIST_FAILED');return{nivel:'aal2',factoresVerificados:f.data.totp.filter(x=>x.status==='verified').length,secretosSoloEnAlmacenDPAPI:true};});
 }catch(e){report.bloqueo=/^[A-Z_0-9]+$/.test(e.message)?e.message:'PRIVATE_VALIDATION_FAILED';}
 report.aprobadas=report.pruebas.filter(x=>x.aprobada).length;report.fallidas=report.pruebas.filter(x=>!x.aprobada).length;saveReport('CUENTAS_RLS_MFA_REALES.json',report);console.log(JSON.stringify({aprobadas:report.aprobadas,fallidas:report.fallidas,bloqueo:report.bloqueo??null}));if(report.fallidas||report.bloqueo)process.exitCode=1;
}
