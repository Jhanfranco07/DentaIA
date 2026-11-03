// Solo servidor de build LOCAL. No despliega ni consulta Vercel/Supabase remoto.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { command } from './local.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'../../..');
const p=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3105'],{cwd:root,env:{...process.env,NODE_ENV:'production',DENTAIA_CLINICAL_HTTP_ENABLED:'true',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','ignore','ignore'],windowsHide:true});
const result={nombre:'Build local mantiene API clínica cerrada en producción incluso con flag true',aprobado:false,http:null};
try{
 for(let n=0;n<40;n++){
  try{const r=await fetch('http://127.0.0.1:3105/api/clinical/patients/40000000-0000-4000-8000-000000000041/history');const d=await r.json();result.http=r.status;result.aprobado=r.status===404&&d.code==='NOT_FOUND'&&r.headers.get('cache-control')?.includes('no-store');break;}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
}finally{try{command('taskkill.exe',['/PID',String(p.pid),'/T','/F']);}catch{}writeFileSync(join(here,'PRODUCCION_CERRADA.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));if(!result.aprobado)process.exitCode=1;
