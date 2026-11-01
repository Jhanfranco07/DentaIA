import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const archivo=new URL('../../lib/supabase/server.ts',import.meta.url).href;
const raiz=fileURLToPath(new URL('../../../',import.meta.url));

test('adaptador real: getUser llama Auth con bearer, sin caché ni cliente privilegiado',()=>{
  const code=`
    import assert from 'node:assert/strict';
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://auth.example.test';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const llamadas=[];
    globalThis.fetch=async(input,init)=>{
      llamadas.push({input:String(input),init});
      assert.equal(String(input),'https://auth.example.test/auth/v1/user');
      assert.equal(new Headers(init.headers).get('Authorization'),'Bearer token-sintetico');
      assert.equal(new Headers(init.headers).get('apikey'),'public-test-key');
      assert.equal(init.cache,'no-store');
      assert.ok(init.signal instanceof AbortSignal);
      return Response.json({id:'identidad-sintetica',aud:'authenticated',app_metadata:{dentaia:{version:1,estado:'activo',roles:['superusuario']}},user_metadata:{}});
    };
    const {crearClienteIdentidadServidor}=await import(${JSON.stringify(archivo)});
    const a=crearClienteIdentidadServidor(), b=crearClienteIdentidadServidor();
    assert.notEqual(a,b);
    assert.deepEqual(Object.keys(a),['auth']);
    assert.deepEqual(Object.keys(a.auth),['getUser']);
    const {data,error}=await a.auth.getUser('token-sintetico');
    assert.equal(error,null);
    assert.equal(data.user.app_metadata.dentaia.roles[0],'superusuario');
    await b.auth.getUser('token-sintetico');
    assert.equal(llamadas.length,2);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.throws(()=>crearClienteIdentidadServidor(),/Configuración/);
  `;
  const result=spawnSync(process.execPath,['--conditions=react-server','--experimental-strip-types','--input-type=module','-e',code],{cwd:raiz,encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr);
});
test('server-only impide importar el adaptador en un contexto ordinario',()=>{
  const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`await import(${JSON.stringify(archivo)})`],{cwd:raiz,encoding:'utf8',timeout:15000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/cannot be imported from a Client Component module/);
});
