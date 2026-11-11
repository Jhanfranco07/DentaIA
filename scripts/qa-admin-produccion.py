"""Regresión de navegación en build Next local con entorno Vercel Production/main.
Auth y APIs se interceptan con fixtures; no valida Supabase real ni enrolamiento MFA.
El servidor debe escuchar en 127.0.0.1:3181 y compilar con URL admin404-fixtures.
"""
import argparse,base64,json,time
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:3181';ID=lambda n:f'00000000-0000-4000-8000-{n:012d}'
r={'fecha':datetime.now(timezone.utc).isoformat(),'entorno':'Build Next local; VERCEL=1, VERCEL_ENV=production, ref=main. Chromium real y Auth/API sintéticos; no Supabase remoto.','pruebas':[]}
def check(name,fn):
    try:fn();r['pruebas'].append({'nombre':name,'aprobada':True});print('PASS '+name,flush=True)
    except Exception as e:r['pruebas'].append({'nombre':name,'aprobada':False,'detalle':str(e)[:1200]});print('FAIL '+name,flush=True)
def session(rol):
    enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
    user={'id':ID(1),'aud':'authenticated','email':'fixture@example.test','confirmed_at':'2026-11-01T00:00:00Z','app_metadata':{'dentaia':{'version':1,'estado':'activo','roles':[rol]}},'user_metadata':{'full_name':'Cuenta sintética QA'}}
    return {'access_token':enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':ID(1),'exp':int(time.time())+3600,'role':'authenticated'})+'.fixture','refresh_token':'fixture-refresh','token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':user}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium');r['chromium']=b.version
    def new(rol='superusuario',mfa=True):
        c=b.new_context(viewport={'width':1440,'height':950},service_workers='block');state={'rol':rol,'logged':False,'writes':[],'errors':[],'mfa':mfa}
        def intercept(route):
            req=route.request;u=urlparse(req.url);path=u.path
            def reply(body,status=200,headers=None):route.fulfill(status=status,headers={'content-type':'application/json','cache-control':'private, no-store',**(headers or {})},body=json.dumps(body))
            if u.hostname=='admin404-fixtures.supabase.co':
                if path=='/auth/v1/token':state['logged']=True;reply(session(rol));return
                if path=='/auth/v1/user':reply(session(rol)['user']);return
                if path=='/auth/v1/logout':state['logged']=False;reply({});return
                if path.startswith('/rest/v1/'):
                    reply({'id':ID(1),'full_name':'Cuenta sintética QA'} if path.endswith('/profiles') else [],headers={'content-range':'*/0'});return
                route.abort();return
            if u.hostname!='127.0.0.1':route.abort();return
            if path.startswith('/api/administracion/'):
                if req.method=='POST':state['writes'].append(path)
                if not state['logged']:reply({'codigo':'SESION_INVALIDA'},401);return
                if rol!='superusuario':reply({'codigo':'ROL_INSUFICIENTE'},403);return
                if not mfa:reply({'codigo':'MFA_AAL2_PENDIENTE'},403);return
                if path.endswith('/acceso'):reply({'autorizado':True});return
                if path.endswith('/usuarios/reales'):
                    q=parse_qs(u.query);empty=bool(q.get('q'));reply({'origen':'supabase','consistencia':'lectura_no_transaccional','total':0 if empty else 1,'pagina':1,'paginas':1,'tamano':int(q.get('tamano',['5'])[0]),'usuarios':[] if empty else [{'id':ID(2),'cuenta':'habilitada','perfil':{'estado':'presente','nombre':'Perfil sintético QA'},'asignacion':{'estado':'activa','roles':['paciente']}}]});return
                reply({'codigo':'ESCRITURAS_DESACTIVADAS'},503);return
            if path.startswith('/api/clinical/') or path.startswith('/api/professional/'):reply({'error':'Servicio de fixture no disponible'},503);return
            route.continue_()
        c.route('**/*',intercept);page=c.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:state['errors'].append(str(e)))
        return c,page,state
    def login(page):
        page.goto(BASE+'/cuenta');page.get_by_label('Correo electrónico',exact=True).fill('fixture@example.test');page.get_by_label('Contraseña',exact=True).fill('FixturePassword123!');page.get_by_role('button',name='Entrar a mi cuenta',exact=True).click();expect(page.get_by_role('button',name='Cerrar sesión',exact=True)).to_be_visible()
    c,page,s=new()
    check('Visitante: la ruta existe y no monta datos administrativos',lambda:(page.goto(BASE+'/administracion'),expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible(),expect(page.get_by_role('table')).to_have_count(0)))
    def admin_login():
        login(page);page.get_by_role('link',name='Panel administrativo',exact=True).click();expect(page).to_have_url(BASE+'/administracion');expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_be_visible()
    check('Login sintético y selección del panel administrativo sin 404',admin_login)
    def account_navigation():
        page.goto(BASE+'/cuenta');expect(page.get_by_role('heading',name='Mi cuenta',exact=True)).to_be_visible();page.get_by_role('link',name='Panel administrativo',exact=True).click();expect(page.get_by_role('heading',name='Un espacio para organizar DentaIA.')).to_be_visible();expect(page).to_have_url(BASE+'/administracion')
    check('Regresión: cuenta → enlace Panel administrativo → panel existente',account_navigation)
    def users():
        page.get_by_role('button',name='Usuarios',exact=True).click();expect(page.get_by_role('table')).to_be_visible()
        for w in [320,390,768,1024,1440]:
            page.set_viewport_size({'width':w,'height':950});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),str(w)
        page.get_by_label('Búsqueda por nombre o UUID').fill('sin resultados');expect(page.get_by_text('No hay cuentas para mostrar',exact=True)).to_be_visible()
    check('Listado y búsqueda sintéticos; responsive en cinco tamaños',users)
    check('El recorrido no emite escrituras ni errores JavaScript',lambda: expect(page.locator('body')).to_be_visible() if not s['writes'] and not s['errors'] else (_ for _ in ()).throw(AssertionError(str(s))))
    page.screenshot(path=str(args.output/'administracion-produccion-local.png'),full_page=True);c.close()
    for rol,mfa in [('paciente',True),('odontologo',True),('superusuario',False)]:
        c,page,s=new(rol,mfa)
        def denied():
            login(page);page.goto(BASE+'/administracion');expect(page.get_by_role('heading',name='Acceso a la API protegida')).to_be_visible();expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0);expect(page.get_by_role('table')).to_have_count(0)
        check(f'UI denegada con fixture: {rol}, AAL2={mfa}',denied);c.close()
    b.close()
r['aprobadas']=sum(t['aprobada'] for t in r['pruebas']);r['fallidas']=len(r['pruebas'])-r['aprobadas'];(args.output/'NAVEGADOR.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'aprobadas':r['aprobadas'],'fallidas':r['fallidas']}));raise SystemExit(bool(r['fallidas']))
