import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectRun,gatePassed} from './workflow-state.mjs';
const success={id:1,head_sha:'a',head_branch:'feature/x',event:'pull_request',status:'completed',conclusion:'success'};
test('observador no reutiliza otro SHA, rama o evento',()=>{
 for(const changed of [{head_sha:'b'},{head_branch:'main'},{event:'push'}])
  assert.equal(selectRun([{...success,...changed}],{sha:'a',branch:'feature/x',event:'pull_request'}),undefined);
});
test('última ejecución pendiente/fallida prevalece sobre un verde antiguo',()=>{
 const latest={...success,id:2,status:'in_progress',conclusion:null};
 assert.equal(selectRun([success,latest],{sha:'a',branch:'feature/x',event:'pull_request'}),latest);
});
test('gate rechaza omisiones, cancelación, fallos y ausencia de jobs',()=>{
 for(const conclusion of ['skipped','cancelled','failure','timed_out',null])assert.equal(gatePassed(success,[{conclusion}]),false);
 assert.equal(gatePassed(success,[]),false);
 assert.equal(gatePassed({...success,conclusion:'failure'},[{conclusion:'success'}]),false);
 assert.equal(gatePassed(success,[{conclusion:'success'}]),true);
});
test('gate final Python falla aunque un solo control esté omitido',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ci-gate-'));
 try{
  for(const result of ['success','failure','skipped','cancelled']){
   const file=join(dir,'summary.md');
   const r=spawnSync('python',['scripts/ci/summary.py','--gate'],{env:{...process.env,GITHUB_STEP_SUMMARY:file,NEEDS_JSON:JSON.stringify({a:{result:'success'},b:{result}})}});
   assert.equal(r.status,result==='success'?0:1);
   assert.match(readFileSync(file,'utf8'),/Quality Gate/);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
