import test from 'node:test';
import assert from 'node:assert/strict';
import { crearProveedorAdministrativoSimulado, validarConsultaUsuarios, identificadorAdministrativoValido, ACTOR_ADMINISTRATIVO_DEMO } from './servicios.ts';
const actor=ACTOR_ADMINISTRATIVO_DEMO;
const destino='00000000-0000-4000-8000-000000000002';
const propuesta=(extra={})=>({operacion:'validar_cambio_rol',usuarioId:destino,rol:'odontologo',...extra});

test('listado paginado sintético, estable y sin información privada',async()=>{
  const p=crearProveedorAdministrativoSimulado();
  const primera=await p.listar({});assert.equal(primera.ok,true);
  assert.equal(primera.valor.origen,'sintetico');assert.equal(primera.valor.total,13);assert.equal(primera.valor.paginas,3);
  assert.equal(primera.valor.usuarios.length,5);
  const segunda=await p.listar({pagina:2});
  assert.equal(segunda.valor.usuarios[0].etiqueta,'Cuenta de prueba 06');
  const ultima=await p.listar({pagina:3});assert.equal(ultima.valor.usuarios.length,3);
  const fuera=await p.listar({pagina:999});assert.equal(fuera.valor.pagina,3);
  assert.doesNotMatch(JSON.stringify(primera),/email|phone|user_metadata|app_metadata|object_path|@/);
  assert.ok(primera.valor.usuarios.every(u=>u.origenRoles==='sintetico'));
});
test('búsqueda por alias/UUID y filtros combinados no usan consultas SQL',async()=>{
  const p=crearProveedorAdministrativoSimulado();
  assert.equal((await p.listar({q:'CUENTA DE PRUEBA 02'})).valor.total,1);
  assert.equal((await p.listar({q:destino})).valor.usuarios[0].id,destino);
  assert.equal((await p.listar({q:'no existe'})).valor.total,0);
  const filtrado=await p.listar({rol:'paciente',estado:'activo'});
  assert.ok(filtrado.valor.usuarios.every(u=>u.roles.includes('paciente')&&u.estado==='activo'));
  assert.ok((await p.listar({rol:'sin_asignacion'})).valor.usuarios.every(u=>u.roles.length===0));
});
test('consulta estricta rechaza tipos, roles, paginación y campos manipulables',()=>{
  for(const entrada of [null,[],{q:4},{q:'a'.repeat(81)},{rol:'service_role'},{rol:{toString:null}},{estado:'borrado'},{tamano:{valueOf:null,toString:null}},
    {pagina:0},{pagina:-1},{pagina:1.5},{pagina:'2'},{tamano:'5'},{tamano:500},{actorId:actor},{role:'superusuario'}]) {
    assert.equal(validarConsultaUsuarios(entrada).ok,false,JSON.stringify(entrada));
  }
});
test('UUID inválido se rechaza; IDs sintéticos y UUID en mayúsculas se aceptan',()=>{
  assert.equal(identificadorAdministrativoValido(actor),true);
  assert.equal(identificadorAdministrativoValido('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),true);
  for(const valor of ['',null,1,'../../auth/users','00000000-0000-0000-0000-000000000000','no-es-uuid']) assert.equal(identificadorAdministrativoValido(valor),false);
});
test('roles permitidos se validan sin modificar el listado ni persistir cambios',async()=>{
  const p=crearProveedorAdministrativoSimulado();
  const antes=await p.listar({q:destino});
  for(const rol of ['paciente','odontologo']){
    const r=await p.validarPropuesta(propuesta({rol}),actor);
    assert.equal(r.ok,true);assert.equal(r.valor.aplicado,false);assert.equal(r.valor.modo,'solo_validacion');
    assert.match(r.valor.mensaje,/No se aplicó/);
  }
  assert.deepEqual(await p.listar({q:destino}),antes);
  assert.deepEqual(Object.keys(p).sort(),['listar','validarPropuesta']);
});
test('roles técnicos, visitante y payloads con campos de autoridad son rechazados',async()=>{
  const p=crearProveedorAdministrativoSimulado();
  for(const rol of ['service_role','authenticated','visitante','admin',null,['superusuario']]) assert.equal((await p.validarPropuesta(propuesta({rol}),actor)).ok,false);
  for(const entrada of [null,[],propuesta({operacion:'asignar_rol'}),propuesta({actorId:actor}),propuesta({app_metadata:{}}),propuesta({usuarioId:'invalido'})]) {
    assert.equal((await p.validarPropuesta(entrada,actor)).ok,false);
  }
  assert.equal((await p.validarPropuesta(propuesta(),'actor-no-verificado')).status,403);
});
test('autoasignación, promoción y cambios sobre superusuario requieren denegación',async()=>{
  const p=crearProveedorAdministrativoSimulado();
  assert.equal((await p.validarPropuesta(propuesta({usuarioId:actor}),actor)).codigo,'CAMBIO_PROPIO_PROHIBIDO');
  assert.equal((await p.validarPropuesta(propuesta({rol:'superusuario'}),actor)).codigo,'APROBACION_REQUERIDA');
  assert.equal((await p.validarPropuesta(propuesta({usuarioId:actor}),destino)).codigo,'APROBACION_REQUERIDA');
});
test('escenarios vacío/error son explícitos y la cuenta inexistente no se crea',async()=>{
  const vacio=crearProveedorAdministrativoSimulado({escenario:'vacio'});
  assert.equal((await vacio.listar({})).valor.total,0);
  assert.equal((await vacio.validarPropuesta(propuesta(),actor)).status,404);
  const error=crearProveedorAdministrativoSimulado({escenario:'error'});
  assert.equal((await error.listar({})).status,503);
  assert.equal((await error.validarPropuesta(propuesta(),actor)).status,503);
});
test('los resultados son copias; un consumidor no altera el proveedor ni sus roles',async()=>{
  const p=crearProveedorAdministrativoSimulado();
  const r=await p.listar({});r.valor.usuarios[0].roles.length=0;r.valor.usuarios[0].etiqueta='alterado';
  const siguiente=await p.listar({});
  assert.equal(siguiente.valor.usuarios[0].etiqueta,'Cuenta de prueba 01');
  assert.deepEqual(siguiente.valor.usuarios[0].roles,['superusuario']);
});
