"""Armoniza solo la copia revisada. No conecta a servicios ni cambia refs de Git."""
import hashlib,json,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[1]
REPO=R.parents[1]
def write(name,text): (R/name).write_text(text.strip()+'\n',encoding='utf8')
def append(name,text):
 p=R/name;v=p.read_text(encoding='utf8');marker='\n## Actualización de auditoría integral\n'
 v=v.split(marker)[0];p.write_text(v.rstrip()+marker+'\n'+text.strip()+'\n',encoding='utf8')

write('README.md', '''# DentaIA — arquitectura integral auditada

Fecha: **03/11/2026, America/Lima**. Rama local `docs/auditoria-arquitectura-integral`, desde c992a142 de DI-151. Sin commits, push, PR, merge, modificaciones funcionales o escrituras en Jira/Supabase.

**Dictamen:** modelo físico definitivo **propuesto para revisión del equipo y QA sintético**, no listo para producción. Se conservan las 29 tablas; las 214 columnas originales se auditan y el diseño revisado tiene 219 (cinco incorporaciones justificadas). Las 38 piezas de origen permanecen intactas en `../evidencias/arquitectura/`.

## Lectura recomendada

1. [Informe y 31 hallazgos](AUDITORIA_INTEGRAL.md) · [diferencias del modelo](CAMBIOS_MODELO.md).
2. [Arquitectura general y módulos](ARQUITECTURA_GENERAL.md), [lógica](ARQUITECTURA_LOGICA.md) y [física](ARQUITECTURA_FISICA.md).
3. [Modelo conceptual](MODELO_CONCEPTUAL.md), [lógico](MODELO_LOGICO.md), [físico](MODELO_FISICO.md) y [diccionario de las 29 tablas](DICCIONARIO_DATOS.md).
4. [Roles y seguridad](SEGURIDAD_Y_ROLES.md), [políticas por tabla](POLITICAS_POR_TABLA.md) y [protocolo de RPC/revocación/concurrencia](PROTOCOLO_RPC_Y_CONCURRENCIA.md).
5. [Contratos de API](CONTRATOS_API.md), [diagramas editables y SVG](DIAGRAMAS.md).
6. [Plan de implementación y coordinación](BRECHAS_Y_PLAN_IMPLEMENTACION.md), [decisiones](DECISIONES_ARQUITECTURA.md), [fuentes comprobadas](FUENTES_Y_EVIDENCIAS.md).
7. [Pruebas y limitaciones](PRUEBAS_Y_LIMITACIONES.md), [consistencia](VALIDACION_CONSISTENCIA.md) y [borradores SQL por fases](borradores_sql/README.md).

## Fuentes estructuradas

- [MODELO_DATOS.json](MODELO_DATOS.json): 29 tablas/219 columnas con PK, FK, CHECK, UNIQUE, índices y fases.
- [INVENTARIO_SUPABASE_VERIFICADO.json](INVENTARIO_SUPABASE_VERIFICADO.json) y [catálogo complementario](CATALOGO_COMPLEMENTARIO_VERIFICADO.json): metadatos, no filas privadas.
- [REQUISITOS_JIRA_VERIFICADOS.json](REQUISITOS_JIRA_VERIFICADOS.json): 171 incidencias leídas, con descripción y responsable de coordinación; no se modifica Jira.
- [FUENTES_VERIFICADAS.json](FUENTES_VERIFICADAS.json): refs/SHAs y archivos contrastados.
- [HALLAZGOS.json](HALLAZGOS.json) y [validación mecánica](validacion/RESULTADOS.json).
- Los anexos originales [REQUISITOS_JIRA.md](REQUISITOS_JIRA.md), [CATALOGO_GESTIONADO.md](CATALOGO_GESTIONADO.md) e [INVENTARIO_SUPABASE.json](INVENTARIO_SUPABASE.json) se conservan como instantáneas del paquete recibido; los archivos VERIFICADOS describen la consulta de esta auditoría.

## Qué se puede implementar y qué no

| Grupo | Tablas | Situación |
|---|---:|---|
| MVP académico actual | 5 existentes | Reutilizar; no recrear Auth, Storage ni módulos personales. |
| Administración DI-151 | 3 de migración publicada | Revisar/ensayar su rollout en QA autorizado; ausentes en el catálogo principal. La validación manual declarada no se presenta como nueva evidencia de despliegue aquí. |
| Clínica y permisos | 11 propuestas | Primer candidato a QA sintético tras acordar identidad/verificación/membresías/retención; no habilitar contenido antes de RPC y auditoría efectiva. |
| IA | 10 propuestas | Diseño futuro condicionado a dataset/licencia, experimento reproducible, autorización específica y servicio mínimo. |

El motor Mermaid renderizó 17 diagramas. Los borradores SQL se analizan sintácticamente, pero **no se ejecutaron** por falta de daemon Docker. Los tests del repositorio no sustituyen esos ensayos ni pruebas con JWT reales. No existe autorización para aplicar estas propuestas a Dental-IA.
''')

sources={}
refs=['origin/main','origin/feature/superusuario-admin','origin/feature/vista-paciente','origin/feature/vista-odontologo','origin/feature/anelis-di156-historial-demo','origin/feature/anelis-vista-profesional-s5','origin/feature/angie-avance3','origin/feature/landing-comercial']
for ref in refs:sources[ref]=subprocess.check_output(['git','rev-parse',ref],cwd=REPO,text=True).strip()
selected={
'origin/main':['package.json','next.config.ts','src/lib/supabase/database.types.ts','src/features/solicitudes/solicitudes.ts','src/features/fotografias/eliminar.ts','src/features/analisis/casos.ts','src/app/(modulos)/profesional/page.tsx','.github/workflows/ci.yml','.github/workflows/tests.yml','.github/workflows/security.yml'],
'origin/feature/superusuario-admin':['src/features/autorizacion/autorizacion.ts','src/features/administracion/cambios-roles.ts','src/features/administracion/lecturas-supabase.ts','src/features/administracion/escrituras-roles-supabase.ts','src/features/administracion/servidor-cambios-roles.ts','supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql'],
'origin/feature/vista-paciente':['src/app/(modulos)/panel/page.tsx','src/features/panel/PanelPaciente.tsx','src/features/panel/ResumenPanel.tsx'],
'origin/feature/anelis-di156-historial-demo':['src/features/profesional/historial-autorizado.ts','src/features/profesional/proveedor-historial-sintetico.ts','docs/DI-157-integracion-informacion-autorizada.md']}
files=[]
for ref, paths in selected.items():
 for path in paths:
  content=subprocess.check_output(['git','show',ref+':'+path],cwd=REPO)
  files.append(dict(ref=ref,commit=sources[ref],path=path,sha256=hashlib.sha256(content).hexdigest()))
(R/'FUENTES_VERIFICADAS.json').write_text(json.dumps(dict(fecha='2026-11-03',refs=sources,archivos_contrastados=files,alcance='No representa auditoría línea por línea de todas las ramas históricas'),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
write('FUENTES_Y_EVIDENCIAS.md', '# Fuentes verificadas de esta auditoría\n\n'
 'Fecha 03/11/2026, America/Lima. Las fuentes originales siguen en ../evidencias/arquitectura y sus hashes se comprueban sin modificarlas. Este documento sustituye las afirmaciones de inspección de la copia inicial; no atribuye a esta ejecución los 160 archivos o estados de Vercel citados por el paquete anterior.\n\n'
 '## Git local y GitHub\n\nRepositorio conectado confirmado mediante GitHub, refs actualizadas con git fetch y archivos contrastados mediante git show, sin checkout de ramas de compañeros. Rama de documentación desde c992a142; no commits ni publicación.\n\n'
 '| Ref | SHA |\n|---|---|\n'+ '\n'.join('| '+k+' | '+v+' |' for k,v in sources.items())+
 '\n\nLa rama paciente avanzó desde el SHA 502790a6 del insumo a ac545b5d. main conserva la pantalla profesional sintética; el historial de la rama DI-156 usa un escenario simulado, no un servicio Supabase. Administración conserva sus controles y declaración manual; no se prueba aquí una escritura administrativa remota. El detalle de archivos/hashes está en FUENTES_VERIFICADAS.json.\n\n'
 '## Jira\n\nJQL project = DI, paginación 100 + 71: 171 incidencias con descripción. Se verificaron específicamente DI-34, DI-36, DI-144, DI-145 y DI-146 y se contrastaron criterios del resto del alcance. DI-144 figura En curso y DI-151 Listo; un estado administrativo no prueba una migración o un permiso efectivo. No se escribieron comentarios ni estados. Las descripciones y responsables mínimos de coordinación están en REQUISITOS_JIRA_VERIFICADOS.json.\n\n'
 '## Supabase\n\nSolo SELECT de catálogo y metadatos del bucket; ninguna fila de pacientes, perfiles, Auth, fotografías o resultados. PostgreSQL reporta **17.11**. Cinco tablas/43 columnas, 32 restricciones, 13 índices, 16 políticas y bucket dental-photos privado con 8 MiB y JPEG/PNG/WebP. No aparecen tablas/funciones de negocio dentaia_admin, clinical o ml. Migraciones aplicadas observadas: 20261025150315 dentaia_mvp_independent_modules y 20261025150507 allow_photo_owner_cleanup_after_consent_revocation.\n\n'
 'Se inspeccionaron además 68 columnas de tablas Auth relevantes y 89 entradas de privilegios de columnas para anon/authenticated, sin valores de cuentas. pgcrypto 1.3 instalado; btree_gist disponible 1.7 pero sin instalar. No se cambia configuración ni se aplica DDL. Los JSON VERIFICADO contienen el catálogo, no secretos.\n\n'
 '## Fuentes primarias de plataforma\n\n'
 '- [Restricciones PostgreSQL](https://www.postgresql.org/docs/17/ddl-constraints.html): FK, CHECK/NULL, UNIQUE y exclusión.\n'
 '- [btree_gist](https://www.postgresql.org/docs/17/btree-gist.html): igualdad y desigualdad en exclusiones; no se presenta como extensión instalada.\n'
 '- [Funciones Supabase](https://supabase.com/docs/guides/database/functions): privilegios, search_path y elección de SECURITY INVOKER/DEFINER.\n'
 '- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [Auth](https://supabase.com/docs/guides/auth/managing-user-data).\n\n'
 'No se revalidó el despliegue Vercel ni se disparó CI; sus estados del paquete anterior son evidencia histórica atribuida. Se revisaron los YAML actuales y el diseño de despliegue, sin introducir infraestructura sin evidencia.')

append('ARQUITECTURA_GENERAL.md', '''Esta revisión conserva el monolito modular y el inventario de módulos. El modelo revisado añade solo cinco columnas justificadas, no tablas: 29 tablas y 219 columnas. La referencia de cuenta/perfil es transversal (base ya integrada y contrato de roles DI-144), no una afirmación de que DI-144 haya creado por sí sola el login.

La consulta profesional propia requiere un servicio nuevo por destinatario vinculado; la demo actual no es esa autorización. El historial compartido sigue como MVP sintético y diseño de servicios, sin escritura asistencial real o interoperabilidad. La identidad estable es por cuenta Auth, no deduplicación de personas entre sistemas.

Leer primero AUDITORIA_INTEGRAL.md y FUENTES_Y_EVIDENCIAS.md para estados actualizados, fuentes y riesgos. Los estados de Jira se conservaron sin modificarlos.''')
append('ARQUITECTURA_LOGICA.md', '''El servicio clínico usa el backend Next.js existente y una operación de base auditada: no pasa por un cliente administrativo general ni por SELECT directo de contenido. Identidad Auth, verificación profesional, membresía y concesión son condiciones distintas, no cuatro sistemas de roles. Un registro verified no otorga automáticamente odontologo; DI-151 necesita una ampliación aprobada para habilitar esa concesión.

Conservar la interfaz de Anelis mediante un adaptador explícito: los identificadores de fixture y el parámetro escenario no se aceptan como autoridad del backend. La fuente real añade origen supabase y versión de contrato sin etiquetarse falsamente como sintética; ningún error usa datos ajenos como fallback. No se modifica aquí ningún componente.

El trabajador IA y sus leases son futuros. Las tablas no constituyen un servicio desplegado; las credenciales de investigación no equivalen a rol superusuario y no habilitan lectura clínica.''')
append('ARQUITECTURA_FISICA.md', '''La consulta actual confirma PostgreSQL 17.11 y btree_gist disponible pero no instalado. Docker se contempla únicamente como herramienta opcional de ensayo local desechable, no como infraestructura actual de DentaIA. No se incorpora FastAPI, AWS o Render como servicio existente.

La futura consulta clínica se procesa en Next.js y PostgreSQL con auditoría; la descarga es un proxy autenticado con autorización por petición, no una URL pública. Los límites de Vercel, las cuotas y el presupuesto no se midieron. La rama de documentación no se publicó ni desplegó y no se revalidó Vercel en esta auditoría.''')
append('SEGURIDAD_Y_ROLES.md', '''## Reglas vinculantes del modelo corregido

Las cinco tablas actuales mantienen sus políticas observadas; no se añade lectura profesional directa a appointment_requests ni se amplía patient_consents. En clinical/ml el borrador aplica RLS y revoca acceso directo de PUBLIC, anon, authenticated y service_role. No hay políticas SELECT de contenido que permitan omitir auditoría: cada RPC necesita revisión y pruebas antes de conceder EXECUTE. Conocer un UUID, ser dueño de una cuenta sin ficha clínica o ser superusuario no permite historias ajenas.

El paciente controla solo su registro y concesiones. Odontólogo requiere rol fresco, verificación aprobada, membresía/clinica activas y recursos autorizados. La clínica histórica de origen no debe estar activa hoy para conservar procedencia. La recepción de una solicitud no concede acceso al historial. Supervisión administrativa no es supervisión clínica.

Revocación usa el protocolo de bloqueos descrito aparte; páginas/streams ya autorizados tienen la limitación temporal expresa. El objeto clínico no se entrega si falla la auditoría; una política RLS no prueba existencia ni inocuidad del binario.

La revisión de perfiles profesionales y recomendaciones debe atribuirse a responsables y evidencia real. El campo review_status no acredita por sí solo respaldo odontológico: la publicación de contenido requiere un acta/artefacto versionado de revisión por código/versión, o que el equipo acuerde otra trazabilidad antes de habilitarlo. No se inventa una cuenta médica revisora ni se usa Auth para deducir credenciales profesionales.

La retención RESTRICT clínica afecta futuras bajas de Auth. Resolver soporte, conservación y anonimización antes de datos reales; no fijar aquí plazos legales. La excepción de borrado del subárbol de análisis académico es expresa para preservar el comportamiento actual de fotos. Ver MODELO_FISICO.md y PROTOCOLO_RPC_Y_CONCURRENCIA.md.''')
append('POLITICAS_POR_TABLA.md', '''## Estado efectivo del borrador

Las reglas propuestas anteriores son una especificación de las futuras operaciones, no GRANT actualmente concedidos. Para cada una de las 11 tablas clinical y las 10 ml, los siete borradores SQL activan RLS y aplican REVOKE ALL a PUBLIC, anon, authenticated y service_role; sin una política permisiva ni acceso al esquema, no hay lectura/escritura cliente. Esto falla cerrado, pero aún no ofrece el servicio funcional.

Un futuro RPC clínico privilegiado necesita propietario mínimo revisado, search_path vacío, SQL estático, identidad vigente, comprobación de cada recurso y auditoría en la misma transacción. Nunca conceder EXECUTE a PUBLIC. Un wrapper SECURITY INVOKER público no basta para autorizar. No se crean en estos borradores wrappers privilegiados incompletos ni roles clínicos automáticos.

| Familia | Lectura objetivo | Escritura objetivo | Condición antes de habilitar |
|---|---|---|---|
| Identidad profesional/clínica | Propia metadata mínima o procedencia de atención autorizada | Verificador/operador explícitamente autorizado, sin autoaprobación | Vinculación y rol canónico coordinados; no duplicar Auth |
| Contenido clínico | Propietario o concesión por contexto/recurso, siempre auditada | Fuera del MVP de lectura; futuras correcciones append-only | RPC positivo/negativo y fallo de auditoría probados |
| Concesiones/recursos | Propietario; profesional solo alcance dirigido | Paciente emisor mediante transacción; revocación irreversible | Idempotencia y carreras lectura/revocación ensayadas |
| Auditoría clínica | Proyección propia; verificador clínico por acordar | INSERT de función controlada, no UPDATE/DELETE ordinarios | No inventar FK de recursos no autorizados |
| Dataset/modelo/evaluación | Operador de investigación aprobado | Protocolo reproducible y versiones protegidas | Licencia, partición, métricas reales y privilegios mínimos |
| Análisis personal | Propietario derivado y autorización vigente | Propietario crea/revoca; trabajador mínimo completa con lease | Contrato de servicio, cancelación y borrado compatibles |

En IA, CASCADE de foto no autoriza lectura de ella: se limita a preservar el borrado. Los bytes Storage tienen controles separados. Las tablas de administración siguen el SQL DI-151 sin políticas nuevas ni una segunda fuente de roles.''')
append('BRECHAS_Y_PLAN_IMPLEMENTACION.md', '''## Fases revisadas y criterios de salida

| Fase | Se puede preparar ahora | Requiere decisión/validación | Salida comprobable |
|---|---|---|---|
| 0 — Contrato común | Revisar estas 29 tablas, 219 columnas y 31 hallazgos | Verificación profesional, retención, estados y política de análisis | Acuerdo del equipo y alcance MVP/futuro firmado, sin cambios automáticos de Jira |
| 1 — Base existente | Reutilizar las cinco tablas y SDK | No quitar is_demo para aparentar atención real | Regresión actual y permisos por propietario intactos |
| 2 — Administración | Revisar SQL DI-151 conservado | Conciliar entorno de validación manual con ausencia de esquema en proyecto principal | QA SQL y rollout autorizado, flags cerradas por defecto |
| 3 — Clínica sintética | 11 tablas propuestas y contratos de Anelis | Roles/verificación, contextos, RPC y auditoría | Dos clínicas, paciente común, permiso/revocación y pruebas negativas/carreras |
| 4 — Integración de vistas | Adaptadores del puerto profesional y panel paciente | Listado profesional por destinatario, retorno interno y estados reales | Sin escenario del cliente como autorización, sin duplicar módulos |
| 5 — Investigación IA | 6 tablas de dataset/modelo/evaluación/contenido | Licencias, manifiesto, particiones y revisión real | Experimento reproducible con precisión/recall/F1/matriz observados |
| 6 — Análisis privado | 4 tablas de autorización/job/resultado/asociación | Texto de autorización, worker, leases y reconciliación | Propiedad cruzada, cancelación y borrado de foto probados |
| 7 — Operación | Guía de secretos, errores y pruebas | Backups/RPO/RTO, límites/costo, monitoreo | Restauración sintética y smoke del entorno autorizado |

La historia DI-144 está En curso; DI-151 Listo es una confirmación de trabajo, no evidencia de despliegue en este proyecto. No se modifica ninguno de esos estados.

Coordinación, sin asignar tareas nuevas: Jhan (DI-34/144/40) mantiene contratos de autorización y revisión SQL; Anelis (DI-36/145/39/42/43) acuerda puertos/persistencia profesional e historial; Angie (DI-146/35/41/44) integra panel, permisos visibles y directorio; Stephan (DI-147/37/38) conserva fotos/consentimiento y coordina licencias/datos. Validar esta distribución con los responsables, no trasladarles unilateralmente alcance.

Antes de extender el backend con Anelis: acordar DTO clinical.v1, IDs Auth/patient/professional/membership, errores genéricos, paginación, ausencia de datos y proyección de procedencia. Resolver clínica destino de solicitudes antes de filtrar por sede. La app actual no tiene ese campo.

No llevar clínica ni IA a producción solo por disponer de DDL. Los criterios de QA están en PRUEBAS_Y_LIMITACIONES.md; la revisión de conservación y consentimiento sigue pendiente.''')
append('DECISIONES_ARQUITECTURA.md', '''| ID | Decisión revisada | Alternativa descartada / pendiente |
|---|---|---|
| ADR-15 | Modelar 219 columnas y no más tablas: motivos de corrección y lease son datos indispensables del contrato original | Omitirlos mantiene promesas de auditoría/recuperación sin representación |
| ADR-16 | Ficha publicada opcional; Auth y paciente únicos por cuenta | No emparejar cuentas por nombre/email ni exigir publicación demo para ser profesional |
| ADR-17 | Episodios de membresía y exclusión de solapamiento | Sobrescribir origen pierde trazabilidad; btree_gist necesita revisión/instalación QA |
| ADR-18 | IA personal CASCADE desde foto/propietario; investigación RESTRICT separada | RESTRICT genérico rompería borrado actual; reutilizar imágenes para dataset no está autorizado |
| ADR-19 | Acceso clínico por operación auditada y cero GRANT de contenido directo | Un SELECT con RLS que omita auditoría incumple el criterio DI-145 |
| ADR-20 | Backend Next.js existente y adaptadores de DTO; sin segundo backend CRUD | Servicio de visión sigue independiente/futuro solo cuando el experimento lo justifique |

Estas son propuestas técnicas, no acuerdos atribuidos al equipo. Quedan abiertas: vocabulario final, propósito/texto de permiso, contexto de solicitudes por sede, verificador/registro de evidencia profesional, revisión de recomendaciones, baja de Auth con historia, conservación, ejecución SQL real y operación del worker. No declarar cierre productivo de esos puntos.''')

write('borradores_sql/README.md', '''# Borradores SQL por dominio — NO APLICADOS

Estos archivos son propuestas dentro de documentación, **no migraciones instaladas en supabase/migrations**. No ejecutarlos contra Dental-IA ni producción. No cargan datos de usuarios.

Precondiciones futuras: aprobación del equipo, base PostgreSQL 17.11 compatible desechable cuyo nombre comience por dentaia_arch_qa_, cinco tablas académicas de QA vacías y roles técnicos normales. Establecer dentaia.architecture_draft='qa_only' solo en ese ambiente. El guarda reduce ejecuciones accidentales; no es un permiso para usar datos reales.

| Orden | Archivo/fase | Tablas | Dependencias y condición |
|---|---|---:|---|
| Existente | public y Auth/Storage | 5 de negocio | No recrear en migraciones de negocio ni alterar políticas actuales |
| Admin separada | [SQL DI-151 canónico](../../../supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql) | 3 | Se referencia sin copiar ni modificar; requiere revisión del Auth gestionado, QA y autorización aparte |
| 01 | [Identidad clínica](01_clinical_identidad.sql) | 5 | btree_gist propuesto; disponible pero no instalado remotamente. Roles no se conceden automáticamente |
| 02 | [Contenido](02_clinical_contenido.sql) | 3 | Paciente, membresía y FK compuestas; escritura asistencial real fuera del MVP |
| 03 | [Permisos y auditoría](03_clinical_permisos_auditoria.sql) | 3 | Ningún acceso de cliente hasta implementar y validar RPC |
| 04 | [Integridad clínica](04_clinical_integridad.sql) | 0 | Mismo paciente, origen, rutas, revisión y append-only |
| 05 | [Investigación IA](05_ia_investigacion.sql) | 6 | Clinical 01 instala extensión; si IA se implementa por separado, aprobar esa dependencia antes. Sin datasets reales |
| 06 | [Análisis personal](06_ia_analisis.sql) | 4 | Candidata UNIQUE adicional en dental_photos para FK de propietario; no cambia el algoritmo actual ni autoriza entrenamiento |
| 07 | [Integridad IA](07_ia_integridad.sql) | 0 | Matrices, versiones, estados, resultado y lease. Worker/RPC aún futuros |

Todos los CREATE TABLE nuevos activan RLS y revocan acceso directo, incluido service_role. Los triggers son SECURITY INVOKER con search_path vacío y no autorizan usuarios. No se publican funciones privilegiadas incompletas. Los futuros RPC necesitan un PR explícito con controles y pruebas del protocolo documentado.

Se analizaron los AST SQL y PL/pgSQL; no se aplicaron estos borradores por falta de un entorno PostgreSQL local en ejecución. La comprobación de gramática no valida operadores, permisos, triggers ni concurrencia reales. El catálogo principal solo registra las dos migraciones de octubre. No usar git push o un deploy para aplicar automáticamente estas propuestas.

Recuperación/rollback real requiere plan revisado y datos sintéticos; estos borradores no contienen DROP de tablas compartidas, cambios Auth ni desactivación RLS. La única ampliación de una tabla existente es la candidata UNIQUE documentada en fase IA.
''')
print('Índice, fuentes, fases y documentación armonizados')
