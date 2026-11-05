import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){return s.startsWith('.')&&c.parentURL?.includes('/clinica-http/')&&!/\.[a-z]+$/i.test(s)?n(new URL(s+'.ts',c.parentURL).href,c):n(s,c);}});
const { crearApiClinica } = await import('../clinica-http/http.ts');
const { crearClienteApiClinica } = await import('./api-clinica.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
// Ejecuta cliente y BFF reales en memoria. Auth/RPC son dobles: no acredita RLS.
function preparar() {
  let token='a.b.c', authStatus=200, denied=false;
  const calls=[], audit=[];
  const bff=crearApiClinica({enabled:true,cursorSecret:'x'.repeat(43),cursorTtl:300,
    autenticar:async()=>authStatus!==200?{ok:false,status:authStatus}:{ok:true,
      usuario:{id:id(1),sessionId:id(2),exp:Math.floor(Date.now()/1000)+3600,roles:['odontologo']},
      rpc:async(name,args)=>{
        calls.push({name,args});
        const base={ok:true,status:200,requestId:id(99),environment:'qa_local',nextAfterId:null};
        if(name==='get_authorized_clinical_history'){
          audit.push(denied?'denied':'allowed');
          return {error:null,data:denied?{ok:false,status:403,requestId:id(99)}:{...base,
            apiVersion:'clinical.v1',origen:'supabase',estado:'listo',
            caso:{patientId:id(41),professionalContext:id(1),clinicContext:id(31)},
            entries:[{encounterId:id(51),attendedAt:'2026-11-01T00:00:00Z',recordedAt:'2026-11-01T00:00:00Z',status:'recorded',replacesId:null,correctionReason:null,
              origin:{clinicId:id(31),clinicName:'Clínica sintética',professionalId:id(1),professionalName:null},background:{state:'unknown',value:null},clinicalEntries:[],diagnoses:[],treatments:[],exams:[]}],nextCursor:null}};
        }
        const kind=args.p_kind;
        const data=kind==='professional'?{professionalId:id(1),dentistId:null,contexts:[{membershipId:id(33),clinicId:id(31),clinicName:'Clínica sintética',validFrom:'2026-01-01T00:00:00Z',validUntil:null}]}:
          kind==='patients'?{membershipId:id(33),items:[{patientId:id(41)}]}:
          {membershipId:id(33),professionalId:id(1),items:[{id:id(71),status:'requested',createdAt:'2026-11-01T00:00:00Z',preferredDate:'2026-12-01',preferredTime:null,isDemo:true,contact_email:'SECRET'}]};
        return {error:null,data:{...base,apiVersion:'clinical.workspace.v1',kind,data}};
      }} });
  const client=crearClienteApiClinica({obtenerAccessToken:async()=>token,fetchImpl:async(path,init)=>{
    const req=new Request('http://localhost'+path,init), url=new URL(req.url);
    const res=url.pathname.endsWith('/history')?await bff.historial(req,id(41)):
      await bff.workspace(req,url.pathname.endsWith('/me')?'professional':url.pathname.endsWith('/patients')?'patients':'requests');
    assert.match(res.headers.get('cache-control'),/no-store/);
    return res;
  }});
  return {client,calls,audit,signal:new AbortController().signal,setToken:v=>token=v,setAuth:v=>authStatus=v,setDenied:v=>denied=v};
}
test('DI-159 cliente → BFF: perfil, solicitudes asignadas y pacientes autorizados compatibles',async()=>{
  const p=preparar();
  assert.equal((await p.client.obtenerPerfil({},p.signal)).data.contexts[0].membershipId,id(33));
  const requests=await p.client.obtenerSolicitudes(id(33),{},p.signal);
  assert.equal(requests.data.items[0].id,id(71));
  assert.equal(JSON.stringify(requests).includes('SECRET'),false);
  assert.equal((await p.client.obtenerPacientes(id(33),{},p.signal)).data.items[0].patientId,id(41));
  assert.equal(p.calls[1].args.p_membership_id,id(33));
});
test('DI-159 cliente → BFF: historial autorizado y nueva lectura denegada tras cambio de permiso RPC',async()=>{
  const p=preparar();
  assert.equal((await p.client.obtenerHistorial(id(41),id(33),{},p.signal)).entries[0].encounterId,id(51));
  p.setDenied(true);
  await assert.rejects(()=>p.client.obtenerHistorial(id(41),id(33),{},p.signal),e=>e.status===403&&e.code==='ACCESS_DENIED');
  assert.deepEqual(p.audit,['allowed','denied']); // Auditor doble, sin persistencia SQL.
});
for(const status of [401,403])test(`DI-159 cliente → BFF: Auth ${status} impide consultar RPC`,async()=>{
  const p=preparar();p.setAuth(status);
  await assert.rejects(()=>p.client.obtenerPerfil({},p.signal),e=>e.status===status);
  assert.equal(p.calls.length,0);
});
test('DI-159 sin token después de logout no consulta BFF/RPC',async()=>{
  const p=preparar();p.setToken(null);
  await assert.rejects(()=>p.client.obtenerPerfil({},p.signal),e=>e.status===401);
  assert.equal(p.calls.length,0);
});
