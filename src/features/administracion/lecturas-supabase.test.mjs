import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const archivo=new URL('./lecturas-supabase.ts',import.meta.url).href;
const raiz=fileURLToPath(new URL('../../../',import.meta.url));
function ejecutar(codigo,servidor=true) {
  return spawnSync(process.execPath,[...(servidor?['--conditions=react-server']:[]),
    '--experimental-strip-types','--input-type=module','-e',codigo],{cwd:raiz,encoding:'utf8',timeout:15000});
}
const configuracion=`
  process.env.NODE_ENV='development';
  delete process.env.VERCEL;delete process.env.VERCEL_ENV;delete process.env.VERCEL_GIT_COMMIT_REF;
  delete process.env.DENTAIA_ADMIN_PREVIEW_ENABLED;
  process.env.DENTAIA_ADMIN_READS_ENABLED='true';
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://admin.example.test';
  process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET='credencial-sintetica-exclusiva-de-prueba';
`;

test('el adaptador privilegiado no se puede importar en contexto cliente',()=>{
  const r=ejecutar(`await import(${JSON.stringify(archivo)})`,false);
  assert.notEqual(r.status,0);assert.match(r.stderr,/cannot be imported from a Client Component module/);
});

test('sin opt-in o credencial dedicada falla sin red; no toma la clave del script de usuarios',()=>{
  const r=ejecutar(`
    import assert from 'node:assert/strict';
    delete process.env.DENTAIA_ADMIN_READS_ENABLED;
    process.env.SUPABASE_SECRET_KEY='credencial-ajena-no-utilizar';
    let llamadas=0;globalThis.fetch=async()=>{llamadas++;throw Error('no ejecutar');};
    const {crearLecturasSupabase}=await import(${JSON.stringify(archivo)});
    assert.throws(()=>crearLecturasSupabase(),/no configurada/);
    ${configuracion}
    delete process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET;
    assert.throws(()=>crearLecturasSupabase(),/no configurada/);
    ${configuracion}
    process.env.VERCEL='1';process.env.VERCEL_ENV='production';
    assert.throws(()=>crearLecturasSupabase(),/no configurada/);
    delete process.env.VERCEL;delete process.env.VERCEL_ENV;
    ${configuracion}
    process.env.NEXT_PUBLIC_SUPABASE_URL='http://admin.example.test';
    assert.throws(()=>crearLecturasSupabase(),/no configurada/);
    assert.equal(llamadas,0);
  `);
  assert.equal(r.status,0,r.stderr);
});

test('SDK real con fetch interceptado: GET Auth y profiles mínimo, sin caché, redirects ni métodos de escritura',()=>{
  const r=ejecutar(`
    import assert from 'node:assert/strict';
    ${configuracion}
    const id='00000000-0000-4000-8000-000000000001';
    const llamadas=[];
    globalThis.fetch=async(input,init)=>{
      const url=new URL(String(input));llamadas.push(url);
      assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');
      assert.ok(init.signal instanceof AbortSignal);
      const headers=new Headers(init.headers);
      assert.equal(headers.get('apikey'),process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET);
      if(url.pathname==='/auth/v1/admin/users') {
        assert.equal(url.searchParams.get('page'),'1');assert.equal(url.searchParams.get('per_page'),'100');
        return Response.json({users:[{id,aud:'authenticated',is_anonymous:false,confirmed_at:'2026-11-01T00:00:00Z',
          email:'no-publicar',app_metadata:{otro:'no-publicar'},user_metadata:{nombre:'no-publicar'},factors:['no-publicar']}]});
      }
      assert.equal(url.pathname,'/rest/v1/profiles');assert.equal(url.searchParams.get('select'),'id,full_name');
      assert.equal(url.searchParams.get('id'),'in.('+id+')');assert.match(headers.get('prefer'),/count=exact/);
      return Response.json([{id,full_name:'Nombre ficticio',email:'no-publicar'}],{headers:{'content-range':'0-0/1'}});
    };
    const {crearLecturasSupabase}=await import(${JSON.stringify(archivo)});
    const p=crearLecturasSupabase();assert.deepEqual(Object.keys(p),['listarCuentas','consultarPerfiles']);
    const cuentas=await p.listarCuentas(1,100);
    assert.deepEqual(cuentas.usuarios[0].app_metadata,{});
    assert.doesNotMatch(JSON.stringify(cuentas),/no-publicar|email|factors|user_metadata/);
    assert.deepEqual(await p.consultarPerfiles([id]),[{id,full_name:'Nombre ficticio'}]);
    assert.deepEqual(await p.consultarPerfiles([]),[]);assert.equal(llamadas.length,2);
    await assert.rejects(()=>p.consultarPerfiles(['no-uuid']));
    await assert.rejects(()=>p.consultarPerfiles(['------------------------------------']));
    await assert.rejects(()=>p.listarCuentas(0,100));
    await assert.rejects(()=>p.listarCuentas(1,101));
    assert.equal(llamadas.length,2);
  `);
  assert.equal(r.status,0,r.stderr);
});

test('SDK: errores de Auth/PostgreSQL y truncamiento no se convierten en lista vacía o perfiles ausentes',()=>{
  const r=ejecutar(`
    import assert from 'node:assert/strict';
    ${configuracion}
    const {crearLecturasSupabase}=await import(${JSON.stringify(archivo)});
    globalThis.fetch=async()=>Response.json({msg:'detalle-privado'},{status:401});
    await assert.rejects(()=>crearLecturasSupabase().listarCuentas(1,100),/Auth no disponible/);
    globalThis.fetch=async()=>Response.json({message:'detalle-privado'},{status:403});
    await assert.rejects(()=>crearLecturasSupabase().consultarPerfiles(['00000000-0000-4000-8000-000000000001']),/perfiles no disponible/);
    globalThis.fetch=async()=>Response.json([],{headers:{'content-range':'*/1'}});
    await assert.rejects(()=>crearLecturasSupabase().consultarPerfiles(['00000000-0000-4000-8000-000000000001']),/incompleta/);
  `);
  assert.equal(r.status,0,r.stderr);
});

test('integración API → guard → proveedor → SDK Auth/profiles con transporte interceptado, sin servicio remoto',()=>{
  const dominio=new URL('./usuarios-reales.ts',import.meta.url).href;
  const api=new URL('./api-usuarios-reales.ts',import.meta.url).href;
  const guard=new URL('../autorizacion/autorizacion.ts',import.meta.url).href;
  const r=ejecutar(`
    import assert from 'node:assert/strict';
    ${configuracion}
    const id='00000000-0000-4000-8000-000000000001';
    let llamadas=0;
    globalThis.fetch=async(input)=>{
      llamadas++;
      if(new URL(String(input)).pathname==='/auth/v1/admin/users') return Response.json({users:[{
        id,aud:'authenticated',is_anonymous:false,confirmed_at:'2026-11-01T00:00:00Z',
        app_metadata:{dentaia:{version:1,estado:'activo',roles:['paciente']}},email:'no-publicar'}]});
      return Response.json([{id,full_name:'Paciente ficticio'}],{headers:{'content-range':'0-0/1'}});
    };
    const {crearLecturasSupabase}=await import(${JSON.stringify(archivo)});
    const {crearProveedorUsuariosReales}=await import(${JSON.stringify(dominio)});
    const {crearConsultaUsuariosReales}=await import(${JSON.stringify(api)});
    const {ejecutarOperacionAdministrativa}=await import(${JSON.stringify(guard)});
    const identidad=()=>({auth:{getUser:async()=>({data:{user:{id,aud:'authenticated',is_anonymous:false,
      confirmed_at:'2026-11-01T00:00:00Z',app_metadata:{dentaia:{version:1,estado:'activo',roles:['superusuario']}},factors:[{status:'verified'}]}},error:null}),
      getClaims:async()=>({data:{claims:{sub:id,role:'authenticated',aal:'aal2',session_id:'fixture',exp:Date.now()/1000+300}},error:null})}});
    const consultar=crearConsultaUsuariosReales((req,accion,fn)=>ejecutarOperacionAdministrativa(req,accion,identidad,fn),
      crearProveedorUsuariosReales(crearLecturasSupabase));
    const url='https://dentaia.example.test/api/administracion/usuarios/reales';
    assert.equal((await consultar(new Request(url))).status,401);assert.equal(llamadas,0);
    const respuesta=await consultar(new Request(url,{headers:{authorization:'Bearer fixture'}}));
    assert.equal(respuesta.status,200);
    const body=await respuesta.json();assert.equal(body.total,1);
    assert.equal(body.usuarios[0].perfil.nombre,'Paciente ficticio');
    assert.equal(body.usuarios[0].asignacion.estado,'activa');assert.equal(llamadas,2);
    assert.doesNotMatch(JSON.stringify(body),/no-publicar|email|app_metadata/);
  `);
  assert.equal(r.status,0,r.stderr);
});
