"""Catálogo verificable del paquete MVP local, sin filas de usuarios ni contenido clínico."""
from pathlib import Path
import json,os,subprocess
R=Path(__file__).resolve().parent;DB='dentaia_arch_qa_fase5';C='supabase_db_DentaIA-arquitectura-fase2-qa'
if os.environ.get('DOCKER_HOST')or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':raise SystemExit('LOCAL_ONLY')
query="""SELECT json_build_object(
'columnas',(SELECT json_agg(x ORDER BY x.table_schema,x.table_name,x.ordinal_position) FROM (SELECT table_schema,table_name,column_name,ordinal_position,data_type,is_nullable FROM information_schema.columns WHERE table_schema IN ('public','clinical','dentaia_admin'))x),
'restricciones',(SELECT json_agg(x) FROM (SELECT n.nspname AS schema,t.relname AS tabla,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','clinical','dentaia_admin'))x),
'indices',(SELECT json_agg(x) FROM (SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','clinical','dentaia_admin'))x),
'politicas',(SELECT json_agg(x) FROM (SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','clinical','dentaia_admin'))x),
'funciones',(SELECT json_agg(x) FROM (SELECT n.nspname AS schema,p.proname,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS propietario FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('clinical','clinical_service','dentaia_admin'))x),
'sinRpcAnon',NOT has_function_privilege('anon','public.get_clinical_workspace(text,uuid,uuid,integer,text)','EXECUTE'),
'sinRpcServiceRole',NOT has_function_privilege('service_role','public.get_clinical_workspace(text,uuid,uuid,integer,text)','EXECUTE'),
'sinContenidoDirecto',NOT has_table_privilege('authenticated','clinical.clinical_encounters','SELECT'),
'sinContactoEjecutor',NOT has_column_privilege('dentaia_clinical_executor','public.appointment_requests','contact_email','SELECT'),
'sinCrearPrivados',NOT has_schema_privilege('authenticated','clinical_service','CREATE'));
"""
p=subprocess.run(['docker','exec','-i',C,'psql','-X','-U','postgres','-d',DB,'-Atq','-v','ON_ERROR_STOP=1'],input=query,text=True,encoding='utf8',capture_output=True,check=True)
d=json.loads(p.stdout);model=json.loads((R/'MODELO_MVP.json').read_text(encoding='utf8'));actual={(x['table_schema']+'.'+x['table_name'],x['column_name']):x for x in d['columnas']}
aliases={'timestamptz':'timestamp with time zone','time':'time without time zone'};errors=[]
for t in model['tablas']:
 for f in t['fields']:
  a=actual.get((t['name'],f['name']))
  if not a or a['data_type']!=aliases.get(f['type'],f['type'])or(a['is_nullable']=='YES')!=f['nullable']:errors.append(t['name']+'.'+f['name'])
assert not errors,errors
assert len(actual)==142 and len({x[0]for x in actual})==19
assert all(d[k]for k in ['sinRpcAnon','sinRpcServiceRole','sinContenidoDirecto','sinContactoEjecutor','sinCrearPrivados'])
d.update(fecha='2026-11-03',base=DB,camposContrastados=len(actual),erroresModelo=errors,remoto=False)
(R/'CATALOGO_MVP_VALIDADO.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'tablas':19,'campos':len(actual),'restricciones':len(d['restricciones']),'indices':len(d['indices']),'modeloCompatible':True,'ACLMinimos':True}))
