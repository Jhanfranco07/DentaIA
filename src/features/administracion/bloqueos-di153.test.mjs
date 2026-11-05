import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// DI-153: hueco de cableado no cubierto por el test del puerto ni del adaptador aislado.
// Carga el ensamblado server-only real. Solo Auth se dobla; nunca hay red o credenciales.
const raiz = fileURLToPath(new URL('../../../', import.meta.url));
const modulo = new URL('./servidor-cambios-roles.ts', import.meta.url).href;
const comun = `
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = ${JSON.stringify(raiz)};
registerHooks({resolve(s,c,n){
  if(s.startsWith('@/')) return n(pathToFileURL(root+'src/'+s.slice(2)+'.ts').href,c);
  if(s.startsWith('.') && c.parentURL?.startsWith(pathToFileURL(root+'src/').href) && !/\\.[a-z]+$/i.test(s)) return n(new URL(s+'.ts',c.parentURL).href,c);
  return n(s,c);
}});
process.env.NEXT_PUBLIC_SUPABASE_URL='https://di153.example.test';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-fixture';
process.env.DENTAIA_ROLE_WRITES_ENABLED='false';
process.env.DENTAIA_ADMIN_READS_ENABLED='false';
process.env.DENTAIA_SUPABASE_ROLE_WRITE_SECRET='credencial-sintetica-no-utilizable';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id(1),role:'authenticated',aal:'aal2',session_id:id(4),exp:Math.floor(Date.now()/1000)+600})+'.Zml4dHVyZQ';
let auth=0, otros=0;
globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.origin!=='https://di153.example.test' || url.pathname!=='/auth/v1/user') {otros++;throw Error('Transporte ajeno a Auth prohibido en este fixture');}
  assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+token);
  auth++;
  return Response.json({id:id(1),aud:'authenticated',confirmed_at:'2026-11-01T00:00:00Z',
    app_metadata:{dentaia:{version:1,estado:'activo',roles:['superusuario']}},user_metadata:{},factors:[{status:'verified'}]});
};
const {gestionarRoles}=await import(${JSON.stringify(modulo)});
const peticion=(origin='http://localhost:3000')=>new Request('http://localhost:3000/api/administracion/roles',{
  method:'POST',headers:{authorization:'Bearer '+token,origin,'content-type':'application/json','idempotency-key':id(5)},
  body:JSON.stringify({usuarioId:id(2),operacion:'asignar',rol:'paciente',revisionEsperada:0,asignacionEsperada:null,aprobacionId:id(3)})
});
`;
function ejecutar(codigo) {
  const r = spawnSync(process.execPath, ['--conditions=react-server', '--experimental-strip-types', '--input-type=module', '-e', comun + codigo],
    { cwd: raiz, encoding: 'utf8', timeout: 15000 });
  assert.equal(r.status, 0, r.stderr);
}

test('DI-153 ensamblado real: origen ajeno se rechaza antes del cuerpo; origen correcto conserva bandera apagada', () => ejecutar(`
 const ajena=peticion('https://ajeno.example.test');
 const a=await gestionarRoles(ajena);assert.equal(a.status,403);assert.deepEqual(await a.json(),{codigo:'ORIGEN_NO_ADMITIDO'});
 assert.equal(ajena.bodyUsed,false);assert.equal(otros,0);
 const propia=peticion();const b=await gestionarRoles(propia);assert.equal(b.status,503);
 assert.equal((await b.json()).codigo,'ESCRITURAS_DESACTIVADAS');assert.match(b.headers.get('cache-control'),/private, no-store/);
 assert.equal(otros,0);assert.ok(auth>0);
`));

test('DI-153 ensamblado real: valores no exactos de la bandera jamás invocan el RPC aunque haya credencial sintética', () => ejecutar(`
 for(const bandera of ['false','TRUE','1','']) {
   process.env.DENTAIA_ROLE_WRITES_ENABLED=bandera;
   const r=await gestionarRoles(peticion());assert.equal(r.status,503);
   assert.equal((await r.json()).codigo,'ESCRITURAS_DESACTIVADAS');
 }
 assert.equal(otros,0);
`));

test('DI-153 ensamblado real: Preview de Vercel bloquea escrituras aunque la bandera esté activada', () => ejecutar(`
 process.env.VERCEL='1';process.env.VERCEL_ENV='preview';process.env.DENTAIA_ROLE_WRITES_ENABLED='true';
 const r=await gestionarRoles(peticion());assert.equal(r.status,503);
 assert.equal((await r.json()).codigo,'ESCRITURAS_DESACTIVADAS');assert.equal(otros,0);
`));

test('DI-153 consulta de revisión no elude el bloqueo del ensamblado de escritura ni expone contexto', () => ejecutar(`
 const r=await gestionarRoles(new Request('http://localhost:3000/api/administracion/roles?usuarioId='+id(2),{headers:{authorization:'Bearer '+token}}));
 assert.equal(r.status,503);const cuerpo=await r.text();assert.match(cuerpo,/ESCRITURAS_DESACTIVADAS/);
 assert.doesNotMatch(cuerpo,/actorId|sesionId|credencial-sintetica|refresh_token/);assert.equal(otros,0);
`));
