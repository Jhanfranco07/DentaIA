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
    assert.deepEqual(Object.keys(a.auth),['getUser','getClaims']);
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

test('SDK real: firma criptográfica, caducidad y aal2 sin claves persistidas ni Auth remoto',()=>{
  const nucleo=new URL('./autorizacion.ts',import.meta.url).href;
  const code=`
    import assert from 'node:assert/strict';
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://mfa.example.test';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'fixture-kid',alg:'ES256'};
    const codificar=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const header=codificar({alg:'ES256',typ:'JWT',kid:'fixture-kid'});
    const base={sub:'identidad-sintetica',iss:'https://mfa.example.test/auth/v1',aud:'authenticated',
      role:'authenticated',aal:'aal2',session_id:'sesion-sintetica',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600};
    async function firmar(claims){
      const texto=header+'.'+codificar(claims);
      const firma=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(texto));
      return texto+'.'+Buffer.from(firma).toString('base64url');
    }
    let metadata={dentaia:{version:1,estado:'activo',roles:['superusuario']}};
    let factors=[{id:'factor-sintetico',status:'verified',factor_type:'totp'}];
    globalThis.fetch=async(input,init)=>{
      assert.equal(init.cache,'no-store');
      assert.ok(init.signal instanceof AbortSignal);
      const url=String(input);
      if(url.endsWith('/.well-known/jwks.json')) return Response.json({keys:[jwk]});
      assert.equal(url,'https://mfa.example.test/auth/v1/user');
      return Response.json({id:'identidad-sintetica',aud:'authenticated',confirmed_at:'2026-11-01T00:00:00Z',
        app_metadata:metadata,user_metadata:{},factors});
    };
    const {crearClienteIdentidadServidor}=await import(${JSON.stringify(archivo)});
    const {autorizarSolicitudAdministrativa}=await import(${JSON.stringify(nucleo)});
    const comprobar=token=>autorizarSolicitudAdministrativa(new Headers({Authorization:'Bearer '+token}),crearClienteIdentidadServidor);
    const valido=await firmar(base);
    assert.equal((await comprobar(valido)).autorizado,true);
    const aal1=await firmar({...base,aal:'aal1'});
    assert.deepEqual(await comprobar(aal1),{autorizado:false,status:403,codigo:'MFA_AAL2_PENDIENTE'});
    // Cambio manipulable del payload sin volver a firmar.
    const partes=aal1.split('.');
    partes[1]=codificar({...base,aal:'aal2'});
    assert.deepEqual(await comprobar(partes.join('.')),{autorizado:false,status:401,codigo:'SESION_INVALIDA'});
    assert.deepEqual(await comprobar(await firmar({...base,exp:Math.floor(Date.now()/1000)-1})),{autorizado:false,status:401,codigo:'SESION_INVALIDA'});
    assert.deepEqual(await comprobar(await firmar({...base,sub:'otro-usuario'})),{autorizado:false,status:401,codigo:'SESION_INVALIDA'});
    metadata={dentaia:{version:1,estado:'suspendido',roles:['superusuario']}};
    assert.deepEqual(await comprobar(valido),{autorizado:false,status:403,codigo:'ROL_INSUFICIENTE'});
    metadata={dentaia:{version:1,estado:'activo',roles:['superusuario']}};factors=[];
    assert.deepEqual(await comprobar(valido),{autorizado:false,status:403,codigo:'MFA_AAL2_PENDIENTE'});
  `;
  const result=spawnSync(process.execPath,['--conditions=react-server','--experimental-strip-types','--input-type=module','-e',code],{cwd:raiz,encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr);
});
