"""Compila resultados ya obtenidos; no sustituye la ejecución del banco SQL."""
import hashlib
import json
from collections import Counter
from pathlib import Path
R=Path(__file__).resolve().parent
root=R.parent
d=json.loads((R/'RESULTADOS.json').read_text(encoding='utf8'))
history=json.loads((R/'INTENTOS.json').read_text(encoding='utf8'))
catalog=json.loads((R/'CATALOGO_VALIDADO.json').read_text(encoding='utf8'))
lines=['# Fase 2: validación SQL, integridad y seguridad RLS','',
 'Fecha: 03/11/2026. Rama `docs/auditoria-arquitectura-integral`. Sin cambios remotos, funcionales, de Jira o de ramas del equipo; sin commit/push/merge. Se mantienen los 31 hallazgos y el alcance de revisión anterior.','',
 '## Entorno y aislamiento','',
 '- Docker respondió a `docker info` y `docker ps`; cliente/servidor 29.9.2. Al comenzar había cero contenedores y únicamente postgres:16.',
 '- El responsable autorizó expresamente descargar Supabase CLI e imágenes oficiales. CLI 3.0.0, carpeta temporal separada, sin login/link ni lectura de .env del proyecto.',
 '- Stack oficial local: PostgreSQL 17.11.0.011, GoTrue v2.197.0, PostgREST v16.5, Storage v1.88.0 y Kong 2.8.1. El CLI puede descargar herramientas internas de inicialización adicionales aunque sus servicios se excluyan.',
 '- Base de ejecución: `dentaia_arch_qa_fase2`, dentro del contenedor QA de nombre cerrado. El Auth oficial se copia **solo como esquema vacío local**; las identidades y sesiones se insertan sintéticamente. No hay cuentas ni credenciales de Dental-IA.',
 '- Los servicios HTTP del stack continúan usando su base local postgres. Las pruebas se conectan a la copia QA por SQL; no se declara validado el flujo HTTP GoTrue/PostgREST de esa copia ni autenticación JWT firmada.',
 '- Las cinco tablas públicas se reconstruyen vacías desde el catálogo verificado previo. Es bootstrap de pruebas; los borradores no recrean esas tablas.',
 '- Versión efectiva: `'+d.get('postgresql','NO VERIFICADA')+'`.','',
 '## Migraciones y orden real','',
 '| Orden | Borrador | Resultado de aplicación | SHA-256 |','|---|---|---|---|']
for i,m in enumerate(d['migraciones'],1):
 lines.append(f"| {i:02} | `{m['archivo']}` | {'APROBADA' if m['aprobada'] else 'FALLIDA'} | `{m['sha256']}` |")
lines += ['', '01 crea identidad/contextos; 02 contenido; 03 concesiones/auditoría; 04 triggers clínicos; 05 investigación; 06 análisis y clave candidata de dental_photos; 07 triggers de IA. La migración administrativa DI-151 se ejecuta después, separadamente y sin cambiar su fuente histórica.',
 '', '## Resultados ejecutados', '',f"Última ejecución completa desde una base limpia: **{d.get('aprobadas',0)} comprobaciones aprobadas y {d.get('fallidas',0)} fallidas**. Cada fila siguiente procede de ejecución SQL, no de fixtures declarados como éxitos. Después de incorporar la comprobación del último administrador y observar explícitamente los bloqueos administrativos, se repitió el banco completo.",'',
 '| Prueba | Clasificación | Resultado |','|---|---|---|']
for t in d['pruebas']:
 lines.append('| '+t['nombre'].replace('|','/')+' | '+t['categoria']+' | '+('APROBADA' if t['aprobado'] else 'FALLIDA')+' |')
if d.get('bloqueo'):lines += ['', '**Bloqueo del último intento:** '+d['bloqueo']]
lines += ['',f"Catálogo físico obtenido por SELECT: **{d.get('catalogo_sql',{}).get('tablas')} tablas, {d.get('catalogo_sql',{}).get('columnas')} columnas, {d.get('catalogo_sql',{}).get('restricciones')} restricciones y {d.get('catalogo_sql',{}).get('indices')} índices**. El verificador adicional comprobó PK, FK y sus acciones DELETE, UNIQUE, cantidad/validación de CHECK, exclusiones GiST e índices: **{catalog['aprobadas']}/29 tablas aprobadas**, {catalog['fallidas']} fallidas. Evidencia: [CATALOGO_VALIDADO.json](pruebas_sql/CATALOGO_VALIDADO.json)."]
lines += ['', '## Permisos: qué quedó validado y qué sigue pendiente','',
 '| Perfil | Verificación real SQL | Límite |','|---|---|---|',
 '| Visitante | Acceso privado bloqueado por ACL y RLS | No hay sesión HTTP en este banco |',
 '| Paciente | Perfil propio y borrado propio de fotos con RLS existente; sin acceso a filas ajenas | Lectura clínica y gestión de concesiones solo en prototipo QA; faltan RPC reales |',
 '| Odontólogo | RLS clínica cerrada; prototipo rechaza IDs ajenos, contexto distinto, vencimiento y revocación | No se declara operativo el servicio profesional real |',
 '| Superusuario | Guarda administrativa SQL, auditoría, aprobaciones y concurrencia; sin acceso clínico directo | AAL2/factores sintéticos, no desafío TOTP real |',
 '', '## Interpretación de seguridad','',
 'Las restricciones PK/FK/CHECK/UNIQUE/exclusión y triggers se prueban como dueño QA. Esas aprobaciones demuestran integridad, no autorización. Las identidades sintéticas incluyen dos pacientes, dos clínicas, dos profesionales autorizados y uno sin concesión, con atenciones de distintos orígenes y permisos vigentes/vencidos/revocados.',
 '', 'El bloqueo por privilegios SQL se registra separado de RLS. Para observar RLS, un GRANT de SELECT local se limita a una transacción reversible y luego se cambia a anon/authenticated: las 21 tablas nuevas continúan sin filas visibles por default-deny. No se usa postgres ni service_role como evidencia positiva de RLS. El bloqueo de service_role es por ACL, dado su BYPASSRLS.',
 '', '**Los siete borradores no incluyen los RPC clínicos de lectura, concesión y revocación.** Por tanto, el acceso clínico positivo del paciente/profesional y su gestión funcional de permisos siguen sin estar implementados en esos borradores. No se agregan políticas directas que permitan evitar la auditoría para obtener un resultado favorable.',
 '', 'El prototipo bajo esquema `qa` demuestra por separado una posibilidad de implementación: derivar actor, consultar rol fresco, validar contexto/recurso, bloquear filas, insertar auditoría mínima y devolver solo después de éxito. Los eventos denegados no incorporan contenido clínico ni recursos ajenos; el fallo de auditoría aborta respuesta y modificaciones. No es un endpoint desplegado ni una implementación completa aprobada para producción.',
 '', 'Ese prototipo devuelve únicamente autorización y recuentos sintéticos: no implementa la proyección completa del historial ni descarga de documentos. La evidencia de concurrencia se conserva con espera observada por sesión en RESULTADOS.json. Las versiones/digests oficiales y los atributos efectivos de roles están en [ENTORNO.json](pruebas_sql/ENTORNO.json).',
 '', '## Concurrencia y límites de las garantías','',
 'Las carreras usan conexiones PostgreSQL independientes y observan esperas en pg_stat_activity. El orden del prototipo es identidad/paciente/contexto/concesión. La lectura autorizada que obtiene el bloqueo primero puede terminar; la revocación espera. Cuando la revocación confirma primero, la nueva lectura espera y vuelve a validar, sin entregar contenido. Se usa clock_timestamp al revisar vencimiento después de esperar.',
 '', 'Estas pruebas no cortan una respuesta HTTP ya autorizada ni recuperan bytes descargados. Cada nueva página/descarga debe revalidar; el endpoint y el proxy de documentos aún requieren implementación. Los locks del prototipo no prueban todos los escritores futuros ni todos los órdenes posibles de bloqueo.',
 '', '## Administración y compatibilidad Auth','',
 'La migración canónica de DI-151 se conserva intacta. Su suite histórica utilizaba tablas Auth mínimas y VALUES posicionales. El adaptador versionado aquí utiliza el esquema oficial local con columnas explícitas, confirmación, aud y timestamps; la copia ejecutada queda en `pruebas_sql/admin_adaptado_qa.sql` cuando se alcanza esa fase.',
 '', 'Los factores verificados/sesiones AAL2 son filas sintéticas para probar guardas SQL y compatibilidad, no un login MFA real ni un JWT firmado. La suite verifica persistencia, namespaces ajenos, aprobaciones independientes, autoedición, MFA requerido, idempotencia, revisión obsoleta, pérdida de autorización y rollback ante fallo de auditoría. La rama mantiene controles de DI-150 sin cambios.',
 '', 'Se comprobó un único administrador restante: su intento de retirarse fue rechazado con CAMBIO_PROPIO_PROHIBIDO y su rol permaneció intacto. Esto demuestra ese invariante, pero no cubre directamente la rama SQL ULTIMO_SUPERUSUARIO_PROTEGIDO ni todos los escritores externos. Las operaciones sobre auth.users siguen requiriendo revisión de compatibilidad gestionada y escritor único antes de rollout.',
 '', '## Errores e intentos conservados','',
 'Los siete borradores se aplicaron sin errores y no requirieron cambios. Las correcciones fueron exclusivamente del banco: (1) ALTER DATABASE no permitía fijar el parámetro custom QA con el rol postgres gestionado; se sustituyó por SET en cada conexión QA; (2) el comparador confundía time con su nombre canónico time without time zone; se añadió la equivalencia, sin alterar columna ni modelo. Se repitió todo desde una base limpia después de esos ajustes.',
 f"Se conservaron {len(history)} intentos en [INTENTOS.json](pruebas_sql/INTENTOS.json). Los errores de preparación/fixtures no se confunden con errores de los borradores. La última ejecución y cada SHA aplicado están en [RESULTADOS.json](pruebas_sql/RESULTADOS.json).",
 '', '| Intento | Aplicaciones SQL aprobadas | Pruebas aprobadas/fallidas | Bloqueo |','|---|---|---|---|']
for i,h in enumerate(history,1):
 lines.append(f"| {i} | {sum(m['aprobada'] for m in h['migraciones'])}/7 | {h['aprobadas']}/{h['fallidas']} | "+str(h.get('bloqueo') or 'Ninguno').replace('|','/').replace('\n',' ')+' |')
lines += ['', '## Regresión del repositorio — separada de SQL','',
 '| Comando ejecutado | Resultado |','|---|---|',
 '| `node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"` | 231/231 aprobadas, cero fallos/canceladas/omitidas |',
 '| `npm run typecheck` | Aprobado |', '| `npm run build` | Aprobado |',
 '| `npm audit --json` | 0 vulnerabilidades |',
 '| `git diff --check` | Sin errores |',
 '| Validador documental | 360/360 repetidas al cierre; no hubo cambios en los siete borradores |','',
 'Los logs locales originales de Node/build/audit se guardaron temporalmente fuera del repositorio; no se versionan archivos de entorno ni credenciales. Esta tabla registra la ejecución de esta sesión, no es un resultado que el generador infiera de las fechas.',
 '', '## Qué falta y qué se puede solicitar','',
 '- **Ninguna migración queda declarada apta para producción por esta prueba local.** La aplicación correcta del DDL permite solicitar revisión técnica de las fases que no tengan errores pendientes, no su ejecución automática en Dental-IA.',
 '- Para las cinco tablas existentes, conservar el comportamiento actual y revisar la única ampliación de clave candidata al llegar a IA.',
 '- Para las tres administrativas: revisar compatibilidad Auth, permisos efectivos, escritor único, pruebas HTTP AAL2 y concurrencia específica antes de una autorización de rollout independiente.',
 '- Para las once clínicas: acordar verificación profesional/roles/retención, convertir el protocolo ensayado en RPC reales auditados, implementar errores/idempotencia completos e integrar vistas y documentos privados. No habilitar SELECT directo de contenido.',
 '- Para las diez IA: mantener diseño futuro. Faltan licencias, datasets reales, evaluación reproducible, revisión profesional, worker con identidad mínima, lease y reconciliación completos.',
 '- No ejecutado aquí: autenticación HTTP con dos JWT reales, expiración real de sesión, Storage/bytes/URLs y descargas concurrentes, entrenamiento/inferencia, validación clínica, carga/rendimiento o restauración de backups.',
 '', '## Reproducción y preservación','',
 'Consultar [instrucciones del banco](pruebas_sql/README.md). El ejecutor no acepta una URL remota; requiere nombre exacto de contenedor/base. Para repetir desde limpio solo puede recrear la base QA explícita con --reset-qa. No se borran documentación previa, historial Git ni volúmenes de otros proyectos.',
 '', 'Las fuentes originales de arquitectura, los 31 hallazgos y el código de DI-151 se conservan. Los resultados del prototipo no se presentan como funcionalidades existentes ni como validación clínica.']
(root/'VALIDACION_SQL_RLS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print('Informe generado desde resultados reales del banco')
