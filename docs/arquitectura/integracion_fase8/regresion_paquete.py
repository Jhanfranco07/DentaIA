"""78 casos SQL/RPC originales sobre la copia incremental Fase 8. No JWT HTTP."""
from pathlib import Path
import importlib.util,json,os,subprocess,sys
from urllib.parse import urlsplit,unquote
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ARCH=HERE.parent
C='supabase_db_DentaIA-arquitectura-fase2-qa';DB='dentaia_arch_qa_fase8'
if os.environ.get('DOCKER_HOST')or subprocess.check_output(['docker','context','show'],text=True).strip()!='desktop-linux':raise SystemExit('LOCAL_ONLY')
def sql(query,check=True,db_user='postgres'):
    args=['docker','exec','-i',C,'psql','-X','-U','postgres','-d',DB,'-Atq','-v','ON_ERROR_STOP=1'];prefix=''
    if db_user=='authenticator':
        envs=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .Config.Env}}','supabase_rest_DentaIA-arquitectura-fase2-qa'],text=True))
        uri=next(x.split('=',1)[1]for x in envs if x.startswith('PGRST_DB_URI='));password=unquote(urlsplit(uri).password)
        args=['docker','exec','-i',C,'sh','-c','IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -h 127.0.0.1 -U authenticator -d dentaia_arch_qa_fase8 -Atq -v ON_ERROR_STOP=1'];prefix=password+'\n'
    p=subprocess.run(args,input=prefix+'\\set VERBOSITY verbose\n'+query,text=True,encoding='utf8',capture_output=True,timeout=90)
    if check and p.returncode:raise RuntimeError(p.stderr[:1800])
    return p
report={'fecha':'2026-11-03','base':DB,'entorno':'copia local con paquete incremental exacto','metodo':'claims SQL sinteticos; NO JWT firmados','pruebas':[]}
def record(name,ok,detail=None,category=None):
    report['pruebas'].append({'nombre':name,'aprobado':bool(ok),'detalle':detail,'categoria':category});print(('PASS 'if ok else'FAIL ')+name,flush=True)
try:
    assert sql("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database();").stdout.strip()=='DENTAIA_PHASE8_SYNTHETIC_ONLY'
    fixture=(ARCH/'servicios_clinicos/pruebas/fixtures.sql').read_text(encoding='utf8').replace("current_database()<>'dentaia_arch_qa_fase3'","current_database()<>'dentaia_arch_qa_fase8'")
    sql(fixture)
    cases=json.loads((ARCH/'servicios_clinicos/pruebas/casos.json').read_text(encoding='utf8'))
    for case in cases:
        p=sql('BEGIN; SET LOCAL plpgsql.check_asserts=on;\n'+case['sql']+'\nSET CONSTRAINTS ALL IMMEDIATE;ROLLBACK;',False,case.get('db_user','postgres'))
        state=case.get('sqlstate');ok=(p.returncode!=0 and state in p.stderr)if state else p.returncode==0
        record(case['nombre'],ok,('SQLSTATE '+state if state else None)if ok else p.stderr[:1800],case['tipo'])
    spec=importlib.util.spec_from_file_location('fase8_concurrencia',ARCH/'servicios_clinicos/pruebas/concurrencia.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.ejecutar(sql,record,C,DB)
finally:
    source=(ARCH/'servicios_clinicos/sql/08_identidad_y_privilegios.sql').read_text(encoding='utf8')
    import re
    closed=re.search(r'CREATE FUNCTION clinical_service\.configuration\(\) RETURNS jsonb[\s\S]*?\$\$;',source)[0]
    sql(closed.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'))
    report['aprobadas']=sum(x['aprobado']for x in report['pruebas']);report['fallidas']=sum(not x['aprobado']for x in report['pruebas'])
    report['cerradoAlTerminar']=sql("SELECT clinical_service.configuration()->>'enabled';").stdout.strip()=='false'
    (HERE/'REGRESION_PAQUETE_SQL.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'aprobadas':report['aprobadas'],'fallidas':report['fallidas'],'cerrado':report['cerradoAlTerminar']}))
if report['fallidas']or not report['cerradoAlTerminar']:raise SystemExit(1)
