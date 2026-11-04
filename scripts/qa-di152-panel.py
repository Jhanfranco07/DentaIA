"""Navegador real con HTTP/Auth simulados. Sin credenciales ni llamadas remotas.
Requiere Playwright Python y Chromium ya instalados; no instala dependencias.
"""
from pathlib import Path
import argparse,base64,json,os,signal,socket,subprocess,time,urllib.request
from importlib.metadata import version
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,required=True,help='Directorio de evidencias nuevo; no sobreescribe DI-152')
parser.add_argument('--chromium',help='Ejecutable Chromium instalado; no descarga navegadores')
parser.add_argument('--di153',action='store_true',help='Añade solo los escenarios de UI faltantes detectados en DI-153')
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:3112'
REPORT={'fecha':datetime.now(timezone.utc).isoformat(),'entorno':'Chromium real; respuestas HTTP y sesión ficticias; sin Supabase remoto','pruebas':[]}
REPORT.update({'base':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'playwright':version('playwright'),'di153':args.di153})
ID=lambda n:f'00000000-0000-4000-8000-{n:012d}'
def record(name,fn):
    try: fn();REPORT['pruebas'].append({'nombre':name,'aprobada':True});print('PASS '+name,flush=True)
    except Exception as e: REPORT['pruebas'].append({'nombre':name,'aprobada':False,'error':type(e).__name__,'detalleFixture':str(e)[:1000]});print('FAIL '+name+' '+str(e)[:500],flush=True)
def session():
    enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
    token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':ID(99),'exp':int(time.time())+3600,'role':'authenticated'})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture-refresh-not-a-secret','token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':{'id':ID(99),'aud':'authenticated','app_metadata':{},'user_metadata':{}}}
server=None
server_log=(args.output/'next.log').open('w',encoding='utf8')
try:
    # Si el puerto ya está ocupado, fallar sin tocar el proceso ajeno.
    with socket.socket() as probe:probe.bind(('127.0.0.1',3112))
    env={**os.environ,'NODE_ENV':'development','NEXT_TELEMETRY_DISABLED':'1','NEXT_PUBLIC_SUPABASE_URL':'https://di152-fixtures.supabase.co','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_fixture','DENTAIA_ADMIN_READS_ENABLED':'false','DENTAIA_ROLE_WRITES_ENABLED':'false','DENTAIA_SUPABASE_ADMIN_READ_SECRET':'','DENTAIA_SUPABASE_ROLE_WRITE_SECRET':''}
    server=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3112'],cwd=ROOT,env=env,stdout=server_log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),start_new_session=os.name!='nt')
    for _ in range(120):
        try: urllib.request.urlopen(BASE+'/desarrollo/panel-admin',timeout=3);break
        except Exception: time.sleep(.5)
    else: raise RuntimeError('NEXT_NOT_READY')
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,**({'executable_path':args.chromium} if args.chromium else {}))
        REPORT['chromium']=browser.version
        def new_page(auth=True,guard=200):
            context=browser.new_context(viewport={'width':1280,'height':900});state={'guard':guard,'list_status':200,'empty':False,'requests':[],'roles':['paciente'],'revision':2,'write_status':503,'hold':False,'deferred':[],'role_requests':[],'posts':[],'wrong_key':False,'post_denied':False,'hold_access':False,'access_pending':[]}
            context.route('https://**/*',lambda route:route.abort())
            if auth:
                context.add_init_script('localStorage.setItem("sb-di152-fixtures-auth-token",'+json.dumps(json.dumps(session()))+');')
            def intercept(route):
                path=route.request.url.split(BASE)[-1];headers={'Cache-Control':'private, no-store','Content-Type':'application/json'}
                if path=='/api/administracion/acceso' and state['hold_access']:state['access_pending'].append((route,headers));return
                if path=='/api/administracion/acceso':route.fulfill(status=state['guard'],headers=headers,body=json.dumps({'autorizado':True} if state['guard']==200 else {'error':'denegado'}));return
                if path.startswith('/api/administracion/usuarios/reales?'):
                    state['requests'].append(path)
                    from urllib.parse import urlparse,parse_qs
                    q=parse_qs(urlparse(path).query);page=int(q.get('pagina',['1'])[0]);size=int(q.get('tamano',['5'])[0]);empty=state['empty'] or q.get('q')==['sin resultados']
                    rows=[{'id':ID(n),'cuenta':'habilitada','perfil':{'estado':'presente','nombre':'Perfil ficticio '+str(n)},'asignacion':{'estado':'activa','roles':state['roles'] if n==1 else ['paciente']}} for n in range(1,9)] if not empty else []
                    body={'origen':'supabase','consistencia':'lectura_no_transaccional','total':len(rows),'pagina':page if rows else 1,'paginas':2 if size==5 and rows else 1,'tamano':size,'usuarios':rows[(page-1)*size:page*size]}
                    if state['hold']:state['deferred'].append((route,headers,body));return
                    route.fulfill(status=state['list_status'],headers=headers,body=json.dumps(body if state['list_status']==200 else {'error':'NO_MOSTRAR_SECRETO'}));return
                if path.startswith('/api/administracion/roles'):
                    state['role_requests'].append(route.request.method)
                    if route.request.method=='GET':body={'codigo':'ESTADO_ACTUAL','resultado':'consultado','revision':state['revision'],'asignacion':{'version':1,'estado':'activo','roles':state['roles']},'solicitudId':None};status=200
                    else:
                        status=state['write_status'];payload=route.request.post_data_json
                        state['posts'].append({'clave':route.request.headers.get('idempotency-key'),'cuerpo':payload})
                        if state['post_denied']:route.fulfill(status=403,headers=headers,body=json.dumps({'error':'Acceso denegado.'}));return
                        if status==200:state['revision']+=1;state['roles']=['paciente','superusuario']
                        body={'codigo':'CAMBIO_APLICADO' if status==200 else 'ESCRITURAS_DESACTIVADAS','resultado':'aplicado' if status==200 else 'rechazado','revision':state['revision'] if status==200 else None,'asignacion':{'version':1,'estado':'activo','roles':state['roles']} if status==200 else None,'solicitudId':route.request.headers.get('idempotency-key')}
                        if state['wrong_key']:body['solicitudId']=ID(88)
                        assert payload['revisionEsperada']==2
                    route.fulfill(status=status,headers=headers,body=json.dumps(body));return
                route.abort()
            context.route(BASE+'/api/administracion/**',intercept)
            page=context.new_page();page.goto(BASE+'/desarrollo/panel-admin');return context,page,state
        def cerrar_fixture(c,s):
            # Liberar respuestas retenidas incluso si falla una aserción del arnés.
            for clave in ['deferred','access_pending']:
                for entrada in s[clave]:
                    try:entrada[0].abort()
                    except Exception:pass
                s[clave].clear()
            c.unroute_all(behavior='ignoreErrors');c.close()
        def denied(auth,status):
            c,page,s=new_page(auth,status)
            try:expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible();expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0);assert not s['requests']
            finally:cerrar_fixture(c,s)
        record('UI sin sesión no monta el panel',lambda:denied(False,200))
        record('UI HTTP403 no monta el panel',lambda:denied(True,403))
        c,page,s=new_page()
        try:
            def loaded():page.get_by_role('button',name='Usuarios',exact=True).click();expect(page.get_by_role('cell',name='Perfil ficticio 1',exact=False)).to_be_visible()
            record('Listado representa DTO de usuarios de la API simulada',loaded)
            def paging():page.get_by_role('button',name='Siguiente',exact=True).click();expect(page.get_by_role('status').filter(has_text='Página 2')).to_be_visible();assert 'pagina=2' in s['requests'][-1]
            record('Paginación envía parámetros esperados',paging)
            def filtered():
                page.get_by_label('Filtrar por rol',exact=False).select_option('paciente')
                with page.expect_response(lambda r:'usuarios/reales?' in r.url and 'estado=habilitada' in r.url):page.get_by_label('Filtrar por estado de cuenta').select_option('habilitada')
                expect(page.get_by_role('status').filter(has_text='Página 1')).to_be_visible()
                assert 'rol=paciente' in s['requests'][-1] and 'estado=habilitada' in s['requests'][-1]
            record('Filtros reinician página y conservan parámetros',filtered)
            def empty():page.get_by_label('Búsqueda por nombre o UUID').fill('sin resultados');expect(page.get_by_text('No hay cuentas para mostrar',exact=True)).to_be_visible()
            record('Estado vacío representado',empty)
            def error():s['list_status']=503;page.get_by_label('Búsqueda por nombre o UUID').fill('');expect(page.get_by_text('La lectura administrativa está desactivada o no disponible.',exact=False)).to_be_visible();expect(page.get_by_role('table')).to_have_count(0);assert 'NO_MOSTRAR_SECRETO' not in page.locator('body').inner_text()
            record('503 no muestra éxito, datos anteriores ni detalles sensibles',error)
            def retry():s['list_status']=200;page.get_by_role('button',name='Volver a consultar',exact=True).click();expect(page.get_by_role('table')).to_be_visible()
            record('Reintento recupera el listado en el mismo servicio',retry)
            def roles():page.get_by_role('button',name='Consultar roles de Perfil ficticio 1',exact=True).click();expect(page.get_by_label('UUID de la cuenta ficticia objetivo')).to_have_value(ID(1));page.get_by_role('button',name='Consultar estado y revisión').click();expect(page.get_by_role('status').filter(has_text='HTTP 200')).to_be_visible()
            record('Selección de usuario integra el formulario existente y su consulta',roles)
            def blocked():page.get_by_label('UUID de aprobación independiente').fill(ID(77));page.get_by_label('Tengo aprobación explícita',exact=False).check();page.get_by_role('button',name='Enviar cambio aprobado').click();expect(page.get_by_role('status').filter(has_text='HTTP 503')).to_be_visible();expect(page.get_by_role('button',name='Reintentar exactamente la misma solicitud')).to_be_visible();assert 'HTTP 200' not in page.get_by_role('status').inner_text()
            record('Escritura bloqueada conserva intento sin confirmar éxito',blocked)
            def applied():s['write_status']=200;page.get_by_role('button',name='Reintentar exactamente la misma solicitud').click();expect(page.get_by_role('status').filter(has_text='HTTP 200')).to_contain_text('aplicado');page.get_by_role('button',name='Volver a consultar usuarios').click();expect(page.get_by_role('cell').filter(has_text='paciente, superusuario')).to_be_visible()
            record('Éxito simulado actualiza el listado mediante nueva consulta',applied)
            def revoked():s['list_status']=403;page.get_by_label('Búsqueda por nombre o UUID').fill('revocado');expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible();expect(page.get_by_role('table')).to_have_count(0)
            record('Pérdida de autorización retira el panel y las cuentas',revoked)
        finally:cerrar_fixture(c,s)
        c,page,s=new_page()
        try:
            def mobile():page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='Abrir menú administrativo').click();expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');page.get_by_role('button',name='Usuarios',exact=True).focus();page.keyboard.press('Enter');expect(page.get_by_role('heading',name='Usuarios y perfiles')).to_be_visible()
            record('Navegación móvil y teclado conservados',mobile)
        finally:cerrar_fixture(c,s)
        if args.di153:
            def esperar(page,predicado):
                limite=time.monotonic()+5
                while not predicado():
                    if time.monotonic()>limite:raise AssertionError('El fixture retenido no llegó al arnés')
                    page.wait_for_timeout(25)
            def abrir_usuarios(page):
                page.get_by_role('button',name='Usuarios',exact=True).click()
                expect(page.get_by_role('table')).to_be_visible()
            def abrir_roles(page):
                abrir_usuarios(page)
                page.get_by_role('button',name='Consultar roles de Perfil ficticio 1',exact=True).click()
                page.get_by_role('button',name='Consultar estado y revisión').click()
                expect(page.get_by_role('status').filter(has_text='HTTP 200')).to_be_visible()
            def preparar_envio(page):
                page.get_by_label('UUID de aprobación independiente').fill(ID(77))
                page.get_by_label('Tengo aprobación explícita',exact=False).check()
            def loading():
                c,page,s=new_page()
                try:
                    s['hold']=True
                    page.get_by_role('button',name='Usuarios',exact=True).click()
                    esperar(page,lambda:len(s['deferred'])>=1)
                    expect(page.get_by_text('Cargando cuentas…',exact=True)).to_be_visible()
                    expect(page.get_by_role('table')).to_have_count(0)
                    pendientes=list(s['deferred']);s['deferred'].clear();s['hold']=False
                    REPORT.setdefault('retenciones',{})['carga']=len(pendientes)
                    for route,headers,body in pendientes:route.fulfill(status=200,headers=headers,body=json.dumps(body))
                    expect(page.get_by_role('table')).to_be_visible()
                finally:cerrar_fixture(c,s)
            record('DI-153 carga retenida no muestra tabla antes de resolver la lectura',loading)
            def stale_list():
                c,page,s=new_page()
                try:
                    abrir_usuarios(page);s['hold']=True
                    page.get_by_label('Búsqueda por nombre o UUID').fill('lectura lenta')
                    esperar(page,lambda:len(s['deferred'])>=1)
                    route,headers,body=s['deferred'].pop();s['hold']=False
                    page.get_by_label('Búsqueda por nombre o UUID').fill('sin resultados')
                    expect(page.get_by_text('No hay cuentas para mostrar',exact=True)).to_be_visible()
                    with page.expect_response(lambda r:'q=lectura+lenta' in r.url):route.fulfill(status=200,headers=headers,body=json.dumps(body))
                    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
                    expect(page.get_by_role('table')).to_have_count(0)
                    expect(page.get_by_text('No hay cuentas para mostrar',exact=True)).to_be_visible()
                finally:cerrar_fixture(c,s)
            record('DI-153 respuesta antigua de búsqueda no repone cuentas tras un resultado vacío posterior',stale_list)
            def logout_fixture():
                c,page,s=new_page()
                try:
                    abrir_usuarios(page)
                    page.evaluate("""() => {localStorage.removeItem('sb-di152-fixtures-auth-token');const c=new BroadcastChannel('sb-di152-fixtures-auth-token');c.postMessage({event:'SIGNED_OUT',session:null});c.close();}""")
                    expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible()
                    expect(page.get_by_role('table')).to_have_count(0)
                    expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0)
                finally:cerrar_fixture(c,s)
            record('DI-153 evento SIGNED_OUT ficticio retira cuentas y navegación',logout_fixture)
            def stale_access():
                c,page,s=new_page()
                try:
                    expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_be_visible()
                    s['hold_access']=True
                    page.evaluate("""() => {const value=JSON.parse(localStorage.getItem('sb-di152-fixtures-auth-token'));const c=new BroadcastChannel('sb-di152-fixtures-auth-token');c.postMessage({event:'TOKEN_REFRESHED',session:value});c.close();}""")
                    esperar(page,lambda:len(s['access_pending'])>=1)
                    pendientes=list(s['access_pending']);s['access_pending'].clear()
                    REPORT.setdefault('retenciones',{})['acceso']=len(pendientes)
                    page.evaluate("""() => {localStorage.removeItem('sb-di152-fixtures-auth-token');const c=new BroadcastChannel('sb-di152-fixtures-auth-token');c.postMessage({event:'SIGNED_OUT',session:null});c.close();}""")
                    expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible()
                    for route,headers in pendientes:route.fulfill(status=200,headers=headers,body=json.dumps({'autorizado':True}))
                    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
                    expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0)
                    assert not s['requests']
                finally:cerrar_fixture(c,s)
            record('DI-153 autorización 200 tardía no monta el panel tras perder la sesión ficticia',stale_access)
            def form_validation():
                c,page,s=new_page()
                try:
                    abrir_usuarios(page)
                    page.get_by_role('button',name='Consultar roles de Perfil ficticio 1',exact=True).click()
                    page.get_by_label('UUID de la cuenta ficticia objetivo').fill('uuid-invalido')
                    expect(page.get_by_role('button',name='Consultar estado y revisión')).to_be_disabled();assert not s['role_requests']
                    page.get_by_label('UUID de la cuenta ficticia objetivo').fill(ID(1))
                    page.get_by_role('button',name='Consultar estado y revisión').click()
                    expect(page.get_by_role('status').filter(has_text='HTTP 200')).to_be_visible()
                    expect(page.get_by_role('button',name='Enviar cambio aprobado')).to_be_disabled()
                    page.get_by_label('UUID de aprobación independiente').fill(ID(77))
                    expect(page.get_by_role('button',name='Enviar cambio aprobado')).to_be_disabled()
                    assert page.locator('#qa-rol option[value="odontologo"]').is_disabled()
                    assert not s['posts']
                finally:cerrar_fixture(c,s)
            record('DI-153 formulario inválido o sin consentimiento no envía cambios ni ofrece alta profesional',form_validation)
            def mismatched_success():
                c,page,s=new_page()
                try:
                    abrir_roles(page);preparar_envio(page);s['write_status']=200;s['wrong_key']=True
                    page.get_by_role('button',name='Enviar cambio aprobado').click()
                    expect(page.get_by_role('status').filter(has_text='No se confirmó el resultado')).to_be_visible()
                    expect(page.get_by_role('button',name='Reintentar exactamente la misma solicitud')).to_be_visible()
                    expect(page.get_by_label('UUID de la cuenta ficticia objetivo')).to_be_disabled()
                    assert len(s['posts'])==1
                    primero=s['posts'][0];s['wrong_key']=False;s['write_status']=503
                    page.get_by_role('button',name='Reintentar exactamente la misma solicitud').click()
                    expect(page.get_by_role('status').filter(has_text='HTTP 503')).to_be_visible()
                    assert len(s['posts'])==2 and s['posts'][1]==primero
                    assert 'HTTP 200' not in page.get_by_role('status').inner_text()
                finally:cerrar_fixture(c,s)
            record('DI-153 200 de otra clave conserva intento y reintenta el mismo contenido sin anunciar éxito',mismatched_success)
            def post_revoked():
                c,page,s=new_page()
                try:
                    abrir_roles(page);preparar_envio(page);s['post_denied']=True
                    page.get_by_role('button',name='Enviar cambio aprobado').click()
                    expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible()
                    expect(page.get_by_role('region',name='Operación controlada de roles')).to_have_count(0)
                    assert len(s['posts'])==1
                finally:cerrar_fixture(c,s)
            record('DI-153 403 de autorización en escritura retira el panel sin respuesta privada',post_revoked)
        browser.close()
except Exception as e:REPORT['bloqueo']=type(e).__name__
finally:
    if server:
        if os.name=='nt':subprocess.run(['taskkill','/PID',str(server.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        elif server.poll() is None:
            os.killpg(server.pid,signal.SIGTERM)
            try:server.wait(timeout=10)
            except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait(timeout=5)
    server_log.close()
    REPORT['aprobadas']=sum(x['aprobada'] for x in REPORT['pruebas']);REPORT['fallidas']=len(REPORT['pruebas'])-REPORT['aprobadas']
    output=args.output;output.mkdir(parents=True,exist_ok=True)
    history_file=output/'INTENTOS_NAVEGADOR.json';history=json.loads(history_file.read_text(encoding='utf8')) if history_file.exists() else []
    history.append(REPORT);history_file.write_text(json.dumps(history,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (output/'NAVEGADOR_FIXTURES.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'aprobadas':REPORT['aprobadas'],'fallidas':REPORT['fallidas'],'bloqueo':REPORT.get('bloqueo')}))
    if REPORT['fallidas'] or REPORT.get('bloqueo'):raise SystemExit(1)
