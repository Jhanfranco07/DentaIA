import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarMatrizLectura, paginaMinimaValida } from './validacion-lectura.ts';
import { crearProveedorUsuariosReales } from './usuarios-reales.ts';
import { crearConsultaUsuariosReales } from './api-usuarios-reales.ts';

// Fixtures exclusivamente: no utiliza sesiones ni servicios remotos.
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const privado = { 'Cache-Control':'private, no-store', 'CDN-Cache-Control':'no-store', Vary:'Authorization' };
function transporte(cantidad = 7) {
  const cuentas = Array.from({length:cantidad}, (_, i) => ({id:id(i+1), aud:'authenticated',
    is_anonymous:false, confirmed_at:'2026-11-01T00:00:00Z',
    app_metadata:i===1 ? {} : i===2 ? {dentaia:{version:99}} :
      {dentaia:{version:1, estado:'activo', roles:[i===0?'superusuario':'paciente']}}}));
  const proveedor = crearProveedorUsuariosReales(() => ({
    listarCuentas:async(p,t)=>({usuarios:cuentas.slice((p-1)*t,p*t)}),
    consultarPerfiles:async(ids)=>ids.filter(x=>x!==id(2)).map(x=>({id:x,full_name:'Nombre ficticio QA'})),
  }));
  const handler = crearConsultaUsuariosReales(async(r,_accion,operacion)=>{
    const respuesta = r.headers.has('authorization') ? await operacion({}) : Response.json({error:'Sin sesión'},{status:401});
    for(const [k,v] of Object.entries(privado)) respuesta.headers.set(k,v);
    return respuesta;
  },proveedor);
  return (q,identidad)=>handler(new Request(`http://localhost/api?${q}`,{
    headers:identidad==='actual'?{authorization:'Bearer fixture'}:{},
  }));
}
test('matriz QA con fixtures: filtros, búsqueda, paginación y reporte sin filas personales',async()=>{
  const informe=await ejecutarMatrizLectura(transporte());
  assert.equal(informe.estado,'COHERENTE');
  assert.equal(informe.registrosConsultados,7);
  assert.equal(informe.perfilesAusentes,1);
  assert.equal(informe.coherenciaPaginacion,true);
  assert.ok(informe.casos.some(c=>c.caso==='paginacion_5_2'&&c.registros===2));
  assert.ok(informe.casos.every(c=>c.correcto));
  assert.doesNotMatch(JSON.stringify(informe),/Nombre ficticio|00000000|Bearer fixture/);
});
test('matriz QA limita el volumen y no presenta una muestra incompleta como validada',async()=>{
  const informe=await ejecutarMatrizLectura(transporte(101));
  assert.equal(informe.estado,'BLOQUEADA');
  assert.equal(informe.motivo,'LIMITE_DE_MUESTRA_QA');
  assert.equal(informe.casos.length,1);
});
test('matriz QA identifica rechazos 401 y 403 antes de consultar filas',async()=>{
  for(const status of [401,403]) {
    const informe=await ejecutarMatrizLectura(async()=>Response.json({error:'denegado'},{status,headers:privado}));
    assert.equal(informe.estado,'BLOQUEADA');
    assert.equal(informe.httpInicial,status);
    assert.equal(informe.registrosConsultados,null);
  }
});
test('matriz QA rechaza campos adicionales sensibles y errores sin revelar contenido',async()=>{
  const pagina={origen:'supabase',consistencia:'lectura_no_transaccional',total:0,pagina:1,paginas:1,tamano:20,usuarios:[]};
  assert.equal(paginaMinimaValida(pagina),true);
  assert.equal(paginaMinimaValida({...pagina,credentials:'no-publicar'}),false);
  const informe=await ejecutarMatrizLectura(async()=>{throw new Error('secreto-no-publicar');});
  assert.equal(informe.estado,'FALLO');
  assert.doesNotMatch(JSON.stringify(informe),/secreto-no-publicar/);
});
