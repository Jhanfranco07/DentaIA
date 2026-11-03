"""Reejecuta casos SQL/RPC y carreras de F3 sobre el paquete MVP limpio, no sobre F3."""
import importlib.util,json,os,subprocess,sys
from urllib.parse import urlsplit,unquote
from pathlib import Path
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parent;A=R.parent;C='supabase_db_DentaIA-arquitectura-fase2-qa';DB='dentaia_arch_qa_fase5'
OUT=R.parent/'qa_fase7' if '--fase7' in sys.argv else R.parent/'versionado_fase6' if '--fase6' in sys.argv else R
OUT.mkdir(exist_ok=True)
if os.environ.get('DOCKER_HOST')or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':raise SystemExit('LOCAL_ONLY')
def sql(s,check=True,db_user='postgres'):
 args=['docker','exec','-i',C,'psql','-X','-U','postgres','-d',DB,'-Atq','-v','ON_ERROR_STOP=1'];prefix=''
 if db_user=='authenticator':
  envs=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .Config.Env}}','supabase_rest_DentaIA-arquitectura-fase2-qa'],text=True))
  uri=next(x.split('=',1)[1]for x in envs if x.startswith('PGRST_DB_URI='));secret=unquote(urlsplit(uri).password)
  # La clave viaja por stdin, no por argumentos, logs ni archivos.
  args=['docker','exec','-i',C,'sh','-c','IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -h 127.0.0.1 -U authenticator -d dentaia_arch_qa_fase5 -Atq -v ON_ERROR_STOP=1']
  prefix=secret+'\n'
 p=subprocess.run(args,input=prefix+'\\set VERBOSITY verbose\n'+s,text=True,encoding='utf8',capture_output=True,timeout=90)
 if check and p.returncode:raise RuntimeError(p.stderr[:1800])
 return p
report={'fecha':'2026-11-03','base':DB,'pruebas':[],'metodo':'SQL con claims sintéticos y SET ROLE; no JWT HTTP'}
def record(name,ok,detail=None,category=None):
 report['pruebas'].append(dict(nombre=name,aprobado=bool(ok),detalle=detail,categoria=category));print(('PASS 'if ok else'FAIL ')+name,flush=True)
try:
 fixture=(A/'servicios_clinicos/pruebas/fixtures.sql').read_text(encoding='utf8').replace("current_database()<>'dentaia_arch_qa_fase3'","current_database()<>'dentaia_arch_qa_fase5'")
 sql(fixture)
 cases=json.loads((A/'servicios_clinicos/pruebas/casos.json').read_text(encoding='utf8'))
 for c in cases:
  p=sql('BEGIN; SET LOCAL plpgsql.check_asserts=on;\n'+c['sql']+'\nSET CONSTRAINTS ALL IMMEDIATE;ROLLBACK;',False,c.get('db_user','postgres'))
  expected=c.get('sqlstate');ok=(p.returncode!=0 and expected in p.stderr)if expected else p.returncode==0
  record(c['nombre'],ok,('SQLSTATE '+expected if expected else None)if ok else p.stderr[:1800],c['tipo'])
 spec=importlib.util.spec_from_file_location('carreras_mvp',A/'servicios_clinicos/pruebas/concurrencia.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 m.ejecutar(sql,record,C,DB)
 report['aprobadas']=sum(x['aprobado']for x in report['pruebas']);report['fallidas']=sum(not x['aprobado']for x in report['pruebas'])
except Exception as e:report['bloqueo']=str(e);raise
finally:
 history_path=OUT/'INTENTOS_SQL.json'
 history=json.loads(history_path.read_text(encoding='utf8'))if history_path.exists()else[]
 history.append(report)
 history_path.write_text(json.dumps(history,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 (OUT/'REGRESION_SQL.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if report.get('fallidas'):raise SystemExit(1)
