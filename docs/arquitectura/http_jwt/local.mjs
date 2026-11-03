import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const container='supabase_db_DentaIA-arquitectura-fase2-qa';
export const workdir=join(tmpdir(),'DentaIA-arquitectura-fase2-qa');
export function command(program,args,options={}) {
 try {return execFileSync(program,args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024,...options});}
 catch {throw new Error('LOCAL_COMMAND_FAILED:'+program.split(/[\\/]/).at(-1));}
}
export function assertLocal() {
 if(process.env.DOCKER_HOST||command('docker',['context','show']).trim()!=='desktop-linux')throw new Error('LOCAL_DOCKER_REQUIRED');
 const config=readFileSync(join(workdir,'supabase/config.toml'),'utf8');
 if(!config.includes('project_id = "DentaIA-arquitectura-fase2-qa"'))throw new Error('LOCAL_PROJECT_MISMATCH');
}
export function cli() {
 const base=join(process.env.LOCALAPPDATA,'npm-cache/_npx');
 for(const dir of readdirSync(base)) {
  const path=join(base,dir,'node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
  if(existsSync(path)&&command(path,['--version'],{cwd:workdir}).trim()==='3.0.0')return path;
 }
 throw new Error('EXISTING_CLI_3_REQUIRED');
}
export function status() {
 assertLocal();const raw=JSON.parse(command(cli(),['status','--output','json'],{cwd:workdir}));
 const url=raw.API_URL??raw.api_url;
 if(!url||!['http://127.0.0.1:54321','http://localhost:54321'].includes(url))throw new Error('LOCAL_API_REQUIRED');
 return {url,anon:raw.PUBLISHABLE_KEY??raw.publishable_key??raw.ANON_KEY??raw.anon_key,
  admin:raw.SECRET_KEY??raw.secret_key??raw.SERVICE_ROLE_KEY??raw.service_role_key};
}
export function sql(query,db='postgres') {
 assertLocal();if(!['postgres','dentaia_arch_qa_fase2','dentaia_arch_qa_fase3'].includes(db))throw new Error('INVALID_LOCAL_DATABASE');
 return command('docker',['exec','-i',container,'psql','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],{input:query}).trim();
}
export async function withShortTokens(callback) {
 assertLocal();const path=join(workdir,'supabase/config.toml'),original=readFileSync(path,'utf8');
 const expiry=Number(/^jwt_expiry\s*=\s*(\d+)/m.exec(original)?.[1]);
 if(!Number.isInteger(expiry))throw new Error('JWT_CONFIG_UNRECOGNIZED');
 const previous=[2,3].map(n=>sql("SELECT count(*) FROM clinical.clinical_encounters;",`dentaia_arch_qa_fase${n}`));
 const meta={expiryOriginal:expiry,expiryTesting:60,restored:false};
 const binary=cli();
 function restart() {
  command(binary,['stop'],{cwd:workdir,timeout:180000});
  command(binary,['start','--exclude','realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'],{cwd:workdir,timeout:240000});
  if([2,3].some((n,i)=>sql('SELECT count(*) FROM clinical.clinical_encounters;',`dentaia_arch_qa_fase${n}`)!==previous[i]))throw new Error('PRIOR_QA_DATA_MISMATCH');
 }
 try {
  writeFileSync(path,original.replace(/^jwt_expiry\s*=\s*\d+/m,'jwt_expiry = 60'));
  restart();return await callback(meta);
 } finally {
  writeFileSync(path,original);restart();
  if(readFileSync(path,'utf8')!==original)throw new Error('LOCAL_CONFIG_NOT_RESTORED');
  meta.restored=true;
 }
}
