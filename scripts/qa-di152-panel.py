"""Navegador real con HTTP/Auth simulados. Sin credenciales ni llamadas remotas.
Requiere Playwright Python y Chromium ya instalados; no instala dependencias.
"""
from pathlib import Path
import base64,json,os,subprocess,time,urllib.request
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:3112'
REPORT={'fecha':datetime.now(timezone.utc).isoformat(),'entorno':'Chromium real; respuestas HTTP y sesión ficticias; sin Supabase remoto','pruebas':[]}
ID=lambda n:f'00000000-0000-4000-8000-{n:012d}'
def record(name,fn):
    try: fn();REPORT['pruebas'].append({'nombre':name,'aprobada':True});print('PASS '+name,flush=True)
    except Exception as e: REPORT['pruebas'].append({'nombre':name,'aprobada':False,'error':type(e).__name__,'detalleFixture':str(e)[:1000]});print('FAIL '+name+' '+str(e)[:500],flush=True)
def session():
    enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
    token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':ID(99),'exp':int(time.time())+3600,'role':'authenticated'})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture-refresh-not-a-secret','token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':{'id':ID(99),'aud':'authenticated','app_metadata':{},'user_metadata':{}}}
server=None
try:
    env={**os.environ,'NODE_ENV':'development','NEXT_TELEMETRY_DISABLED':'1','NEXT_PUBLIC_SUPABASE_URL':'https://di152-fixtures.supabase.co','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_fixture','DENTAIA_ADMIN_READS_ENABLED':'false','DENTAIA_ROLE_WRITES_ENABLED':'false','DENTAIA_SUPABASE_ADMIN_READ_SECRET':'','DENTAIA_SUPABASE_ROLE_WRITE_SECRET':''}
    server=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3112'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    for _ in range(120):
        try: urllib.request.urlopen(BASE+'/desarrollo/panel-admin',timeout=3);break
        except Exception: time.sleep(.5)
    else: raise RuntimeError('NEXT_NOT_READY')
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        def new_page(auth=True,guard=200):
            context=browser.new_context(viewport={'width':1280,'height':900});state={'guard':guard,'list_status':200,'empty':False,'requests':[],'roles':['paciente'],'revision':2,'write_status':503,'hold':False,'deferred':[]}
            context.route('https://**/*',lambda route:route.abort())
            if auth:
                context.add_init_script('localStorage.setItem("sb-di152-fixtures-auth-token",'+json.dumps(json.dumps(session()))+');')
            def intercept(route):
                path=route.request.url.split(BASE)[-1];headers={'Cache-Control':'private, no-store','Content-Type':'application/json'}
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
                    if route.request.method=='GET':body={'codigo':'ESTADO_ACTUAL','resultado':'consultado','revision':state['revision'],'asignacion':{'version':1,'estado':'activo','roles':state['roles']},'solicitudId':None};status=200
                    else:
                        status=state['write_status'];payload=route.request.post_data_json
                        if status==200:state['revision']+=1;state['roles']=['paciente','superusuario']
                        body={'codigo':'CAMBIO_APLICADO' if status==200 else 'ESCRITURAS_DESACTIVADAS','resultado':'aplicado' if status==200 else 'rechazado','revision':state['revision'] if status==200 else None,'asignacion':{'version':1,'estado':'activo','roles':state['roles']} if status==200 else None,'solicitudId':route.request.headers.get('idempotency-key')}
                        assert payload['revisionEsperada']==2
                    route.fulfill(status=status,headers=headers,body=json.dumps(body));return
                route.abort()
            context.route(BASE+'/api/administracion/**',intercept)
            page=context.new_page();page.goto(BASE+'/desarrollo/panel-admin');return context,page,state
        def denied(auth,status):
            c,page,s=new_page(auth,status)
            try:expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible();expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0);assert not s['requests']
            finally:c.close()
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
        finally:c.close()
        c,page,s=new_page()
        try:
            def mobile():page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='Abrir menú administrativo').click();expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');page.get_by_role('button',name='Usuarios',exact=True).focus();page.keyboard.press('Enter');expect(page.get_by_role('heading',name='Usuarios y perfiles')).to_be_visible()
            record('Navegación móvil y teclado conservados',mobile)
        finally:c.close()
        browser.close()
except Exception as e:REPORT['bloqueo']=type(e).__name__
finally:
    if server:subprocess.run(['taskkill','/PID',str(server.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    REPORT['aprobadas']=sum(x['aprobada'] for x in REPORT['pruebas']);REPORT['fallidas']=len(REPORT['pruebas'])-REPORT['aprobadas']
    output=ROOT/'docs/evidencias/DI-152';output.mkdir(parents=True,exist_ok=True)
    history_file=output/'INTENTOS_NAVEGADOR.json';history=json.loads(history_file.read_text(encoding='utf8')) if history_file.exists() else []
    history.append(REPORT);history_file.write_text(json.dumps(history,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (output/'NAVEGADOR_FIXTURES.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'aprobadas':REPORT['aprobadas'],'fallidas':REPORT['fallidas'],'bloqueo':REPORT.get('bloqueo')}))
    if REPORT['fallidas'] or REPORT.get('bloqueo'):raise SystemExit(1)
