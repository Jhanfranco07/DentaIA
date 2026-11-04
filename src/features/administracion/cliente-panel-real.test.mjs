import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
// Solo resolución de TS local en Node; fixtures explícitos, sin red ni credenciales.
registerHooks({resolve(s,c,n){return s.startsWith('.')&&c.parentURL?.includes('/administracion/')&&!/\.[a-z]+$/i.test(s)?n(new URL(s+'.ts',c.parentURL).href,c):n(s,c);}});
const {crearClientePanelReal,paginaReal,respuestaRolesPanel}=await import('./cliente-panel-real.ts');
const {crearProveedorUsuariosReales}=await import('./usuarios-reales.ts');
const {crearConsultaUsuariosReales}=await import('./api-usuarios-reales.ts');
const {ejecutarOperacionAdministrativa}=await import('../autorizacion/autorizacion.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const cuenta=n=>({id:id(n),aud:'authenticated',is_anonymous:false,confirmed_at:'2026-11-01T00:00:00Z',app_metadata:{dentaia:{version:1,estado:'activo',roles:[n%2?'paciente':'odontologo']}}});
const fila={id:id(1),cuenta:'habilitada',perfil:{estado:'presente',nombre:'Nombre ficticio'},asignacion:{estado:'activa',roles:['paciente']}};
const pagina=(usuarios=[fila])=>({origen:'supabase',consistencia:'lectura_no_transaccional',total:usuarios.length,pagina:1,paginas:1,tamano:5,usuarios});
function preparar({rol='superusuario',aal='aal2',invalid=false,disabled=false}={}){
 let lecturas=0;const peticiones=[];
 const identidad=()=>({auth:{getUser:async()=>({data:{user:invalid?null:{id:id(99),aud:'authenticated',confirmed_at:'2026-11-01',app_metadata:{dentaia:{version:1,estado:'activo',roles:[rol]}},factors:[{status:'verified'}]}},error:null}),
 getClaims:async()=>({data:{claims:{sub:id(99),role:'authenticated',aal,session_id:id(98),exp:Date.now()/1000+300}},error:null})}});
 const p=crearProveedorUsuariosReales(()=>{lecturas++;if(disabled)throw Error('SECRETO_NO_MOSTRAR');return{listarCuentas:async()=>({usuarios:Array.from({length:8},(_,n)=>cuenta(n+1))}),consultarPerfiles:async ids=>ids.map(id=>({id,full_name:'Perfil ficticio '+id.slice(-1)}))};});
 const api=crearConsultaUsuariosReales((r,a,f)=>ejecutarOperacionAdministrativa(r,a,identidad,f),p);
 const cliente=crearClientePanelReal(async()=>'fixture-token',async(url,init)=>{peticiones.push({url,init});return api(new Request('https://dentaia.test'+url,init));});
 return{cliente,peticiones,lecturas:()=>lecturas};
}
test('DI-152 cliente → endpoint real → guard → puerto simulado conserva filtros/paginación',async()=>{
 const p=preparar();const a=await p.cliente.listar({rol:'paciente',estado:'habilitada',q:'Perfil',pagina:1,tamano:5});
 assert(a.ok);assert.equal(a.valor.total,4);assert(a.valor.usuarios.every(x=>x.asignacion.roles.includes('paciente')));
 const b=await p.cliente.listar({pagina:2,tamano:5});assert(b.ok);assert.equal(b.valor.pagina,2);assert.equal(b.valor.usuarios.length,3);
 const url=new URL(p.peticiones[0].url,'https://dentaia.test');assert.equal(url.pathname,'/api/administracion/usuarios/reales');assert.equal(url.searchParams.get('q'),'Perfil');assert.equal(url.searchParams.get('rol'),'paciente');
 assert.equal(p.peticiones[0].init.credentials,'omit');assert.equal(p.peticiones[0].init.cache,'no-store');
});
test('DI-152 proveedor puede ajustar página fuera de rango sin fabricar resultados',async()=>{const r=await preparar().cliente.listar({pagina:8,tamano:5});assert(r.ok);assert.equal(r.valor.pagina,2);});
test('DI-152 búsqueda sin resultados mantiene página uno y vacío real del contrato',async()=>{const r=await preparar().cliente.listar({q:'no-existe'});assert(r.ok);assert.equal(r.valor.total,0);assert.equal(r.valor.pagina,1);});
for(const [op,status]of [[{rol:'paciente'},403],[{rol:'odontologo'},403],[{aal:'aal1'},403],[{invalid:true},401]])test('DI-152 rechazo '+JSON.stringify(op)+' antes del proveedor',async()=>{const p=preparar(op),r=await p.cliente.listar({});assert(!r.ok);assert.equal(r.status,status);assert.equal(p.lecturas(),0);});
test('DI-152 sesión ausente no llama al transporte y lectura apagada nunca se presenta exitosa',async()=>{let calls=0;const r=await crearClientePanelReal(async()=>null,async()=>{calls++;}).listar({});assert(!r.ok);assert.equal(r.status,401);assert.equal(calls,0);const d=await preparar({disabled:true}).cliente.listar({});assert(!d.ok);assert.equal(d.status,503);assert(!JSON.stringify(d).includes('SECRETO'));});
test('DI-152 validación de filtros/identidad impide peticiones manipuladas',async()=>{const p=preparar();for(const x of [{actorId:id(1)},{estado:'activo'},{rol:'admin'},{tamano:999},{pagina:0}]){const r=await p.cliente.listar(x);assert(!r.ok);assert.equal(r.status,400);}assert.equal(p.peticiones.length,0);});
test('DI-152 DTO conserva estados diferenciados y descarta datos extra',()=>{
 const r=paginaReal(pagina([{...fila,email:'NO_MOSTRAR',clinica:'NO_MOSTRAR',perfil:{estado:'ausente',nombre:null},asignacion:{estado:'invalida',roles:[]},cuenta:'suspendida'}]));assert(r);assert.equal(r.usuarios[0].perfil.estado,'ausente');assert.equal(r.usuarios[0].asignacion.estado,'invalida');assert(!JSON.stringify(r).includes('NO_MOSTRAR'));
 for(const cambio of [{origen:'sintetico'},{consistencia:'otra'},{total:999},{usuarios:[{...fila,asignacion:{estado:'invalida',roles:['superusuario']}}]}])assert.equal(paginaReal({...pagina(),...cambio}),null);
});
test('DI-152 no acepta una página de otra consulta ni resultados duplicados',async()=>{const c=crearClientePanelReal(async()=>'fixture',async()=>Response.json({...pagina(),tamano:10}));assert.equal((await c.listar({tamano:5})).status,502);assert.equal(paginaReal(pagina([fila,fila])),null);});
test('DI-152 lectura posterior representa el nuevo estado después de respuesta confirmada',async()=>{let roles=['paciente'];const c=crearClientePanelReal(async()=>'fixture',async()=>Response.json(pagina([{...fila,asignacion:{estado:'activa',roles}}])));assert.deepEqual((await c.listar({})).valor.usuarios[0].asignacion.roles,['paciente']);roles=['paciente','superusuario'];assert.deepEqual((await c.listar({})).valor.usuarios[0].asignacion.roles,roles);});
test('DI-152 resultado roles exige operación, código y clave correspondientes',()=>{
 const data={codigo:'ESTADO_ACTUAL',resultado:'consultado',revision:0,asignacion:null,solicitudId:null};assert(respuestaRolesPanel(data,null));
 const applied={...data,codigo:'CAMBIO_APLICADO',resultado:'aplicado',revision:1,solicitudId:id(77)};assert(respuestaRolesPanel(applied,id(77)));
 for(const x of [{...applied,codigo:'ESCRITURAS_DESACTIVADAS'},{...applied,solicitudId:id(78)},{...applied,resultado:'consultado'},{...applied,revision:-1}])assert.equal(respuestaRolesPanel(x,id(77)),null);
 assert.equal(respuestaRolesPanel(applied,null),null);
});
test('DI-152 HTTP de error/HTML no expone cuerpos sensibles',async()=>{for(const response of [new Response('SECRETO_INTERNO',{status:500}),new Response('<html>SECRETO</html>',{status:200,headers:{'Content-Type':'text/html'}})]){const r=await crearClientePanelReal(async()=>'fixture',async()=>response).listar({});assert(!r.ok);assert(!JSON.stringify(r).includes('SECRETO'));}});
