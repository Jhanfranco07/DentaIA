import test from 'node:test';
import assert from 'node:assert/strict';
import { autorizarSolicitudAdministrativa, responderComprobacionAdministrativa, leerAsignacionAdministrativa, ROLES_NEGOCIO } from './autorizacion.ts';

// Identidad sintética: solo fixtures en memoria, nunca se crea en Supabase.
const asignacion = {version:1, estado:'activo', roles:['superusuario']};
const usuario = (extra={}) => ({id:'identidad-sintetica',aud:'authenticated',confirmed_at:'2026-10-31T00:00:00Z',
  app_metadata:{dentaia:asignacion},user_metadata:{},factors:[{id:'factor-sintetico',status:'verified',factor_type:'totp'}],...extra});
const headers = () => new Headers({Authorization:'Bearer token-sintetico'});
function proveedor(user=usuario(), error=null) {
  const llamadas=[];
  return {llamadas,crear:()=>({auth:{getUser:async token=>{llamadas.push(token);return {data:{user},error};},getClaims:async()=>({data:{claims:{sub:user?.id,role:'authenticated',aal:'aal2',session_id:'sesion-sintetica',exp:Date.now()/1000+3600}},error:null})}})};
}

test('sin sesión, esquema incorrecto o bearer ambiguo: 401 y no consulta Auth',async()=>{
  for(const authorization of [null,'','Basic abc','Bearer','Bearer uno dos','Bearer uno, Bearer dos','Bearer '+ 'a'.repeat(8193)]) {
    const h=new Headers(); if(authorization!==null) h.set('authorization',authorization);
    const p=proveedor();
    assert.deepEqual(await autorizarSolicitudAdministrativa(h,p.crear),{autorizado:false,status:401});
    assert.deepEqual(p.llamadas,[]);
  }
});
test('Auth recibe el token exacto; no se decodifica como prueba de identidad',async()=>{
  const p=proveedor();
  assert.deepEqual(await autorizarSolicitudAdministrativa(headers(),p.crear),{autorizado:true,usuarioId:'identidad-sintetica'});
  assert.deepEqual(p.llamadas,['token-sintetico']);
});
test('sesión inválida, expirada o usuario inexistente: 401 aunque vengan metadatos',async()=>{
  for(const [user,error] of [[null,null],[usuario(),{status:401}],[usuario(),{status:403}]]) {
    assert.deepEqual(await autorizarSolicitudAdministrativa(headers(),proveedor(user,error).crear),{autorizado:false,status:401});
  }
});
test('paciente o profesional autenticado carece de autorización administrativa',async()=>{
  for(const app_metadata of [{},{role:'superusuario'},{dentaia:{...asignacion,roles:['paciente']}},{dentaia:{...asignacion,roles:['odontologo']}}]) {
    assert.deepEqual(await autorizarSolicitudAdministrativa(headers(),proveedor(usuario({app_metadata})).crear),{autorizado:false,status:403});
  }
});
test('autoasignación en user_metadata no concede acceso, ni con namespace idéntico',async()=>{
  const p=proveedor(usuario({app_metadata:{},user_metadata:{role:'superusuario',dentaia:asignacion,app_metadata:{dentaia:asignacion}}}));
  assert.deepEqual(await autorizarSolicitudAdministrativa(headers(),p.crear),{autorizado:false,status:403});
});
test('rol recibido en query, cookies, encabezados o cuerpo no es autoridad',async()=>{
  const request=new Request('https://dentaia.example.test/api/administracion/acceso?role=superusuario&access_token=token-sintetico',{
    method:'POST',headers:{...Object.fromEntries(headers()),'x-role':'superusuario','x-user-id':'otro','cookie':'role=superusuario'},
    body:JSON.stringify({app_metadata:{dentaia:asignacion},role:'superusuario'}),
  });
  const response=await responderComprobacionAdministrativa(request,proveedor(usuario({app_metadata:{}})).crear);
  assert.equal(response.status,403);
  const sinBearer=new Request(request.url,{headers:{cookie:'access_token=token-sintetico'}});
  const p=proveedor(); assert.equal((await responderComprobacionAdministrativa(sinBearer,p.crear)).status,401);
  assert.equal(p.llamadas.length,0);
});
test('formatos desconocidos, roles inesperados y asignación inactiva se deniegan',()=>{
  for(const dentaia of [null,[],{},'superusuario',{...asignacion,version:2},{...asignacion,estado:'suspendido'},
    {...asignacion,roles:'superusuario'},{...asignacion,roles:[]},{...asignacion,roles:['superusuario','service_role']},
    {...asignacion,roles:['visitante']},{...asignacion,roles:[null]}]) assert.equal(leerAsignacionAdministrativa({dentaia}),null);
  for(const metadata of [null,[],undefined,'superusuario']) assert.equal(leerAsignacionAdministrativa(metadata),null);
});
test('superusuario válido procede únicamente de app_metadata obtenido del proveedor',async()=>{
  assert.deepEqual(ROLES_NEGOCIO,['visitante','paciente','odontologo','superusuario']);
  assert.deepEqual(leerAsignacionAdministrativa({dentaia:asignacion}),asignacion);
  const response=await responderComprobacionAdministrativa(new Request('https://dentaia.example.test',{headers:headers()}),proveedor().crear);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{autorizado:true});
});
test('identidad anónima, sin confirmar, eliminada o suspendida se deniega',async()=>{
  for(const extra of [{is_anonymous:true},{confirmed_at:undefined},{deleted_at:'2026-10-31T00:00:00Z'},
    {banned_until:'2999-01-01T00:00:00Z'},{banned_until:'fecha-invalida'},{aud:'service_role'},{id:''}]) {
    assert.deepEqual(await autorizarSolicitudAdministrativa(headers(),proveedor(usuario(extra)).crear),{autorizado:false,status:403});
  }
});
test('revocación de rol se consulta en la siguiente petición, aun con el mismo token',async()=>{
  let actual=usuario(); let llamadas=0;
  const crear=()=>({auth:{...proveedor().crear().auth,getUser:async()=>{llamadas++;return {data:{user:actual},error:null};}}});
  assert.equal((await autorizarSolicitudAdministrativa(headers(),crear)).autorizado,true);
  actual=usuario({app_metadata:{dentaia:{...asignacion,estado:'suspendido'}}});
  assert.deepEqual(await autorizarSolicitudAdministrativa(headers(),crear),{autorizado:false,status:403});
  actual=usuario({app_metadata:{}});
  assert.deepEqual(await autorizarSolicitudAdministrativa(headers(),crear),{autorizado:false,status:403});
  assert.equal(llamadas,3);
});
test('red, configuración, límite de peticiones o caída de Auth: 503 y ninguna concesión',async()=>{
  const factories=[()=>{throw Error('detalle privado');},()=>({auth:{getUser:async()=>{throw Error('detalle privado');}}}),
    proveedor(usuario(),{status:500,message:'detalle privado'}).crear,proveedor(usuario(),{status:429}).crear,
    proveedor(usuario(),{status:0,name:'AuthRetryableFetchError'}).crear,proveedor(usuario(),{}).crear];
  for(const crear of factories) {
    const res=await responderComprobacionAdministrativa(new Request('https://dentaia.example.test',{headers:headers()}),crear);
    assert.equal(res.status,503); assert.deepEqual(await res.json(),{error:'Verificación no disponible.'});
  }
});
test('todas las respuestas son privadas y mínimas; desafío Bearer solo para 401',async()=>{
  for(const [h,p,status] of [[new Headers(),proveedor(),401],[headers(),proveedor(usuario({app_metadata:{}})),403],
    [headers(),proveedor(),200]]) {
    const response=await responderComprobacionAdministrativa(new Request('https://dentaia.example.test',{headers:h}),p.crear);
    assert.equal(response.status,status);
    assert.match(response.headers.get('cache-control'),/private, no-store/);
    assert.equal(response.headers.get('cdn-cache-control'),'no-store');
    assert.equal(response.headers.get('vary'),'Authorization');
    assert.equal(response.headers.get('www-authenticate'),status===401?'Bearer':null);
    assert.doesNotMatch(await response.text(),/identidad-sintetica|token-sintetico|app_metadata|superusuario|full_name/);
  }
});
test('peticiones concurrentes no comparten identidad ni autorización',async()=>{
  const [admin,paciente]=await Promise.all([
    autorizarSolicitudAdministrativa(headers(),proveedor().crear),
    autorizarSolicitudAdministrativa(headers(),proveedor(usuario({app_metadata:{}})).crear),
  ]);
  assert.equal(admin.autorizado,true); assert.deepEqual(paciente,{autorizado:false,status:403});
});
