"""Fase 3: únicamente Docker Desktop local, nunca URLs/.env/servicios remotos."""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlsplit,unquote
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
PHASE=HERE.parent
ARCH=PHASE.parent
CONTAINER='supabase_db_DentaIA-arquitectura-fase2-qa'
DB='dentaia_arch_qa_fase3'
ap=argparse.ArgumentParser();ap.add_argument('--reset-qa',action='store_true');args=ap.parse_args()
if os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':
 raise SystemExit('Usar exclusivamente Docker Desktop local; no DOCKER_HOST remoto')
report=dict(inicio_utc=datetime.now(timezone.utc).isoformat(),base=DB,contenedor=CONTAINER,remoto=False,migraciones=[],pruebas=[],http_jwt_ejecutado=False)
_local_authenticator_password=None
def sql(text,db=DB,check=True,db_user='postgres'):
 global _local_authenticator_password
 if db_user not in ['postgres','authenticator']:raise RuntimeError('Rol de conexión no permitido')
 if db==DB:text="SET dentaia.architecture_draft='qa_only';\n"+text
 command=['docker','exec','-i'];environment=None;host=[]
 if db_user=='authenticator':
  # Credencial del REST LOCAL ya creado por CLI, solo memoria. Nunca .env ni tokens.
  if _local_authenticator_password is None:
   env_values=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .Config.Env}}','supabase_rest_DentaIA-arquitectura-fase2-qa'],text=True,encoding='utf8'))
   uri=next(v.split('=',1)[1]for v in env_values if v.startswith('PGRST_DB_URI='))
   parsed=urlsplit(uri)
   if parsed.username!='authenticator' or not parsed.password:raise RuntimeError('Configuración local de authenticator no reconocida')
   _local_authenticator_password=unquote(parsed.password)
  environment=dict(os.environ,PGPASSWORD=_local_authenticator_password)
  command+=['-e','PGPASSWORD'];host=['-h','127.0.0.1']
 command+=[CONTAINER,'psql','-X']+host+['-U',db_user,'-d',db,'-Atq','-v','ON_ERROR_STOP=1']
 p=subprocess.run(command,input=text,text=True,encoding='utf8',capture_output=True,timeout=120,env=environment)
 if check and p.returncode:raise RuntimeError(p.stderr.strip())
 return p
def record(name,ok,detail=None,kind='SQL RPC'):
 report['pruebas'].append(dict(nombre=name,aprobado=bool(ok),detalle=detail,tipo=kind))
 print(('PASS 'if ok else 'FAIL ')+name,flush=True)
def save():
 report['aprobadas']=sum(p['aprobado']for p in report['pruebas']);report['fallidas']=sum(not p['aprobado']for p in report['pruebas'])
 (HERE/'RESULTADOS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 p=HERE/'INTENTOS.json';history=json.loads(p.read_text(encoding='utf8'))if p.exists()else[]
 history.append(dict(inicio_utc=report['inicio_utc'],migraciones=report['migraciones'],aprobadas=report['aprobadas'],fallidas=report['fallidas'],bloqueo=report.get('bloqueo'),errores=[x for x in report['pruebas']if not x['aprobado']]))
 p.write_text(json.dumps(history,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def bootstrap():
 report['postgresql']=sql('SELECT version();','postgres').stdout.strip()
 exists=sql("SELECT count(*) FROM pg_database WHERE datname='"+DB+"';",'postgres').stdout.strip()=='1'
 if exists:
  if not args.reset_qa:raise RuntimeError('QA Fase 3 existe; --reset-qa recrea únicamente esta base')
  sql('DROP DATABASE '+DB+' WITH(FORCE);','postgres')
 sql('CREATE DATABASE '+DB+';','postgres')
 dump=subprocess.check_output(['docker','exec',CONTAINER,'pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=auth','--no-owner','--no-privileges'],text=True,encoding='utf8')
 sql('CREATE SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;')
 sql(dump)
 # Baseline MVP vacío desde catálogo, sin importar datos de ninguna base anterior.
 catalog=json.loads((ARCH/'INVENTARIO_SUPABASE_VERIFICADO.json').read_text(encoding='utf8'))
 tables=sorted({c['table_name']for c in catalog['columns']})
 statements=['SET search_path=public,auth,extensions;']
 for table in tables:
  columns=sorted([c for c in catalog['columns']if c['table_name']==table],key=lambda c:c['ordinal_position'])
  definitions=[c['column_name']+' '+c['data_type']+(' DEFAULT '+c['column_default']if c['column_default']else'')+(' NOT NULL'if c['is_nullable']=='NO'else'')for c in columns]
  statements.append('CREATE TABLE public.'+table+'('+','.join(definitions)+');')
 for c in sorted(catalog['constraints'],key=lambda c:c['contype']=='f'):
  statements.append('ALTER TABLE public.'+c['table_name']+' ADD CONSTRAINT '+c['conname']+' '+c['definition']+';')
 for i in catalog['indexes']:
  statements.append(i['indexdef'].replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ').replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ')+';')
 for table in tables:statements.append('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY;')
 for p in catalog['policies']:
  if p['schemaname']!='public':continue
  statements.append('CREATE POLICY '+p['policyname']+' ON public.'+p['tablename']+' FOR '+p['cmd']+' TO '+','.join(p['roles'])+(' USING('+p['qual']+')'if p['qual']else'')+(' WITH CHECK('+p['with_check']+')'if p['with_check']else'')+';')
 statements.append('GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;')
 sql('\n'.join(statements))
 # Fase clínica solamente. No aplicar administración, IA ni el prototipo de Fase 2.
 for path in sorted((ARCH/'borradores_sql').glob('0[1-4]_*.sql'))+sorted((PHASE/'sql').glob('*.sql')):
  p=sql(path.read_text(encoding='utf8'),check=False)
  report['migraciones'].append(dict(archivo=path.relative_to(ARCH).as_posix(),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),aprobada=p.returncode==0,error=p.stderr.strip()if p.returncode else None))
  if p.returncode:raise RuntimeError(path.name+': '+p.stderr.strip())
  print('APPLIED '+path.name,flush=True)
try:
 bootstrap()
 sql((HERE/'fixtures.sql').read_text(encoding='utf8'))
 for test in json.loads((HERE/'casos.json').read_text(encoding='utf8')):
  p=sql('\\set VERBOSITY verbose\nBEGIN; SET LOCAL plpgsql.check_asserts=on;\n'+test['sql']+'\nSET CONSTRAINTS ALL IMMEDIATE; ROLLBACK;',check=False,db_user=test.get('db_user','postgres'))
  state=test.get('sqlstate');ok=(p.returncode!=0 and state in p.stderr)if state else p.returncode==0
  record(test['nombre'],ok,p.stderr.strip()if not ok else ('SQLSTATE '+state if state else None),test.get('tipo','SQL RPC'))
 from concurrencia import ejecutar
 ejecutar(sql,record,CONTAINER,DB)
except Exception as exc:
 report['bloqueo']=str(exc);print('BLOQUEO '+str(exc),flush=True)
finally:save()
if report.get('bloqueo')or report['fallidas']:raise SystemExit(1)
