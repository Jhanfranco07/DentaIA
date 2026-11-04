"""Comprobación adicional de catálogo real local; exclusivamente SELECT."""
import json
import re
import subprocess
from pathlib import Path
R=Path(__file__).resolve().parent
ROOT=R.parent
CONTAINER='supabase_db_DentaIA-arquitectura-fase2-qa'
DB='dentaia_arch_qa_fase2'
def query(sql):
 p=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-U','postgres','-d',DB,'-Atq','-v','ON_ERROR_STOP=1'],input=sql,text=True,encoding='utf8',capture_output=True,check=True)
 return json.loads(p.stdout)
model=json.loads((ROOT/'MODELO_DATOS.json').read_text(encoding='utf8'))
constraints=query("""SELECT json_agg(r) FROM (
 SELECT n.nspname||'.'||t.relname AS name,c.contype,
 ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
 fn.nspname||'.'||ft.relname AS target,
 ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS references,
 c.confdeltype,c.convalidated,pg_get_constraintdef(c.oid) AS definition
 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace JOIN pg_class t ON t.oid=c.conrelid
 LEFT JOIN pg_class ft ON ft.oid=c.confrelid LEFT JOIN pg_namespace fn ON fn.oid=ft.relnamespace
 WHERE n.nspname IN ('public','clinical','ml','dentaia_admin')) r;""")
indexes=query("SELECT json_agg(r) FROM (SELECT schemaname||'.'||tablename AS name,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','clinical','ml','dentaia_admin')) r;")
def norm(s):return re.sub(r'[\s()]','',s).lower()
checks=[]
for t in model:
 cs=[c for c in constraints if c['name']==t['name']]
 ix=[i for i in indexes if i['name']==t['name']]
 errors=[]
 pk=[c['columns'] for c in cs if c['contype']=='p']
 if pk!=[t['primary_key']]:errors.append('PK')
 actual_unique={tuple(c['columns']) for c in cs if c['contype']=='u'}
 expected_unique={tuple(c) for c in t.get('unique',[])+t.get('candidate_keys_proposed',[])}
 if actual_unique!=expected_unique:errors.append('UNIQUE')
 delete={'r':'RESTRICT','a':'NO ACTION','c':'CASCADE','n':'SET NULL','d':'SET DEFAULT'}
 fk={(tuple(c['columns']),c['target'],tuple(c['references']),delete[c['confdeltype']]) for c in cs if c['contype']=='f'}
 expected={(tuple(c['columns']),c['target'],tuple(c['references']),c['on_delete']) for c in t.get('foreign_keys',[])}
 if fk!=expected:errors.append('FK o regla DELETE')
 if sum(c['contype']=='c' for c in cs)!=len(t.get('checks',[])):errors.append('Cantidad CHECK')
 if any(not c['convalidated'] for c in cs):errors.append('Restricción no validada')
 for expr in t.get('indexes_sql',[]):
  if not any(norm(expr) in norm(i['indexdef']) for i in ix):errors.append('Índice '+expr)
 if t['domain']=='existente':
  observed=json.loads((ROOT/'INVENTARIO_SUPABASE_VERIFICADO.json').read_text(encoding='utf8'))
  for idx in observed['indexes']:
   if 'public.'+idx['tablename']==t['name'] and not any(i['indexname']==idx['indexname'] and norm(i['indexdef'])==norm(idx['indexdef']) for i in ix):errors.append('Índice baseline '+idx['indexname'])
 if t['name'] in ['clinical.clinic_memberships','ml.dataset_items'] and sum(c['contype']=='x' for c in cs)!=1:errors.append('Exclusión GiST')
 checks.append(dict(nombre='PK/FK/UNIQUE/CHECK/índices: '+t['name'],categoria='catálogo completo PostgreSQL',aprobado=not errors,detalle=dict(restricciones=len(cs),indices=len(ix),errores=errors)))
out=dict(base=DB,comprobaciones=checks,aprobadas=sum(c['aprobado'] for c in checks),fallidas=sum(not c['aprobado'] for c in checks),restricciones=constraints,indices=indexes)
(R/'CATALOGO_VALIDADO.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(dict(aprobadas=out['aprobadas'],fallidas=out['fallidas'],errores=[c for c in checks if not c['aprobado']]),ensure_ascii=True))
raise SystemExit(1 if out['fallidas'] else 0)
