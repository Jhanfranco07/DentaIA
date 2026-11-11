import test from 'node:test';
import assert from 'node:assert/strict';
import { crearApiCambiosRoles, evaluarTransicionRoles, validarCambioRoles } from './cambios-roles.ts';
import { ejecutarOperacionAdministrativa } from '../autorizacion/autorizacion.ts';

// Dobles explícitos: estas pruebas NO ejecutan SQL ni modifican Supabase.
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const asignacion=roles=>({version:1,estado:'activo',roles});
const base=()=>({usuarioId:id(2),operacion:'asignar',rol:'paciente',revisionEsperada:0,asignacionEsperada:null,aprobacionId:id(3)});
const identidad={actorId:id(1),sesionId:id(4),expira:Math.floor(Date.now()/1000)+3600};
const resultado=()=>({status:200,codigo:'CAMBIO_APLICADO',resultado:'aplicado',revision:1,asignacion:asignacion(['paciente'])});
function preparar({rol='superusuario',aal='aal2',error=null,fallo=false,alEjecutar}={}){
  const llamadas=[];
  const cliente=()=>({auth:{getUser:async()=>({data:{user:{id:id(1),aud:'authenticated',confirmed_at:'2026-11-01',
    app_metadata:{dentaia:asignacion([rol])},factors:[{status:'verified'}]}},error}),
    getClaims:async()=>({data:{claims:{sub:id(1),role:'authenticated',aal,session_id:id(4),exp:identidad.expira}},error})}});
  const api=crearApiCambiosRoles((r,a,o)=>ejecutarOperacionAdministrativa(r,a,cliente,o),async()=>identidad,{
    ejecutar:async(...args)=>{llamadas.push(args);if(fallo)throw Error('detalles-privados-no-publicar');return alEjecutar?alEjecutar(...args):resultado();},
  });
  return {api,llamadas};
}
function req(body=base(),extra={}){
  return new Request('http://localhost:3000/api/administracion/roles',{
    method:'POST',headers:{authorization:'Bearer fixture-sesion',origin:'http://localhost:3000',
      'content-type':'application/json','idempotency-key':id(5),...extra},
    body:typeof body==='string'?body:JSON.stringify(body),
  });
}
test('contrato de cambio estricto: rechaza campos de autoridad, metadatos y revisiones inválidas',()=>{
  assert.deepEqual(validarCambioRoles(base()),base());
  for(const extra of [{actorId:id(8)},{app_metadata:{}},{revisionEsperada:-1},{revisionEsperada:1.2},
    {revisionEsperada:2147483647},{usuarioId:'otro'},{rol:'service_role'},{aprobacionId:'x'},
    {asignacionEsperada:asignacion(['paciente','paciente'])},{asignacionEsperada:{...asignacion(['paciente']),secreto:'x'}}]){
    assert.equal(validarCambioRoles({...base(),...extra}),null);
  }
});
test('transiciones de paciente preservan roles independientes y revocar el último elimina la asignación',()=>{
  assert.deepEqual(evaluarTransicionRoles(id(1),id(2),null,base()).asignacion,asignacion(['paciente']));
  assert.deepEqual(evaluarTransicionRoles(id(1),id(2),asignacion(['odontologo']),base()).asignacion,asignacion(['odontologo','paciente']));
  assert.equal(evaluarTransicionRoles(id(1),id(2),asignacion(['paciente']),{operacion:'revocar',rol:'paciente'}).asignacion,null);
});
test('cambios propios, superusuario objetivo y concesiones no aprobadas se deniegan',()=>{
  assert.equal(evaluarTransicionRoles(id(1),id(1),null,base()).codigo,'CAMBIO_PROPIO_PROHIBIDO');
  assert.equal(evaluarTransicionRoles(id(1),id(2),asignacion(['superusuario']),base()).codigo,'SUPERUSUARIO_PROTEGIDO');
  for(const rol of ['odontologo','superusuario'])assert.equal(evaluarTransicionRoles(id(1),id(2),null,{operacion:'asignar',rol}).permitido,false);
});
test('promoción administrativa requiere aprobación independiente y MFA del objetivo; protege último superusuario',()=>{
  const control={aprobacionIndependiente:true,superusuariosActivos:2,mfaObjetivo:true};
  const promover={operacion:'asignar',rol:'superusuario'};
  assert.deepEqual(evaluarTransicionRoles(id(1),id(2),asignacion(['paciente']),promover,control).asignacion,asignacion(['paciente','superusuario']));
  assert.equal(evaluarTransicionRoles(id(1),id(2),null,promover,{...control,mfaObjetivo:false}).codigo,'MFA_OBJETIVO_REQUERIDO');
  assert.equal(evaluarTransicionRoles(id(1),id(2),asignacion(['superusuario']),{operacion:'revocar',rol:'superusuario'},{...control,superusuariosActivos:1}).codigo,'ULTIMO_SUPERUSUARIO_PROTEGIDO');
  assert.equal(evaluarTransicionRoles(id(1),id(2),asignacion(['superusuario']),{operacion:'revocar',rol:'superusuario'},control).asignacion,null);
  assert.equal(evaluarTransicionRoles(id(1),id(1),null,promover,control).codigo,'CAMBIO_PROPIO_PROHIBIDO');
});
test('aprobación administrativa no sustituye verificación profesional; sí permite revocar un rol existente',()=>{
  const control={aprobacionIndependiente:true,superusuariosActivos:2,mfaObjetivo:true};
  assert.equal(evaluarTransicionRoles(id(1),id(2),null,{operacion:'asignar',rol:'odontologo'},control).codigo,'VERIFICACION_PROFESIONAL_PENDIENTE');
  assert.deepEqual(evaluarTransicionRoles(id(1),id(2),asignacion(['paciente','odontologo']),{operacion:'revocar',rol:'odontologo'},control).asignacion,asignacion(['paciente']));
});
test('API reutiliza DI-150 y transmite únicamente contexto verificado, transición y clave',async()=>{
  const p=preparar();const r=await p.api(req());
  assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private, no-store/);
  assert.deepEqual(p.llamadas,[[identidad,base(),id(5)]]);
  assert.doesNotMatch(await r.text(),/fixture-sesion|expira|sesionId|actorId/);
});
test('sin sesión, paciente, odontólogo, AAL1 y fallo de Auth no acceden al proveedor',async()=>{
  for(const [op,status] of [[{rol:'paciente'},403],[{rol:'odontologo'},403],[{aal:'aal1'},403],[{error:{status:401}},401]]){
    const p=preparar(op);const r=req();assert.equal((await p.api(r)).status,status);assert.equal(p.llamadas.length,0);assert.equal(r.bodyUsed,false);
  }
  const p=preparar();const r=req();r.headers.delete('authorization');assert.equal((await p.api(r)).status,401);assert.equal(p.llamadas.length,0);
});
test('pérdida de autorización entre solicitudes se revalida y no reutiliza el permiso anterior',async()=>{
  const p=preparar();assert.equal((await p.api(req())).status,200);
  const revocado=preparar({rol:'paciente'});assert.equal((await revocado.api(req())).status,403);assert.equal(revocado.llamadas.length,0);
});
test('protección de origen, tipo JSON, clave, longitud y entrada desconocida',async()=>{
  for(const [body,extra,status] of [[base(),{origin:'https://ajeno.test'},403],[base(),{'sec-fetch-site':'cross-site'},403],
    [base(),{'content-type':'text/plain'},400],[base(),{'idempotency-key':''},400],['{',{},400],['a'.repeat(2050),{},413],
    [{...base(),actorId:id(7)},{},400]]){
    const p=preparar();assert.equal((await p.api(req(body,extra))).status,status);assert.equal(p.llamadas.length,0);
  }
});
test('consulta de revisión es protegida y no admite campos adicionales o duplicados',async()=>{
  for(const query of [`?usuarioId=${id(2)}`,`?usuarioId=${id(2)}&usuarioId=${id(2)}`,`?usuarioId=${id(2)}&rol=superusuario`]){
    const p=preparar();const r=await p.api(new Request('http://localhost:3000/api/administracion/roles'+query,{headers:{authorization:'Bearer fixture-sesion'}}));
    assert.equal(r.status,query.includes('&')?400:200);
    if(!query.includes('&'))assert.deepEqual(p.llamadas[0],[identidad,{usuarioId:id(2),operacion:'consultar'},null]);
  }
});
test('respuestas perdidas y fallos de auditoría no se presentan como éxito ni rollback confirmado',async()=>{
  const p=preparar({fallo:true});const r=await p.api(req());const body=await r.json();
  assert.equal(r.status,503);assert.equal(body.codigo,'ESTADO_NO_CONFIRMADO');assert.equal(body.solicitudId,id(5));
  assert.doesNotMatch(JSON.stringify(body),/detalles-privados|aplicado|rollback/);
});
test('reintento conserva clave y contenido; transporte no decide por sí mismo si hubo commit',async()=>{
  let intento=0;
  const p=preparar({alEjecutar:async()=>{if(++intento===1)throw Error('respuesta perdida');return resultado();}});
  assert.equal((await p.api(req())).status,503);assert.equal((await p.api(req())).status,200);
  assert.deepEqual(p.llamadas[0],p.llamadas[1]);
});
test('solicitudes simultáneas llegan al puerto con su versión y claves distintas; no simula un lock PostgreSQL',async()=>{
  const p=preparar();const r2=req(base(),{'idempotency-key':id(6)});
  await Promise.all([p.api(req()),p.api(r2)]);
  assert.equal(p.llamadas.length,2);assert.deepEqual(p.llamadas.map(l=>l[2]).sort(),[id(5),id(6)]);
  assert.ok(p.llamadas.every(l=>l[1].revisionEsperada===0));
});
test('rechazos de la unidad transaccional se propagan sin afirmar aplicación',async()=>{
  for(const [status,codigo] of [[409,'VERSION_OBSOLETA'],[409,'CLAVE_REUTILIZADA'],[403,'APROBACION_NO_VALIDA'],[403,'AUTORIZACION_NO_VIGENTE']]){
    const p=preparar({alEjecutar:async()=>({status,codigo,resultado:'rechazado',revision:null,asignacion:null})});
    const r=await p.api(req());assert.equal(r.status,status);assert.equal((await r.json()).resultado,'rechazado');
  }
});
