"""QA local exclusivamente mediante docker exec; nunca acepta una URL remota.
Uso: python ejecutar.py --container supabase_db_DentaIA-arquitectura-fase2-qa
Requiere Supabase local iniciado. No lee .env ni usa credenciales del proyecto.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = ROOT.parents[1]
DB = 'dentaia_arch_qa_fase2'
ap = argparse.ArgumentParser()
ap.add_argument('--container', required=True)
ap.add_argument('--reset-qa', action='store_true', help='Recrear SOLO la base QA identificada')
args = ap.parse_args()
if args.container != 'supabase_db_DentaIA-arquitectura-fase2-qa':
    raise SystemExit('Contenedor no autorizado para este protocolo QA')

report = {'fecha': '2026-11-03', 'inicio_utc': datetime.now(timezone.utc).isoformat(), 'entorno': 'Supabase local Docker; Auth real del stack, identidades SQL sintéticas',
          'base': DB, 'migraciones': [], 'pruebas': [], 'remoto': False}

def call(sql, db=DB, check=True):
    if db==DB:
        sql="SET dentaia.architecture_draft='qa_only';\n"+sql
    p = subprocess.run(['docker','exec','-i',args.container,'psql','-X','-U','postgres','-d',db,
                        '-v','ON_ERROR_STOP=1','-Atq'], input=sql, text=True, encoding='utf8',
                       capture_output=True, timeout=90)
    if check and p.returncode:
        raise RuntimeError(p.stderr.strip())
    return p

def record(name, ok, detail=None, category='integridad'):
    item = dict(nombre=name, categoria=category, aprobado=bool(ok), detalle=detail)
    report['pruebas'].append(item)
    print(('PASS ' if ok else 'FAIL ')+name, flush=True)

def case(name, sql, state=None, category='integridad'):
    p = call('\\set VERBOSITY verbose\nBEGIN; SET LOCAL plpgsql.check_asserts=on;\n'+sql+'\nSET CONSTRAINTS ALL IMMEDIATE; ROLLBACK;', check=False)
    if state is None:
        record(name, p.returncode == 0, None if p.returncode == 0 else p.stderr.strip(), category)
    else:
        # psql verbosity permite verificar SQLSTATE, no solo la existencia de un error.
        record(name, p.returncode != 0 and state in p.stderr, 'SQLSTATE esperado '+state+'; '+p.stderr.strip() if p.returncode else 'No rechazado', category)

def save():
    report['aprobadas'] = sum(x['aprobado'] for x in report['pruebas'])
    report['fallidas'] = sum(not x['aprobado'] for x in report['pruebas'])
    (HERE/'RESULTADOS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    path=HERE/'INTENTOS.json'
    history=json.loads(path.read_text(encoding='utf8')) if path.exists() else []
    history.append(dict(inicio_utc=report['inicio_utc'],migraciones=report['migraciones'],aprobadas=report['aprobadas'],fallidas=report['fallidas'],bloqueo=report.get('bloqueo'),errores=[p for p in report['pruebas'] if not p['aprobado']]))
    path.write_text(json.dumps(history,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

def bootstrap():
    version = call('SELECT version();','postgres').stdout.strip()
    report['postgresql'] = version
    exists = call("SELECT count(*) FROM pg_database WHERE datname='"+DB+"';",'postgres').stdout.strip() == '1'
    if exists:
        if not args.reset_qa:
            raise RuntimeError('QA ya existe; usar --reset-qa para repetir desde limpio')
        # Nombre constante; nunca se elimina postgres ni una base compartida.
        call('DROP DATABASE '+DB+' WITH (FORCE);','postgres')
    call('CREATE DATABASE '+DB+';','postgres')
    # Catálogo Auth procedente del stack local oficial, no las tablas simuladas de DI-151.
    dump = subprocess.run(['docker','exec',args.container,'pg_dump','-U','postgres','-d','postgres',
                           '--schema-only','--schema=auth','--no-owner','--no-privileges'],
                          capture_output=True,text=True,encoding='utf8',check=True).stdout
    call('CREATE SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;')
    call(dump)
    catalog = json.loads((ROOT/'INVENTARIO_SUPABASE_VERIFICADO.json').read_text(encoding='utf8'))
    model = json.loads((ROOT/'MODELO_DATOS.json').read_text(encoding='utf8'))
    statements = ['SET search_path=public,auth,extensions;']
    # Recreación SOLO del baseline vacío de QA, previa a las migraciones de negocio.
    for t in [t for t in model if t['domain']=='existente']:
        cols = [c for c in catalog['columns'] if 'public.'+c['table_name']==t['name']]
        cols.sort(key=lambda c:c['ordinal_position'])
        fields = [c['column_name']+' '+c['data_type']+(' DEFAULT '+c['column_default'] if c['column_default'] else '')+(' NOT NULL' if c['is_nullable']=='NO' else '') for c in cols]
        statements.append('CREATE TABLE '+t['name']+' ('+', '.join(fields)+');')
    constraints = sorted(catalog['constraints'],key=lambda c:c['contype']=='f')
    for c in constraints:
        statements.append('ALTER TABLE public.'+c['table_name']+' ADD CONSTRAINT '+c['conname']+' '+c['definition']+';')
    for i in catalog['indexes']:
        statements.append(i['indexdef'].replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ').replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ')+';')
    for t in [t for t in model if t['domain']=='existente']:
        statements.append('ALTER TABLE '+t['name']+' ENABLE ROW LEVEL SECURITY;')
    for p in catalog['policies']:
        if p['schemaname']!='public': continue
        statements.append('CREATE POLICY '+p['policyname']+' ON public.'+p['tablename']+' AS '+p['permissive']+' FOR '+p['cmd']+' TO '+','.join(p['roles'])+(' USING ('+p['qual']+')' if p['qual'] else '')+(' WITH CHECK ('+p['with_check']+')' if p['with_check'] else '')+';')
    statements += ['GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;',
                   'GRANT SELECT ON public.dentists TO anon,authenticated;',
                   'GRANT SELECT,INSERT ON public.profiles,public.appointment_requests,public.patient_consents,public.dental_photos TO authenticated;',
                   'GRANT UPDATE(full_name) ON public.profiles TO authenticated;',
                   'GRANT UPDATE(status) ON public.appointment_requests TO authenticated;',
                   'GRANT UPDATE(revoked_at) ON public.patient_consents TO authenticated;',
                   'GRANT DELETE ON public.dental_photos TO authenticated;']
    call('\n'.join(statements))
    record('Baseline QA vacío: Auth oficial y cinco tablas de catálogo',True,category='entorno')

def validate_catalog():
    model=json.loads((ROOT/'MODELO_DATOS.json').read_text(encoding='utf8'))
    rows=json.loads(call("SELECT json_agg(r) FROM (SELECT table_schema||'.'||table_name AS name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema IN ('public','clinical','ml','dentaia_admin') AND table_name NOT LIKE 'qa_%') r;").stdout)
    by={(r['name'],r['column_name']):r for r in rows}
    aliases={'timestamptz':'timestamp with time zone','time':'time without time zone','uuid':'uuid','jsonb':'jsonb','integer':'integer','bigint':'bigint','numeric':'numeric','text':'text','date':'date','boolean':'boolean'}
    for table in model:
        errors=[]
        for f in table['fields']:
            actual=by.get((table['name'],f['name']))
            if not actual or actual['data_type']!=aliases.get(f['type'],f['type']) or (actual['is_nullable']=='YES')!=f['nullable']:
                errors.append(f['name'])
        record('Catálogo real SQL: '+table['name'],not errors,dict(campos=len(table['fields']),errores=errors),'catálogo PostgreSQL')
    report['catalogo_sql']=json.loads(call("SELECT json_build_object('tablas',(SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','clinical','ml','dentaia_admin')),'columnas',(SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('public','clinical','ml','dentaia_admin')),'restricciones',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','clinical','ml','dentaia_admin')),'indices',(SELECT count(*) FROM pg_indexes WHERE schemaname IN ('public','clinical','ml','dentaia_admin')));").stdout)

try:
    bootstrap()
    before = call("SELECT table_name||':'||column_name||':'||data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;").stdout
    for path in sorted((ROOT/'borradores_sql').glob('*.sql')):
        p = call(path.read_text(encoding='utf8'),check=False)
        report['migraciones'].append(dict(archivo=path.name,aprobada=p.returncode==0,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),error=p.stderr.strip() if p.returncode else None))
        if p.returncode:
            raise RuntimeError(path.name+': '+p.stderr.strip())
        print('APPLIED '+path.name,flush=True)
    after = call("SELECT table_name||':'||column_name||':'||data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;").stdout
    record('Migraciones conservan columnas y tipos de las cinco tablas existentes',before==after,category='compatibilidad')
    call((HERE/'fixtures.sql').read_text(encoding='utf8'))
    # Cada escenario queda en su propia transacción reversible.
    scenarios = json.loads((HERE/'casos.json').read_text(encoding='utf8'))
    for item in scenarios:
        case(item['nombre'],item['sql'],item.get('sqlstate'),item.get('categoria','integridad'))
    call((HERE/'prototipo_auditado_qa.sql').read_text(encoding='utf8'))
    for item in json.loads((HERE/'casos_prototipo.json').read_text(encoding='utf8')):
        case(item['nombre'],item['sql'],item.get('sqlstate'),'prototipo QA; no RPC implementado')
    # Validación de la migración administrativa sin modificar su fuente histórica.
    admin=REPO/'supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql'
    p=call(admin.read_text(encoding='utf8'),check=False)
    record('Migración DI-151 sobre Auth oficial local',p.returncode==0,p.stderr.strip() if p.returncode else None,'administración')
    if p.returncode==0:
        fixture=(REPO/'supabase/tests/fixtures-auth-local.sql').read_text(encoding='utf8')
        call(fixture[fixture.index('create function public.qa_id'):])
        sql=(REPO/'supabase/tests/di151-roles.sql').read_text(encoding='utf8')
        # El test original usa tablas mínimas y VALUES posicionales; adaptar SOLO
        # su copia de ejecución al esquema Auth oficial, sin tocar el test histórico.
        sql=re.sub(r'insert into auth.users\(id,raw_app_meta_data\) values\s*([\s\S]*?);',
            lambda m:"INSERT INTO auth.users(id,raw_app_meta_data,email_confirmed_at,created_at,updated_at,aud,role) SELECT id,metadata::jsonb,now(),now(),now(),'authenticated','authenticated' FROM (VALUES "+m[1]+') v(id,metadata);',sql,flags=re.I)
        sql=re.sub(r"insert into auth.mfa_factors values\((public.qa_id\(\d+\)),(public.qa_id\(\d+\)),'verified','totp'\);",
            r"INSERT INTO auth.mfa_factors(id,user_id,status,factor_type,created_at,updated_at) VALUES(\1,\2,'verified','totp',now(),now());",sql,flags=re.I)
        sql=sql.replace("insert into auth.sessions values(public.qa_id(11),public.qa_id(1),public.qa_id(10),'aal2',now()+interval '1 hour');",
            "INSERT INTO auth.sessions(id,user_id,factor_id,aal,not_after,created_at,updated_at) VALUES(public.qa_id(11),public.qa_id(1),public.qa_id(10),'aal2',now()+interval '1 hour',now(),now());")
        sql=sql.replace("insert into auth.mfa_amr_claims values(public.qa_id(11),'totp',clock_timestamp());",
            "INSERT INTO auth.mfa_amr_claims(id,session_id,authentication_method,updated_at,created_at) VALUES(gen_random_uuid(),public.qa_id(11),'totp',clock_timestamp(),clock_timestamp());")
        (HERE/'admin_adaptado_qa.sql').write_text('-- Copia adaptada para Auth oficial local. NO migración; solo SQL sintético.\n'+sql,encoding='utf8')
        p=call(sql,check=False)
        record('Suite SQL administrativa adaptada al Auth oficial',p.returncode==0,p.stderr.strip() if p.returncode else None,'administración')
    validate_catalog()
    # Pruebas concurrentes separadas: procesos y sesiones PostgreSQL independientes.
    from concurrencia import ejecutar
    ejecutar(call,record,args.container,DB)
    p=call((HERE/'admin_ultimo_qa.sql').read_text(encoding='utf8'),check=False)
    record('Último administrador conserva rol al rechazarse su retirada propia',p.returncode==0,p.stderr.strip() if p.returncode else 'Rechazo CAMBIO_PROPIO_PROHIBIDO; no cobertura de la rama ULTIMO_SUPERUSUARIO_PROTEGIDO','administración')
except Exception as exc:
    report['bloqueo']=str(exc)
    print('BLOQUEO '+str(exc),flush=True)
finally:
    save()
if report.get('bloqueo') or report['fallidas']:
    raise SystemExit(1)
