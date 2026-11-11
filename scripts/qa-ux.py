"""QA de presentación en Chromium real con Auth/API sintéticos; nunca Supabase remoto.
Requiere Next dev o next start en 127.0.0.1:3180 con URL pública https://ux-fixtures.supabase.co
 y clave publicable de fixture. No instala dependencias ni inicia procesos.
"""
import argparse,base64,json,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:3180'
ID=lambda n:f'00000000-0000-4000-8000-{n:012d}'
report={'fecha':datetime.now(timezone.utc).isoformat(),'entorno':'Chromium real local; sesión, perfiles y HTTP sintéticos; ninguna conexión Supabase remota','pruebas':[]}
def check(name,fn):
    try:fn();report['pruebas'].append({'nombre':name,'aprobada':True});print('PASS '+name,flush=True)
    except Exception as e:report['pruebas'].append({'nombre':name,'aprobada':False,'detalle':str(e)[:1400]});print('FAIL '+name+' '+str(e)[:300],flush=True)
def session(roles):
    enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
    user={'id':ID(1),'email':'fixture@example.test','aud':'authenticated','confirmed_at':'2026-11-01T00:00:00Z','app_metadata':{'dentaia':{'version':1,'estado':'activo','roles':roles}},'user_metadata':{'full_name':'Cuenta sintética de QA'}}
    token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':ID(1),'exp':int(time.time())+3600,'role':'authenticated'})+'.fixture'
    return {'access_token':token,'refresh_token':'fixture-refresh-not-a-secret','token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':user}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
    report['chromium']=browser.version
    def context(roles=None):
        c=browser.new_context(viewport={'width':1440,'height':950},service_workers='block',reduced_motion='reduce')
        state={'roles':roles or [],'admin':200 if roles and 'superusuario' in roles else 403,'directory_error':False,'mutations':[],'errors':[],'reads':0}
        if roles is not None:c.add_init_script('localStorage.setItem("sb-ux-fixtures-auth-token",'+json.dumps(json.dumps(session(roles)))+');')
        def intercept(route):
            req=route.request;u=urlparse(req.url);path=u.path
            def reply(body,status=200,headers=None):route.fulfill(status=status,headers={'Content-Type':'application/json','Cache-Control':'no-store',**(headers or {})},body=json.dumps(body))
            if u.hostname=='ux-fixtures.supabase.co':
                if path=='/auth/v1/user':reply(session(state['roles'])['user']);return
                if path=='/auth/v1/logout':reply({});return
                if req.method not in ['GET','HEAD']:state['mutations'].append(path);route.abort();return
                if path=='/rest/v1/profiles':reply({'id':ID(1),'full_name':'Cuenta sintética de QA'});return
                if path=='/rest/v1/dentists' and state['directory_error']:reply({'message':'fixture'},400);return
                if path.startswith('/rest/v1/'):reply([],headers={'Content-Range':'*/0'});return
                route.abort();return
            if u.hostname!='127.0.0.1':route.abort();return
            if path=='/api/administracion/acceso':reply({'autorizado':True} if state['admin']==200 else {'error':'Acceso denegado.'},state['admin']);return
            if path=='/api/administracion/usuarios/reales':
                state['reads']+=1;q=parse_qs(u.query);empty=bool(q.get('q'));n=int(q.get('tamano',['5'])[0]);
                reply({'origen':'supabase','consistencia':'lectura_no_transaccional','total':0 if empty else 1,'pagina':1,'paginas':1,'tamano':n,'usuarios':[] if empty else [{'id':ID(2),'cuenta':'habilitada','perfil':{'estado':'presente','nombre':'Perfil sintético de QA'},'asignacion':{'estado':'activa','roles':['paciente']}}]});return
            if path.startswith('/api/administracion/'):
                if req.method=='POST':state['mutations'].append(path)
                reply({'codigo':'ESCRITURAS_DESACTIVADAS'},503);return
            if path=='/api/professional/me':reply({'ok':True,'status':200,'environment':'qa_local','requestId':ID(99),'apiVersion':'clinical.workspace.v1','kind':'professional','data':{'professionalId':ID(1),'dentistId':None,'contexts':[{'membershipId':ID(33),'clinicId':ID(31),'clinicName':'Clínica sintética de QA','validFrom':'2026-01-01T00:00:00Z','validUntil':None}]},'nextAfterId':None});return
            if path.startswith('/api/professional/'):
                kind='patients' if path.endswith('patients') else 'requests'
                reply({'ok':True,'environment':'qa_local','requestId':ID(99),'apiVersion':'clinical.workspace.v1','kind':kind,'data':{'membershipId':ID(33),'professionalId':ID(1),'items':[]},'nextAfterId':None});return
            if path.startswith('/api/clinical/'):reply({'error':'Servicio no disponible en el fixture'},503);return
            route.continue_()
        c.route('**/*',intercept)
        page=c.new_page();page.set_default_timeout(12000);page.on('pageerror',lambda e:state['errors'].append(str(e)))
        return c,page,state
    def no_overflow(page):
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'Desbordamiento horizontal'
    c,page,s=context()
    page.goto(BASE)
    def landing():
        expect(page.get_by_role('heading',level=1)).to_have_count(1)
        expect(page.get_by_role('link',name='Comenzar ahora')).to_have_attribute('href','/cuenta?modo=registro')
        assert page.locator('a[href="#"]').count()==0
        assert 'Prototipo académico' not in page.locator('body').inner_text()
        expect(page.get_by_role('heading',name='Hoy puedes preparar una fotografía.')).to_be_visible()
    check('Landing: rutas reales, una jerarquía principal y límite de IA explícito',landing)
    for width in [320,390,768,1024,1440]:
        def hero(w=width):
            page.set_viewport_size({'width':w,'height':950});no_overflow(page)
            image=page.get_by_alt_text('Una mujer sonríe en la recepción de un consultorio dental');expect(image).to_be_visible();assert image.evaluate('(i)=>i.complete && i.naturalWidth>0')
            image.scroll_into_view_if_needed();b=image.bounding_box();assert b['height']>=219 and b['width']>=280, str(b)
            assert image.evaluate('(i)=>{const r=i.getBoundingClientRect();return document.elementFromPoint(r.x+r.width*.7,r.y+r.height*.4)===i}')
            page.screenshot(path=str(args.output/f'landing-{w}.png'),full_page=True) if w in [390,1440] else None
        check(f'Landing responsive {width}px: fotografía visible y sin elementos encima',hero)
    def public_menu():
        page.set_viewport_size({'width':390,'height':850});b=page.locator('button[aria-controls="navegacion-principal"]');b.click();expect(b).to_have_attribute('aria-expanded','true');page.keyboard.press('Escape');expect(b).to_be_focused();expect(b).to_have_attribute('aria-expanded','false')
    check('Menú público móvil: Escape devuelve el foco',public_menu)
    for path in ['/cuenta?modo=registro','/directorio','/privacidad','/panel','/profesional','/administracion']:
        def anonymous(path=path):
            page.goto(BASE+path);page.locator('h1,h2').first.wait_for();no_overflow(page)
            if path in ['/panel','/profesional']:expect(page.get_by_role('heading',name='Inicia sesión para continuar')).to_be_visible()
            if path=='/administracion':expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0)
        check('Visitante: '+path,anonymous)
    def directory_error():
        s['directory_error']=True;page.goto(BASE+'/directorio');expect(page.get_by_text('No pudimos cargar el directorio.',exact=True)).to_be_visible();s['directory_error']=False;page.get_by_role('button',name='Reintentar',exact=True).click();expect(page.get_by_text('Por ahora no hay odontólogos activos ni ubicaciones publicadas en el directorio.')).to_be_visible()
    check('Directorio: error recuperable y estado vacío sin inventar perfiles',directory_error)
    c.close()
    for roles,paths in [(['paciente'],['/panel','/cuenta','/analisis','/resultados','/fotografias','/solicitudes']),(['odontologo'],['/profesional','/cuenta']),(['superusuario'],['/administracion','/cuenta'])]:
        c,page,s=context(roles)
        for path in paths:
            page.goto(BASE+path);page.locator('h1').first.wait_for()
            if path=='/cuenta':expect(page.get_by_role('heading',name='Mi cuenta',exact=True)).to_be_visible()
            if path=='/panel':expect(page.get_by_role('heading',name='Hola, Cuenta')).to_be_visible()
            if path=='/profesional':
                check('Profesional: membresía sintética compatible y selector de clínica disponible',lambda: expect(page.get_by_label('Clínica activa',exact=True)).to_be_visible())
            if path=='/administracion':expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_be_visible()
            for width in [320,390,768,1024,1440]:
                def responsive(w=width):
                    page.set_viewport_size({'width':w,'height':950});no_overflow(page)
                    if path=='/cuenta':expect(page.get_by_role('navigation',name='Módulos de tu cuenta')).to_have_count(0)
                check(f'{roles[0]} {path}: responsive {width}px',responsive)
            if path in ['/cuenta','/profesional','/administracion']:page.screenshot(path=str(args.output/(roles[0]+'-'+path.strip('/')+'.png')),full_page=True)
        if roles==['paciente']:
            def image_flow():
                page.goto(BASE+'/analisis')
                png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFOsAAAAASUVORK5CYII=')
                page.get_by_label('Seleccionar una fotografía',exact=True).set_input_files({'name':'pixel-sintetico.png','mimeType':'image/png','buffer':png})
                expect(page.get_by_role('heading',name='Revisa la fotografía',exact=True)).to_be_visible()
                page.get_by_role('button',name='Confirmar fotografía',exact=True).click()
                page.get_by_role('button',name='Consultar disponibilidad de IA',exact=True).click()
                expect(page.get_by_text('El módulo de análisis está preparado, pero el motor de inteligencia artificial todavía no está disponible en esta versión.',exact=True)).to_be_visible()
                assert not s['mutations']
            check('Fotografía sintética: revisión local y aviso honesto de IA, sin envío',image_flow)
            def profile_validation():
                page.goto(BASE+'/cuenta');field=page.get_by_label('Nombre completo',exact=True);field.fill('A');page.get_by_role('button',name='Guardar cambios',exact=True).click();expect(field).to_have_attribute('aria-invalid','true');expect(field).to_be_focused();assert not s['mutations']
            check('Perfil: validación accesible conserva el formulario y no envía datos inválidos',profile_validation)
            def drawer():
                page.goto(BASE+'/cuenta');page.set_viewport_size({'width':390,'height':850});button=page.get_by_role('button',name='Abrir navegación');button.click();expect(page.locator('#navegacion-portal').get_by_role('button',name='Cerrar navegación')).to_be_focused();page.keyboard.press('Shift+Tab');expect(page.get_by_role('link',name='DentaIA, página de inicio')).to_be_focused();page.keyboard.press('Shift+Tab');expect(page.get_by_role('link',name='Ir a DentaIA pública')).to_be_focused();page.keyboard.press('Tab');expect(page.get_by_role('link',name='DentaIA, página de inicio')).to_be_focused();page.keyboard.press('Escape');expect(button).to_be_focused();assert page.evaluate('document.body.style.overflow')!='hidden'
            check('Portal móvil: foco contenido, Escape y restauración de desplazamiento',drawer)
            def denied():
                page.goto(BASE+'/profesional');expect(page.get_by_role('heading',name='Acceso restringido')).to_be_visible();page.goto(BASE+'/administracion');expect(page.get_by_role('navigation',name='Secciones del panel administrativo')).to_have_count(0)
            check('Paciente: panel profesional y administración siguen restringidos (fixture)',denied)
        if roles==['odontologo']:
            def professional():
                page.goto(BASE+'/profesional');page.set_viewport_size({'width':1440,'height':950});page.get_by_role('link',name='Mi clínica',exact=True).click();expect(page.get_by_role('link',name='Mi clínica',exact=True)).to_have_attribute('aria-current','page');assert page.locator('nav a[aria-current=page]').count()==1
            check('Profesional: anclas existentes y una única sección activa',professional)
        if roles==['superusuario']:
            def admin():
                page.goto(BASE+'/administracion');page.set_viewport_size({'width':1440,'height':950});page.get_by_role('button',name='Usuarios',exact=True).click();expect(page.get_by_role('table')).to_be_visible();
                for width in [320,390,768,1024,1440]:
                    page.set_viewport_size({'width':width,'height':950});no_overflow(page)
                page.get_by_label('Búsqueda por nombre o UUID').fill('sin resultados');expect(page.get_by_text('No hay cuentas para mostrar',exact=True)).to_be_visible()
            check('Administración: listado y búsqueda vacía con servicios simulados',admin)
        check(roles[0]+': sin escrituras ni errores de JavaScript',lambda s=s: (_ for _ in ()).throw(AssertionError(str(s))) if s['mutations'] or s['errors'] else None)
        c.close()
    c,page,s=context([])
    def no_role():
        page.goto(BASE+'/cuenta');expect(page.get_by_text('Esta cuenta no tiene un rol DentaIA activo.',exact=True)).to_be_visible();expect(page.get_by_role('button',name='Cerrar sesión',exact=True)).to_be_visible()
    check('Cuenta sin rol: conserva alternativa para cerrar sesión',no_role)
    c.close()
    c,page,s=context(['paciente','odontologo','superusuario'])
    def multi_role():
        page.goto(BASE+'/cuenta');other=page.get_by_role('region',name='Otros espacios de tu cuenta');expect(other.get_by_role('link',name='Espacio profesional')).to_have_attribute('href','/profesional');expect(other.get_by_role('link',name='Espacio del paciente')).to_have_attribute('href','/panel')
    check('Cuenta multirrol: conserva acceso contextual a sus otros espacios',multi_role)
    c.close()
    browser.close()
report['aprobadas']=sum(x['aprobada'] for x in report['pruebas']);report['fallidas']=len(report['pruebas'])-report['aprobadas']
(args.output/'resultados.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'aprobadas':report['aprobadas'],'fallidas':report['fallidas']}))
raise SystemExit(bool(report['fallidas']))
