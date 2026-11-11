// Respaldo remoto de SOLO LECTURA; restauración exclusivamente en contenedor aislado.
// Secretos y datos privados viajan por memoria/stdin; nunca por argumentos ni logs.
import { loadEnvFile } from 'node:process';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocal, container } from '../http_jwt/local.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..');
const target='vwmdknzjyvmsdqpepykz', stamp=new Date().toISOString().replace(/[:.]/g,'-');
const base=join(process.env.LOCALAPPDATA,'DentaIA/respaldos/fase8');
const revalidate=process.argv.includes('--revalidar-ultimo');
let out=join(base,stamp);
if(revalidate){const candidates=readdirSync(base).map(n=>join(base,n)).filter(p=>statSync(p).isDirectory()&&existsSync(join(p,'postgresql-completo.dump.dpapi'))&&existsSync(join(p,'snapshot-resumen.json.dpapi'))).sort();if(candidates.length)out=candidates.at(-1);}
const result={fecha:'2026-11-03',target,operacionesRemotas:'SELECT/pg_dump/descarga Storage solamente',escriturasRemotas:0,backupCompleto:false,restauracionLocal:false,storageVerificado:false};
let connection, snapshotProcess, isolated;
let stage='preflight';
const connectionShell='IFS= read -r PGHOST; IFS= read -r PGPORT; IFS= read -r PGUSER; IFS= read -r PGPASSWORD; IFS= read -r PGSSLMODE; IFS= read -r PGDATABASE; export PGHOST PGPORT PGUSER PGPASSWORD PGSSLMODE PGDATABASE; export PGCONNECT_TIMEOUT=15; ';
const digest=b=>createHash('sha256').update(b).digest('hex');
const call=(bin,args,options={})=>{try{return execFileSync(bin,args,{windowsHide:true,maxBuffer:128*1024*1024,stdio:['pipe','pipe','pipe'],...options});}catch(e){
 if(args.includes('pg_restore')){
  const text=e.stderr?.toString()??'';
  const codes=[[/schema "[^"]+" already exists/,'RESTORE_SCHEMA_ALREADY_EXISTS'],[/extension "[^"]+" is not available/,'RESTORE_EXTENSION_UNAVAILABLE'],[/unrecognized configuration parameter/,'RESTORE_SETTING_UNAVAILABLE'],[/must be loaded via shared_preload_libraries/,'RESTORE_PRELOAD_REQUIRED'],[/role "[^"]+" does not exist/,'RESTORE_ROLE_MISSING'],[/permission denied/,'RESTORE_PERMISSION_DENIED'],[/function [^\n]+ does not exist/,'RESTORE_FUNCTION_MISSING']];
  const found=codes.find(([pattern])=>pattern.test(text));
  if(found){const line=text.match(/ERROR:\s*([^\r\n]+)/)?.[1];if(line)console.log(JSON.stringify({restoreDiagnostic:line.replace(/"[^"]*"|'[^']*'/g,'OBJECT').slice(0,220)}));throw new Error(found[1]);}
  const line=text.match(/ERROR:\s*([^\r\n]+)/)?.[1];
  if(line){const masked=line.replace(/"[^"]*"|'[^']*'/g,'OBJECT').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'IDENTITY');
   console.log(JSON.stringify({restoreDiagnostic:masked.slice(0,220)}));}
 }
 throw new Error('FAILED_'+bin.replace(/.*[\\/]/,'').replace(/\W/g,'_'));
}};
const docker=(args,options={})=>call('docker',args,options);
function remote(program,args=[],input=''){
 // Credenciales por stdin a variables libpq del proceso efímero, nunca por argv.
 const shell=connectionShell+'exec '+program+' '+args.map(x=>"'"+x.replace(/'/g,"'\\''")+"'").join(' ');
 return docker(['exec','-i',container,'sh','-c',shell],{input:connection+'\n'+input});
}
function protect(name,bytes){const path=join(out,name+'.dpapi');call('powershell.exe',['-NoProfile','-NonInteractive','-File',join(here,'proteger-backup.ps1'),'-Mode','Protect','-Path',path],{input:bytes});return path;}
function unprotect(path){return call('powershell.exe',['-NoProfile','-NonInteractive','-File',join(here,'proteger-backup.ps1'),'-Mode','Unprotect','-Path',path]);}
const tables=['public.profiles','public.dentists','public.appointment_requests','public.patient_consents','public.dental_photos','auth.users','auth.identities','auth.sessions','auth.mfa_factors','storage.buckets','storage.objects'];
const contentSummary="SELECT jsonb_build_object("+tables.map(t=>"'"+t+"',(SELECT jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),''))) FROM "+t+' x)').join(',')+") AS summary;";
function localSql(text,db='restore_dentalia'){return docker(['exec','-i',isolated,'psql','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],{input:text}).toString('utf8').trim();}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 if(!process.argv.includes('--crear-y-verificar')&&!revalidate)throw new Error('EXPLICIT_BACKUP_COMMAND_REQUIRED');
 assertLocal();loadEnvFile(join(root,'.env.backup.local'));
 const u=new URL(process.env.DENTAIA_BACKUP_DATABASE_URL??'');
 const direct=u.hostname==='db.'+target+'.supabase.co'&&decodeURIComponent(u.username)==='postgres';
 const pool=u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)==='postgres.'+target;
 if(!['postgres:','postgresql:'].includes(u.protocol)||(!direct&&!pool)||!u.password||(u.port&&u.port!=='5432')||u.pathname!=='/postgres')throw new Error('BACKUP_TARGET_MISMATCH');
 if(u.searchParams.has('sslmode')&&!['require','verify-ca','verify-full'].includes(u.searchParams.get('sslmode')))throw new Error('SSL_REQUIRED');
 u.searchParams.set('sslmode',u.searchParams.get('sslmode')??'require');
 const fields=[u.hostname,u.port||'5432',decodeURIComponent(u.username),decodeURIComponent(u.password),u.searchParams.get('sslmode'),'postgres'];
 if(fields.some(x=>/[\r\n]/.test(x)))throw new Error('INVALID_CONNECTION_FIELDS');connection=fields.join('\n');
 if(resolve(out).startsWith(root))throw new Error('BACKUP_MUST_BE_OUTSIDE_REPOSITORY');
 mkdirSync(out,{recursive:true});
 const sid=call('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value']).toString().trim();
 if(!/^S-1-5-[\d-]+$/.test(sid))throw new Error('LOCAL_SID_REQUIRED');
 call('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F']);
 let snapshot,dump,dumpPath;
 if(revalidate){
  dumpPath=join(out,'postgresql-completo.dump.dpapi');dump=unprotect(dumpPath);
  snapshot={data:JSON.parse(unprotect(join(out,'snapshot-resumen.json.dpapi')).toString())};
  result.dumpReutilizadoSinNuevaDescarga=true;
 }else{
 const summaryQuery=contentSummary.replace(/ AS summary;$/,'');
 const sql="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TIME ZONE 'UTC'; SELECT jsonb_build_object('snapshot',pg_export_snapshot(),'data',("+summaryQuery+"));\n";
 snapshotProcess=spawn('docker',['exec','-i',container,'sh','-c',connectionShell+'exec psql -X -Atq -v ON_ERROR_STOP=1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stderr='';snapshotProcess.stderr.on('data',b=>{stderr+=b.toString();});
 snapshotProcess.stdin.on('error',()=>{});
 stage='snapshot_lectura_remota';
 snapshot=await new Promise((resolve,reject)=>{
  let text='';const timeout=setTimeout(()=>reject(new Error('REMOTE_READ_CONNECTION_TIMEOUT')),45000);
  snapshotProcess.stdout.on('data',b=>{text+=b.toString();for(const line of text.split('\n'))if(line.startsWith('{')){try{const j=JSON.parse(line);clearTimeout(timeout);resolve(j);}catch{}}});
  snapshotProcess.once('exit',()=>{clearTimeout(timeout);reject(new Error(/Network is unreachable|No route to host|Connection timed out/.test(stderr)?'REMOTE_NETWORK_UNREACHABLE':/password authentication failed/.test(stderr)?'REMOTE_PASSWORD_REJECTED':/could not translate host name/.test(stderr)?'REMOTE_DNS_FAILED':/Tenant or user not found/.test(stderr)?'REMOTE_POOLER_TENANT_NOT_FOUND':'REMOTE_READ_CONNECTION_FAILED'));});
  snapshotProcess.stdin.write(connection+'\n'+sql);
 });
 stage='pg_dump_completo';
 dump=remote('pg_dump',['--format=custom','--snapshot='+snapshot.snapshot]);
 if(dump.subarray(0,5).toString()!=='PGDMP')throw new Error('CUSTOM_DUMP_REQUIRED');
 stage='cifrado_dump';
 dumpPath=protect('postgresql-completo.dump',dump);
 protect('snapshot-resumen.json',Buffer.from(JSON.stringify(snapshot.data)));
 result.dumpDescargadoYCifrado=true;
 }
 const roles=remote('psql',['-X','-Atq','-v','ON_ERROR_STOP=1'],"SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'login',rolcanlogin,'inherit',rolinherit,'bypassRls',rolbypassrls,'createRole',rolcreaterole,'createDb',rolcreatedb) ORDER BY rolname) FROM pg_roles WHERE left(rolname,3)<>'pg_';\n");
 const rolesPath=protect('roles-auxiliares-sin-contrasenas.json',roles);
 const memberships=remote('psql',['-X','-Atq','-v','ON_ERROR_STOP=1'],"SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option,'grantor',g.rolname) ORDER BY r.rolname,m.rolname),'[]') FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor;\n");
 const membershipsPath=protect('membresias-roles.json',memberships);
 const globals=remote('pg_dumpall',['--globals-only','--no-role-passwords']);
 const globalsPath=protect('globales-sin-contrasenas.sql',globals);
 if(snapshotProcess){snapshotProcess.stdin.end('ROLLBACK;\n');await new Promise(r=>snapshotProcess.once('exit',r));snapshotProcess=null;}
 stage='descifrado_dump';
 const restoredDump=unprotect(dumpPath);if(digest(restoredDump)!==digest(dump))throw new Error('BACKUP_ROUNDTRIP_MISMATCH');
 const image=docker(['inspect','--format','{{.Config.Image}}',container]).toString().trim();
 stage='postgres_aislado';
 isolated='dentaia-fase8-restauracion-'+randomBytes(5).toString('hex');
 docker(['run','--detach','--name',isolated,'--label','dentaia.phase8.private-restore=true','--network','none','--user','postgres','--tmpfs','/tmp:rw,mode=1777','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/dentaia-restore -U postgres --auth-local=trust --auth-host=reject >/tmp/init.log 2>&1 && exec postgres -D /tmp/dentaia-restore -k /tmp -c listen_addresses='' >/tmp/server.log 2>&1"]);
 let ready=false;for(let i=0;i<60;i++){try{docker(['exec',isolated,'pg_isready','-h','/tmp','-U','postgres']);ready=true;break;}catch{}await sleep(500);}
 if(!ready)throw new Error('ISOLATED_POSTGRES_NOT_READY');
 // Atributos internos originales solo en este PostgreSQL offline; NOLOGIN y sin contraseñas.
 // Los event triggers gestionados pueden requerir supabase_admin con sus atributos reales.
 const restoredRoles=JSON.parse(unprotect(rolesPath).toString());
 const roleSql=restoredRoles.filter(x=>x.name!=='postgres').map(x=>'CREATE ROLE "'+x.name.replaceAll('"','""')+'" NOLOGIN '+(x.superuser?'SUPERUSER':'NOSUPERUSER')+' '+(x.inherit?'INHERIT':'NOINHERIT')+' '+(x.bypassRls?'BYPASSRLS':'NOBYPASSRLS')+' '+(x.createRole?'CREATEROLE':'NOCREATEROLE')+' '+(x.createDb?'CREATEDB':'NOCREATEDB')+';').join('\n');
 docker(['exec','-i',isolated,'psql','-h','/tmp','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:roleSql+'\nCREATE DATABASE restore_dentalia;'});
 const quoted=n=>'"'+n.replaceAll('"','""')+'"';
 const restoredMemberships=JSON.parse(unprotect(membershipsPath).toString());
 const membershipSql=restoredMemberships.map(x=>'GRANT '+quoted(x.role)+' TO '+quoted(x.member)+' WITH ADMIN '+String(x.admin).toUpperCase()+', INHERIT '+String(x.inherit).toUpperCase()+', SET '+String(x.set).toUpperCase()+';').join('\n');
 docker(['exec','-i',isolated,'psql','-h','/tmp','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:membershipSql});
 stage='restauracion_aislada';
 docker(['exec','-i',isolated,'pg_restore','-h','/tmp','-U','postgres','-d','restore_dentalia','--exit-on-error'],{input:restoredDump});
 // psql usa el socket privado del contenedor, nunca TCP ni puertos publicados.
 stage='comparacion_contenido';
 const actual=JSON.parse(docker(['exec','-i',isolated,'psql','-h','/tmp','-X','-U','postgres','-d','restore_dentalia','-Atq','-v','ON_ERROR_STOP=1'],{input:"SET TIME ZONE 'UTC';\n"+contentSummary}).toString().trim());
 if(JSON.stringify(actual)!==JSON.stringify(snapshot.data))throw new Error('RESTORED_ROW_CONTENT_MISMATCH');
 result.backupCompleto=true;result.restauracionLocal=true;result.tablasContenidoVerificado=tables.length;
 result.registros=Object.fromEntries(Object.entries(actual).map(([k,v])=>[k,v.count]));
 result.dumpBytes=dump.length;result.dumpCifradoSha256=digest(readFileSync(dumpPath));
 result.globalesSinContrasenasRespaldados=true;result.membresiasRestauradas=restoredMemberships.length;
 result.limitacionRoles='Atributos y membresías recreados solo offline; contraseñas de login PostgreSQL excluidas. Globales completos archivados, no aplicados ciegamente sobre roles gestionados.';
 result.cifrado='Windows DPAPI CurrentUser, ACL SID actual y SYSTEM; necesita este perfil Windows para recuperar';
 // Respaldo de binarios por API Storage con credencial de operador SOLO servidor.
 stage='respaldo_binarios_storage';
 loadEnvFile(join(root,'.env.local'));
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET;
 if(new URL(url).origin!=='https://'+target+'.supabase.co'||!key)throw new Error('STORAGE_BACKUP_OPERATOR_CONFIG_REQUIRED');
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const buckets=await admin.storage.listBuckets();if(buckets.error)throw new Error('STORAGE_BUCKET_LIST_DENIED');
 const objects=[];
 async function walk(bucket,prefix=''){
  for(let offset=0;;offset+=100){const q=await admin.storage.from(bucket).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(q.error)throw new Error('STORAGE_LIST_FAILED');
   for(const entry of q.data){const path=prefix?prefix+'/'+entry.name:entry.name;if(!entry.id){await walk(bucket,path);continue;}
    const downloaded=await admin.storage.from(bucket).download(path);if(downloaded.error)throw new Error('STORAGE_DOWNLOAD_FAILED');const bytes=Buffer.from(await downloaded.data.arrayBuffer());
    objects.push({bucket,path,id:entry.id,updatedAt:entry.updated_at,metadata:entry.metadata,sha256:digest(bytes),bytes:bytes.toString('base64')});
   }if(q.data.length<100)break;
  }
 }
 for(const b of buckets.data)await walk(b.id);
 if(objects.length!==actual['storage.objects'].count)throw new Error('STORAGE_SNAPSHOT_COUNT_CHANGED');
 for(const item of objects){const parent=item.path.includes('/')?item.path.slice(0,item.path.lastIndexOf('/')):'',name=item.path.split('/').at(-1);const r=await admin.storage.from(item.bucket).list(parent,{search:name,limit:100});const latest=r.data?.find(x=>x.name===name);if(r.error||latest?.id!==item.id||latest?.updated_at!==item.updatedAt)throw new Error('STORAGE_CHANGED_DURING_BACKUP');}
 const storagePath=protect('storage-binarios-y-mapa.json',Buffer.from(JSON.stringify({buckets:buckets.data,objects})));
 const verify=JSON.parse(unprotect(storagePath).toString());
 if(!verify.objects.every(x=>digest(Buffer.from(x.bytes,'base64'))===x.sha256))throw new Error('STORAGE_BACKUP_INTEGRITY_FAILED');
 result.storageVerificado=true;result.archivosStorage=objects.length;result.bytesStorage=objects.reduce((n,x)=>n+Buffer.from(x.bytes,'base64').length,0);
 result.storageRestauracionAPIProbada=false;result.limitacionStorage='Descarga, cifrado/descifrado y hashes verificados; no se reinsertaron binarios por API ni se modificó metadata remota. No existe transacción compartida PostgreSQL/Storage.';
 result.archivosCifrados=[dumpPath,rolesPath,membershipsPath,globalsPath,storagePath].map(x=>({nombre:x.split(/[\\/]/).at(-1),sha256:digest(readFileSync(x))}));
 writeFileSync(join(out,'MANIFIESTO-PRIVADO.json'),JSON.stringify({resultado:result,carpeta:out},null,2));
 // Versionar solo agregado sin rutas de objetos, identidades, credenciales ni hashes de filas.
 writeFileSync(join(here,'RESPALDO_VERIFICADO.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({backupCompleto:true,restauracionLocal:true,storageVerificado:true,archivosStorage:objects.length,dumpBytes:dump.length,carpetaPrivada:out}));
}catch(e){
 result.etapa=stage;result.error=e.message?.match(/^[A-Z_0-9]+$/)?.[0]??'PRIVATE_BACKUP_FAILED';
 writeFileSync(join(here,'RESPALDO_VERIFICADO.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({error:result.error,etapa:stage,escriturasRemotas:0}));process.exitCode=1;
}finally{
 if(snapshotProcess&&snapshotProcess.exitCode===null&&!snapshotProcess.stdin.destroyed){snapshotProcess.stdin.end('ROLLBACK;\n');}
 if(isolated){try{const label=docker(['inspect','--format','{{index .Config.Labels "dentaia.phase8.private-restore"}}',isolated]).toString().trim();if(label==='true'&&isolated.startsWith('dentaia-fase8-restauracion-'))docker(['rm','--force','--volumes',isolated]);}catch{console.log('ISOLATED_CONTAINER_CLEANUP_REQUIRES_REVIEW');process.exitCode=1;}}
}
