import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks}from'node:module';
registerHooks({resolve(s,c,n){return s.startsWith('.')&&c.parentURL?.includes('/clinica-http/')&&!/\.[a-z]+$/i.test(s)?n(new URL(s+'.ts',c.parentURL).href,c):n(s,c);}});
const{consultaWorkspace,workspaceDto}=await import('./workspace.ts');
const{crearApiClinica}=await import('./http.ts');
const id=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const request=(query='')=>new Request('http://localhost/api/clinical/patients/me'+query,{headers:{Authorization:'Bearer a.b.c'}});
const raw=(kind,data)=>({ok:true,status:200,kind,data,apiVersion:'clinical.workspace.v1',environment:'qa_local',nextAfterId:null,requestId:id(99)});
test('paciente propio no acepta ID/rol/escenario arbitrarios',()=>{for(const q of ['?patientId='+id(42),'?roles=superusuario','?escenario=concedido','?membershipId='+id(33)])assert.throws(()=>consultaWorkspace(request(q),'patient'));});
test('contexto requerido para pacientes y solicitudes profesionales',()=>{for(const k of ['patients','requests'])assert.throws(()=>consultaWorkspace(request(),k));});
test('query profesional valida UUID, estados originales y keyset',()=>{
 const q=consultaWorkspace(request('?membershipId='+id(33)+'&afterId='+id(41)+'&status=cancelled&limit=1'),'requests');
 assert.equal(q.p_status,'cancelled');assert.equal(q.p_limit,1);assert.equal(q.p_after_id,id(41));
 for(const query of ['?membershipId=x','?membershipId='+id(33)+'&status=confirmed','?membershipId='+id(33)+'&limit=51','?membershipId='+id(33)+'&limit=1&limit=2'])assert.throws(()=>consultaWorkspace(request(query),'requests'));
});
test('estado de solicitudes no se admite en otros recursos',()=>assert.throws(()=>consultaWorkspace(request('?status=requested'),'grants')));
test('DTO identidad solo proyecta ID propio',()=>assert.deepEqual(workspaceDto(raw('patient',{patientId:id(41),secret:'no'}),'patient').data,{patientId:id(41)}));
test('DTO rechaza origen/kind/version inconsistentes',()=>{for(const x of [{kind:'grants'},{apiVersion:'x'},{environment:'production'}])assert.throws(()=>workspaceDto({...raw('patient',{patientId:id(41)}),...x},'patient'));});
test('DTO solicitudes no contiene datos de contacto ni ID Auth del paciente',()=>{
 const d=workspaceDto(raw('requests',{membershipId:id(33),professionalId:id(23),items:[{id:id(71),status:'requested',createdAt:'2026-11-03T00:00:00.123456Z',preferredDate:'2026-12-01',preferredTime:null,isDemo:true,contact_email:'NO_DEVOLVER',message:'NO_DEVOLVER',user_id:id(1)}]}),'requests');
 assert.equal(JSON.stringify(d).includes('NO_DEVOLVER'),false);assert.equal(d.data.items.length,1);
});
test('DTO rechaza objetos/filas sin contrato y páginas excesivas',()=>{assert.throws(()=>workspaceDto(raw('patients',{membershipId:id(33),items:Array(51).fill({patientId:id(41)})}),'patients'));assert.throws(()=>workspaceDto(raw('patient',{patientId:'otro'}),'patient'));});
test('lista clínica vacía mantiene contexto y pagina nula',()=>assert.deepEqual(workspaceDto(raw('patients',{membershipId:id(33),items:[]}),'patients').data,{membershipId:id(33),items:[]}));
function api(result,enabled=true,status){let calls=0;return{calls:()=>calls,api:crearApiClinica({enabled,cursorSecret:'x',cursorTtl:300,autenticar:async()=>status?{ok:false,status}:{ok:true,usuario:{id:id(1),sessionId:id(1001),exp:9999999999,roles:['paciente']},rpc:async()=>{calls++;return{data:result,error:null};}}})};}
test('endpoint desactivado no consulta Auth/RPC',async()=>{const p=api({},false);assert.equal((await p.api.workspace(request(),'patient')).status,404);assert.equal(p.calls(),0);});
test('endpoint sin JWT y sin autorización no invoca RPC',async()=>{const p=api({},true,403);assert.equal((await p.api.workspace(new Request('http://localhost'),'patient')).status,401);assert.equal((await p.api.workspace(request(),'patient')).status,403);assert.equal(p.calls(),0);});
test('RPC denegado transforma envelope en HTTP 403 sin datos',async()=>{const p=api({ok:false,status:403,requestId:id(99),data:{private:'NO'}});const r=await p.api.workspace(request(),'patient');assert.equal(r.status,403);assert.equal(JSON.stringify(await r.json()).includes('private'),false);});
test('endpoint proyecta datos y marca no-store',async()=>{const p=api(raw('patient',{patientId:id(41)}));const r=await p.api.workspace(request(),'patient');assert.equal(r.status,200);assert.ok(r.headers.get('cache-control').includes('no-store'));assert.equal((await r.json()).data.patientId,id(41));});
test('respuesta RPC con contexto distinto falla cerrada',async()=>{const p=api(raw('patients',{membershipId:id(34),items:[]}));assert.equal((await p.api.workspace(request('?membershipId='+id(33)),'patients')).status,503);});
