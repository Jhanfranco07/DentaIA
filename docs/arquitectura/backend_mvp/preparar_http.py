"""Etapa HTTP local: conserva tablas existentes y exige marcador/cuentas propias de F4."""
from pathlib import Path
import hashlib,json,os,subprocess
R=Path(__file__).resolve().parent;A=R.parent;ROOT=A.parents[1];C='supabase_db_DentaIA-arquitectura-fase2-qa'
if os.environ.get('DOCKER_HOST')or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':raise SystemExit('LOCAL_DOCKER_REQUIRED')
def sql(s):
 p=subprocess.run(['docker','exec','-i',C,'psql','-X','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],input=s,text=True,encoding='utf8',capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr[:1600])
 return p.stdout.strip()
assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='dentaia_http_qa' AND obj_description(oid,'pg_namespace')='DENTAIA_PHASE4_SYNTHETIC_ONLY';")=='1'
assert sql("SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'qa_http_phase' IS DISTINCT FROM '4';")=='0'
if sql("SELECT to_regnamespace('dentaia_admin') IS NULL;")=='t':sql((ROOT/'supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql').read_text(encoding='utf8'))
migration=next(R.glob('*_di36_servicios_comunes_mvp.sql'))
if sql("SELECT to_regprocedure('public.get_clinical_workspace(text,uuid,uuid,integer,text)') IS NULL;")=='t':sql("SET dentaia.architecture_draft='qa_only';\n"+migration.read_text(encoding='utf8'))
catalog=json.loads((A/'INVENTARIO_SUPABASE_VERIFICADO.json').read_text(encoding='utf8'))
for p in catalog['policies']:
 if p['schemaname']=='storage' and sql("SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND policyname='"+p['policyname']+"';")=='0':
  sql('CREATE POLICY '+p['policyname']+' ON storage.objects FOR '+p['cmd']+' TO '+','.join(p['roles'])+(' USING('+p['qual']+')'if p['qual']else'')+(' WITH CHECK('+p['with_check']+')'if p['with_check']else'')+';')
sql("INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('dental-photos','dental-photos',false,8388608,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;")
assert sql("SELECT NOT public AND file_size_limit=8388608 AND allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] FROM storage.buckets WHERE id='dental-photos';")=='t'
report={'fecha':'2026-11-03','base':'postgres exclusivamente stack Docker QA marcado','remoto':False,'migracionIncremental':migration.name,'sha256':hashlib.sha256(migration.read_bytes()).hexdigest(),'bucketPrivado':True,'politicasStorage':3,'noSeRelajoRLS':True}
(R/'PREPARACION_HTTP.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(report))
