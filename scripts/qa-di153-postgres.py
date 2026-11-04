"""Ejecuta las pruebas SQL EXISTENTES de DI-151 en PostgreSQL local desechable.
No acepta URL, conexión, credenciales ni SQL suministrado por el usuario.
Requiere la imagen postgres:17 descargada; no modifica los archivos SQL.
"""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--confirmar-base-desechable', action='store_true', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
label = uuid.uuid4().hex
name = 'dentaia-di153-' + label[:12]
env = dict(os.environ)
for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
    env.pop(key, None)
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
report = {'fecha': datetime.now(timezone.utc).isoformat(), 'entorno': 'PostgreSQL 17 real en Docker local sin red; Auth es un esquema fixture, NO Supabase',
          'base': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'pruebas': []}
files = ['supabase/tests/fixtures-auth-local.sql', 'supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql',
         'supabase/tests/di151-roles.sql', 'supabase/tests/di151-concurrencia-preparar.sql']
report['sha256_archivos_reutilizados'] = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files}

def docker(*params, input=None, timeout=60):
    r = subprocess.run(DOCKER + list(params), input=input, env=env, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    if r.returncode:
        raise RuntimeError('DOCKER_O_SQL_EXIT_' + str(r.returncode))
    return r.stdout.strip()

def sql(text):
    return docker('exec', '-i', '-e', 'PGOPTIONS=-c plpgsql.check_asserts=on', name, 'psql', '-X', '-h', '/var/run/postgresql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', input=text)

def passed(nombre, **datos):
    report['pruebas'].append({'nombre': nombre, 'aprobada': True, **datos})
    print('PASS ' + nombre, flush=True)

def paralelo(a, b):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(sql, consulta) for consulta in (a, b)]
        return sorted(line for f in futures for line in f.result().splitlines() if line in ['200', '403', '409'])

try:
    docker('info', '--format', '{{.ServerVersion}}')
    report['imagen'] = docker('image', 'inspect', 'postgres:17', '--format', '{{index .RepoDigests 0}}')
    docker('run', '--detach', '--pull=never', '--name', name, '--label', 'dentaia.di153.qa=' + label,
           '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17')
    # Inspección del contenedor propio: ni puertos ni red ni carpetas del host.
    config = json.loads(docker('inspect', name))[0]
    assert config['HostConfig']['NetworkMode'] == 'none'
    assert not config['HostConfig'].get('PortBindings') and not config['HostConfig'].get('Binds')
    for _ in range(30):
        try:
            docker('exec', name, 'pg_isready', '-h', '/var/run/postgresql', '-U', 'postgres')
            break
        except RuntimeError:
            time.sleep(1)
    else:
        raise RuntimeError('POSTGRES_LOCAL_NO_DISPONIBLE')
    report['version_postgres'] = sql('show server_version;')
    report['plpgsql_check_asserts'] = sql('show plpgsql.check_asserts;')
    assert report['plpgsql_check_asserts'] == 'on'
    for path in files:
        sql((ROOT / path).read_text(encoding='utf8'))
        if path.endswith('di151-roles.sql'):
            passed('Suite SQL existente: grants/RLS, cambio y lectura posterior, rechazos, auditoría, rollback y último administrador')
    a = "select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,20),public.qa_id(30))->>'status';"
    b = "select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(3,21),public.qa_id(31))->>'status';"
    statuses = paralelo(a, b)
    assert statuses == ['200', '409'], statuses
    passed('Conexiones locales concurrentes: un commit y un conflicto de revisión', estados=statuses)
    same = "select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(4,22),public.qa_id(32))->>'status';"
    statuses = paralelo(same, same)
    assert statuses == ['200', '200'], statuses
    assert sql('select count(*) from dentaia_admin.auditoria_roles where objetivo_id=public.qa_id(4);') == '1'
    passed('Idempotencia concurrente existente: misma respuesta y una sola auditoría', estados=statuses)
    snapshot = "'{\"version\":1,\"estado\":\"activo\",\"roles\":[\"superusuario\"]}'"
    revoke = " || '{\"operacion\":\"revocar\",\"rol\":\"superusuario\"}'"
    context2 = "jsonb_build_object('actorId',public.qa_id(2),'sesionId',public.qa_id(12),'expira',floor(extract(epoch from clock_timestamp()))::bigint+3600)"
    a = f"select public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(2,23,0,{snapshot}){revoke},public.qa_id(33))->>'status';"
    b = f"select public.dentaia_cambiar_roles_v1({context2},public.qa_peticion(1,24,0,{snapshot}){revoke},public.qa_id(34))->>'status';"
    statuses = paralelo(a, b)
    assert statuses == ['200', '403'], statuses
    assert sql("select count(*) from auth.users where raw_app_meta_data->'dentaia'->'roles' @> '[\"superusuario\"]'::jsonb;") == '2'
    passed('Retirada concurrente existente: se conserva el invariante de administradores', estados=statuses)
except Exception as error:
    report['bloqueo'] = type(error).__name__ + ': ' + str(error)
    print('FAIL ' + report['bloqueo'], flush=True)
finally:
    try:
        propia = docker('inspect', '--format', '{{index .Config.Labels "dentaia.di153.qa"}}', name)
        if propia != label:
            raise RuntimeError('ETIQUETA_NO_COINCIDE')
        docker('rm', '--force', '--volumes', name)
        report['contenedor_propio_retirado'] = True
    except Exception as error:
        report['limpieza_pendiente'] = type(error).__name__
    assert report['sha256_archivos_reutilizados'] == {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files}
    report['aprobadas'] = len(report['pruebas'])
    report['fallidas'] = int('bloqueo' in report or 'limpieza_pendiente' in report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'aprobadas': report['aprobadas'], 'fallidas': report['fallidas']}))
    if report['fallidas']:
        raise SystemExit(1)
