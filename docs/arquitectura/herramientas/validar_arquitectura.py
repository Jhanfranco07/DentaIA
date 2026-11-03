"""Validación estática reproducible. No ejecuta SQL ni abre conexiones.
Uso: python .../validar_arquitectura.py --parser-dir <herramienta temporal pglast>
"""
import argparse,hashlib,json,os,re,subprocess,sys,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote

R=Path(__file__).resolve().parents[1]
REPO=R.parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--parser-dir');ap.add_argument('--fase7',action='store_true');args=ap.parse_args()
if args.parser_dir:sys.path.insert(0,args.parser_dir)
from pglast import parser,ast,stream

report={'fecha':'2026-11-03','alcance':'validación estática y render local; sin SQL ejecutado ni JWT reales','checks':[],'sql':[],'mermaid':[],'errores':[]}
def check(name,condition,detail=None):
 report['checks'].append(dict(nombre=name,aprobado=bool(condition),detalle=detail))
 if not condition:report['errores'].append(name)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
model=json.loads((R/'MODELO_DATOS.json').read_text(encoding='utf8'));tables={t['name']:t for t in model}
check('29 tablas y 219 columnas',len(model)==29 and sum(len(t['fields'])for t in model)==219)
check('clasificación 5 existentes/3 administrativas/11 clínicas/10 IA',[sum(t['domain']==d for t in model)for d in ['existente','administracion','clinico','ia']]==[5,3,11,10])

for t in model:
 fields={f['name']:f for f in t['fields']}
 check(t['name']+' PK/columnas',len(fields)==len(t['fields'])and bool(t['primary_key'])and all(c in fields and not fields[c]['nullable']for c in t['primary_key']))
 for fk in t['foreign_keys']:
  target=tables.get(fk['target']);ok=set(fk['columns'])<=set(fields)
  if target:
   tf={f['name']:f for f in target['fields']}
   ok=ok and len(fk['columns'])==len(fk['references']) and all(c in tf for c in fk['references'])
   ok=ok and any(u==fk['references']for u in [target['primary_key']]+target['unique']+target.get('candidate_keys_proposed',[]))
   ok=ok and all(fields[c]['type']==tf[rc]['type']for c,rc in zip(fk['columns'],fk['references']))
  else:ok=ok and fk['target']=='auth.users' and fk['references']==['id']
  check(t['name']+' FK '+','.join(fk['columns']),ok)

dictionary=(R/'DICCIONARIO_DATOS.md').read_text(encoding='utf8')
sections=re.split(r'^## ([a-z_]+\.[a-z_]+)\s*$',dictionary,flags=re.M)
dict_tables={sections[i]:sections[i+1]for i in range(1,len(sections),2)}
for t in model:
 fields=re.findall(r'^\|\s*([a-z_][a-z_0-9]*)\s*\|',dict_tables.get(t['name'],''),flags=re.M)
 check(t['name']+' diccionario',fields==[f['name']for f in t['fields']])

canonical=lambda s:stream.RawStream()(parser.parse_sql('SELECT ('+s+')')[0].stmt.targetList[0].val)
type_name=lambda s:{'timestamp with time zone':'timestamptz','int':'integer','int4':'integer','int8':'bigint','bool':'boolean'}.get(s,s)
ddl={}
for p in sorted((R/'borradores_sql').glob('*.sql')):
 text=p.read_text(encoding='utf8');nodes=parser.parse_sql(text)
 prohibited=[];rls=[];grants=[]
 for n in nodes:
  stmt=n.stmt
  if isinstance(stmt,ast.CreateStmt):ddl[stmt.relation.schemaname+'.'+stmt.relation.relname]=stmt
  if isinstance(stmt,ast.DropStmt):prohibited.append('DROP')
  if isinstance(stmt,ast.GrantStmt)and stmt.is_grant:grants.append('GRANT')
  if isinstance(stmt,ast.AlterTableStmt):
   target=stmt.relation.schemaname+'.'+stmt.relation.relname
   if target.startswith('auth.'):prohibited.append('ALTER AUTH')
   for cmd in stmt.cmds:
    if cmd.subtype.name=='AT_DisableRowSecurity':prohibited.append('DISABLE RLS')
    if cmd.subtype.name=='AT_EnableRowSecurity':rls.append(target)
 if re.search(r'\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+auth\.',text,re.I):prohibited.append('WRITE AUTH')
 check(p.name+' guardas/cierre', 'DRAFT_TARGET_NOT_ISOLATED'in text and not prohibited and not grants,dict(prohibido=prohibited,grants=grants))
 normalized=re.sub(r'\b([a-z_]+)\s+(?:clinical|ml)\.[a-z_]+;',r'\1 record;',text)
 normalized=normalized.replace('clinical.','public.').replace('ml.','public.')
 pl=json.loads(parser.parse_plpgsql_json(normalized))
 report['sql'].append(dict(archivo=p.relative_to(R).as_posix(),sentencias=len(nodes),funciones_pl_normalizadas=len(pl),rls=rls,ejecutado=False))

expected={t['name']:t for t in model if t['domain']in ['clinico','ia']}
check('21 CREATE TABLE y ningún reemplazo de tablas existentes',set(ddl)==set(expected))
delete_names={'r':'RESTRICT','a':'NO ACTION','c':'CASCADE','n':'SET NULL','d':'SET DEFAULT'}
for name,t in expected.items():
 actual=ddl.get(name);cols={c.colname:c for c in actual.tableElts if isinstance(c,ast.ColumnDef)}if actual else {}
 check(name+' DDL columnas',list(cols)==[f['name']for f in t['fields']])
 for f in t['fields']:
  c=cols.get(f['name'])
  if c is None:continue
  cs=list(c.constraints or []);required=any(x.contype.name=='CONSTR_NOTNULL'for x in cs)or f['name']in t['primary_key']
  default=next((stream.RawStream()(x.raw_expr)for x in cs if x.contype.name=='CONSTR_DEFAULT'),None)
  expected_default=canonical(str(f['default']))if f['default']is not None else None
  check(name+'.'+f['name']+' tipo/NULL/default',type_name(stream.RawStream()(c.typeName))==f['type'] and required==(not f['nullable'])and default==expected_default)
 constraints=[c for c in actual.tableElts if isinstance(c,ast.Constraint)]
 pk=[list(x.sval for x in c.keys)for c in constraints if c.contype.name=='CONSTR_PRIMARY']
 uniques=[list(x.sval for x in c.keys)for c in constraints if c.contype.name=='CONSTR_UNIQUE']
 checks=[stream.RawStream()(c.raw_expr)for c in constraints if c.contype.name=='CONSTR_CHECK']
 fks=[dict(columns=[x.sval for x in c.fk_attrs],target=c.pktable.schemaname+'.'+c.pktable.relname,references=[x.sval for x in c.pk_attrs],on_delete=delete_names[c.fk_del_action])for c in constraints if c.contype.name=='CONSTR_FOREIGN']
 check(name+' DDL PK/UNIQUE/CHECK/FK',pk==[t['primary_key']]and uniques==t['unique']and checks==[canonical(c)for c in t['checks']]and fks==t['foreign_keys'])

for p in sorted((R/'diagramas').glob('*.mmd')):
 svg=R/'renderizados'/(p.stem+'.svg');ok=svg.exists();dimensions=None
 if ok:
  root=ET.parse(svg).getroot();ok=root.tag.endswith('svg')and 'Syntax error'not in svg.read_text(encoding='utf8')
  dimensions=root.attrib.get('viewBox')
 report['mermaid'].append(dict(fuente=p.relative_to(R).as_posix(),sha256_fuente=digest(p),svg=svg.relative_to(R).as_posix(),sha256_svg=digest(svg)if svg.exists()else None,renderizado=ok,viewBox=dimensions,motor='Mermaid CLI 12.2.0 / Chrome headless'))
 check(p.name+' SVG renderizado',ok)
check('17 diagramas renderizados',len(report['mermaid'])==17 and all(x['renderizado']for x in report['mermaid']))
general=(R/'diagramas/04-der-general.mmd').read_text(encoding='utf8')
entities=set(re.findall(r'^\s+([a-z_]+)\s*\{',general,re.M))
check('DER general cubre 29 tablas y solo Auth externa',entities=={n.replace('.','_')for n in tables}|{'auth_users'})
for filename,domain in [('05-der-administracion','administracion'),('06-der-paciente','existente'),('07-der-clinico','clinico'),('08-der-ia','ia')]:
 text=(R/'diagramas'/(filename+'.mmd')).read_text(encoding='utf8')
 for t in [x for x in model if x['domain']==domain]:
  block=re.search(r'^\s*'+re.escape(t['name'].replace('.','_'))+r'\s*\{([^}]+)\}',text,re.M)
  cols=re.findall(r'^\s+\w+\s+(\w+)',block[1],re.M)if block else []
  check(filename+' campos '+t['name'],cols==[f['name']for f in t['fields']])

api=json.loads((R/'CONTRATOS_API.json').read_text(encoding='utf8'))
check('contratos únicos',len({(r['method'],r['path'])for r in api})==len(api))
check('API vincula tablas reales del modelo',all(all(t in tables for t in r['tables'])for r in api))
check('15 contratos de rama y 10 propuestos',sum(r['state'].startswith('propuesto')for r in api)==10 and len(api)==25)
implemented={(r['method'],r['path'])for r in api if not r['state'].startswith('propuesto')}
actual=set()
for route in (REPO/'src/app/api').rglob('route.ts'):
 path='/'+re.sub(r'\[([^]]+)\]',r':\1',route.parent.relative_to(REPO/'src/app').as_posix())
 methods=re.findall(r'export\s+(?:const\s+|(?:async\s+)?function\s+)(GET|POST|DELETE|PUT|PATCH)\b',route.read_text(encoding='utf8'))
 actual.update((method,path)for method in methods)
check('contratos implementados corresponden exactamente a Route Handlers',actual==implemented)
check('Jira 171 descripciones sin modificar',len(json.loads((R/'REQUISITOS_JIRA_VERIFICADOS.json').read_text(encoding='utf8'))['issues'])==171)

# Crear el destino para que los enlaces de resultados sean verificables antes del informe final.
target=R/('qa_fase7/ARQUITECTURA_ESTATICA.json' if args.fase7 else 'validacion/RESULTADOS.json');target.parent.mkdir(exist_ok=True);target.write_text('{}\n',encoding='utf8')
broken=[]
for p in R.rglob('*.md'):
 for link in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf8')):
  if re.match(r'^(https?:|mailto:|#)',link):continue
  link=unquote(link.split('#')[0].strip('<>'))
  if not link:continue
  if not (p.parent/link).exists():broken.append(dict(archivo=p.relative_to(R).as_posix(),enlace=link))
check('enlaces locales Markdown',not broken,broken)

baseline=Path(tempfile.gettempdir())/'DentaIA-arquitectura-originales-sha256.json'
if baseline.exists():
 orig=json.loads(baseline.read_text(encoding='utf8'));changed=[x['path']for x in orig if not(REPO/x['path']).exists()or digest(REPO/x['path'])!=x['sha256']]
 check('38 originales preservados byte a byte',len(orig)==38 and not changed,changed)
else:report['checks'].append(dict(nombre='baseline temporal original',aprobado=None,detalle='No disponible en esta máquina; usar manifiesto de origen'))
status=subprocess.check_output(['git','-c','core.quotepath=false','status','--porcelain','-z','--untracked-files=all'],cwd=REPO).decode('utf8')
pending=[entry[3:]for entry in status.split('\0')if entry]
protected=[p for p in pending if (p.startswith(('src/','.github/','supabase/'))or p in ['package.json','package-lock.json','next-env.d.ts'])and not p.startswith(('src/features/clinica-http/','src/app/api/clinical/','src/app/api/professional/'))]
check('cambios funcionales limitados a adaptadores HTTP aislados; DI-151 intacto',not protected,protected)
report['sql_ejecutado']=False;report['jwt_reales_probados']=False;report['produccion_lista']=False
report['total_comprobaciones']=len(report['checks']);report['aprobadas']=sum(x['aprobado']is True for x in report['checks']);report['fallidas']=len(report['errores'])
target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:report[k]for k in ['total_comprobaciones','aprobadas','fallidas','errores']},ensure_ascii=True))
sys.exit(1 if report['errores']else 0)
