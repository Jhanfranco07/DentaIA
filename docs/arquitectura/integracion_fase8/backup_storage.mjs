// Descarga privada de solo lectura y verificación de recuperación de bytes en memoria.
// No sube archivos, no cambia buckets ni sustituye un ensayo de upload por API.
import { loadEnvFile } from 'node:process';
import { execFileSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..'),target='vwmdknzjyvmsdqpepykz';
const hash=b=>createHash('sha256').update(b).digest('hex');
const result={fecha:'2026-11-03',project:target,escriturasRemotas:0,apiRestauracionProbada:false};
const call=(bin,args,options={})=>{try{return execFileSync(bin,args,{windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:128*1024*1024,...options});}catch{throw new Error('PRIVATE_BACKUP_OPERATION_FAILED');}};
try{
 if(!process.argv.includes('--descargar-y-verificar'))throw new Error('EXPLICIT_STORAGE_BACKUP_REQUIRED');
 loadEnvFile(join(root,'.env.local'));
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET;
 if(new URL(url).origin!=='https://'+target+'.supabase.co'||!key)throw new Error('SERVER_OPERATOR_CONFIG_REQUIRED');
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const out=join(process.env.LOCALAPPDATA,'DentaIA/respaldos/fase8','storage-'+new Date().toISOString().replace(/[:.]/g,'-'));
 if(resolve(out).startsWith(root))throw new Error('OUTSIDE_REPOSITORY_REQUIRED');
 mkdirSync(out,{recursive:true});
 const sid=call('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value']).toString().trim();
 if(!/^S-1-5-[\d-]+$/.test(sid))throw new Error('WINDOWS_SID_REQUIRED');
 call('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F']);
 const buckets=await admin.storage.listBuckets();if(buckets.error)throw new Error('BUCKET_READ_DENIED');
 async function inventory(){
  const entries=[];
  async function walk(bucket,prefix=''){
   for(let offset=0;;offset+=100){const r=await admin.storage.from(bucket).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(r.error)throw new Error('STORAGE_LIST_DENIED');
    for(const entry of r.data){const path=prefix?prefix+'/'+entry.name:entry.name;if(!entry.id)await walk(bucket,path);else entries.push({bucket,path,id:entry.id,updatedAt:entry.updated_at,metadata:entry.metadata});}
    if(r.data.length<100)break;
   }
  }
  for(const b of buckets.data)await walk(b.id);
  return entries.sort((a,b)=>(a.bucket+'/'+a.path).localeCompare(b.bucket+'/'+b.path));
 }
 const before=await inventory(),objects=[];
 for(const entry of before){const r=await admin.storage.from(entry.bucket).download(entry.path);if(r.error)throw new Error('PRIVATE_FILE_DOWNLOAD_DENIED');const bytes=Buffer.from(await r.data.arrayBuffer());objects.push({...entry,sha256:hash(bytes),bytes:bytes.toString('base64')});}
 if(JSON.stringify(before)!==JSON.stringify(await inventory()))throw new Error('STORAGE_CHANGED_DURING_BACKUP');
 const path=join(out,'storage-binarios-y-mapa.json.dpapi');
 call('powershell.exe',['-NoProfile','-NonInteractive','-File',join(here,'proteger-backup.ps1'),'-Mode','Protect','-Path',path],{input:Buffer.from(JSON.stringify({buckets:buckets.data,objects}))});
 const decoded=call('powershell.exe',['-NoProfile','-NonInteractive','-File',join(here,'proteger-backup.ps1'),'-Mode','Unprotect','-Path',path]);
 const restored=JSON.parse(decoded.toString());
 if(restored.objects.length!==before.length||!restored.objects.every(x=>hash(Buffer.from(x.bytes,'base64'))===x.sha256))throw new Error('STORAGE_BINARY_RECOVERY_FAILED');
 Object.assign(result,{backupCifradoVerificado:true,archivos:objects.length,bytes:objects.reduce((n,x)=>n+Buffer.from(x.bytes,'base64').length,0),buckets:buckets.data.length,todosPrivados:buckets.data.every(x=>!x.public),sha256Cifrado:hash(readFileSync(path)),cifrado:'DPAPI CurrentUser; ACL usuario actual y SYSTEM',limitacion:'Bytes/manifest y estabilidad antes/despues comprobados; no upload de recuperacion por API ni transaccion atomica con PostgreSQL.'});
 writeFileSync(join(out,'MANIFIESTO-PRIVADO.json'),JSON.stringify({resultado:result,carpeta:out},null,2));
 console.log(JSON.stringify({verificado:true,archivos:result.archivos,bytes:result.bytes,carpetaPrivada:out}));
}catch(e){result.error=e.message?.match(/^[A-Z_]+$/)?.[0]??'PRIVATE_STORAGE_BACKUP_FAILED';console.log(JSON.stringify({error:result.error,escriturasRemotas:0}));process.exitCode=1;}
finally{writeFileSync(join(here,'RESPALDO_STORAGE.json'),JSON.stringify(result,null,2)+'\n');}
