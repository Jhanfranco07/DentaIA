"""Registrar evidencia final ya ejecutada. No ejecuta pruebas ni SQL."""
import hashlib
import json
import re
from pathlib import Path

R = Path(__file__).resolve().parents[1]
if (R / 'VALIDACION_SQL_RLS.md').exists():
    raise SystemExit('Fase 2 ya registrada: no regenerar el cierre estático histórico. Usar actualizar_manifest.py para hashes.')

# Reparar la codificación de textos generados a través del PowerShell heredado.
replacements = {
    'Regresi?n': 'Regresión', 'm?dulos': 'módulos', 'm?nimo': 'mínimo', 'Dise?o': 'Diseño',
    'revisi?n': 'revisión', 'ejecuci?n': 'ejecución', '?ndices': 'índices',
    'prop?sito': 'propósito', 'conservaci?n': 'conservación',
    'migraci?n': 'migración', 'can?nico': 'canónico', 'auditor?a': 'auditoría',
    'cl?nico': 'clínico', 'Identidad/Auth no duplicada': 'Identidad/Auth no duplicada',
    'espec?fico': 'específico', 'sem?ntica': 'semántica', 'exclusi?n': 'exclusión',
    'describen por columna': 'describen por columna', 'f?sico': 'físico',
    'hist?ricos': 'históricos', 'deliberados': 'deliberados',
    'normalizaci?n': 'normalización', 'retenci?n': 'retención',
    'versi?n': 'versión', 'regresi?n': 'regresión', 'validaci?n': 'validación',
    'pr?ximos': 'próximos', 'est?ticas': 'estáticas', 'acad?mico': 'académico',
    'par?metros': 'parámetros', 'v?nculos': 'vínculos', 'tambi?n': 'también',
    'sint?tico': 'sintético', 'ejecut?:': 'ejecutó:', 'validaci?nes': 'validaciones',
    'comprobaci?n': 'comprobación', 'seg?n': 'según', 'tipos compuestos': 'tipos compuestos',
    'No se a?aden': 'No se añaden',
}
for name in ['MATRIZ_AUDITORIA_TABLAS.md', 'README.md', 'PRUEBAS_Y_LIMITACIONES.md']:
    p = R / name
    s = p.read_text(encoding='utf8')
    for before, after in replacements.items():
        s = s.replace(before, after)
    # El guion de separación del generador anterior también pasó por ASCII.
    if name == 'MATRIZ_AUDITORIA_TABLAS.md':
        s = s.replace('` ? ', '` — ')
    p.write_text(s, encoding='utf8')

results = json.loads((R / 'validacion/RESULTADOS.json').read_text(encoding='utf8'))
assert results['fallidas'] == 0
(R / 'VALIDACION_CONSISTENCIA.md').write_text(f'''# Validación de consistencia final

Fecha: 03/11/2026. Rama `docs/auditoria-arquitectura-integral`, base c992a142.

| Comprobación ejecutada | Resultado | Alcance |
|---|---|---|
| Verificador documental | {results['aprobadas']}/{results['total_comprobaciones']} aprobadas | PK/FK/tipos/NULL/defaults/DDL, enlaces, contratos, fuentes y preservación |
| Modelo auditado | 29 tablas, 219 columnas | 214 originales y cinco incorporaciones justificadas; no nuevas tablas |
| Diagramas | 17/17 renderizados | Mermaid CLI 12.2.0; fuentes y SVG; inspección visual de general y clínico |
| Borradores SQL | 7 analizados | Gramática SQL y PL/pgSQL normalizado; **ninguno ejecutado** |
| Suite del repositorio | 231/231 aprobadas | Node.js test runner; cero fallos/omitidas/canceladas; no prueba las migraciones nuevas |
| Git diff --check | Sin errores | Sin modificaciones funcionales ni staging; nuevos documentos sin commit |
| Fuente original | 38 archivos preservados | Comparación SHA-256 contra inventario previo a la auditoría |

Se consultaron exclusivamente metadatos de Supabase y requisitos de Jira. El catálogo principal tiene cinco tablas públicas de negocio y no acredita el despliegue de las tres administrativas. El modelo propuesto conserva 5 existentes + 3 administrativas + 11 clínicas + 10 de IA.

La ausencia de errores de parser no prueba que PostgreSQL resuelva funciones, extensiones y triggers ni que RLS soporte los escenarios concurrentes. Docker no tenía daemon disponible: no se utilizó Dental-IA como sustituto. No se probaron dos JWT reales, descargas clínicas, inferencia ni expiración de sesión en esta auditoría. No se declara aptitud para producción ni uso clínico.

Consultar [resultados mecánicos](validacion/RESULTADOS.json), [pruebas y límites](PRUEBAS_Y_LIMITACIONES.md), [reproducción](herramientas/README.md) y [matriz por tabla](MATRIZ_AUDITORIA_TABLAS.md). El manifiesto SHA-256 excluye su propio archivo.
''', encoding='utf8')

suspects = []
patterns = {
    'private-key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'supabase-secret': r'\bsb_secret_[A-Za-z0-9_-]{16,}',
    'jwt-literal': r'\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}',
}
for p in R.rglob('*'):
    if not p.is_file():
        continue
    if p.name.startswith('.env') or p.suffix in ['.pyc'] or '__pycache__' in p.parts:
        suspects.append({'archivo': p.relative_to(R).as_posix(), 'tipo': 'archivo no versionable'})
    text = p.read_text(encoding='utf8', errors='replace')
    for kind, pattern in patterns.items():
        if re.search(pattern, text):
            suspects.append({'archivo': p.relative_to(R).as_posix(), 'tipo': kind})
assert not suspects, json.dumps(suspects)

manifest = {
    p.relative_to(R).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted(R.rglob('*')) if p.is_file() and p.name != 'MANIFEST_SHA256.json'
}
(R / 'MANIFEST_SHA256.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
print(json.dumps({'archivos_manifest': len(manifest), 'alertas_secretos': len(suspects)}))
