// Read-only GitHub API observer. Never dispatches or publishes another workflow.
import {appendFileSync} from 'node:fs';
import {selectRun, gatePassed} from './workflow-state.mjs';
const workflow = process.argv[2];
if (!/^[a-z-]+\.yml$/.test(workflow)) throw new Error('Workflow inválido');
const {GITHUB_REPOSITORY: repo, TARGET_SHA: sha, TARGET_EVENT: event, TARGET_BRANCH: branch, GH_TOKEN: token} = process.env;
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('SHA inválido');
const headers = {Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
async function get(path) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {headers, signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
}
let selected;
for (let attempt=0; attempt<110; attempt++) {
  const query = new URLSearchParams({head_sha:sha, branch, per_page:'100'});
  // Manual observation can reuse a completed run for the exact same commit.
  if (event !== 'workflow_dispatch') query.set('event',event);
  const data = await get(`actions/workflows/${workflow}/runs?${query}`);
  selected=selectRun(data.workflow_runs,{sha,branch,event});
  if (selected?.status==='completed') break;
  console.log(`${workflow}: ${selected?.status ?? 'esperando ejecución del mismo SHA'}`);
  await new Promise(resolve=>setTimeout(resolve,20000));
}
if (!selected || selected.status!=='completed') throw new Error(`Timeout esperando ${workflow}; ejecutar el pipeline para este SHA, sin reutilizar resultados de otro commit`);
const jobs=[];
for(let page=1;;page++) {
 const data=await get(`actions/runs/${selected.id}/jobs?per_page=100&page=${page}`);
 jobs.push(...data.jobs); if(data.jobs.length<100)break;
}
const safe=v=>String(v).replace(/[|\r\n<>]/g,' ');
let summary=`## ${workflow}\nCommit: \`${sha}\` · Rama: \`${safe(branch)}\`\n\n[Ejecución real](${selected.html_url}) · Resultado: **${selected.conclusion}**\n\n| Job | Resultado | Duración (s) |\n| --- | --- | --- |\n`;
for (const j of jobs) summary+=`| ${safe(j.name)} | ${j.conclusion} | ${j.completed_at && j.started_at ? (Date.parse(j.completed_at)-Date.parse(j.started_at))/1000 : 'no disponible'} |\n`;
appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
if(!gatePassed(selected,jobs)) throw new Error(`Quality Gate fallido: ${workflow}`);
