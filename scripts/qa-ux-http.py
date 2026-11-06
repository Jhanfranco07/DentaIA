"""Denegaciones sobre el build Next local (127.0.0.1:3180), sin bearer o credenciales.
No invoca servicios remotos; usa únicamente operaciones sin sesión y rutas cerradas.
"""
import argparse,json,urllib.request,urllib.error
from datetime import datetime,timezone
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
cases=[(path,'GET',{},401) for path in ['/api/administracion/acceso','/api/administracion/usuarios/reales','/api/administracion/roles','/api/administracion/vinculaciones','/api/administracion/resenas']]
cases += [('/api/administracion/ubicaciones','POST',{'Content-Type':'application/json'},401),('/api/administracion/ubicaciones','GET',{},405)]
cases += [('/api/administracion/acceso?rol=superusuario','GET',{'X-Role':'superusuario'},401),('/api/administracion/acceso','GET',{'Authorization':'Basic fixture'},401),('/api/administracion/roles','POST',{'Content-Type':'application/json'},401)]
cases += [(path,'GET',{},404) for path in ['/desarrollo/panel-admin','/desarrollo/mfa-admin','/desarrollo/roles-admin','/api/clinical/patients/me']]
r={'fecha':datetime.now(timezone.utc).isoformat(),'entorno':'Build Next local en production; sin sesión ni conexión Supabase; flags apagados','pruebas':[]}
for path,method,headers,expected in cases:
    req=urllib.request.Request('http://127.0.0.1:3180'+path,headers=headers,method=method,data=b'{}' if method=='POST' else None)
    try:res=urllib.request.urlopen(req,timeout=15)
    except urllib.error.HTTPError as error:res=error
    body=res.read().decode();cache=res.headers.get('cache-control','')
    passed=res.code==expected and (expected!=401 or 'no-store' in cache) and 'fixture@example' not in body and 'usuarioId' not in body
    r['pruebas'].append({'ruta':path,'metodo':method,'esperado':expected,'recibido':res.code,'cache_control':cache,'aprobada':passed})
r['aprobadas']=sum(t['aprobada'] for t in r['pruebas']);r['fallidas']=len(r['pruebas'])-r['aprobadas']
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'aprobadas':r['aprobadas'],'fallidas':r['fallidas']}));raise SystemExit(bool(r['fallidas']))
