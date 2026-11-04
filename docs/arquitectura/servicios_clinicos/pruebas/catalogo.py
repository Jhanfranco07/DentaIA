"""Inspección SELECT local del código/ACL de RPC, sin filas clínicas ni secretos."""
import json
import subprocess
from pathlib import Path
HERE=Path(__file__).resolve().parent
query="""SELECT json_build_object(
 'version',current_setting('server_version'),
 'funciones',(SELECT json_agg(x) FROM (SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS firma,p.prosecdef,p.provolatile,p.proconfig,pg_get_userbyid(p.proowner) AS owner,p.proacl,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='clinical_service' OR (n.nspname='public' AND p.proname IN ('grant_clinical_access','revoke_clinical_access','get_authorized_clinical_history')) ORDER BY n.nspname,p.proname)x),
 'rol_ejecutor',(SELECT json_agg(x) FROM (SELECT rolname,rolsuper,rolbypassrls,rolcanlogin,rolinherit FROM pg_roles WHERE rolname='dentaia_clinical_executor')x),
 'politicas',(SELECT json_agg(x) FROM (SELECT schemaname,tablename,policyname,cmd,roles,qual,with_check FROM pg_policies WHERE 'dentaia_clinical_executor'=ANY(roles) ORDER BY schemaname,tablename,policyname)x),
 'tablas',(SELECT json_agg(x) FROM (SELECT n.nspname,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('clinical','public') AND c.relkind='r' ORDER BY n.nspname,c.relname)x),
 'columnas',(SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('clinical','public')),
 'sin_IA',(SELECT count(*)=0 FROM pg_namespace WHERE nspname='ml'),
 'sin_admin_DI151',(SELECT count(*)=0 FROM pg_namespace WHERE nspname='dentaia_admin')
);"""
p=subprocess.run(['docker','exec','-i','supabase_db_DentaIA-arquitectura-fase2-qa','psql','-X','-U','postgres','-d','dentaia_arch_qa_fase3','-Atq','-v','ON_ERROR_STOP=1'],input=query,text=True,encoding='utf8',capture_output=True,check=True)
d=json.loads(p.stdout)
assert len(d['tablas'])==16 and d['columnas']==120 and all(x['relrowsecurity']for x in d['tablas'])
assert d['sin_IA']and d['sin_admin_DI151']
assert all(not x['prosecdef']for x in d['funciones']if x['nspname']=='public')
assert all(not x['anon_execute']and not x['service_execute']for x in d['funciones'])
assert all(not x['authenticated_execute']for x in d['funciones']if x['nspname']=='clinical_service'and x['proname']not in ['grant_access','revoke_access','read_history'])
assert all('search_path=""'in x['proconfig']for x in d['funciones'])
assert not any(d['rol_ejecutor'][0][key]for key in ['rolsuper','rolbypassrls','rolcanlogin'])
(HERE/'CATALOGO_RPC.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Catálogo RPC: 16 tablas/120 columnas; RLS activo; wrappers INVOKER; ejecutor NOLOGIN/NOBYPASSRLS; sin IA ni DI-151')
