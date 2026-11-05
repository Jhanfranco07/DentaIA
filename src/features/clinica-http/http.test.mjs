import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomBytes } from 'node:crypto';
// Resolver local del banco Node 22; no modifica tsconfig ni el código productivo.
registerHooks({resolve(spec,ctx,next){if(spec.startsWith('.')&&ctx.parentURL?.includes('/clinica-http/')&&!/\.[a-z]+$/i.test(spec))return next(new URL(spec+'.ts',ctx.parentURL).href,ctx);return next(spec,ctx);}});
const {crearApiClinica}=await import('./http.ts');
const {fechaIso,entradaConcesion,leerJsonAcotado}=await import('./validaciones.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Math.floor(Date.now()/1000);
const grantBody={membershipId:id(33),encounterIds:[id(51)],expiresAt:'2026-12-01T00:00:00.123456Z',policyVersion:'QA-v1',accepted:true};
const good={ok:true,status:201,id:id(71),estado:'vigente',expiresAt:grantBody.expiresAt,revokedAt:null,replayed:false,requestId:id(99),privateKey:'DO_NOT_RETURN'};
function prepare(result={data:good,error:null},options={}){
 const rpcCalls=[],events=[];let authCalls=0;
 const api=crearApiClinica({enabled:true,cursorSecret:randomBytes(32).toString('base64url'),cursorTtl:300,
  autenticar:async()=>{authCalls++;return{ok:true,usuario:{id:id(1),sessionId:id(1001),exp:now+3600,roles:['paciente']},rpc:async(name,args)=>{rpcCalls.push({name,args});return result;}};},
  registrar:e=>events.push(e),...options});
 return{api,rpcCalls,events,get authCalls(){return authCalls;}};
}
const req=(body=grantBody,extra={})=>new Request('http://localhost/api/clinical/access-grants',{method:'POST',headers:{Authorization:'Bearer a.b.c','Content-Type':'application/json','Idempotency-Key':id(71),...extra},body:JSON.stringify(body)});
test('API desactivada falla cerrada sin llamar Auth ni RPC',async()=>{const p=prepare(undefined,{enabled:false});assert.equal((await p.api.conceder(req())).status,404);assert.equal(p.authCalls,0);});
test('diagnóstico de configuración queda solo en el registro controlado, sin exponer valores',async()=>{
 const p=prepare(undefined,{enabled:false,diagnosticoConfiguracion:'CONFIGURACION_INVALIDA'});
 const r=await p.api.workspace(new Request('http://localhost/api/professional/me',{headers:{Authorization:'Bearer a.b.c'}}),'professional');
 assert.equal(r.status,404);assert.equal((await r.json()).code,'NOT_FOUND');
 assert.equal(p.events[0].code,'CONFIGURACION_INVALIDA');assert.deepEqual(Object.keys(p.events[0]).sort(),['code','operation','requestId','status']);
});
test('sin JWT devuelve 401 y log no incluye token ni datos',async()=>{const p=prepare();const r=await p.api.conceder(req(grantBody,{Authorization:''}));assert.equal(r.status,401);assert.equal(p.rpcCalls.length,0);assert.deepEqual(Object.keys(p.events[0]).sort(),['code','operation','requestId','status']);});
test('error de autenticación se conserva y no ejecuta RPC',async()=>{const p=prepare(undefined,{autenticar:async()=>({ok:false,status:403,diagnostico:'ROL_INSUFICIENTE'})});const r=await p.api.conceder(req());assert.equal(r.status,403);assert.equal((await r.json()).code,'ACCESS_DENIED');assert.equal(p.events[0].code,'ROL_INSUFICIENTE');assert.equal(p.rpcCalls.length,0);});
test('concesión convierte envelope 201 a HTTP 201 y proyecta DTO',async()=>{const p=prepare();const r=await p.api.conceder(req());assert.equal(r.status,201);assert.equal((await r.json()).privateKey,undefined);assert.ok(r.headers.get('cache-control').includes('no-store'));assert.equal(r.headers.get('vary'),'Authorization');assert.equal(p.rpcCalls[0].args.p_accepted,true);assert.ok(!('p_actor_id'in p.rpcCalls[0].args));});
test('actor y rol no pueden declararse en cuerpo',async()=>{for(const k of ['actorId','roles','patientId','purpose']){const p=prepare();assert.equal((await p.api.conceder(req({...grantBody,[k]:id(2)}))).status,400);assert.equal(p.rpcCalls.length,0);}});
test('origen de escritura cruzado se rechaza',async()=>{const p=prepare();assert.equal((await p.api.conceder(req(grantBody,{Origin:'https://example.invalid'}))).status,403);assert.equal(p.rpcCalls.length,0);});
test('clave de idempotencia es obligatoria y UUID',async()=>{const p=prepare();assert.equal((await p.api.conceder(req(grantBody,{'Idempotency-Key':'bad'}))).status,400);});
test('error PostgREST se normaliza sin filtrar detalle',async()=>{const p=prepare({data:null,error:{message:'DO_NOT_RETURN'}});const r=await p.api.conceder(req());assert.equal(r.status,503);assert.ok(!(await r.text()).includes('DO_NOT_RETURN'));});
test('denegación SQL HTTP 200 se convierte a HTTP 403',async()=>{const p=prepare({data:{ok:false,status:403,code:'INTERNAL_REASON',entries:['DO_NOT_RETURN'],requestId:id(99)},error:null});const r=await p.api.conceder(req());assert.equal(r.status,403);const d=await r.json();assert.equal(d.code,'ACCESS_DENIED');assert.equal(d.entries,undefined);assert.equal(d.requestId,id(99));});
test('payload de otro paciente no sale del adaptador',async()=>{const p=prepare({data:{ok:true,status:200,requestId:id(99),apiVersion:'clinical.v1',origen:'supabase',environment:'qa_local',estado:'sin_datos',caso:{patientId:id(42),professionalContext:null,clinicContext:null},entries:[],nextCursor:null},error:null});const r=await p.api.historial(new Request('http://localhost/api/clinical/patients/'+id(41)+'/history',{headers:{Authorization:'Bearer a.b.c'}}),id(41));assert.equal(r.status,503);assert.ok(!(await r.text()).includes(id(42)));});
test('consulta duplicada se rechaza antes de RPC',async()=>{const p=prepare();const r=await p.api.historial(new Request('http://localhost/api/clinical/patients/'+id(41)+'/history?limit=1&limit=2',{headers:{Authorization:'Bearer a.b.c'}}),id(41));assert.equal(r.status,400);assert.equal(p.rpcCalls.length,0);});
test('fechas inválidas no pasan y precisión de seis decimales se conserva',()=>{assert.equal(fechaIso('2026-02-30T00:00:00Z'),false);assert.equal(fechaIso('2026-11-03T25:00:00Z'),false);assert.equal(fechaIso(grantBody.expiresAt),true);assert.equal(entradaConcesion(grantBody).expiresAt,grantBody.expiresAt);});
test('recursos vacíos, duplicados y aceptación falsa se rechazan',()=>{for(const d of [{encounterIds:[]},{encounterIds:[id(51),id(51)]},{accepted:false}])assert.throws(()=>entradaConcesion({...grantBody,...d}));});
test('cuerpo por streaming también respeta límite de bytes',async()=>{const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(8193));c.close();}});const r=new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:stream,duplex:'half'});await assert.rejects(()=>leerJsonAcotado(r),e=>e.status===413);});
test('JSON inválido o tipo MIME incorrecto se distinguen',async()=>{await assert.rejects(()=>leerJsonAcotado(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})),e=>e.status===415);await assert.rejects(()=>leerJsonAcotado(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:'['})),e=>e.status===400);});
