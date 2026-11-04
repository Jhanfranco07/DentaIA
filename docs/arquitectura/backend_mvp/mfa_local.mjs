// Configura únicamente TOTP del stack QA para el ensayo y restaura siempre el config original.
import{readFileSync,writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
import{fileURLToPath}from'node:url';
import{spawn}from'node:child_process';
import{createHash}from'node:crypto';
import{assertLocal,cli,command,workdir,sql}from'../http_jwt/local.mjs';
const outputDir=process.argv.includes('--fase8')?join(dirname(fileURLToPath(import.meta.url)),'../integracion_fase8'):process.argv.includes('--fase7')?join(dirname(fileURLToPath(import.meta.url)),'../qa_fase7'):dirname(fileURLToPath(import.meta.url));
const here=dirname(fileURLToPath(import.meta.url));assertLocal();
const file=join(workdir,'supabase/config.toml'),original=readFileSync(file,'utf8');
const before=[2,3].map(n=>sql('SELECT count(*) FROM clinical.clinical_encounters;',`dentaia_arch_qa_fase${n}`));
const patched=original.replace(/(\[auth\.mfa\.totp\][\s\S]*?enroll_enabled\s*=\s*)false/,'$1true').replace(/(\[auth\.mfa\.totp\][\s\S]*?verify_enabled\s*=\s*)false/,'$1true');
const meta={fecha:'2026-11-03',remoto:false,configOriginalSha256:createHash('sha256').update(original).digest('hex'),restaurado:false,testsExit:null};
function restart(){const exe=cli();command(exe,['stop'],{cwd:workdir,timeout:300000});command(exe,['start','--exclude','realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'],{cwd:workdir,timeout:300000});}
try{
 writeFileSync(file,patched);restart();
 meta.testsExit=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--experimental-strip-types',join(here,'validar_http_mvp.mjs'),...(process.argv.includes('--fase8')?['--fase8']:process.argv.includes('--fase7')?['--fase7']:[])],{cwd:join(here,'../../..'),windowsHide:true,stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});
}finally{
 writeFileSync(file,original);
 try{restart();meta.infraRestaurada=true;}catch{meta.infraRestaurada=false;meta.errorRestauracion='CLI_START_OR_STOP_FAILED_CHECK_LOCAL_STACK';process.exitCode=1;}
 meta.restaurado=readFileSync(file,'utf8')===original;
 try{meta.basesAnterioresPreservadas=[2,3].every((n,i)=>sql('SELECT count(*) FROM clinical.clinical_encounters;',`dentaia_arch_qa_fase${n}`)===before[i]);}catch{meta.basesAnterioresPreservadas=false;}
 writeFileSync(join(outputDir,'MFA_LOCAL_RESTAURACION.json'),JSON.stringify(meta,null,2)+'\n');
 console.log(JSON.stringify(meta));
}
if(meta.testsExit!==0||!meta.restaurado||!meta.basesAnterioresPreservadas)process.exitCode=1;
