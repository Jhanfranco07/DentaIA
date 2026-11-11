import argparse,base64,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
P=Path('docs/ux-administracion/evidencias/despues')
P.mkdir(parents=True,exist_ok=True)
ident=lambda n:f'00000000-0000-4000-8000-{n:012d}'
def token(roles):
 def enc(v):return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
 user={'id':ident(1),'email':'fixture@example.test','aud':'authenticated','app_metadata':{'dentaia':{'version':1,'estado':'activo','roles':roles}},'user_metadata':{'full_name':'Cuenta sintética de QA'}}
 return {'access_token':enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':ident(1),'exp':int(time.time())+3600,'role':'authenticated'})+'.fixture','refresh_token':'fixture','token_type':'bearer','expires_at':int(time.time())+3600,'expires_in':3600,'user':user}
with sync_playwright() as p:
 b=p.chromium.launch()
 c=b.new_context(service_workers='block',reduced_motion='reduce')
 session=token(['superusuario'])
 c.add_init_script('localStorage.setItem("sb-ux-fixtures-auth-token",'+json.dumps(json.dumps(session))+');')
 def route(r):
  u=r.request.url
  if u.startswith('https://ux-fixtures.supabase.co/auth/v1/user'):r.fulfill(json=session['user'])
  elif u.startswith('http://127.0.0.1:3180/api/administracion/acceso'):r.fulfill(json={'autorizado':True})
  elif u.startswith('http://127.0.0.1:3180/api/administracion/usuarios/reales'):r.fulfill(json={'origen':'supabase','consistencia':'lectura_no_transaccional','total':0,'pagina':1,'paginas':1,'tamano':5,'usuarios':[]})
  elif u.startswith('https://'):r.abort()
  else:r.continue_()
 c.route('**/*',route)
 page=c.new_page()
 for width in [320,390,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':900})
  page.goto('http://127.0.0.1:3180/administracion')
  expect(page.get_by_role('heading',name='Panel administrativo')).to_be_visible(timeout=15000)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(P/f'panel-{width}.png'),full_page=True)
 print('5 anchos sin desbordamiento')
 c.close();b.close()
