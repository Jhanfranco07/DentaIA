"""Sprint 5: Chromium con Auth/HTTP controlados; ninguna conexión remota.
Ejecutar después del build. Conserva la evidencia anterior de Supabase real.
"""
from pathlib import Path
import base64,json,os,socket,subprocess,sys,time,urllib.request
from datetime import datetime,timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
sys.stdout.reconfigure(encoding='utf-8',errors='replace')

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/integracion/validacion'
BASE='http://127.0.0.1:3140'
RECHECK='--recheck-panel' in sys.argv
PANEL_CHECK='Cuenta → panel: resumen, solicitudes y clínica separados del reporte demo'
ID=lambda n:f'00000000-0000-4000-8000-{n:012d}'
report={'fecha':datetime.now(timezone.utc).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'entorno':'Chromium real; Auth y HTTP interceptados; red externa bloqueada; sin Supabase remoto','pruebas':[]}
server=None
log=(OUT/'CHROMIUM_NEXT.log').open('w',encoding='utf8')
def check(name,fn):
    if RECHECK and name!=PANEL_CHECK:return
    try:
        fn();report['pruebas'].append({'nombre':name,'aprobada':True});print('PASS '+name,flush=True)
    except Exception as e:
        report['pruebas'].append({'nombre':name,'aprobada':False,'detalle':str(e)[:1800]});print('FAIL '+name+' '+str(e)[:400],flush=True)
        if name=='Panel anónimo oculta contenido personal':
            report['diagnostico']={'url':page.url,'texto':page.locator('body').inner_text(timeout=3000)[:1500]}
            raise RuntimeError('CHROMIUM_INITIAL_BOUNDARY_FAILED')
def session(n=1):
    enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
    token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':ID(n),'exp':int(time.time())+3600,'role':'authenticated'})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture-refresh','token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':{'id':ID(n),'email':'paciente@example.test','aud':'authenticated','app_metadata':{},'user_metadata':{}}}
try:
    with socket.socket() as probe:probe.bind(('127.0.0.1',3140))
    env={**os.environ,'NODE_ENV':'development','NEXT_TELEMETRY_DISABLED':'1','NEXT_PUBLIC_SUPABASE_URL':'https://sprint5-fixtures.supabase.co','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_fixture','DENTAIA_ADMIN_READS_ENABLED':'false','DENTAIA_ROLE_WRITES_ENABLED':'false','DENTAIA_CLINICAL_HTTP_ENABLED':'false','DENTAIA_SUPABASE_ADMIN_READ_SECRET':'','DENTAIA_SUPABASE_ROLE_WRITE_SECRET':''}
    server=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3140'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    for _ in range(100):
        try:urllib.request.urlopen(BASE+'/cuenta',timeout=3);break
        except Exception:time.sleep(.4)
    else:raise RuntimeError('NEXT_NOT_READY')
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',args=['--no-proxy-server'])
        report['chromium']=browser.version
        context=browser.new_context(viewport={'width':1280,'height':900},service_workers='block')
        if RECHECK:context.add_init_script('localStorage.setItem("sb-sprint5-fixtures-auth-token",'+json.dumps(json.dumps(session()))+');')
        state={'actor':1,'clinical':200,'invalidUser':False,'externalBlocked':[],'unexpected':[],'mutations':[]}
        def intercept(route):
            req=route.request;u=urlparse(req.url);path=u.path
            def reply(body,status=200,headers=None):route.fulfill(status=status,headers={'Content-Type':'application/json','Cache-Control':'no-store',**(headers or {})},body=json.dumps(body))
            if u.hostname=='sprint5-fixtures.supabase.co':
                if path=='/auth/v1/token':reply(session(state['actor']));return
                if path=='/auth/v1/user':
                    reply({'message':'invalid session','code':'bad_jwt'},401) if state['invalidUser'] else reply(session(state['actor'])['user']);return
                if path=='/auth/v1/logout':reply({});return
                if req.method not in ['GET','HEAD']:
                    state['mutations'].append(path);route.abort();return
                if path=='/rest/v1/profiles':reply({'id':ID(state['actor']),'full_name':'Paciente fixture '+str(state['actor'])});return
                if path.startswith('/rest/v1/'):
                    reply([],headers={'Content-Range':'*/0'});return
                state['unexpected'].append(path);route.abort();return
            if u.hostname!='127.0.0.1':state['externalBlocked'].append(u.hostname);route.abort();return
            if path.startswith('/api/clinical/'):
                if req.method!='GET':state['mutations'].append(path);route.abort();return
                if state['clinical']!=200:reply({'error':'denied'},state['clinical']);return
                common={'ok':True,'environment':'academic_remote'}
                if path.endswith('/me'):reply({**common,'kind':'patient','apiVersion':'clinical.workspace.v1','data':{'patientId':ID(state['actor'])}})
                elif path.endswith('/access-grants'):reply({**common,'kind':'grants','apiVersion':'clinical.workspace.v1','data':{'patientId':ID(state['actor']),'items':[{'id':ID(10),'estado':'revocado','expiresAt':'2026-11-01T00:00:00Z'}]},'nextAfterId':None})
                elif path.endswith('/history'):reply({**common,'apiVersion':'clinical.v1','origen':'supabase','caso':{'patientId':ID(state['actor'])},'entries':[{'encounterId':ID(20),'attendedAt':'2026-11-01T00:00:00Z','origin':{'clinicName':'Clínica fixture '+str(state['actor'])}}],'nextCursor':None})
                else:state['unexpected'].append(path);route.abort()
                return
            if path.startswith('/api/administracion/'):
                reply({'error':'Acceso denegado.'},403);return
            route.continue_()
        context.route('**/*',intercept)
        page=context.new_page();page.set_default_timeout(15000)
        page.set_default_navigation_timeout(15000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        def anon():
            page.goto(BASE+'/panel');expect(page.get_by_text('Inicia sesión para acceder a tu panel.',exact=True)).to_be_visible();expect(page.get_by_role('heading',name='Tu resumen',exact=True)).to_have_count(0)
        check('Panel anónimo oculta contenido personal',anon)
        def login():
            page.get_by_role('link',name='Ir a mi cuenta',exact=True).click();expect(page).to_have_url(BASE+'/cuenta')
            page.get_by_label('Correo electrónico',exact=True).fill('paciente@example.test');page.get_by_label('Contraseña',exact=True).fill('Fixture123!')
            page.get_by_role('button',name='Entrar a mi cuenta',exact=True).click();expect(page.get_by_role('heading',name='Mi perfil',exact=True)).to_be_visible();expect(page.get_by_text('Paciente fixture 1',exact=True)).to_be_visible()
        check('Cuenta: login por interfaz y perfil propio',login)
        def panel():
            if RECHECK:page.goto(BASE+'/cuenta')
            page.get_by_role('navigation',name='Continuar mi recorrido').get_by_role('link',name='Mi panel',exact=True).click()
            expect(page.get_by_role('heading',name='Tu resumen',exact=True)).to_be_visible();expect(page.get_by_role('heading',name='Autorizaciones e historial académico',exact=True)).to_be_visible();expect(page.locator('#mis-solicitudes').get_by_role('heading',name='Mis solicitudes',exact=True)).to_be_visible()
            expect(page.get_by_text('Todavía no hay un reporte de demostración.',exact=True)).to_be_visible();expect(page.get_by_text('Clínica fixture 1',exact=False)).to_be_visible()
        check(PANEL_CHECK,panel)
        def responsive():
            for width in [375,1024,1280]:
                page.set_viewport_size({'width':width,'height':900});expect(page.get_by_role('heading',name='Tu resumen',exact=True)).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),str(width)
        check('Panel cargado sin desbordamiento a 375, 1024 y 1280',responsive)
        def mobile():
            page.set_viewport_size({'width':375,'height':850});page.get_by_role('button',name='Abrir menú',exact=True).click()
            link=page.get_by_role('navigation',name='Navegación principal').get_by_role('link',name='Mi panel',exact=True);expect(link).to_be_visible();link.focus();page.keyboard.press('Escape')
            expect(page.get_by_role('button',name='Abrir menú',exact=True)).to_be_focused()
            page.locator('.action-account').focus();page.keyboard.press('Enter');expect(page.get_by_role('heading',name='Mi perfil',exact=True)).to_be_visible()
        check('Menú móvil, Escape y teclado hacia cuenta',mobile)
        for path in ['/','/directorio','/solicitudes','/fotografias','/analisis/demo','/privacidad']:
            def route_check(path=path):
                r=page.goto(BASE+path);assert r.status==200;expect(page.locator('main h1')).to_be_visible()
            check('Ruta existente '+path,route_check)
        def photos():
            page.goto(BASE+'/fotografias');expect(page.get_by_text('consentimiento',exact=False).first).to_be_visible()
        check('Fotografías presenta consentimiento sin subir ni eliminar',photos)
        def denied():
            page.goto(BASE+'/desarrollo/panel-admin');expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible();expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0)
        check('Paciente sin acceso a interfaz administrativa',denied)
        page.set_viewport_size({'width':1280,'height':900})
        for status in [401,403,404,503]:
            def rejection(status=status):
                state['clinical']=status;page.goto(BASE+'/panel');expect(page.get_by_text('Lectura clínica no disponible.',exact=True)).to_be_visible();expect(page.get_by_role('heading',name='Autorizaciones e historial académico',exact=True)).to_have_count(0)
            check('Clínica falla cerrada con HTTP '+str(status),rejection)
        def retry():
            state['clinical']=200;page.get_by_role('button',name='Reintentar lectura clínica',exact=True).click();expect(page.get_by_role('heading',name='Autorizaciones e historial académico',exact=True)).to_be_visible()
        check('Recuperación clínica mediante reintento',retry)
        def logout():
            page.goto(BASE+'/cuenta');page.get_by_role('button',name='Cerrar sesión',exact=True).click();expect(page.get_by_role('button',name='Entrar a mi cuenta',exact=True)).to_be_visible();anon()
        check('Logout elimina acceso al panel',logout)
        def invalid():
            state['invalidUser']=True
            page.evaluate('(s)=>localStorage.setItem("sb-sprint5-fixtures-auth-token",JSON.stringify(s))',session())
            page.goto(BASE+'/panel');expect(page.get_by_role('heading',name='Tu resumen',exact=True)).to_have_count(0);expect(page.get_by_text('No pudimos comprobar tu sesión.',exact=True)).to_be_visible()
        check('Sesión almacenada inválida no muestra datos',invalid)
        def clean():
            assert not errors,errors;assert not state['mutations'],state['mutations'];assert not state['unexpected'],state['unexpected']
        check('Sin errores JS, escrituras de negocio ni solicitudes sin controlar',clean)
        report['redExternaBloqueada']=sorted(set(state['externalBlocked']));report['erroresJS']=errors
        browser.close()
except Exception as e:report['bloqueo']=str(e)[:1500]
finally:
    if server:subprocess.run(['taskkill','/PID',str(server.pid),'/T','/F'],capture_output=True)
    log.close();report['aprobadas']=sum(x['aprobada'] for x in report['pruebas']);report['fallidas']=sum(not x['aprobada'] for x in report['pruebas'])
    report['repeticionFocalizada']=RECHECK
    file=OUT/('CHROMIUM_RECHECK_PANEL.json' if RECHECK else 'CHROMIUM_FIXTURES.json');history=OUT/'INTENTOS_CHROMIUM_FIXTURES.json'
    attempts=json.loads(history.read_text(encoding='utf8')) if history.exists() else [];attempts.append(report)
    history.write_text(json.dumps(attempts,ensure_ascii=False,indent=2)+'\n',encoding='utf8');file.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'aprobadas':report['aprobadas'],'fallidas':report['fallidas'],'bloqueo':report.get('bloqueo')}),flush=True)
    if report['fallidas'] or report.get('bloqueo'):raise SystemExit(1)
