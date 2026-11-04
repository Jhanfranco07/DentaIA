"""Comparación documental de metadatos: sin conexiones ni datos de usuarios."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;A=R.parent
cat=json.loads((R/'CATALOGO_REMOTO_ANTES.json').read_text(encoding='utf8'))['catalog']
model=json.loads((A/'backend_mvp/MODELO_MVP.json').read_text(encoding='utf8'))['tablas']
tables={t['schema']+'.'+t['table']:t for t in cat['tables']}
columns={(c['table_schema']+'.'+c['table_name'],c['column_name']):c for c in cat['columns']}
matrix=[]
for t in model:
    existing=t['name'] in tables
    matrix.append({'objeto':t['name'],'tipo':'tabla','estadoRemoto':'existente'if existing else'nueva','cambio':'ninguno'if existing else'crear','riesgo':'medio','accion':'Conservar columnas, filas, FK y RLS; NO recrear'if existing else'Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales'})
    for c in t['fields']:
        found=(t['name'],c['name'])in columns
        matrix.append({'objeto':t['name']+'.'+c['name'],'tipo':'columna','estadoRemoto':'existente'if found else'nueva','cambio':'ninguno'if found else'crear dentro de tabla nueva','riesgo':'bajo'if found else'medio','accion':'Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales'if found else'No agregarla a tablas originales ni duplicar Auth'})
for name in ['dentaia_cambiar_roles_v1','grant_clinical_access','revoke_clinical_access','get_authorized_clinical_history','get_clinical_workspace']:
    matrix.append({'objeto':'public.'+name,'tipo':'RPC','estadoRemoto':'nuevo','cambio':'crear','riesgo':'alto','accion':'ACL explícita; administrativo solo service_role servidor y controles completos; clínicos authenticated con autorización interna y configuración cerrada'})
for p in cat['policies']:
    matrix.append({'objeto':p['schemaname']+'.'+p['tablename']+'.'+p['policyname'],'tipo':'RLS','estadoRemoto':'existente','cambio':'ninguno','riesgo':'medio','accion':'Preservar definición y roles actuales; Storage permanece privado'})
for obj in ['public.profiles.clinical_executor_provenance','public.appointment_requests.clinical_executor_requests']:
    matrix.append({'objeto':obj,'tipo':'RLS','estadoRemoto':'nueva','cambio':'crear','riesgo':'alto','accion':'Solo rol técnico NOLOGIN/NOBYPASSRLS, con SELECT de columnas mínimas y RPC autorizado; no cambia permisos de pacientes'})
matrix.append({'objeto':'public.appointment_requests.appointment_requests_professional_page','tipo':'índice','estadoRemoto':'nuevo','cambio':'crear','riesgo':'medio','accion':'Parcial WHERE is_demo, no UNIQUE; bloqueo acotado por lock_timeout 2s'})
matrix.append({'objeto':'extensions.btree_gist','tipo':'extensión','estadoRemoto':'nueva','cambio':'crear','riesgo':'medio','accion':'Necesaria para integridad de periodos; ensayar capacidad managed antes de aplicar'})
(R/'MATRIZ_CAMBIOS.json').write_text(json.dumps(matrix,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
lines=['# Matriz de integración incremental — Dental-IA','','Metadatos de lectura del 03/11/2026. No contiene filas ni credenciales. No es autorización de ejecución.','','| Objeto | Estado remoto | Cambio requerido | Riesgo | Acción propuesta |','|---|---|---|---|---|']
for row in matrix:lines.append('| '+ ' | '.join(str(row[k]).replace('|','/')for k in ['objeto','estadoRemoto','cambio','riesgo','accion'])+' |')
lines+=['','Las 43 columnas públicas se mantienen; 99 pertenecen a 14 tablas nuevas. No hay tablas IA. La precisión real numeric(10,2) de dentists.consultation_price se conserva: no se sustituye por numeric sin escala.','La huella de deriva incluye tipos formateados, defaults/nulabilidad, ACL de tabla/columna, restricciones, índices y políticas. No es un respaldo ni una prueba criptográfica de la identidad del servidor.']
(R/'MATRIZ_CAMBIOS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps({'filasMatriz':len(matrix),'tablasRemotas':len(tables),'columnasRemotas':len(columns),'tablasNuevas':sum(t['name']not in tables for t in model),'columnasNuevas':sum((t['name'],c['name'])not in columns for t in model for c in t['fields'])}))
