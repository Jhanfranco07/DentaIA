// Only inspect GitHub provider statuses and public HTTPS Preview. No provider token or publication.
import {appendFileSync} from 'node:fs';
const {GITHUB_REPOSITORY:repo,TARGET_SHA:sha,GH_TOKEN:token}=process.env;
const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'};
async function get(path){
 const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{headers,signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`GitHub API ${r.status}`);return r.json();
}
let vercel, statuses;
for(let attempt=0;attempt<50;attempt++){
 statuses=await get(`commits/${sha}/status?per_page=100`);
 vercel=statuses.statuses.find(s=>s.context==='Vercel');
 if(vercel && vercel.state!=='pending')break;
 await new Promise(r=>setTimeout(r,15000));
}
if(vercel?.state!=='success')throw new Error('Vercel no confirmó publicación correcta para el commit exacto');
const railway=statuses.statuses.filter(s=>s.target_url && /^https:\/\/railway\.(app|com)\//.test(s.target_url));
if(railway.some(s=>['failure','error'].includes(s.state)))throw new Error('Railway reportó fallo');
let text=`## Publicación observada\nCommit: \`${sha}\`\n\nVercel: **${vercel.state}**. [Evidencia del proveedor](${vercel.target_url}).\n\n`;
text+=railway.length ? 'Railway: '+railway.map(s=>`${s.state}: ${s.description}`).join('; ')+'. Un estado «No deployment needed» no acredita un despliegue nuevo.\n' : 'Railway: sin estado para este commit; no se acredita publicación ni disponibilidad del backend.\n';
if(process.argv.includes('--smoke')){
 const deployments=await get(`deployments?sha=${sha}&per_page=100`);
 let url;
 for(const d of deployments){
  const states=await get(`deployments/${d.id}/statuses?per_page=100`);
  const state=states[0];
  if(state?.state==='success' && state.environment_url){
   const candidate=new URL(state.environment_url);
   // Restrict to public Preview hosts; never send GitHub authorization to provider.
   if(candidate.protocol==='https:' && candidate.hostname.endsWith('.vercel.app') && !candidate.username && !candidate.password){url=candidate;break;}
  }
 }
 if(url){
  const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
  if(r.status===401 || r.status===403) text+='HTTP Preview: protegida; prueba funcional no ejecutada (sin bypass ni secretos).\n';
  else if(r.status>=200 && r.status<400)text+=`HTTP Preview: ${r.status}. Comprueba disponibilidad HTTP, no autenticación ni pagos.\n`;
  else throw new Error(`Preview HTTP ${r.status}`);
 } else text+='HTTP Preview: URL pública no disponible en Deployments API; prueba no ejecutada. Estado del proveedor verificado por separado.\n';
}
text+='\nProduction: no se ejecuta promoción ni despliegue desde este workflow. Revisión y autorización externas necesarias.\n';
appendFileSync(process.env.GITHUB_STEP_SUMMARY,text);
