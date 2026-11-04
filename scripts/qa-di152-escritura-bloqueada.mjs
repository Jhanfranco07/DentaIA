// Solo la observación pendiente: dos etapas de rechazo del mismo POST. No habilita escrituras.
import{spawn}from'node:child_process';import{join}from'node:path';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{randomUUID,createHash}from'node:crypto';
import{readVault,clients,sqlRemote,root,command,ref}from'./academic-private.mjs';
import{elevarAdministrador}from'./validar-cuentas-academicas.mjs';
const report={fecha:new Date().toISOString(),ref,entorno:'Next local temporal; sesión AAL2 real; PostgreSQL remoto solo SELECT',expectativaAnterior:503,recibidoAnterior:403,escriturasHabilitadas:false,pruebas:[]};
const ensure=(v,c)=>{if(!v)throw Error(c);};let server,client;
const configs=['.env.local','.env.development.local'];
const hashes=()=>configs.map(f=>createHash('sha256').update(readFileSync(join(root,f))).digest('hex'));
const originalConfigs=hashes();
try{
 const v=readVault(),admin=v.accounts.find(x=>x.alias==='administrador_qa'),target=v.accounts.find(x=>x.alias==='paciente_a');
 ensure(v.ref===ref&&admin.factorId&&admin.totpSecret&&target.id,'EXISTING_FIXTURES_REQUIRED');
 const c=clients();client=await elevarAdministrador(v,c);
 const token=(await client.auth.getSession()).data.session?.access_token;ensure(token,'AAL2_SESSION_REQUIRED');
 server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3113'],{cwd:root,env:{...process.env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:c.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.key,DENTAIA_ADMIN_READS_ENABLED:'false',DENTAIA_ROLE_WRITES_ENABLED:'false',DENTAIA_SUPABASE_ROLE_WRITE_SECRET:''},stdio:'ignore',windowsHide:true});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3113/api/administracion/acceso')).status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}ensure(ready,'NEXT_NOT_READY');
 const snapshot=()=>{
   const parts=[];
   for(const [table,where]of [['auth.users',"id='"+target.id+"'"],['public.profiles',"id='"+target.id+"'"],['dentaia_admin.aprobaciones_roles','true'],['dentaia_admin.revisiones_roles','true'],['dentaia_admin.auditoria_roles','true']])parts.push("'"+table+"',(SELECT jsonb_build_object('filas',count(*),'huella',md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),''))) FROM "+table+' x WHERE '+where+')');
   return JSON.parse(sqlRemote('SELECT jsonb_build_object('+parts.join(',')+');'));
 };
 for(const test of [{base:'http://127.0.0.1:3113',status:403,code:'ORIGEN_NO_ADMITIDO',etapa:'control de origen, antes de leer cuerpo o invocar proveedor'},
   {base:'http://localhost:3113',status:503,code:'ESCRITURAS_DESACTIVADAS',etapa:'proveedor desactivado, antes de crear cliente de escritura'}]){
   const before=snapshot(),key=randomUUID();
   const response=await fetch(test.base+'/api/administracion/roles',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:test.base,'Sec-Fetch-Site':'same-origin','Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({usuarioId:target.id,operacion:'asignar',rol:'paciente',revisionEsperada:0,asignacionEsperada:null,aprobacionId:randomUUID()})});
   const body=await response.json(),after=snapshot(),unchanged=JSON.stringify(before)===JSON.stringify(after);
   const passed=response.status===test.status&&body.codigo===test.code&&unchanged&&(test.status===403?!body.resultado:body.resultado==='rechazado');
   report.pruebas.push({origen:test.base,esperado:test.status,recibido:response.status,codigo:/^[A-Z_]+$/.test(body.codigo??'')?body.codigo:'CODIGO_NO_RECONOCIDO',etapa:test.etapa,registrosConservados:unchanged,comparacionAntes:before,comparacionDespues:after,aprobada:passed});
   ensure(passed,'BLOCKING_OR_PERSISTENCE_CHECK_FAILED');
 }
 report.causa='La petición a 127.0.0.1 lleva ese Origin, pero la URL reconstruida por Next usa localhost. El guard de origen devuelve 403 antes de llegar a la bandera de escritura; con localhost concordante llega a la bandera y devuelve 503. No se cambió el guard.';
}catch(e){report.bloqueo=/^[A-Z_0-9]+$/.test(e.message??'')?e.message:'FOCUSED_CHECK_FAILED';}
finally{
 if(server?.pid)try{command('taskkill.exe',['/PID',String(server.pid),'/T','/F']);}catch{}
 if(client)try{await client.auth.signOut({scope:'local'});}catch{}
 report.configuracionLocalConservada=JSON.stringify(originalConfigs)===JSON.stringify(hashes());
 report.aprobadas=report.pruebas.filter(x=>x.aprobada).length;report.fallidas=report.pruebas.filter(x=>!x.aprobada).length;
 const dir=join(root,'docs/evidencias/DI-152');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'ESCRITURA_BLOQUEADA.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pruebas:report.pruebas.map(({esperado,recibido,codigo,registrosConservados})=>({esperado,recibido,codigo,registrosConservados})),configuracionLocalConservada:report.configuracionLocalConservada,bloqueo:report.bloqueo??null}));
 if(report.bloqueo||report.aprobadas!==2||!report.configuracionLocalConservada)process.exitCode=1;
}
