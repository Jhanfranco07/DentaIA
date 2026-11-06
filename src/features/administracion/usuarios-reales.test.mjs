import test from 'node:test';
import assert from 'node:assert/strict';
import { crearProveedorUsuariosReales, validarConsultaReal } from './usuarios-reales.ts';
import { crearConsultaUsuariosReales } from './api-usuarios-reales.ts';
import { ejecutarOperacionAdministrativa } from '../autorizacion/autorizacion.ts';

// Dobles explícitos: ninguna prueba de este archivo consulta Supabase.
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ahora = Date.parse('2026-11-02T12:00:00Z');
const cuenta = (n, extra = {}) => ({ id: id(n), aud: 'authenticated', is_anonymous: false,
  confirmed_at: '2026-11-01T00:00:00Z', app_metadata: { dentaia: { version: 1, estado: 'activo', roles: ['paciente'] } }, ...extra });
function preparar(cuentas = [cuenta(1)], perfiles = [{id: id(1), full_name: 'Nombre ficticio'}]) {
  const llamadas = [];
  const proveedor = crearProveedorUsuariosReales(() => ({
    listarCuentas: async (pagina, tamano) => {
      llamadas.push(['auth', pagina, tamano]);
      return { usuarios: cuentas.slice((pagina - 1) * tamano, pagina * tamano) };
    },
    consultarPerfiles: async ids => {
      llamadas.push(['profiles', [...ids]]);
      return perfiles.filter(p => ids.includes(p.id));
    },
  }), () => ahora);
  return { proveedor, llamadas };
}
async function listar(cuentas, perfiles, consulta = {}) {
  const r = await preparar(cuentas, perfiles).proveedor.listar(consulta);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.valor;
}

test('contrato real: perfiles propios del Auth ID, origen y proyección mínima', async () => {
  const r = await listar([cuenta(1, {email:'no-publicar', user_metadata:{roles:['superusuario']}, factors:['no-publicar']})],
    [{id:id(1),full_name:'Nombre ficticio',historial:'no-publicar'}]);
  assert.equal(r.origen, 'supabase');
  assert.equal(r.consistencia, 'lectura_no_transaccional');
  assert.deepEqual(r.usuarios, [{id:id(1),perfil:{estado:'presente',nombre:'Nombre ficticio'},
    cuenta:'habilitada',asignacion:{estado:'activa',roles:['paciente']}}]);
  assert.doesNotMatch(JSON.stringify(r), /email|factors|user_metadata|historial|no-publicar/);
});

test('perfil ausente no se crea ni se deduce desde user_metadata o correo', async () => {
  const r = await listar([cuenta(1, {email:'no-publicar',user_metadata:{full_name:'no-publicar'}})], []);
  assert.deepEqual(r.usuarios[0].perfil, {estado:'ausente',nombre:null});
});

test('asignación ausente, inválida y suspendida son estados distintos; no asigna paciente por defecto', async () => {
  const datos = [cuenta(1,{app_metadata:{}}),cuenta(2,{app_metadata:{dentaia:null}}),
    cuenta(3,{app_metadata:{dentaia:{version:1,estado:'suspendido',roles:['paciente','odontologo']}}}),
    cuenta(4,{app_metadata:{dentaia:{version:2,estado:'activo',roles:['superusuario']}}}),
    cuenta(5,{app_metadata:{dentaia:{version:1,estado:'activo',roles:['paciente','paciente']}}}),
    cuenta(6,{app_metadata:{dentaia:{version:1,estado:'activo',roles:['service_role']}}}),
    cuenta(7,{app_metadata:{dentaia:{version:1,estado:['activo'],roles:['superusuario']}}})];
  const r = await listar(datos, [], {tamano:10});
  assert.deepEqual(r.usuarios.map(u => u.asignacion.estado), ['ausente','invalida','suspendida','invalida','invalida','invalida','invalida']);
  assert.deepEqual(r.usuarios[0].asignacion.roles, []);
  assert.equal((await listar(datos,[],{rol:'sin_asignacion'})).total, 1);
  assert.equal((await listar(datos,[],{rol:'asignacion_invalida'})).total, 5);
});

test('estado de Auth es independiente de la asignación del negocio', async () => {
  const r = await listar([cuenta(1),cuenta(2,{banned_until:'2099-01-01T00:00:00Z'}),cuenta(3,{confirmed_at:null}),
    cuenta(4,{is_anonymous:true}),cuenta(5,{deleted_at:'2026-11-01T00:00:00Z'}),cuenta(6,{banned_until:'inválido'}),
    cuenta(7,{banned_until:'2020-01-01T00:00:00Z'}),cuenta(8,{is_anonymous:undefined})],[],{tamano:10});
  assert.deepEqual(r.usuarios.map(u=>u.cuenta),['habilitada','suspendida','sin_confirmar','anonima','eliminada','inconsistente','habilitada','inconsistente']);
  assert.equal((await listar([cuenta(1),cuenta(2,{confirmed_at:null})],[],{estado:'sin_confirmar'})).total,1);
});

test('fechas falsy malformadas nunca se clasifican como cuenta habilitada', async () => {
  for(const valor of [false,0,NaN]) {
    for(const campo of ['deleted_at','banned_until','confirmed_at']) {
      const r=await listar([cuenta(1,{[campo]:valor})],[]);
      assert.equal(r.usuarios[0].cuenta,'inconsistente',campo);
    }
  }
  const r=await listar([cuenta(1,{deleted_at:null,banned_until:'',confirmed_at:null})],[]);
  assert.equal(r.usuarios[0].cuenta,'sin_confirmar');
});

test('búsqueda y filtros globales incluyen cuentas posteriores a la primera página de Auth', async () => {
  const cuentas = Array.from({length:102},(_,i)=>cuenta(i+1));
  cuentas[101] = cuenta(102,{app_metadata:{dentaia:{version:1,estado:'activo',roles:['odontologo']}}});
  const {proveedor,llamadas} = preparar(cuentas,[{id:id(102),full_name:'Odontóloga ficticia'}]);
  const r = await proveedor.listar({q:'odontologa',rol:'odontologo',estado:'habilitada'});
  assert.equal(r.ok,true);assert.equal(r.valor.total,1);assert.equal(r.valor.usuarios[0].id,id(102));
  assert.deepEqual(llamadas.slice(0,2),[['auth',1,100],['auth',2,100]]);
  assert.equal(llamadas.filter(l=>l[0]==='profiles').length,2);
});

test('paginación ordenada por UUID, página fuera de rango y vacío', async () => {
  const r = await listar(Array.from({length:12},(_,i)=>cuenta(12-i)),[],{pagina:9});
  assert.equal(r.total,12);assert.equal(r.pagina,3);assert.equal(r.paginas,3);
  assert.deepEqual(r.usuarios.map(u=>u.id),[id(11),id(12)]);
  const vacio = preparar([],[]);
  assert.equal((await vacio.proveedor.listar({})).valor.total,0);
  assert.equal(vacio.llamadas.filter(l=>l[0]==='profiles').length,0);
});

test('consulta inválida no construye cliente privilegiado', async () => {
  let creados=0;
  const p=crearProveedorUsuariosReales(()=>{creados++;throw Error('no ejecutar');});
  for(const entrada of [null,[],{rol:'service_role'},{pagina:'1'},{pagina:0},{tamano:100},
    {estado:'activo'},{q:'x'.repeat(81)},{secret:'no-publicar'}]) {
    assert.equal(validarConsultaReal(entrada),null);
    assert.equal((await p.listar(entrada)).status,400);
  }
  assert.equal(creados,0);
});

test('errores de Auth y PostgreSQL no devuelven datos parciales ni detalles privados', async () => {
  for(const falla of ['auth','profiles','configuracion']) {
    const p=crearProveedorUsuariosReales(()=>{
      if(falla==='configuracion') throw Error('no-publicar');
      return {listarCuentas:async()=>{if(falla==='auth')throw Error('no-publicar');return {usuarios:[cuenta(1)]};},
        consultarPerfiles:async()=>{throw Error('no-publicar');}};
    });
    const r=await p.listar({});assert.equal(r.ok,false);assert.equal(r.status,503);
    assert.doesNotMatch(JSON.stringify(r),/no-publicar|00000000/);
  }
});

test('cuentas repetidas durante un escaneo se rechazan como lectura inestable', async () => {
  const p=crearProveedorUsuariosReales(()=>({listarCuentas:async()=>({usuarios:Array.from({length:100},()=>cuenta(1))}),
    consultarPerfiles:async()=>assert.fail('no consultar perfiles')}));
  assert.equal((await p.listar({})).codigo,'LECTURA_INESTABLE');
});

test('límite de 2000 cuentas falla sin truncar ni fingir un total completo', async () => {
  const p=crearProveedorUsuariosReales(()=>({listarCuentas:async(pagina,tamano)=>({usuarios:Array.from({length:tamano},(_,i)=>cuenta((pagina-1)*tamano+i+1))}),
    consultarPerfiles:async()=>assert.fail('no consultar perfiles')}));
  assert.equal((await p.listar({})).codigo,'LIMITE_LECTURA_REAL');
});

test('se admite exactamente el límite únicamente después de comprobar el final de Auth', async () => {
  const {proveedor,llamadas}=preparar(Array.from({length:2000},(_,i)=>cuenta(i+1)),[]);
  const r=await proveedor.listar({});assert.equal(r.ok,true);assert.equal(r.valor.total,2000);
  assert.equal(llamadas.filter(l=>l[0]==='auth').length,21);
});

test('respuestas malformadas, perfiles ajenos y duplicados se rechazan', async () => {
  for(const filas of [[{id:id(2),full_name:'ajeno'}],[{id:id(1),full_name:42}],
    [{id:id(1),full_name:'a'},{id:id(1),full_name:'b'}]]) {
    const p=crearProveedorUsuariosReales(()=>({listarCuentas:async()=>({usuarios:[cuenta(1)]}),consultarPerfiles:async()=>filas}));
    assert.equal((await p.listar({})).codigo,'RESPUESTA_PERFILES_INVALIDA');
  }
  const p=crearProveedorUsuariosReales(()=>({listarCuentas:async()=>({usuarios:[{id:'no-uuid'}]}),consultarPerfiles:async()=>[]}));
  assert.equal((await p.listar({})).codigo,'RESPUESTA_AUTH_INVALIDA');
});

test('lecturas concurrentes no comparten snapshot, filtros, resultados ni instancia', async () => {
  let instancia=0;
  const p=crearProveedorUsuariosReales(()=>{
    const n=++instancia;
    return {listarCuentas:async()=>{await new Promise(r=>setTimeout(r,n===1?5:0));return {usuarios:[cuenta(n)]};},consultarPerfiles:async()=>[]};
  });
  const [a,b]=await Promise.all([p.listar({}),p.listar({})]);
  assert.equal(a.valor.usuarios[0].id,id(1));assert.equal(b.valor.usuarios[0].id,id(2));
});

function identidad({rol='superusuario',aal='aal2',estado='activo',error=null}={}) {
  return ()=>({auth:{getUser:async()=>({data:{user:{...cuenta(999),app_metadata:{dentaia:{version:1,estado,roles:[rol]}},factors:[{status:'verified'}]}},error}),
    getClaims:async()=>({data:{claims:{sub:id(999),role:'authenticated',aal,session_id:'sesion-fixture',exp:Date.now()/1000+300}},error:null})}});
}
const req=(query='',token='Bearer token-fixture')=>new Request('https://dentaia.example.test/api/administracion/usuarios/reales'+query,{headers:token?{authorization:token}:{}});
const api=(crear=identidad(),proveedor=preparar().proveedor)=>crearConsultaUsuariosReales((r,a,fn)=>ejecutarOperacionAdministrativa(r,a,crear,fn),proveedor);

test('API real de lectura exige guard AAL2 por petición y respuesta privada sin caché', async () => {
  const r=await api()(req());assert.equal(r.status,200);
  assert.match(r.headers.get('cache-control'),/private, no-store/);
  assert.equal(r.headers.get('cdn-cache-control'),'no-store');assert.match(r.headers.get('vary'),/Authorization/);
  assert.equal((await r.json()).origen,'supabase');
});

test('visitante, paciente, odontólogo, AAL1, suspendido y JWT inválido no crean proveedor real', async () => {
  for(const [opciones,token,status] of [[{},null,401],[{rol:'paciente'},undefined,403],[{rol:'odontologo'},undefined,403],
    [{aal:'aal1'},undefined,403],[{estado:'suspendido'},undefined,403],[{error:{status:401}},undefined,401]]) {
    let consultas=0;
    const p={listar:async()=>{consultas++;assert.fail('no ejecutar');}};
    const r=await api(identidad(opciones),p)(req('',token));assert.equal(r.status,status);assert.equal(consultas,0);
  }
});

test('API rechaza query duplicada, autoridad/proveedor del cliente y tipos inválidos', async () => {
  for(const q of ['?pagina=1&pagina=2','?actorId=otro','?proveedor=demo','?estado=activo','?rol=admin','?tamano=5.5','?__proto__=x']) {
    assert.equal((await api()(req(q))).status,400,q);
  }
});

test('API proyecta también campos anidados y nunca expone objetos del proveedor', async () => {
  const r=await preparar().proveedor.listar({});
  r.valor.usuarios[0].perfil.email='no-publicar';r.valor.usuarios[0].asignacion.app_metadata='no-publicar';
  r.valor.usuarios[0].secreto='no-publicar';r.valor.secreto='no-publicar';
  const respuesta=await api(identidad(),{listar:async()=>r})(req());
  assert.doesNotMatch(await respuesta.text(),/no-publicar|secreto|email|app_metadata/);
});

test('no hay acción administrativa de escritura habilitada, aunque el actor tenga AAL2', async () => {
  for(const accion of ['roles.asignar','roles.revocar','usuarios.actualizar']) {
    let escrito=false;
    const r=await ejecutarOperacionAdministrativa(req(),accion,identidad(),()=>{escrito=true;return Response.json({aplicado:true});});
    assert.equal(r.status,403);assert.equal(escrito,false);
  }
});
