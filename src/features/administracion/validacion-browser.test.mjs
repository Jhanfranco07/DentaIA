import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const codigo=await readFile(new URL('../../../scripts/validar-lectura-admin.browser.js',import.meta.url),'utf8');
const id='00000000-0000-4000-8000-000000000001';
const privadas={'cache-control':'private, no-store, max-age=0','cdn-cache-control':'no-store','vary':'Authorization'};
const fila=()=>({id,perfil:{estado:'presente',nombre:'Nombre ficticio no publicar'},cuenta:'habilitada',asignacion:{estado:'activa',roles:['paciente']}});
async function ejecutar({escenario='perfil_presente',usuario=fila(),status=200,hostname='localhost',extra={},sesion=true}={}) {
  const llamadas=[];
  const localStorage=sesion?{'sb-fixture-auth-token':JSON.stringify({access_token:'token-fixture-no-publicar'})}:{};
  localStorage.getItem=k=>localStorage[k];
  const entradas=[escenario,id];
  const report=await runInNewContext(codigo,{location:{hostname,protocol:'http:'},localStorage,
    prompt:()=>entradas.shift(),AbortSignal,fetch:async(ruta,init)=>{
      llamadas.push({ruta,init});
      assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');
      if(!init.headers.Authorization) return Response.json({error:'Autenticación requerida.'},{status:401,headers:privadas});
      if(ruta==='/api/administracion/acceso') return Response.json(status===200?{autorizado:true}:{error:'Acceso denegado.'},{status,headers:privadas});
      return Response.json(status===200?{origen:'supabase',consistencia:'lectura_no_transaccional',total:1,pagina:1,paginas:1,tamano:5,usuarios:[usuario],...extra}
        :{error:'Acceso denegado.'},{status,headers:privadas});
    }});
  assert.doesNotMatch(JSON.stringify(report),/token-fixture|00000000|Nombre ficticio/);
  return {report,llamadas};
}

test('snippet verifica las cuatro respuestas con fixtures sin reportar datos personales o tokens',async()=>{
  for(const [escenario,cambios] of [['perfil_presente',{}],['perfil_ausente',{perfil:{estado:'ausente',nombre:null}}],
    ['cuenta_suspendida',{cuenta:'suspendida'}],['asignacion_invalida',{asignacion:{estado:'invalida',roles:[]}}]]) {
    const {report}=await ejecutar({escenario,usuario:{...fila(),...cambios}});
    assert.equal(report.resultado,'COINCIDE_CON_ESPERADO');assert.equal(report.contratoMinimo,true);
  }
});

test('snippet requiere rechazo del guard y del endpoint en escenarios negativos, con fixtures',async()=>{
  for(const status of [401,403]) {
    const {report}=await ejecutar({escenario:'denegado'+status,status});
    assert.equal(report.resultado,'COINCIDE_CON_ESPERADO');
  }
  assert.equal((await ejecutar({escenario:'denegado403'})).report.resultado,'FALLO_O_BLOQUEO');
});

test('snippet no acepta campos extra, estado inesperado ni datos de otra identidad',async()=>{
  for(const cambios of [{extra:{historial:'no-publicar'}},{usuario:{...fila(),email:'no-publicar'}},
    {usuario:{...fila(),perfil:{estado:'ausente',nombre:'no-publicar'}}},{usuario:{...fila(),id:id.replace(/1$/,'2')}}]) {
    assert.equal((await ejecutar(cambios)).report.resultado,'FALLO_O_BLOQUEO');
  }
});

test('snippet no se ejecuta en producción ni confunde ausencia de sesión con aceptación positiva',async()=>{
  const produccion=await ejecutar({hostname:'dent-ai-five.vercel.app'});
  assert.equal(produccion.report.resultado,'NO_VERIFICADA');assert.equal(produccion.llamadas.length,0);
  const sinSesion=await ejecutar({sesion:false});
  assert.equal(sinSesion.report.resultado,'NO_VERIFICADA');assert.equal(sinSesion.report.rechazoAnonimo,true);
  const indisponible=await ejecutar({status:503});
  assert.equal(indisponible.report.resultado,'NO_VERIFICADA');
});
