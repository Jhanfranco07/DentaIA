import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const archivo=new URL('./escrituras-roles-supabase.ts',import.meta.url).href;
const cwd=fileURLToPath(new URL('../../../',import.meta.url));
const correr=(code,server=true)=>spawnSync(process.execPath,[...(server?['--conditions=react-server']:[]),'--experimental-strip-types','--input-type=module','-e',code],{cwd,encoding:'utf8',timeout:15000});
const config=`process.env.NEXT_PUBLIC_SUPABASE_URL='https://roles.example.test';process.env.DENTAIA_ROLE_WRITES_ENABLED='true';process.env.DENTAIA_SUPABASE_ROLE_WRITE_SECRET='privada-sintetica';`;
test('cliente de escritura server-only y apagado sin credencial dedicada; no toma la de lectura',()=>{
  assert.notEqual(correr(`await import(${JSON.stringify(archivo)})`,false).status,0);
  const r=correr(`import assert from 'node:assert/strict';const {crearEscriturasRolesSupabase}=await import(${JSON.stringify(archivo)});
    ${config} delete process.env.DENTAIA_ROLE_WRITES_ENABLED;process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET='ajena';
    let red=0;globalThis.fetch=async()=>{red++;throw Error('no ejecutar');};assert.throws(()=>crearEscriturasRolesSupabase());
    process.env.DENTAIA_ROLE_WRITES_ENABLED='true';delete process.env.DENTAIA_SUPABASE_ROLE_WRITE_SECRET;
    assert.throws(()=>crearEscriturasRolesSupabase());assert.equal(red,0);`);
  assert.equal(r.status,0,r.stderr);
});
test('SDK instalado: solo POST al RPC fijo, sin sesión de navegador, caché ni redirecciones',()=>{
  const r=correr(`import assert from 'node:assert/strict';${config}
    let llamadas=0;globalThis.fetch=async(url,init)=>{llamadas++;assert.equal(String(url),'https://roles.example.test/rest/v1/rpc/dentaia_cambiar_roles_v1');
      assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');
      const b=JSON.parse(init.body);assert.equal(b.p_contexto.actorId,'actor-fixture');assert.equal(b.p_solicitud,'id-fixture');
      return Response.json({status:200,codigo:'CAMBIO_APLICADO',resultado:'aplicado',revision:1,asignacion:{version:1,estado:'activo',roles:['paciente']}});};
    const {crearEscriturasRolesSupabase}=await import(${JSON.stringify(archivo)});
    const p=crearEscriturasRolesSupabase();const r=await p.ejecutar({actorId:'actor-fixture',sesionId:'sesion-fixture',expira:9999999999},{operacion:'consultar',usuarioId:'objetivo-fixture'},'id-fixture');
    assert.equal(r.revision,1);assert.equal(llamadas,1);`);
  assert.equal(r.status,0,r.stderr);
});
test('errores RPC y campos privados inesperados fallan sin reenviar detalle',()=>{
  const r=correr(`import assert from 'node:assert/strict';${config}
    const {crearEscriturasRolesSupabase}=await import(${JSON.stringify(archivo)});
    for(const respuesta of [Response.json({message:'detalle-interno'},{status:503}),Response.json({status:200,codigo:'CAMBIO_APLICADO',resultado:'aplicado',revision:1,asignacion:null,token:'no-publicar'}),
      Response.json({status:200,codigo:'CAMBIO_APLICADO',resultado:'aplicado',revision:1,asignacion:{version:1,estado:'activo',roles:[['paciente']]}})]){
      let llamadas=0;globalThis.fetch=async()=>{llamadas++;return respuesta;};await assert.rejects(()=>crearEscriturasRolesSupabase().ejecutar({}, {}, null),e=>!e.message.includes('detalle-interno')&&!e.message.includes('no-publicar'));assert.equal(llamadas,1);}`);
  assert.equal(r.status,0,r.stderr);
});
