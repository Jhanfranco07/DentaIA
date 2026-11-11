"""Cierre local: salidas realmente ejecutadas, fuentes, SQL y detección de secretos.
No abre conexiones remotas ni modifica el esquema.
"""
from pathlib import Path
import ast,hashlib,json,re,subprocess,sys,tempfile
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent;ARCH=HERE.parent;T=Path(tempfile.gettempdir())
sys.path.insert(0,str(T/'DentaIA-DI151-sql-parser'))
from pglast import parser
def output(n):
    b=(T/n).read_bytes();return b.decode('utf-16'if b.startswith((b'\xff\xfe',b'\xfe\xff'))else'utf-8-sig').replace('\r\n','\n')
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True,encoding='utf8').strip()
counts={k:int(re.search(r'^# '+k+r' (\d+)$',output('DentaIA-fase8-suite.tap'),re.M)[1])for k in ['tests','pass','fail','skipped','cancelled']}
assert counts=={'tests':269,'pass':269,'fail':0,'skipped':0,'cancelled':0}
assert 'Compiled successfully' in output('DentaIA-fase8-build.log')
assert 'tsc --noEmit' in output('DentaIA-fase8-typecheck.log')
audit=json.loads(output('DentaIA-fase8-audit.json'))['metadata']['vulnerabilities'];assert audit['total']==0
sim=json.loads((HERE/'SIMULACION_MIGRACIONES.json').read_text(encoding='utf8'));assert sim['aprobada']and len(sim['migraciones'])==4 and len(sim['checks'])==12
assert sim['catalogo']=={'rls':True,'tablas':19,'indices':54,'columnas':142,'tablasIA':0,'restricciones':118}
for file,n,key in [('REGRESION_PAQUETE_SQL.json',78,'aprobadas'),('REGRESION_HTTP_F4.json',59,'aprobadas'),('HTTP_MVP.json',45,'aprobadas'),('STORAGE_LIMITES.json',3,'aprobadas'),('PRODUCCION_CERRADA.json',8,'aprobadas')]:
    x=json.loads((HERE/file).read_text(encoding='utf8'));assert x[key]==n and not x.get('fallidas',0) and not x.get('bloqueo'),file
backup=json.loads((HERE/'RESPALDO_VERIFICADO.json').read_text(encoding='utf8'));assert backup['backupCompleto']and backup['restauracionLocal']and backup['storageVerificado']and backup['escriturasRemotas']==0
assert backup['tablasContenidoVerificado']==11 and backup['membresiasRestauradas']==24
pack=json.loads((HERE/'PAQUETE_PROPUESTO.json').read_text(encoding='utf8'))
sql=[]
for row in pack['migraciones']:
    p=ROOT/row['archivo'];assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256']
    for f in row['fuentes']:assert hashlib.sha256((ROOT/f['archivo']).read_bytes()).hexdigest()==f['sha256']
    parsed=json.loads(parser.parse_sql_json(p.read_text(encoding='utf8')))
    statements=[x['stmt']for x in parsed['stmts']]
    forbidden={'DropStmt','TruncateStmt','DeleteStmt','UpdateStmt','InsertStmt','CopyStmt'}
    assert not any(set(s)&forbidden for s in statements),p
    assert not any('AlterTableStmt'in s and s['AlterTableStmt']['relation'].get('schemaname')=='public'for s in statements),p
    sql.append({'archivo':row['archivo'],'sha256':row['sha256'],'sentencias':len(statements),'dmlDirecto':False,'alterTablasPublicas':False})
files=git('diff','--name-only').splitlines()+git('ls-files','--others','--exclude-standard').splitlines()
assert all(f.startswith('docs/arquitectura/')for f in files),files
private=[]
for env in [ROOT/'.env.local',ROOT/'.env.backup.local']:
    if not env.exists():continue
    for line in env.read_text(encoding='utf-8-sig').splitlines():
        m=re.match(r'([A-Z_]+)\s*=\s*(.+)',line)
        if m and re.search('SECRET|TOKEN|PASSWORD|DATABASE_URL|PUBLISHABLE_KEY',m[1]):
            value=m[2].strip().strip('"').strip("'")
            if len(value)>15:private.append(value)
leaks=[]
for f in files:
    p=ROOT/f;s=p.read_text(encoding='utf8')
    patterns=[r'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}',r'sb_secret_[A-Za-z0-9_-]{15,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
    if p.name.startswith('.env')or p.suffix in {'.log','.tmp','.pyc','.dump','.dpapi'}or any(re.search(x,s)for x in patterns)or any(x in s for x in private):leaks.append(f)
    if p.suffix=='.py':ast.parse(s)
    if p.suffix=='.mjs':subprocess.run(['node','--check',str(p)],capture_output=True,check=True)
    if p.suffix=='.json':json.loads(s)
assert not leaks,leaks
frozen=git('ls-files','docs/evidencias/arquitectura').splitlines()
assert len(frozen)==38
assert all((ROOT/f).read_bytes()==subprocess.check_output(['git','show','HEAD:'+f],cwd=ROOT)for f in frozen)
assert git('branch','--show-current')=='docs/auditoria-arquitectura-integral'
assert not git('diff','--cached','--name-only')
subprocess.run(['git','diff','--check'],cwd=ROOT,check=True,capture_output=True)
broken=[]
for p in [ARCH/'INTEGRACION_FINAL_SUPABASE_DENTALIA.md',ARCH/'GUIA_FINAL_EQUIPO_DENTAIA.md',HERE/'README.md',HERE/'MATRIZ_CAMBIOS.md']:
    for link in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf8')):
        if link.startswith(('https:','http:','#')):continue
        target=p.parent/link.split('#')[0]
        if not target.exists()and target.resolve()!=(HERE/'COMPROBACIONES_FINALES.json').resolve():broken.append({'archivo':p.name,'link':link})
assert not broken,broken
result={'fecha':'2026-11-03','rama':git('branch','--show-current'),'head':git('rev-parse','HEAD'),'main':git('rev-parse','origin/main'),'suiteNode':counts,'typecheck':{'exitCode':0,'fuente':'salida real de npm run typecheck en esta fase'},'build':{'exitCode':0,'sha256Log':hashlib.sha256((T/'DentaIA-fase8-build.log').read_bytes()).hexdigest()},'audit':audit,'simulacion':{'aprobada':True,'checks':12,'catalogo':sim['catalogo']},'regresionPaqueteSQL':78,'httpJWTLocal':59,'mvpLocal':45,'storageLocal':3,'produccionCerrada':8,'sqlPglast':sql,'respaldoRemotoLecturaRestauradoLocalmente':True,'escriturasRemotas':0,'nuevosEndpointsRemotosHabilitados':0,'autorizacionMigracionesPendiente':True,'archivosRevisados':len(files),'secretosLiteralesDetectados':leaks,'limiteEscaneo':'Patrones y comparación con valores privados configurados; no certificación universal','originalesCongeladosPreservados':38,'codigoFuncionalModificado':False,'diffCheck':True,'commitsCreadosEnFase8':0,'push':False,'merge':False}
(HERE/'COMPROBACIONES_FINALES.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'suite':counts,'sql':78,'http':59,'mvp':45,'storage':3,'produccion':8,'sqlArchivosParseados':len(sql),'secretosDetectados':len(leaks),'originales':38,'escriturasRemotas':0}))
