"""Bootstrap de la base HTTP LOCAL de CLI; no acepta URL ni credenciales remotas."""
import json
import os
import subprocess
import sys
from pathlib import Path
R=Path(__file__).resolve().parent
ARCH=R.parent
C='supabase_db_DentaIA-arquitectura-fase2-qa'
if os.environ.get('DOCKER_HOST')or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':raise SystemExit('LOCAL_DOCKER_REQUIRED')
def sql(query,db='postgres'):
 p=subprocess.run(['docker','exec','-i',C,'psql','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],input=query,text=True,encoding='utf8',capture_output=True)
 if p.returncode:raise RuntimeError('LOCAL_SQL_PREPARATION_FAILED: '+p.stderr[:1800])
 return p.stdout.strip()
mode=sys.argv[1]if len(sys.argv)>1 else'bootstrap'
marker=sql("SELECT coalesce(obj_description(oid,'pg_namespace'),'') FROM pg_namespace WHERE nspname='dentaia_http_qa';")
if mode=='bootstrap':
 if marker:
  if marker!='DENTAIA_PHASE4_SYNTHETIC_ONLY':raise SystemExit('UNOWNED_LOCAL_SCHEMA')
  print('BASE_HTTP_QA_YA_PREPARADA');raise SystemExit(0)
 if sql("SELECT count(*) FROM auth.users;")!='0'or sql("SELECT count(*) FROM pg_tables WHERE schemaname='public';")!='0':raise SystemExit('LOCAL_BASE_NOT_EMPTY_ABORTED')
 catalog=json.loads((ARCH/'INVENTARIO_SUPABASE_VERIFICADO.json').read_text(encoding='utf8'))
 statements=['SET search_path=public,auth,extensions;']
 for table in sorted({c['table_name']for c in catalog['columns']}):
  cols=sorted([c for c in catalog['columns']if c['table_name']==table],key=lambda c:c['ordinal_position'])
  defs=[c['column_name']+' '+c['data_type']+(' DEFAULT '+c['column_default']if c['column_default']else'')+(' NOT NULL'if c['is_nullable']=='NO'else'')for c in cols]
  statements.append('CREATE TABLE public.'+table+'('+','.join(defs)+');')
 for c in sorted(catalog['constraints'],key=lambda c:c['contype']=='f'):statements.append('ALTER TABLE public.'+c['table_name']+' ADD CONSTRAINT '+c['conname']+' '+c['definition']+';')
 for i in catalog['indexes']:statements.append(i['indexdef'].replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ').replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ')+';')
 for table in sorted({c['table_name']for c in catalog['columns']}):statements.append('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY;')
 for p in catalog['policies']:
  if p['schemaname']=='public':statements.append('CREATE POLICY '+p['policyname']+' ON public.'+p['tablename']+' FOR '+p['cmd']+' TO '+','.join(p['roles'])+(' USING('+p['qual']+')'if p['qual']else'')+(' WITH CHECK('+p['with_check']+')'if p['with_check']else'')+';')
 # Copia de estructura ya validada; no ejecutar guardas de migraciones contra postgres.
 dump=subprocess.check_output(['docker','exec',C,'pg_dump','-U','postgres','-d','dentaia_arch_qa_fase3','--schema-only','--schema=clinical','--schema=clinical_service'],text=True,encoding='utf8')
 dump=dump.replace('CREATE SCHEMA clinical_service;','CREATE SCHEMA clinical_service;\nGRANT USAGE,CREATE ON SCHEMA clinical_service TO dentaia_clinical_executor;')
 defs=json.loads(sql("SELECT json_agg(pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('grant_clinical_access','revoke_clinical_access','get_authorized_clinical_history');",'dentaia_arch_qa_fase3'))
 defs=[definition.replace('\r','')for definition in defs]
 signatures=['public.grant_clinical_access(uuid,uuid,uuid[],timestamptz,text,boolean)','public.revoke_clinical_access(uuid)','public.get_authorized_clinical_history(uuid,uuid,integer,timestamptz,uuid)']
 acl='REVOKE CREATE ON SCHEMA clinical_service FROM dentaia_clinical_executor; GRANT SELECT(id,full_name) ON public.profiles TO dentaia_clinical_executor; CREATE POLICY clinical_executor_provenance ON public.profiles FOR SELECT TO dentaia_clinical_executor USING(true);'
 acl+='REVOKE ALL ON FUNCTION '+','.join(signatures)+' FROM PUBLIC,anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION '+','.join(signatures)+' TO authenticated; CREATE SCHEMA dentaia_http_qa; REVOKE ALL ON SCHEMA dentaia_http_qa FROM PUBLIC,anon,authenticated,service_role; COMMENT ON SCHEMA dentaia_http_qa IS \'DENTAIA_PHASE4_SYNTHETIC_ONLY\'; NOTIFY pgrst,\'reload schema\';'
 sql('BEGIN; CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;\n'+'\n'.join(statements)+'\n'+dump+'\n'+';\n'.join(defs)+';\n'+acl+'\nCOMMIT;')
 print('BASE_HTTP_LOCAL_PREPARADA')
elif mode=='fixtures':
 if marker!='DENTAIA_PHASE4_SYNTHETIC_ONLY':raise SystemExit('QA_MARKER_REQUIRED')
 actors=json.load(sys.stdin)
 if set(actors)!=set(['patient1','patient2','dentist1','dentist2','nonprofessional','superuser']):raise SystemExit('INVALID_FIXTURE_ACTORS')
 for name,value in actors.items():
  import uuid
  uuid.UUID(value)
  if sql("SELECT count(*) FROM auth.users WHERE id='"+value+"' AND raw_app_meta_data->>'qa_http_actor'='"+name+"' AND raw_app_meta_data->>'qa_http_phase'='4';")!='1':raise SystemExit('SYNTHETIC_IDENTITY_NOT_CONFIRMED')
 text=(R/'fixtures.sql').read_text(encoding='utf8')
 for name,value in actors.items():text=text.replace('{{'+name+'}}',value)
 sql(text);print('FIXTURES_CLINICAS_LOCALES_PREPARADAS')
else:raise SystemExit('UNSUPPORTED_MODE')
