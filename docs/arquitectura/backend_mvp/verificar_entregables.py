"""Cierre de evidencia local: hashes, secretos literales y salidas reales ya ejecutadas."""
from pathlib import Path
import ast,hashlib,json,re,subprocess,tempfile
R=Path(__file__).resolve().parent;ROOT=R.parents[2];A=R.parent;T=Path(tempfile.gettempdir())
def output(name):
 raw=(T/name).read_bytes()
 return raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig').replace('\r\n','\n')
tap=output('DentaIA-mvp-suite-final.tap');counts={k:int(re.search(r'^# '+k+r' (\d+)$',tap,re.M)[1])for k in ['tests','pass','fail','skipped','cancelled']}
assert counts=={'tests':269,'pass':269,'fail':0,'skipped':0,'cancelled':0}
build=output('DentaIA-mvp-build-final.log');assert 'Compiled successfully' in build and '/api/professional/requests' in build
audit=json.loads(output('DentaIA-mvp-audit-final.json'));assert audit['metadata']['vulnerabilities']['total']==0
old=json.loads((R/'BASELINE_ANTES_CONSOLIDACION.json').read_text(encoding='utf8'))
allowed={'docs/arquitectura/CONTRATOS_API.json','docs/arquitectura/CONTRATOS_API.md','docs/arquitectura/README.md','docs/arquitectura/herramientas/validar_arquitectura.py','docs/arquitectura/validacion/RESULTADOS.json','docs/arquitectura/MANIFEST_SHA256.json','src/features/clinica-http/http.ts','src/features/clinica-http/servidor.ts','src/app/api/clinical/access-grants/route.ts'}
missing=[p for p in old if not(ROOT/p).is_file()];changed=[p for p,h in old.items()if (ROOT/p).is_file()and hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
assert not missing and set(changed)<=allowed,(missing,changed)
assert not subprocess.check_output(['git','diff','--name-only'],cwd=ROOT).strip()
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=ROOT).strip()
assert subprocess.check_output(['git','branch','--show-current'],cwd=ROOT).decode().strip()=='docs/auditoria-arquitectura-integral'
patterns=[r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}',r'sb_secret_[A-Za-z0-9_-]{15,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'];leaks=[]
for folder in [A,ROOT/'src/features/clinica-http',ROOT/'src/app/api/clinical',ROOT/'src/app/api/professional']:
 for p in folder.rglob('*'):
  if not p.is_file():continue
  if p.name.startswith('.env')or p.suffix in {'.pyc','.log','.tmp'}:leaks.append(p.relative_to(ROOT).as_posix())
  try:s=p.read_text(encoding='utf8')
  except UnicodeError:continue
  if any(re.search(x,s)for x in patterns):leaks.append(p.relative_to(ROOT).as_posix())
assert not leaks,leaks
for p in R.glob('*.py'):ast.parse(p.read_text(encoding='utf8'))
for p in R.glob('*.mjs'):subprocess.run(['node','--check',str(p)],cwd=ROOT,check=True,capture_output=True)
assert subprocess.run(['git','diff','--check'],cwd=ROOT,capture_output=True).returncode==0
result={'fecha':'2026-11-03','rama':'docs/auditoria-arquitectura-integral','suite':counts,'typecheck':{'comando':'npm run typecheck','exitCode':0,'fuente':'salida real observada de herramienta en esta fase'},'build':{'exitCode':0,'sha256Salida':hashlib.sha256((T/'DentaIA-mvp-build-final.log').read_bytes()).hexdigest()},'audit':audit['metadata']['vulnerabilities'],'diffCheck':True,'sintaxisScripts':True,'archivosPrevios':len(old),'ausentes':missing,'cambiosPreviosJustificados':changed,'escaneoSecretosLiterales':leaks,'limiteEscaneo':'Patrones JWT/secret/PEM y archivos temporales; complementa revisión de código, no certificación exhaustiva','trackedSinCambios':True,'stagingVacio':True,'DI151SinModificar':True,'commitsCreados':0,'push':False,'remotoModificado':False,'produccionLista':False}
(R/'VERIFICACIONES_FINALES.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'suite':counts,'audit':0,'preservacion':True,'secretosLiterales':0,'scriptsValidos':True}))
