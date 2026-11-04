"""Metadatos mínimos del banco local; nunca inspecciona variables de contenedores."""
import json
import subprocess
from pathlib import Path
def command(args):return subprocess.check_output(args,text=True,encoding='utf8').strip()
container='supabase_db_DentaIA-arquitectura-fase2-qa'
images=['postgres:17.11.0.011','gotrue:v2.197.0','postgrest:v16.5','storage-api:v1.88.0','kong:2.8.1','realtime:v2.151.3']
d={'docker':json.loads(command(['docker','version','--format','{{json .}}']))['Server']['Version'],'imagenes':[]}
for image in images:
 name='public.ecr.aws/supabase/'+image
 d['imagenes'].append(dict(nombre=name,digests=json.loads(command(['docker','image','inspect','--format','{{json .RepoDigests}}',name]))))
sql="""SELECT json_build_object('postgresql',current_setting('server_version'),'roles',
 (SELECT json_agg(r) FROM (SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role'))r),
 'columnas_auth',(SELECT count(*) FROM information_schema.columns WHERE table_schema='auth' AND table_name IN ('users','sessions','mfa_factors','mfa_amr_claims')));"""
d['catalogo_local']=json.loads(command(['docker','exec',container,'psql','-X','-U','postgres','-d','postgres','-Atc',sql]))
d['sin_credenciales_remotas']=True
d['servicios_http_base']='postgres'
d['base_pruebas_sql']='dentaia_arch_qa_fase2'
(Path(__file__).resolve().parent/'ENTORNO.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Entorno local registrado; no variables, claves ni filas personales')
