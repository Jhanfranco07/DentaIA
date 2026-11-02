import test from 'node:test';
import assert from 'node:assert/strict';
import { crearApiAdministrativa } from './api.ts';
import { crearProveedorAdministrativoSimulado, ACTOR_ADMINISTRATIVO_DEMO } from './servicios.ts';
import { ejecutarOperacionAdministrativa } from '../autorizacion/autorizacion.ts';
const destino='00000000-0000-4000-8000-000000000002';
function cliente({rol='superusuario',aal='aal2',error=null,id=ACTOR_ADMINISTRATIVO_DEMO}={}) {
  return ()=>({auth:{getUser:async()=>({data:{user:{id,aud:'authenticated',confirmed_at:'2026-11-01T00:00:00Z',
    app_metadata:{dentaia:{version:1,estado:'activo',roles:[rol]}},user_metadata:{},factors:[{status:'verified'}]}},error}),
    getClaims:async()=>({data:{claims:{sub:id,role:'authenticated',aal,session_id:'sesion-sintetica',exp:Date.now()/1000+3600}},error:null})}});
}
const req=(query='',authorization='Bearer token-sintetico')=>new Request('https://dentaia.example.test/api/administracion/usuarios'+query,{headers:authorization?{authorization}:{}});
const post=(body={operacion:'validar_cambio_rol',usuarioId:destino,rol:'odontologo'},headers={})=>new Request('https://dentaia.example.test/api/administracion/roles/validar',{
  method:'POST',headers:{authorization:'Bearer token-sintetico','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body),
});
const api=(crear=cliente(),proveedor=crearProveedorAdministrativoSimulado())=>crearApiAdministrativa((request,accion,operacion)=>ejecutarOperacionAdministrativa(request,accion,crear,operacion),proveedor);

test('consulta autorizada reutiliza el guard AAL2 y devuelve solo datos sintéticos privados',async()=>{
  const response=await api().listar(req('?pagina=2&tamano=5'));
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
  const body=await response.json();assert.equal(body.pagina,2);assert.equal(body.origen,'sintetico');assert.equal(body.usuarios.length,5);
});
test('visitante, token inválido, paciente, odontólogo y AAL1 no llegan a consultar servicios',async()=>{
  for(const [crear,request,status] of [[cliente(),req('',null),401],[cliente({error:{status:401}}),req(),401],
    [cliente({rol:'paciente'}),req(),403],[cliente({rol:'odontologo'}),req(),403],[cliente({aal:'aal1'}),req(),403]]){
    let consultas=0;
    const p={listar:async()=>{consultas++;throw Error('no ejecutar');},validarPropuesta:async()=>{consultas++;throw Error('no ejecutar');}};
    const a=api(crear,p);
    assert.equal((await a.listar(request)).status,status);assert.equal(consultas,0);
    const escritura=post();if(status===401&&request.headers.get('authorization')===null) escritura.headers.delete('authorization');
    assert.equal((await a.validarRol(escritura)).status,status);assert.equal(consultas,0);
    assert.equal(escritura.bodyUsed,false);
  }
});
test('consulta estricta: desconocidos, duplicados y formato de paginación se rechazan',async()=>{
  for(const query of ['?rol=admin','?pagina=0','?pagina=1.2','?pagina=1&pagina=2','?tamano=1000','?actorId=otro','?__proto__=otro']) assert.equal((await api().listar(req(query))).status,400,query);
});
test('proyección de respuesta excluye campos privados adicionales de un proveedor',async()=>{
  const base=crearProveedorAdministrativoSimulado();
  const p={...base,listar:async entrada=>{
    const r=await base.listar(entrada);
    return {ok:true,valor:{...r.valor,secreto:'no-publicar',usuarios:r.valor.usuarios.map(u=>({...u,email:'no-publicar',phone:'no-publicar',app_metadata:{privado:true},historial:'no-publicar'}))}};
  }};
  const text=await (await api(cliente(),p).listar(req())).text();
  assert.doesNotMatch(text,/email|phone|app_metadata|historial|secreto|no-publicar/);
});
test('propuesta autorizada es validación sin aplicar; la identidad procede del guard',async()=>{
  const a=api();const response=await a.validarRol(post());assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.aplicado,false);assert.equal(body.modo,'solo_validacion');
  assert.doesNotMatch(JSON.stringify(body),/token-sintetico|app_metadata/);
  assert.equal((await a.validarRol(post({operacion:'validar_cambio_rol',usuarioId:ACTOR_ADMINISTRATIVO_DEMO,rol:'paciente'}))).status,403);
});
test('no se aceptan actor/autoridad del cliente, acciones de escritura ni promociones',async()=>{
  const a=api();
  for(const [cambios,status] of [[{actorId:destino},400],[{rol:'service_role'},400],[{usuarioId:'x'},400],[{rol:'superusuario'},403],[{operacion:'guardar_rol'},400]]){
    const response=await a.validarRol(post({operacion:'validar_cambio_rol',usuarioId:destino,rol:'paciente',...cambios}));assert.equal(response.status,status);
  }
});
test('JSON, tipo de contenido y tamaño de cuerpo se validan tras autorización',async()=>{
  assert.equal((await api().validarRol(post('{'))).status,400);
  assert.equal((await api().validarRol(post({}, {'content-type':'text/plain'}))).status,400);
  assert.equal((await api().validarRol(post('a'.repeat(3000)))).status,413);
});
test('escenarios vacíos, errores de servicio y excepciones no filtran detalles',async()=>{
  const vacio=api(cliente(),crearProveedorAdministrativoSimulado({escenario:'vacio'}));
  assert.equal((await (await vacio.listar(req())).json()).total,0);
  const error=api(cliente(),crearProveedorAdministrativoSimulado({escenario:'error'}));
  assert.equal((await error.listar(req())).status,503);assert.equal((await error.validarRol(post())).status,503);
  const explota=api(cliente(),{listar:async()=>{throw Error('detalle-privado-sintetico');}});
  const r=await explota.listar(req());assert.equal(r.status,500);assert.doesNotMatch(await r.text(),/detalle-privado/);
});
