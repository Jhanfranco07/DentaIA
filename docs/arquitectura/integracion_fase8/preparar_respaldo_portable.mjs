// Offline: convierte copias DPAPI existentes, prueba descifrado Linux y restaura PostgreSQL.
// No carga .env ni usa red/Supabase remoto. Datos y clave nunca aparecen en argv/logs.
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createCipheriv,randomBytes,randomUUID,createHash } from 'node:crypto';
import { assertLocal,container } from '../http_jwt/local.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..');
const source=join(process.env.LOCALAPPDATA,'DentaIA/respaldos/fase8/2026-11-04T00-09-59-697Z');
const keyId=randomUUID(),stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=join(process.env.LOCALAPPDATA,'DentaIA/respaldos-portables/fase8',stamp);
const custody=join(process.env.LOCALAPPDATA,'DentaIA/custodia-claves/fase8',keyId);
const result={fecha:'2026-11-03',project:'vwmdknzjyvmsdqpepykz',escriturasRemotas:0,lecturasRemotas:0,cifrado:'AES-256-GCM',keyId,dependeDPAPIParaRecuperar:false,restauracionAislada:false};
let isolated,key,stage='preflight';
const hash=b=>createHash('sha256').update(b).digest('hex');
const call=(bin,args,options={})=>{try{return execFileSync(bin,args,{windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:128*1024*1024,...options});}catch(error){const code=error.stderr?.toString().match(/PORTABLE_RECOVERY_FAILED:([A-Z_]+)/)?.[1];throw new Error(code??'LOCAL_OPERATION_FAILED');}};
const docker=(args,options={})=>call('docker',args,options);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function privateDir(path){
 if(resolve(path).startsWith(root))throw new Error('OUTSIDE_GIT_REQUIRED');
 mkdirSync(path,{recursive:true,mode:0o700});
 const sid=call('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value']).toString().trim();
 if(!/^S-1-5-[\d-]+$/.test(sid))throw new Error('SID_REQUIRED');
 call('icacls.exe',[path,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F']);
}
try{
 if(!process.argv.includes('--crear-y-probar'))throw new Error('EXPLICIT_COMMAND_REQUIRED');
 assertLocal();privateDir(out);privateDir(custody);
 const baseline=JSON.parse(readFileSync(join(here,'RESPALDO_VERIFICADO.json'),'utf8'));
 const files=[];stage='lectura_dpapi_existente';
 const entries=[...baseline.archivosCifrados,{nombre:'snapshot-resumen.json.dpapi'}];
 for(const entry of entries){
  const path=join(source,entry.nombre),cipher=readFileSync(path);
  if(entry.sha256&&hash(cipher)!==entry.sha256)throw new Error('ORIGINAL_BACKUP_HASH_MISMATCH');
  const bytes=call('powershell.exe',['-NoProfile','-NonInteractive','-File',join(here,'proteger-backup.ps1'),'-Mode','Unprotect','-Path',path]);
  files.push({name:entry.nombre.replace(/\.dpapi$/,''),sha256:hash(bytes),data:bytes.toString('base64')});
 }
 const payload=Buffer.from(JSON.stringify({format:'DENTAIA-CONTENTS-v1',files}));
 key=randomBytes(32);const nonce=randomBytes(12);
 const header={format:'DENTAIA-PORTABLE-v1',algorithm:'AES-256-GCM',project:result.project,keyId,createdAt:new Date().toISOString()};
 const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(JSON.stringify(header)));
 const ciphertext=Buffer.concat([cipher.update(payload),cipher.final()]);
 const envelope={header,nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
 const bundle=join(out,'dentalia-fase8.portable.json'),keyPath=join(custody,'dentalia-fase8.recovery.key');
 writeFileSync(bundle,JSON.stringify(envelope),{flag:'wx',mode:0o600});writeFileSync(keyPath,key,{flag:'wx',mode:0o600});
 // Usar los bytes releídos del disco, no solo los buffers recién generados.
 const diskEnvelope=JSON.parse(readFileSync(bundle,'utf8')),diskKey=readFileSync(keyPath);
 const nodeImage=docker(['image','inspect','node:22-alpine','--format','{{index .RepoDigests 0}}']).toString().trim();
 if(!/^node@sha256:[a-f0-9]{64}$/.test(nodeImage))throw new Error('OFFICIAL_PINNED_NODE_REQUIRED');
 const decryptSource=readFileSync(join(here,'descifrar_portable.mjs'),'utf8');
 const decrypt=(env,k,verify=false)=>docker(['run','--rm','-i','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','128m','--pids-limit','64','--user','node',nodeImage,'node','--input-type=module','--eval',decryptSource,'--',verify?'--verify-only':'--stdin-private-pipe'],{input:JSON.stringify({key:k.toString('base64'),envelope:env})});
 stage='descifrado_linux_sin_dpapi';
 const recovered=JSON.parse(decrypt(diskEnvelope,diskKey).toString());
 if(recovered.files.length!==files.length||!recovered.files.every(x=>hash(Buffer.from(x.data,'base64'))===x.sha256))throw new Error('PORTABLE_CONTENT_MISMATCH');
 const badKey=Buffer.from(diskKey);badKey[0]^=1;let keyRejected=false;
 try{decrypt(diskEnvelope,badKey,true);}catch(error){keyRejected=error.message==='AUTH_OR_FORMAT_ERROR';}badKey.fill(0);
 const badEnvelope=structuredClone(diskEnvelope),bad=Buffer.from(badEnvelope.ciphertext,'base64');bad[0]^=1;badEnvelope.ciphertext=bad.toString('base64');let tamperRejected=false;
 try{decrypt(badEnvelope,diskKey,true);}catch(error){tamperRejected=error.message==='AUTH_OR_FORMAT_ERROR';}
 if(!keyRejected||!tamperRejected)throw new Error('AEAD_NEGATIVE_CHECK_FAILED');
 diskKey.fill(0);
 const get=n=>{const f=recovered.files.find(x=>x.name===n);if(!f)throw new Error('ARCHIVE_FILE_MISSING');return Buffer.from(f.data,'base64');};
 stage='restauracion_postgresql_offline';
 const image=docker(['inspect','--format','{{.Config.Image}}',container]).toString().trim();
 isolated='dentaia-portable-restore-'+randomBytes(6).toString('hex');
 docker(['run','--detach','--name',isolated,'--label','dentaia.portable-restore=true','--network','none','--user','postgres','--tmpfs','/tmp:rw,mode=1777','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/portable-restore -U postgres --auth-local=trust --auth-host=reject >/tmp/init.log 2>&1 && exec postgres -D /tmp/portable-restore -k /tmp -c listen_addresses='' >/tmp/server.log 2>&1"]);
 let ready=false;for(let i=0;i<60;i++){try{docker(['exec',isolated,'pg_isready','-h','/tmp','-U','postgres']);ready=true;break;}catch{}await sleep(500);}
 if(!ready)throw new Error('OFFLINE_POSTGRES_NOT_READY');
 const q=n=>'"'+n.replaceAll('"','""')+'"';
 const roles=JSON.parse(get('roles-auxiliares-sin-contrasenas.json').toString());
 const roleSql=roles.filter(x=>x.name!=='postgres').map(x=>'CREATE ROLE '+q(x.name)+' NOLOGIN '+(x.superuser?'SUPERUSER':'NOSUPERUSER')+' '+(x.inherit?'INHERIT':'NOINHERIT')+' '+(x.bypassRls?'BYPASSRLS':'NOBYPASSRLS')+' '+(x.createRole?'CREATEROLE':'NOCREATEROLE')+' '+(x.createDb?'CREATEDB':'NOCREATEDB')+';').join('\n');
 const memberships=JSON.parse(get('membresias-roles.json').toString());
 const grants=memberships.map(x=>'GRANT '+q(x.role)+' TO '+q(x.member)+' WITH ADMIN '+String(x.admin).toUpperCase()+', INHERIT '+String(x.inherit).toUpperCase()+', SET '+String(x.set).toUpperCase()+';').join('\n');
 const sql=(s,db='postgres')=>docker(['exec','-i',isolated,'psql','-h','/tmp','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],{input:s}).toString().trim();
 sql(roleSql+'\n'+grants+'\nCREATE DATABASE portable_dentalia;');
 docker(['exec','-i',isolated,'pg_restore','-h','/tmp','-U','postgres','-d','portable_dentalia','--exit-on-error'],{input:get('postgresql-completo.dump')});
 const tables=['public.profiles','public.dentists','public.appointment_requests','public.patient_consents','public.dental_photos','auth.users','auth.identities','auth.sessions','auth.mfa_factors','storage.buckets','storage.objects'];
 const summary="SELECT jsonb_build_object("+tables.map(t=>"'"+t+"',(SELECT jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),''))) FROM "+t+' x)').join(',')+");";
 const actual=JSON.parse(sql("SET TIME ZONE 'UTC';\n"+summary,'portable_dentalia')),expected=JSON.parse(get('snapshot-resumen.json').toString());
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('PORTABLE_DATABASE_CONTENT_MISMATCH');
 const storage=JSON.parse(get('storage-binarios-y-mapa.json').toString());
 if(storage.objects.length!==actual['storage.objects'].count||!storage.objects.every(x=>hash(Buffer.from(x.bytes,'base64'))===x.sha256))throw new Error('PORTABLE_STORAGE_CONTENT_MISMATCH');
 result.restauracionAislada=true;result.descifradoLinuxCorrecto=true;result.archivosRecuperados=recovered.files.length;
 result.tablasComparadas=tables.length;result.membresiasRestauradas=memberships.length;result.storageArchivos=storage.objects.length;
 result.storageBytes=storage.objects.reduce((n,x)=>n+Buffer.from(x.bytes,'base64').length,0);
 result.claveIncorrectaRechazada=keyRejected;result.manipulacionRechazada=tamperRejected;
 result.bundleSha256=hash(readFileSync(bundle));result.bundleBytes=readFileSync(bundle).length;result.nodeImage=nodeImage;
 result.claveFueraRepositorio=true;result.claveEnCarpetaSeparada=true;result.copiaOffsiteComprobada=false;result.storageUploadRestoreProbado=false;
 const privateManifest={resultado:result,bundle,keyPath,nota:'Trasladar respaldo y clave a ubicaciones independientes. Quien posea ambos puede descifrar datos privados.'};
 writeFileSync(join(out,'MANIFIESTO-PORTABLE.json'),JSON.stringify(privateManifest,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({ok:true,bundle,keyPath,archivos:result.archivosRecuperados,tablas:result.tablasComparadas,storage:result.storageArchivos}));
}catch(error){result.error=/^[A-Z_]+$/.test(error.message??'')?error.message:'PORTABLE_BACKUP_CHECK_FAILED';result.etapa=stage;console.log(JSON.stringify({ok:false,etapa:stage,error:result.error,escriturasRemotas:0}));process.exitCode=1;}
finally{
 if(key)key.fill(0);
 if(isolated){try{const label=docker(['inspect','--format','{{index .Config.Labels "dentaia.portable-restore"}}',isolated]).toString().trim();if(label==='true'&&isolated.startsWith('dentaia-portable-restore-'))docker(['rm','--force','--volumes',isolated]);}catch{result.errorLimpiezaLocal=true;process.exitCode=1;}}
 writeFileSync(join(here,'RESPALDO_PORTABLE_VERIFICADO.json'),JSON.stringify(result,null,2)+'\n');
}
