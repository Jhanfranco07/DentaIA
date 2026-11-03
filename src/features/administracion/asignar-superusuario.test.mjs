import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararAsignacion, crearAdminAsignacion, UUID_OBJETIVO, URL_PROYECTO, FRASE_CONFIRMACION } from '../../../scripts/asignar-superusuario.mjs';

const asignacion={version:1,estado:'activo',roles:['superusuario']};
const cuenta=()=>({id:UUID_OBJETIVO,aud:'authenticated',is_anonymous:false,confirmed_at:'2026-11-01T00:00:00Z',
  created_at:'2026-11-01T00:00:00Z',email:'privado-fixture-no-publicar',app_metadata:{provider:'email',providers:['email']}});
function preparar(user=cuenta()) {
  let actual=structuredClone(user);const llamadas=[];
  return {llamadas,alterar:fn=>fn(actual),admin:{
    getUserById:async id=>{assert.equal(id,UUID_OBJETIVO);llamadas.push('GET');return {data:{user:structuredClone(actual)},error:null};},
    updateUserById:async(id,body)=>{assert.equal(id,UUID_OBJETIVO);assert.deepEqual(Object.keys(body),['app_metadata']);llamadas.push('PUT');actual.app_metadata=structuredClone(body.app_metadata);return {data:{user:structuredClone(actual)},error:null};},
  }};
}

test('provisión: preparar un resumen no escribe ni imprime datos personales/metadatos',async()=>{
  const p=preparar();const op=await prepararAsignacion(p.admin);
  assert.equal(op.resumen.cuentaEsperadaVerificada,true);assert.equal(op.resumen.cambioNecesario,true);
  assert.deepEqual(p.llamadas,['GET']);
  assert.doesNotMatch(JSON.stringify(op.resumen),/privado-fixture|access_token|email/);
  assert.ok(!JSON.stringify(op.resumen).includes(UUID_OBJETIVO));
});

test('provisión: confirmación ausente, genérica o booleana no autoriza',async()=>{
  for(const respuesta of [undefined,'si','yes',true,FRASE_CONFIRMACION+' ']){
    const p=preparar();const op=await prepararAsignacion(p.admin);
    const r=await op.aplicar(()=>respuesta);assert.equal(r.resultado,'CANCELADA_SIN_ESCRITURA');assert.deepEqual(p.llamadas,['GET']);
  }
});

test('provisión: objetivo privado ligado a la ejecución, sin UUID real embebido ni fallback CLI',async()=>{
  const id='00000000-0000-4000-8000-000000000002';
  const user={...cuenta(),id};const llamadas=[];
  const admin={getUserById:async recibido=>{assert.equal(recibido,id);llamadas.push('GET');return {data:{user},error:null};}};
  const op=await prepararAsignacion(admin,id);
  assert.equal(op.resumen.cuentaEsperadaVerificada,true);assert.deepEqual(llamadas,['GET']);
  await assert.rejects(()=>prepararAsignacion(admin,'no-valido'),e=>e.codigo==='CONFIGURACION');
  const sdk=crearAdminAsignacion({NEXT_PUBLIC_SUPABASE_URL:URL_PROYECTO,DENTAIA_SUPABASE_ADMIN_READ_SECRET:'privada-fixture-no-real'},async()=>Response.json(user),id);
  assert.throws(()=>sdk.getUserById(UUID_OBJETIVO));
  assert.equal((await sdk.getUserById(id)).data.user.id,id);
});

test('provisión: concesión confirmada preserva metadata anidada y exige nueva lectura',async()=>{
  const user=cuenta();user.app_metadata.otro={version:7,opciones:['conservar']};
  const p=preparar(user);const op=await prepararAsignacion(p.admin);
  const r=await op.aplicar(()=>FRASE_CONFIRMACION);
  assert.equal(r.resultado,'ASIGNACION_VERIFICADA');assert.equal(r.metadatosPreservados,true);
  assert.deepEqual(p.llamadas,['GET','GET','PUT','GET']);
  const leido=await p.admin.getUserById(UUID_OBJETIVO);
  assert.deepEqual(leido.data.user.app_metadata,{...user.app_metadata,dentaia:asignacion});
});

test('provisión: otra identidad, proveedor inesperado, cuenta no confirmada o suspendida bloquean',async()=>{
  for(const cambio of [{id:'otro'},{aud:'anon'},{is_anonymous:true},{confirmed_at:null},{banned_until:'2099-01-01T00:00:00Z'},
    {app_metadata:{provider:'otro',providers:['otro']}},{app_metadata:{provider:'email',providers:['email','otro']}}]){
    const p=preparar({...cuenta(),...cambio});await assert.rejects(()=>prepararAsignacion(p.admin));assert.deepEqual(p.llamadas,['GET']);
  }
});

test('provisión: nunca sobrescribe roles o namespaces existentes distintos',async()=>{
  for(const dentaia of [null,{version:1,estado:'activo',roles:['paciente']},{...asignacion,otros:'conservar'}]){
    const user=cuenta();user.app_metadata.dentaia=dentaia;
    const p=preparar(user);await assert.rejects(()=>prepararAsignacion(p.admin),e=>e.codigo==='METADATA_NO_ESPERADA');
    assert.deepEqual(p.llamadas,['GET']);
  }
});

test('provisión: estado ya asignado es idempotente sin PUT',async()=>{
  const user=cuenta();user.app_metadata.dentaia=asignacion;
  const p=preparar(user);const op=await prepararAsignacion(p.admin);
  assert.equal(op.resumen.cambioNecesario,false);
  assert.equal((await op.aplicar(()=>assert.fail('no se necesita escribir'))).resultado,'YA_ASIGNADO_SIN_ESCRITURA');
  assert.deepEqual(p.llamadas,['GET']);
});

test('provisión: cambio durante confirmación cancela sin escribir',async()=>{
  for(const modificar of [u=>{u.app_metadata.nuevo='externo';},u=>{u.email='otro-fixture';}]){
    const p=preparar();const op=await prepararAsignacion(p.admin);
    await assert.rejects(()=>op.aplicar(()=>{p.alterar(modificar);return FRASE_CONFIRMACION;}),e=>e.codigo==='CAMBIO_CONCURRENTE');
    assert.deepEqual(p.llamadas,['GET','GET']);
  }
});

test('provisión: un update aparentemente correcto no basta sin lectura posterior coincidente',async()=>{
  const p=preparar();p.admin.updateUserById=async()=>{p.llamadas.push('PUT');return {error:null};};
  const op=await prepararAsignacion(p.admin);
  await assert.rejects(()=>op.aplicar(()=>FRASE_CONFIRMACION),e=>e.codigo==='VERIFICACION_DISTINTA');
  assert.deepEqual(p.llamadas,['GET','GET','PUT','GET']);
});

test('provisión: respuesta perdida se comprueba con GET, sin reintento ni rollback',async()=>{
  const p=preparar();const actualizar=p.admin.updateUserById;
  p.admin.updateUserById=async(...args)=>{await actualizar(...args);throw Error('detalle-privado');};
  const op=await prepararAsignacion(p.admin);const r=await op.aplicar(()=>FRASE_CONFIRMACION);
  assert.equal(r.resultado,'ESTADO_VERIFICADO_RESPUESTA_DE_ESCRITURA_INCIERTA');
  assert.deepEqual(p.llamadas,['GET','GET','PUT','GET']);
  await assert.rejects(()=>op.aplicar(()=>FRASE_CONFIRMACION),e=>e.codigo==='CONFIRMACION_REQUERIDA');
});

test('provisión: fallo de lectura posterior produce estado incierto, sin filtrar errores',async()=>{
  const p=preparar();const actualizar=p.admin.updateUserById;
  p.admin.updateUserById=async(...args)=>{const r=await actualizar(...args);p.admin.getUserById=async()=>{throw Error('secreto-no-publicar');};return r;};
  const op=await prepararAsignacion(p.admin);
  await assert.rejects(()=>op.aplicar(()=>FRASE_CONFIRMACION),e=>{assert.equal(e.codigo,'VERIFICACION_NO_DISPONIBLE');assert.doesNotMatch(e.message,/secreto-no-publicar/);return true;});
  assert.equal(p.llamadas.filter(v=>v==='PUT').length,1);
});

test('provisión: transporte SDK real restringe proyecto, UUID, payload y número de escrituras con fetch ficticio',async()=>{
  const env={NEXT_PUBLIC_SUPABASE_URL:URL_PROYECTO,DENTAIA_SUPABASE_ADMIN_READ_SECRET:'privada-fixture-no-real'};
  let metadata=cuenta().app_metadata;const llamadas=[];
  const admin=crearAdminAsignacion(env,async(input,init)=>{
    const url=new URL(String(input));assert.equal(url.origin,URL_PROYECTO);assert.equal(url.pathname,'/auth/v1/admin/users/'+UUID_OBJETIVO);
    assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.ok(init.signal instanceof AbortSignal);
    llamadas.push(init.method);
    if(init.method==='PUT')metadata=JSON.parse(init.body).app_metadata;
    return Response.json({...cuenta(),app_metadata:metadata});
  });
  const op=await prepararAsignacion(admin);await op.aplicar(()=>FRASE_CONFIRMACION);
  assert.deepEqual(llamadas,['GET','GET','PUT','GET']);
  assert.throws(()=>admin.getUserById('otro'));
  // El SDK convierte fallos del transporte en resultados con error, sin emitir el PUT.
  assert.ok((await admin.updateUserById(UUID_OBJETIVO,{password:'no-admitir'})).error);
  assert.ok((await admin.updateUserById(UUID_OBJETIVO,{app_metadata:{...metadata}})).error);
  assert.equal(llamadas.filter(v=>v==='PUT').length,1);
  assert.throws(()=>crearAdminAsignacion({...env,NEXT_PUBLIC_SUPABASE_URL:'https://otro.example.test'}));
});
