"""Ensayo LOCAL de los SQL exactos propuestos. Copia de esquema remoto + filas ficticias.
Nunca acepta connection strings, URLs ni bases de destino externas.
"""
from pathlib import Path
import hashlib, json, os, subprocess, sys

HERE=Path(__file__).resolve().parent
C='supabase_db_DentaIA-arquitectura-fase2-qa'
DB='dentaia_arch_qa_fase8'
MARK='DENTAIA_PHASE8_SYNTHETIC_ONLY'
report={'fecha':'2026-11-03','entorno':'Docker local','base':DB,'datos':'exclusivamente ficticios; esquema remoto de lectura','escriturasRemotas':0,'checks':[],'migraciones':[]}
if os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':raise SystemExit('LOCAL_ENGINE_REQUIRED')
def sql(query,db=DB,check=True):
    if db not in (DB,'postgres'):raise RuntimeError('LOCAL_DB_NOT_ALLOWED')
    p=subprocess.run(['docker','exec','-i',C,'psql','-X','-U','postgres','-d',db,'-Atq','-v','ON_ERROR_STOP=1'],input=query,text=True,encoding='utf8',capture_output=True)
    if check and p.returncode:raise RuntimeError('LOCAL_SQL_FAILED: '+p.stderr[:1600])
    return p.stdout.strip() if check else p
def qi(s):return '"'+s.replace('"','""')+'"'
def record(name,ok):
    report['checks'].append({'nombre':name,'aprobada':bool(ok)})
    print(('PASS ' if ok else 'FAIL ')+name,flush=True)
    if not ok:raise RuntimeError('SIMULATION_CHECK_FAILED')
def public_data():
    return json.loads(sql("SELECT jsonb_object_agg(t.name,t.summary) FROM ("+' UNION ALL '.join("SELECT '"+n+"' AS name,jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),''))) AS summary FROM public."+n+' x' for n in ['profiles','dentists','appointment_requests','patient_consents','dental_photos'])+") t;"))
try:
    exists=sql("SELECT count(*) FROM pg_database WHERE datname='"+DB+"';",'postgres')=='1'
    if exists:
        if '--recrear-simulacion' not in sys.argv:raise RuntimeError('EXISTING_SIMULATION_NOT_RESET')
        if sql("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname='"+DB+"';",'postgres')!=MARK:raise RuntimeError('UNOWNED_LOCAL_DATABASE')
        sql('DROP DATABASE '+DB+' WITH (FORCE);','postgres')
    sql('CREATE DATABASE '+DB+';','postgres')
    sql("COMMENT ON DATABASE "+DB+" IS '"+MARK+"';",'postgres')
    sql('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
    dump=subprocess.check_output(['docker','exec',C,'pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=auth','--no-owner','--no-privileges'],text=True,encoding='utf8')
    sql(dump)
    cat=json.loads((HERE/'CATALOGO_REMOTO_ANTES.json').read_text(encoding='utf8'))['catalog']
    types={(c['table'],c['column']):c['type']for c in json.loads((HERE/'TIPOS_COLUMNAS_REMOTAS.json').read_text(encoding='utf8'))}
    statements=['SET search_path=public,auth,extensions;']
    for t in cat['tables']:
        columns=sorted([c for c in cat['columns']if c['table_name']==t['table']],key=lambda c:c['ordinal_position'])
        fields=[qi(c['column_name'])+' '+types[(t['table'],c['column_name'])]+(' DEFAULT '+c['column_default']if c['column_default'] else '')+(' NOT NULL'if c['is_nullable']=='NO'else '')for c in columns]
        statements.append('CREATE TABLE public.'+qi(t['table'])+'('+','.join(fields)+');')
    for c in sorted(cat['constraints'],key=lambda x:x['type']=='f'):statements.append('ALTER TABLE public.'+qi(c['table'])+' ADD CONSTRAINT '+qi(c['name'])+' '+c['definition']+';')
    for i in cat['indexes']:statements.append(i['indexdef'].replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ').replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ')+';')
    for t in cat['tables']:statements.append('ALTER TABLE public.'+qi(t['table'])+' ENABLE ROW LEVEL SECURITY;')
    for p in cat['policies']:
        if p['schemaname']=='public':statements.append('CREATE POLICY '+qi(p['policyname'])+' ON public.'+qi(p['tablename'])+' FOR '+p['cmd']+' TO '+','.join(qi(x)for x in p['roles'])+(' USING ('+p['qual']+')'if p['qual']else '')+(' WITH CHECK ('+p['with_check']+')'if p['with_check']else '')+';')
    # Mismos ACL de los cinco módulos; sin permisos globales nuevos para clientes.
    statements+=['GRANT ALL PRIVILEGES ON public.profiles,public.dentists,public.appointment_requests,public.patient_consents,public.dental_photos TO service_role;',
      'GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT SELECT ON public.dentists TO anon,authenticated;',
      'GRANT SELECT,INSERT ON public.profiles,public.appointment_requests,public.patient_consents,public.dental_photos TO authenticated;',
      'GRANT UPDATE(full_name) ON public.profiles TO authenticated; GRANT UPDATE(status) ON public.appointment_requests TO authenticated;',
      'GRANT UPDATE(revoked_at) ON public.patient_consents TO authenticated; GRANT DELETE ON public.dental_photos TO authenticated;']
    sql('BEGIN;\n'+'\n'.join(statements)+'\nCOMMIT;')
    fixture="""
CREATE SCHEMA f8_fixture; REVOKE ALL ON SCHEMA f8_fixture FROM PUBLIC;
CREATE FUNCTION f8_fixture.id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('80000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; $$;
INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,is_anonymous) SELECT f8_fixture.id(n),'authenticated','authenticated','fixture-'||n||'@dentaia.test','{}','{}',CASE WHEN n<=4 THEN now() END,false FROM generate_series(1,5)n;
INSERT INTO public.profiles(id,full_name) SELECT f8_fixture.id(n),'Perfil ficticio '||n FROM generate_series(1,2)n;
INSERT INTO public.dentists(id,slug,name,specialty,district,consultation_price,initials,avatar_color,description) SELECT f8_fixture.id(10+n),'fase8-'||n,'Dentista ficticio '||n,'General','Demo',0,'QA','#000000','Exclusivamente ficticio' FROM generate_series(1,4)n;
INSERT INTO public.appointment_requests(id,user_id,dentist_id,contact_name,contact_email,preferred_date) SELECT f8_fixture.id(20+n),f8_fixture.id(1),f8_fixture.id(11),'Contacto ficticio','fixture@dentaia.test',current_date+1 FROM generate_series(1,5)n;
INSERT INTO public.patient_consents(id,user_id,policy_version,consent_text) SELECT f8_fixture.id(30+n),f8_fixture.id(1),'F8-SINTETICO','Consentimiento academico ficticio para prueba local' FROM generate_series(1,5)n;
INSERT INTO public.dental_photos(id,user_id,consent_id,object_path,original_filename,mime_type,size_bytes) VALUES(f8_fixture.id(41),f8_fixture.id(1),f8_fixture.id(31),f8_fixture.id(1)||'/'||f8_fixture.id(31)||'/ficticio.png','ficticio.png','image/png',1);
"""
    sql(fixture)
    before=public_data();record('Copia representativa con 2 perfiles,4 dentistas,5 solicitudes,5 consentimientos,1 metadata foto', [before[t]['count']for t in ['profiles','dentists','appointment_requests','patient_consents','dental_photos']]==[2,4,5,5,1])
    expected=json.loads((HERE/'CONTROL_DESTINO.json').read_text(encoding='utf8'))['huellaPublica']
    record('Huella de esquema remoto reproducida antes de migrar',json.loads(sql("SELECT to_jsonb(f) FROM ("+(HERE/'huella_publica.sql').read_text(encoding='utf8').strip().rstrip(';')+") f;"))['fingerprint']==expected)
    sources=json.loads((HERE/'PAQUETE_PROPUESTO.json').read_text(encoding='utf8'))['migraciones']
    for item in sources:
        path=HERE.parents[2]/item['archivo'];text=path.read_text(encoding='utf8')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise RuntimeError('MIGRATION_HASH_CHANGED')
        sql("SET dentaia.integration_approval='fase8_local_simulation';\n"+text)
        report['migraciones'].append({'archivo':item['archivo'],'sha256':item['sha256'],'aplicadaLocalmente':True})
        record('Datos previos identicos tras '+path.name,public_data()==before)
        if '--observar-post-rpc' in sys.argv and len(report['migraciones'])==3:
            report['huellaPublicaTrasRPC']=json.loads(sql("SELECT to_jsonb(f) FROM ("+(HERE/'huella_publica.sql').read_text(encoding='utf8').strip().rstrip(';')+") f;"))['fingerprint']
            report['alcance']='PRELIMINAR: tres migraciones; no ensayo completo'
            report['aprobada']=True
            print('POST_RPC_FINGERPRINT '+report['huellaPublicaTrasRPC'])
            raise SystemExit(0)
    report['catalogo']=json.loads(sql("SELECT jsonb_build_object('tablas',(SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','clinical','dentaia_admin')),'columnas',(SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('public','clinical','dentaia_admin')),'restricciones',(SELECT count(*) FROM pg_constraint x JOIN pg_namespace n ON n.oid=x.connamespace WHERE n.nspname IN ('public','clinical','dentaia_admin')),'indices',(SELECT count(*) FROM pg_indexes WHERE schemaname IN ('public','clinical','dentaia_admin')),'rls',(SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','clinical','dentaia_admin') AND relkind='r'),'tablasIA',(SELECT count(*) FROM pg_tables WHERE schemaname='ml'));"))
    record('MVP 19 tablas,142 columnas,RLS activo,0 IA',report['catalogo']['tablas']==19 and report['catalogo']['columnas']==142 and report['catalogo']['rls'] and report['catalogo']['tablasIA']==0)
    record('Servicios clinicos cerrados por defecto',sql("SELECT clinical_service.configuration()->>'enabled';")=='false')
    record('No concede RPC administrativo a anon/authenticated',sql("SELECT NOT has_function_privilege('anon','public.dentaia_cambiar_roles_v1(jsonb,jsonb,uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.dentaia_cambiar_roles_v1(jsonb,jsonb,uuid)','EXECUTE');")=='t')
    record('Ejecutor privado NOLOGIN/NOBYPASSRLS',sql("SELECT NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper FROM pg_roles WHERE rolname='dentaia_clinical_executor';")=='t')
    record('Anon no ejecuta RPC clinicos',sql("SELECT NOT has_function_privilege('anon','public.get_clinical_workspace(text,uuid,uuid,integer,text)','EXECUTE');")=='t')
    # Exportación/restauración LOCAL sintética del resultado, sin datos privados.
    backup=subprocess.check_output(['docker','exec',C,'pg_dump','-U','postgres','-d',DB,'--format=custom'])
    report['dumpLocalSha256']=hashlib.sha256(backup).hexdigest()
    record('Dump local sintetico contiene formato custom valido',backup[:5]==b'PGDMP')
    report['aprobada']=True
except Exception as e:
    report['aprobada']=False;report['error']=str(e);raise
finally:
    history=HERE/'INTENTOS_SIMULACION.json'
    previous=json.loads(history.read_text(encoding='utf8')) if history.exists() else [json.loads((HERE/'SIMULACION_MIGRACIONES.json').read_text(encoding='utf8'))] if (HERE/'SIMULACION_MIGRACIONES.json').exists() else []
    previous.append(report)
    history.write_text(json.dumps(previous,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (HERE/'SIMULACION_MIGRACIONES.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'aprobada':report.get('aprobada'),'checks':len(report['checks']),'catalogo':report.get('catalogo')}))
