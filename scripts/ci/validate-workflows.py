"""Repository CI policy checks. Complements actionlint, not branch protection."""
from pathlib import Path
import re, yaml
for path in Path('.github/workflows').glob('*.yml'):
 doc=yaml.load(path.read_text(),Loader=yaml.BaseLoader)
 assert 'pull_request_target' not in doc.get('on',{}), f'{path}: evento privilegiado'
 jobs=doc['jobs']
 for scope,level in doc.get('permissions',{}).items(): assert level=='read',f'{path}: permiso excesivo {scope}'
 assert 'write-all' not in str(doc.get('permissions',{}))
 def visit(key, ancestors):
  assert key in jobs, f'{path}: dependencia inexistente {key}'
  assert key not in ancestors,f'{path}: ciclo {key}'
  needs=jobs[key].get('needs',[])
  if isinstance(needs,str): needs=[needs]
  for need in needs: visit(need,ancestors|{key})
 for key,job in jobs.items():
  visit(key,set())
  assert job.get('continue-on-error','false')=='false'
  for scope,level in job.get('permissions',{}).items(): assert level=='read'
  for step in job.get('steps',[]):
   assert step.get('continue-on-error','false')=='false'
   if 'uses' in step:
    assert re.fullmatch(r'[\w.-]+/[\w./-]+@[0-9a-f]{40}',step['uses']),f'{path}: acción sin SHA'
    if step['uses'].startswith('actions/checkout@'): assert step.get('with',{}).get('persist-credentials')=='false'
   text=str(step.get('run',''))
   assert not re.search(r'\b(supabase db (push|reset)|vercel (deploy|promote)|railway up)\b',text),f'{path}: despliegue no permitido'
   assert '${{ secrets.' not in str(step),f'{path}: secreto de producción no permitido'
 print(f'{path}: YAML, DAG acíclico, permisos y acciones correctos')
