import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {crearApiAdministrativa} from './api.ts';
import {crearProveedorAdministrativoSimulado, ACTOR_ADMINISTRATIVO_DEMO} from './servicios.ts';
import {ejecutarOperacionAdministrativa} from '../autorizacion/autorizacion.ts';

// Compilar el adaptador real con TypeScript existente permite probar su import sin extensión
// en Node, sin modificar tsconfig ni requerir loaders adicionales. Typecheck valida tipos aparte.
const codigo=await readFile(new URL('./cliente.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(codigo,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const modulo=outputText.replace('from "./servicios"',`from "${new URL('./servicios.ts',import.meta.url).href}"`);
const {crearClienteAdministrativo,esDenegacionDeAcceso,fallo}=await import('data:text/javascript;base64,'+Buffer.from(modulo).toString('base64'));
const destino='00000000-0000-4000-8000-000000000002';
const propuesta={operacion:'validar_cambio_rol',usuarioId:destino,rol:'odontologo'};
function identidad({rol='superusuario',aal='aal2',estado='activo',error=null,id=ACTOR_ADMINISTRATIVO_DEMO}={}) {
 return ()=>({auth:{getUser:async()=>({data:{user:{id,aud:'authenticated',confirmed_at:'2026-11-01T00:00:00Z',
  app_metadata:{dentaia:{version:1,estado,roles:[rol]}},factors:[{status:'verified'}]}},error}),
  getClaims:async()=>({data:{claims:{sub:id,role:'authenticated',aal,session_id:'sesion-fixture',exp:Date.now()/1000+300}},error:null})}});
}
function integrar(opciones={},p=crearProveedorAdministrativoSimulado()) {
 const api=crearApiAdministrativa((req,accion,fn)=>ejecutarOperacionAdministrativa(req,accion,identidad(opciones),fn),p);
 return crearClienteAdministrativo(async()=>'token-ficticio-de-prueba',async(url,init)=>{
  const req=new Request('https://dentaia.example.test'+url,init);
  return req.method==='POST'?api.validarRol(req):api.listar(req);
 });
}

test('transporte lee token renovado, usa rutas fijas y solo cookies same-origin sin caché',async()=>{
 const llamadas=[];let n=0;
 const c=crearClienteAdministrativo(async()=>`fixture-${++n}`,async(url,init)=>{llamadas.push({url,init});return Response.json({autorizado:true});});
 assert.equal((await c.comprobarAcceso()).ok,true);await c.comprobarAcceso();
 assert.deepEqual(llamadas.map(x=>x.init.headers.Authorization),['Bearer fixture-1','Bearer fixture-2']);
 for(const x of llamadas){assert.equal(x.url,'/api/administracion/acceso');assert.equal(x.init.credentials,'same-origin');assert.equal(x.init.cache,'no-store');assert.equal(x.init.redirect,'error');assert(!x.url.includes('fixture'));}
});

test('cliente → API → guard AAL2 → proveedor; lista y valida sin modificar roles',async()=>{
 const c=integrar();const inicial=await c.listar({pagina:1,tamano:5});assert(inicial.ok);assert.equal(inicial.valor.origen,'sintetico');assert.equal(inicial.valor.usuarios.length,5);
 const r=await c.validarPropuesta(propuesta);assert(r.ok);assert.equal(r.valor.aplicado,false);assert.equal(r.valor.modo,'solo_validacion');
 assert.deepEqual((await c.listar({})).valor.usuarios,inicial.valor.usuarios);
});

test('identidad del operador solo procede del servidor y rechaza propuesta propia',async()=>{
 const r=await integrar({id:destino}).validarPropuesta(propuesta);
 assert.equal(r.status,403);assert.equal(r.codigo,'CAMBIO_PROPIO_PROHIBIDO');assert.equal(esDenegacionDeAcceso(r),false);
 let peticiones=0;const c=crearClienteAdministrativo(async()=>'fixture',async()=>{peticiones++;});
 assert.equal((await c.validarPropuesta({...propuesta,actorId:ACTOR_ADMINISTRATIVO_DEMO})).status,400);assert.equal(peticiones,0);
});

test('paciente, odontólogo, AAL1, suspensión y token inválido no alcanzan el servicio',async()=>{
 for(const [op,status] of [[{rol:'paciente'},403],[{rol:'odontologo'},403],[{aal:'aal1'},403],[{estado:'suspendido'},403],[{error:{status:401}},401]]){
  let llamadas=0;const c=integrar(op,{listar:async()=>{llamadas++;},validarPropuesta:async()=>{llamadas++;}});
  for(const r of [await c.listar({}),await c.validarPropuesta(propuesta)]){assert.equal(r.status,status);assert(esDenegacionDeAcceso(r));}
  assert.equal(llamadas,0);
 }
});

test('AAL1 muestra el paso MFA requerido y el servidor mantiene la denegación',async()=>{
 const r=await integrar({aal:'aal1'}).comprobarAcceso();
 assert.equal(r.ok,false);assert.equal(r.status,403);assert.equal(r.codigo,'MFA_AAL2_PENDIENTE');
 assert.match(r.mensaje,/Completa la verificación MFA/);
 assert.match(fallo(403,'MFA_AAL2_PENDIENTE').mensaje,/Completa la verificación MFA/);
});

test('ausencia o fallo de sesión no envía una petición ni expone detalles',async()=>{
 let peticiones=0;const fetchFixture=async()=>{peticiones++;};
 assert.equal((await crearClienteAdministrativo(async()=>null,fetchFixture).listar({})).status,401);
 const r=await crearClienteAdministrativo(async()=>{throw Error('detalle-privado');},fetchFixture).listar({});
 assert.equal(r.status,503);assert.doesNotMatch(r.mensaje,/detalle-privado/);assert.equal(peticiones,0);
});

test('estados HTTP y fallos de red producen errores seguros, sin fallback a fixtures',async()=>{
 for(const status of [400,401,403,404,413,429,500,503]){
  const c=crearClienteAdministrativo(async()=>'fixture',async()=>Response.json({error:'detalle-privado',codigo:'privado'},{status}));
  const r=await c.listar({});assert.equal(r.status,status);assert.equal(r.ok,false);assert.doesNotMatch(JSON.stringify(r),/detalle-privado/);
 }
 const c=crearClienteAdministrativo(async()=>'fixture',async()=>{throw Error('token o detalle-privado');});assert.equal((await c.listar({})).status,503);
});

test('respuestas 200 malformadas, HTML, origen incoherente y paginación imposible se rechazan',async()=>{
 const base=(await crearProveedorAdministrativoSimulado().listar({})).valor;
 for(const respuesta of [()=>new Response('<html>login</html>'),()=>Response.json({}),
  ()=>Response.json({...base,total:-1}),()=>Response.json({...base,usuarios:[]}),
  ()=>Response.json({...base,usuarios:base.usuarios.map(u=>({...u,origenRoles:'persistido'}))})]){
  const r=await crearClienteAdministrativo(async()=>'fixture',async()=>respuesta()).listar({});assert.equal(r.ok,false);assert.equal(r.status,502);
 }
});

test('proyección cliente excluye campos extra y conserva origen en listas vacías',async()=>{
 const base=(await crearProveedorAdministrativoSimulado().listar({})).valor;
 const c=crearClienteAdministrativo(async()=>'fixture',async()=>Response.json({...base,secreto:'privado',usuarios:base.usuarios.map(u=>({...u,email:'privado',app_metadata:{privado:true}}))}));
 const r=await c.listar({});assert(r.ok);assert.doesNotMatch(JSON.stringify(r),/privado|email|app_metadata/);
 const vacio=await integrar({},crearProveedorAdministrativoSimulado({escenario:'vacio'})).listar({});assert(vacio.ok);assert.equal(vacio.valor.total,0);assert.equal(vacio.valor.origen,'sintetico');
});

test('nunca da éxito a una escritura aplicada ni a respuestas de otro objetivo o rol',async()=>{
 for(const cambio of [{aplicado:true},{usuarioId:ACTOR_ADMINISTRATIVO_DEMO},{rol:'superusuario'},{modo:'guardado'}]){
  const c=crearClienteAdministrativo(async()=>'fixture',async()=>Response.json({modo:'solo_validacion',aplicado:false,usuarioId:destino,rol:'odontologo',...cambio}));
  assert.equal((await c.validarPropuesta(propuesta)).status,502);
 }
});

test('filtros y JSON de propuesta se serializan sin autoridad aportada por el cliente',async()=>{
 let solicitud;
 const c=crearClienteAdministrativo(async()=>'fixture',async(url,init)=>{solicitud={url,init};return Response.json({modo:'solo_validacion',aplicado:false,usuarioId:destino,rol:'odontologo'});});
 assert((await c.validarPropuesta(propuesta)).ok);assert.deepEqual(JSON.parse(solicitud.init.body),propuesta);assert.equal(solicitud.init.method,'POST');
 const r=await integrar().listar({q:'Cuenta de prueba 02',estado:'activo',rol:'paciente',pagina:1,tamano:5});assert(r.ok);assert.equal(r.valor.total,1);
 assert.equal((await c.listar({actorId:'otro'})).status,400);assert.equal((await c.validarPropuesta({...propuesta,rol:'service_role'})).status,400);
});
