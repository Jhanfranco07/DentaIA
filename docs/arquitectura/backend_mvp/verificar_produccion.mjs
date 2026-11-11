import{spawn}from'node:child_process';
import{writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
import{fileURLToPath}from'node:url';
import{createServer}from'node:net';
import{command}from'../http_jwt/local.mjs';
const outputDir=process.argv.includes('--fase8')?join(dirname(fileURLToPath(import.meta.url)),'../integracion_fase8'):process.argv.includes('--fase7')?join(dirname(fileURLToPath(import.meta.url)),'../qa_fase7'):dirname(fileURLToPath(import.meta.url));
const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'../../..');
const report={fecha:'2026-11-03',entorno:'build local NODE_ENV=production; flag=true',pruebas:[]};let child;
try{
 await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(3106,'127.0.0.1',()=>s.close(resolve));});
 child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3106'],{cwd:root,env:{...process.env,NODE_ENV:'production',DENTAIA_CLINICAL_HTTP_ENABLED:'true',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore',windowsHide:true});
 const paths=[['POST','/api/clinical/access-grants'],['POST','/api/clinical/access-grants/40000000-0000-4000-8000-000000000071/revoke'],['GET','/api/clinical/patients/40000000-0000-4000-8000-000000000041/history'],['GET','/api/clinical/patients/me'],['GET','/api/clinical/access-grants'],['GET','/api/professional/me'],['GET','/api/professional/patients'],['GET','/api/professional/requests']];
 let ready=false;
 for(let n=0;n<60;n++){try{await fetch('http://127.0.0.1:3106'+paths[0][1]);ready=true;break;}catch{}await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw new Error('LOCAL_BUILD_NOT_READY');
 for(const [method,path]of paths){const r=await fetch('http://127.0.0.1:3106'+path,{method,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});const data=await r.json();report.pruebas.push({method,path,http:r.status,aprobada:r.status===404&&data.code==='NOT_FOUND'&&r.headers.get('cache-control')?.includes('no-store')});}
}catch(e){report.bloqueo=e.message;}
finally{if(child?.pid)try{command('taskkill.exe',['/PID',String(child.pid),'/T','/F']);}catch{}report.aprobadas=report.pruebas.filter(x=>x.aprobada).length;writeFileSync(join(outputDir,'PRODUCCION_CERRADA.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));if(report.bloqueo||report.aprobadas!==8)process.exitCode=1;
