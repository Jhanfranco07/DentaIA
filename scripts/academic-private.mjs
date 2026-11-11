// Operador local exclusivamente. No importar desde src ni desde componentes de cliente.
import {loadEnvFile} from 'node:process';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const ref='vwmdknzjyvmsdqpepykz',dataset='fase8-synthetic-v1';
export const privateDir=join(process.env.LOCALAPPDATA,'DentaIA/credenciales/fase8');
export const vaultPath=join(privateDir,'cuentas-y-lote.json.dpapi');
const protector=join(root,'docs/arquitectura/integracion_fase8/proteger-backup.ps1');
export function command(bin,args,options={}){try{return execFileSync(bin,args,{windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024,...options});}catch{throw new Error('PRIVATE_OPERATOR_COMMAND_FAILED');}}
export function privateStorage(){
 if(resolve(privateDir).startsWith(root))throw new Error('PRIVATE_PATH_REQUIRED');mkdirSync(privateDir,{recursive:true});
 const sid=command('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value']).toString().trim();
 if(!/^S-1-5-[\d-]+$/.test(sid))throw new Error('PRIVATE_SID_REQUIRED');
 command('icacls.exe',[privateDir,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F']);
}
export const hasVault=()=>existsSync(vaultPath);
export function readVault(){return JSON.parse(command('powershell.exe',['-NoProfile','-NonInteractive','-File',protector,'-Mode','Unprotect','-Path',vaultPath]).toString());}
export function writeVault(value){privateStorage();command('powershell.exe',['-NoProfile','-NonInteractive','-File',protector,'-Mode','Protect','-Path',vaultPath],{input:Buffer.from(JSON.stringify(value))});const back=readVault();if(JSON.stringify(back)!==JSON.stringify(value))throw new Error('CREDENTIAL_STORAGE_VERIFICATION_FAILED');}
export function clients(){
 loadEnvFile(join(root,'.env.local'));const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET;
 if(new URL(url).origin!=='https://'+ref+'.supabase.co'||!secret||!key||secret===key)throw new Error('APPROVED_REMOTE_OPERATOR_CONFIG_REQUIRED');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 return{url,key,admin:createClient(url,secret,options),user:()=>createClient(url,key,options)};
}
export function sqlRemote(query){
 loadEnvFile(join(root,'.env.backup.local'));const u=new URL(process.env.DENTAIA_BACKUP_DATABASE_URL??'');
 const valid=u.hostname==='db.'+ref+'.supabase.co'&&decodeURIComponent(u.username)==='postgres'||u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)==='postgres.'+ref;
 if(!valid||!u.password||u.pathname!=='/postgres'||u.port&&u.port!=='5432')throw new Error('DATABASE_TARGET_MISMATCH');
 const ssl=u.searchParams.get('sslmode')??'require';if(!['require','verify-ca','verify-full'].includes(ssl))throw new Error('SSL_REQUIRED');
 const fields=[u.hostname,u.port||'5432',decodeURIComponent(u.username),decodeURIComponent(u.password),ssl,'postgres'];if(fields.some(x=>/[\r\n]/.test(x)))throw new Error('INVALID_DATABASE_FIELDS');
 const shell='IFS= read -r PGHOST; IFS= read -r PGPORT; IFS= read -r PGUSER; IFS= read -r PGPASSWORD; IFS= read -r PGSSLMODE; IFS= read -r PGDATABASE; export PGHOST PGPORT PGUSER PGPASSWORD PGSSLMODE PGDATABASE; export PGCONNECT_TIMEOUT=15; exec psql -X -Atq -v ON_ERROR_STOP=1';
 return command('docker',['exec','-i','supabase_db_DentaIA-arquitectura-fase2-qa','sh','-c',shell],{input:fields.join('\n')+'\n'+query}).toString().trim();
}
export function saveReport(name,value){writeFileSync(join(root,'docs/arquitectura/integracion_fase8',name),JSON.stringify(value,null,2)+'\n');}
