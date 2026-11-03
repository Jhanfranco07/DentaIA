"""Inicialización QA local desde vacío. No acepta URL/ref/secretos remotos."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
R=Path(__file__).resolve().parent; ARCH=R.parent; ROOT=ARCH.parents[1]
C='supabase_db_DentaIA-arquitectura-fase2-qa'; DB='dentaia_arch_qa_fase5'
OUT=R.parent/'versionado_fase6' if '--fase6' in sys.argv else R
OUT.mkdir(exist_ok=True)
if os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':raise SystemExit('LOCAL_DOCKER_REQUIRED')
def sql(s,db=DB):
    assert db in (DB,'postgres')
    p=subprocess.run(['docker','exec','-i',C,'psql','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],input=s,text=True,encoding='utf8',capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr[:2400])
    return p.stdout.strip()
incremental=next(R.glob('*_di36_servicios_comunes_mvp.sql'))
package=[ROOT/'supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql']+[ARCH/'borradores_sql'/n for n in ['01_clinical_identidad.sql','02_clinical_contenido.sql','03_clinical_permisos_auditoria.sql','04_clinical_integridad.sql']]+sorted((ARCH/'servicios_clinicos/sql').glob('*.sql'))+[incremental]
report={'fecha':'2026-11-03','base':DB,'remoto':False,'migraciones':[]}
try:
    if sql("SELECT count(*) FROM pg_database WHERE datname='"+DB+"';",'postgres')!='0':
        if '--recrear-qa-propia' not in sys.argv:raise RuntimeError('QA_EXISTS_NO_AUTOMATIC_RESET')
        marker=sql("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname='"+DB+"';",'postgres')
        if marker!='DENTAIA_PHASE5_SYNTHETIC_ONLY':raise RuntimeError('UNOWNED_QA_DATABASE')
        sql('DROP DATABASE '+DB+' WITH (FORCE);','postgres')
    sql('CREATE DATABASE '+DB+';','postgres')
    sql("COMMENT ON DATABASE "+DB+" IS 'DENTAIA_PHASE5_SYNTHETIC_ONLY';",'postgres')
    sql('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
    dump=subprocess.check_output(['docker','exec',C,'pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=auth','--no-owner','--no-privileges'],text=True,encoding='utf8')
    sql(dump)
    catalog=json.loads((ARCH/'INVENTARIO_SUPABASE_VERIFICADO.json').read_text(encoding='utf8'));stm=['SET search_path=public,auth,extensions;']
    for table in sorted({c['table_name'] for c in catalog['columns']}):
        cols=sorted([c for c in catalog['columns'] if c['table_name']==table],key=lambda c:c['ordinal_position'])
        fields=[c['column_name']+' '+c['data_type']+(' DEFAULT '+c['column_default'] if c['column_default'] else '')+(' NOT NULL' if c['is_nullable']=='NO' else '') for c in cols]
        stm.append('CREATE TABLE public.'+table+'('+','.join(fields)+');')
    for c in sorted(catalog['constraints'],key=lambda c:c['contype']=='f'):stm.append('ALTER TABLE public.'+c['table_name']+' ADD CONSTRAINT '+c['conname']+' '+c['definition']+';')
    for i in catalog['indexes']:stm.append(i['indexdef'].replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ').replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ')+';')
    for table in sorted({c['table_name'] for c in catalog['columns']}):stm.append('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY;')
    for p in catalog['policies']:
        if p['schemaname']=='public':stm.append('CREATE POLICY '+p['policyname']+' ON public.'+p['tablename']+' FOR '+p['cmd']+' TO '+','.join(p['roles'])+(' USING('+p['qual']+')' if p['qual'] else '')+(' WITH CHECK('+p['with_check']+')' if p['with_check'] else '')+';')
    stm+=['GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT SELECT ON public.dentists TO anon,authenticated;',
      'GRANT SELECT,INSERT ON public.profiles,public.appointment_requests,public.patient_consents,public.dental_photos TO authenticated;',
      'GRANT UPDATE(full_name) ON public.profiles TO authenticated; GRANT UPDATE(status) ON public.appointment_requests TO authenticated;',
      'GRANT UPDATE(revoked_at) ON public.patient_consents TO authenticated; GRANT DELETE ON public.dental_photos TO authenticated;']
    sql('BEGIN;\n'+'\n'.join(stm)+'\nCOMMIT;')
    report['baseline']='Auth oficial schema-only y cinco tablas públicas vacías desde inventario, sin filas remotas'
    for p in package:
        sql("SET dentaia.architecture_draft='qa_only';\n"+p.read_text(encoding='utf8'))
        report['migraciones'].append({'archivo':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'aplicada':True})
    report['catalogo']=json.loads(sql("SELECT json_build_object('tablas',(SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','clinical','dentaia_admin')),'columnas',(SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('public','clinical','dentaia_admin')),'constraints',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','clinical','dentaia_admin')),'indices',(SELECT count(*) FROM pg_indexes WHERE schemaname IN ('public','clinical','dentaia_admin')),'tablasIA',(SELECT count(*) FROM pg_tables WHERE schemaname='ml'),'rls',(SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','clinical','dentaia_admin') AND relkind='r'));"))
    assert report['catalogo']['tablas']==19 and report['catalogo']['tablasIA']==0 and report['catalogo']['rls']
    assert sql("SELECT clinical_service.configuration()->>'enabled';")=='false'
    report['aprobado']=True
except Exception as e:report['aprobado']=False;report['bloqueo']=str(e);raise
finally:
    (OUT/'MIGRACIONES_DESDE_CERO.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report,ensure_ascii=False))
