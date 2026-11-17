export function selectRun(runs, {sha, branch, event}) {
  return runs.filter(r => r.head_sha === sha && r.head_branch === branch && (event === 'workflow_dispatch' || r.event === event))
    .sort((a,b) => b.id-a.id)[0];
}
export function gatePassed(run, jobs) {
  return run?.status === 'completed' && run.conclusion === 'success' && jobs.length > 0 && jobs.every(j => j.conclusion === 'success');
}
