import test from 'node:test';
import assert from 'node:assert/strict';
import { autorizarSolicitudAdministrativa, ejecutarOperacionAdministrativa } from './autorizacion.ts';

const asignacion={version:1,estado:'activo',roles:['superusuario']};
const identidad=()=>({id:'identidad-sintetica',aud:'authenticated',confirmed_at:'2026-11-01T00:00:00Z',
  factors:[{id:'factor-sintetico',status:'verified',factor_type:'totp'}],app_metadata:{dentaia:asignacion},user_metadata:{}});
const claimsValidos=()=>({sub:'identidad-sintetica',role:'authenticated',aal:'aal2',session_id:'sesion-sintetica',exp:Date.now()/1000+3600});
const solicitud=()=>new Request('https://dentaia.example.test/api/administracion/acceso',{headers:{Authorization:'Bearer token-sintetico'}});
function proveedor({user=identidad(),claims=claimsValidos(),errorUsuario=null,errorClaims=null}={}) {
  const llamadas=[];
  return {llamadas,crear:()=>({auth:{
    getUser:async token=>{llamadas.push(['identidad',token]);return {data:{user},error:errorUsuario};},
    getClaims:async token=>{llamadas.push(['firma',token]);return {data:claims?{claims}:null,error:errorClaims};},
  }})};
}

test('MFA: aal1, ausencia o valor manipulado se deniegan aunque el rol sea válido',async()=>{
  for(const aal of ['aal1',undefined,null,'aal3',true]) {
    const p=proveedor({claims:{...claimsValidos(),aal}});
    assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,p.crear),{autorizado:false,status:403});
  }
});
test('MFA: un factor enrolado no equivale a una sesión aal2',async()=>{
  const p=proveedor({claims:{...claimsValidos(),aal:'aal1'}});
  assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,p.crear),{autorizado:false,status:403});
});
test('MFA: se requiere un factor verificado actual; retirarlo invalida el acceso',async()=>{
  for(const factors of [undefined,[],[{status:'unverified',factor_type:'totp'}]]) {
    const p=proveedor({user:{...identidad(),factors}});
    assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,p.crear),{autorizado:false,status:403});
  }
});
test('MFA: identidad y claims verificados deben corresponder al mismo usuario y token',async()=>{
  const p=proveedor();
  assert.equal((await autorizarSolicitudAdministrativa(solicitud().headers,p.crear)).autorizado,true);
  assert.deepEqual(p.llamadas,[['identidad','token-sintetico'],['firma','token-sintetico']]);
  for(const changes of [{sub:'otro-usuario'},{role:'service_role'},{session_id:null},{session_id:''},
    {exp:Date.now()/1000-1},{exp:undefined},{exp:NaN},{exp:'2999999999'}]) {
    const caso=proveedor({claims:{...claimsValidos(),...changes}});
    assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,caso.crear),{autorizado:false,status:401});
  }
});
test('MFA: cabeceras y metadatos editables no sustituyen la prueba firmada',async()=>{
  const req=solicitud();req.headers.set('x-aal','aal2');req.headers.set('x-mfa','verified');
  const p=proveedor({user:{...identidad(),user_metadata:{aal:'aal2',mfa:true}},claims:{...claimsValidos(),aal:'aal1'}});
  assert.deepEqual(await autorizarSolicitudAdministrativa(req.headers,p.crear),{autorizado:false,status:403});
});
test('MFA: fallo de firma/caducidad devuelve 401; error de proveedor devuelve 503',async()=>{
  for(const [error,status] of [[{status:400,name:'AuthInvalidJwtError'},401],[{status:401},401],
    [{status:0},503],[{status:429},503],[{status:500},503]]) {
    const p=proveedor({errorClaims:error});
    assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,p.crear),{autorizado:false,status});
  }
  const p=proveedor({claims:null});
  assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,p.crear),{autorizado:false,status:401});
  const c=proveedor().crear();c.auth.getClaims=async()=>{throw Error('detalle sensible de proveedor');};
  assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,()=>c),{autorizado:false,status:503});
});
test('un rol revocado prevalece sobre claims firmados antiguos y evita incluso consultar MFA',async()=>{
  const p=proveedor({user:{...identidad(),app_metadata:{}},claims:{...claimsValidos(),app_metadata:{dentaia:asignacion}}});
  assert.deepEqual(await autorizarSolicitudAdministrativa(solicitud().headers,p.crear),{autorizado:false,status:403});
  assert.equal(p.llamadas.length,1);
});
test('un servicio privado nunca se invoca para visitantes, pacientes, odontólogos o sesiones rechazadas',async()=>{
  const casos=[{request:new Request('https://dentaia.example.test'),p:proveedor(),status:401},
    {p:proveedor({errorUsuario:{status:401}}),status:401},
    {p:proveedor({user:{...identidad(),app_metadata:{}}}),status:403},
    ...['paciente','odontologo'].map(rol=>({p:proveedor({user:{...identidad(),app_metadata:{dentaia:{...asignacion,roles:[rol]}}}}),status:403})),
    {p:proveedor({user:{...identidad(),app_metadata:{dentaia:{...asignacion,estado:'suspendido'}}}}),status:403},
    {p:proveedor({claims:{...claimsValidos(),aal:'aal1'}}),status:403},
    {p:proveedor({errorUsuario:{status:500}}),status:503}];
  for(const caso of casos){
    let invocaciones=0;
    const response=await ejecutarOperacionAdministrativa(caso.request??solicitud(),'comprobar_acceso',caso.p.crear,()=>{
      invocaciones++;return Response.json({dato:'privado-sintetico'});
    });
    assert.equal(response.status,caso.status);assert.equal(invocaciones,0);
    assert.doesNotMatch(await response.text(),/privado-sintetico|identidad-sintetica/);
    assert.match(response.headers.get('cache-control'),/no-store/);
  }
});
test('el contrato ejecuta una vez tras validar rol y MFA; impone no-store a la respuesta del servicio',async()=>{
  const p=proveedor();let invocaciones=0;
  const response=await ejecutarOperacionAdministrativa(solicitud(),'comprobar_acceso',p.crear,contexto=>{
    assert.equal(p.llamadas.length,2);assert.equal(Object.isFrozen(contexto),true);
    assert.deepEqual(contexto,{usuarioId:'identidad-sintetica',accion:'comprobar_acceso'});
    invocaciones++;return Response.json({prueba:'sintetica'},{headers:{'Cache-Control':'public, max-age=3600','Vary':'Accept-Language'}});
  });
  assert.equal(invocaciones,1);assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  assert.equal(response.headers.get('cdn-cache-control'),'no-store');
  assert.match(response.headers.get('vary'),/Accept-Language/);assert.match(response.headers.get('vary'),/Authorization/);
});
test('operaciones desconocidas, gestión de cuentas y acciones clínicas permanecen denegadas',async()=>{
  for(const accion of ['usuarios.listar','roles.asignar','fotografias.leer','clinica.leer',null,undefined]){
    let invocaciones=0;
    const response=await ejecutarOperacionAdministrativa(solicitud(),accion,proveedor().crear,()=>{invocaciones++;return Response.json({});});
    assert.equal(response.status,403);assert.equal(invocaciones,0);
  }
});
test('revocación o suspensión entre solicitudes impide volver a ejecutar el servicio',async()=>{
  for(const nuevo of [{},{dentaia:{...asignacion,roles:['paciente']}},{dentaia:{...asignacion,estado:'suspendido'}}]){
    let user=identidad();let invocaciones=0;
    const c=proveedor().crear();c.auth.getUser=async()=>({data:{user},error:null});
    const operacion=()=>{invocaciones++;return Response.json({});};
    assert.equal((await ejecutarOperacionAdministrativa(solicitud(),'comprobar_acceso',()=>c,operacion)).status,200);
    user={...user,app_metadata:nuevo};
    assert.equal((await ejecutarOperacionAdministrativa(solicitud(),'comprobar_acceso',()=>c,operacion)).status,403);
    assert.equal(invocaciones,1);
  }
});
test('revocar el rol y rechazar una sesión son fallos distintos',async()=>{
  const rol=proveedor({user:{...identidad(),app_metadata:{}}});
  const sesion=proveedor({errorUsuario:{status:401,code:'session_not_found'}});
  assert.equal((await autorizarSolicitudAdministrativa(solicitud().headers,rol.crear)).status,403);
  assert.equal((await autorizarSolicitudAdministrativa(solicitud().headers,sesion.crear)).status,401);
});
test('errores del servicio se convierten en respuesta mínima privada',async()=>{
  const response=await ejecutarOperacionAdministrativa(solicitud(),'comprobar_acceso',proveedor().crear,()=>{throw Error('dato-privado-sintetico');});
  assert.equal(response.status,500);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.deepEqual(await response.json(),{error:'Verificación no disponible.'});
});

test('no se prepara una respuesta privada mientras la identidad siga pendiente de verificación',async()=>{
  let resolver;let invocaciones=0;
  const c=proveedor().crear();
  c.auth.getUser=()=>new Promise(resolve=>{resolver=resolve;});
  const pendiente=ejecutarOperacionAdministrativa(solicitud(),'comprobar_acceso',()=>c,()=>{
    invocaciones++;return Response.json({prueba:'sintetica'});
  });
  await Promise.resolve();assert.equal(invocaciones,0);
  resolver({data:{user:identidad()},error:null});
  assert.equal((await pendiente).status,200);assert.equal(invocaciones,1);
});
