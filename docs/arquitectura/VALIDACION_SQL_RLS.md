# Fase 2: validación SQL, integridad y seguridad RLS

Fecha: 03/11/2026. Rama `docs/auditoria-arquitectura-integral`. Sin cambios remotos, funcionales, de Jira o de ramas del equipo; sin commit/push/merge. Se mantienen los 31 hallazgos y el alcance de revisión anterior.

## Entorno y aislamiento

- Docker respondió a `docker info` y `docker ps`; cliente/servidor 29.9.2. Al comenzar había cero contenedores y únicamente postgres:16.
- El responsable autorizó expresamente descargar Supabase CLI e imágenes oficiales. CLI 3.0.0, carpeta temporal separada, sin login/link ni lectura de .env del proyecto.
- Stack oficial local: PostgreSQL 17.11.0.011, GoTrue v2.197.0, PostgREST v16.5, Storage v1.88.0 y Kong 2.8.1. El CLI puede descargar herramientas internas de inicialización adicionales aunque sus servicios se excluyan.
- Base de ejecución: `dentaia_arch_qa_fase2`, dentro del contenedor QA de nombre cerrado. El Auth oficial se copia **solo como esquema vacío local**; las identidades y sesiones se insertan sintéticamente. No hay cuentas ni credenciales de Dental-IA.
- Los servicios HTTP del stack continúan usando su base local postgres. Las pruebas se conectan a la copia QA por SQL; no se declara validado el flujo HTTP GoTrue/PostgREST de esa copia ni autenticación JWT firmada.
- Las cinco tablas públicas se reconstruyen vacías desde el catálogo verificado previo. Es bootstrap de pruebas; los borradores no recrean esas tablas.
- Versión efectiva: `PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit`.

## Migraciones y orden real

| Orden | Borrador | Resultado de aplicación | SHA-256 |
|---|---|---|---|
| 01 | `01_clinical_identidad.sql` | APROBADA | `d2bdc4af5f81aea452b3c1bbc0f33140b5cdb322d9db37e0358cbaf6f05c7799` |
| 02 | `02_clinical_contenido.sql` | APROBADA | `27ea4d14f37e6b50bca78076656e0deb7986f04ac2565373221f7da6a6ccca99` |
| 03 | `03_clinical_permisos_auditoria.sql` | APROBADA | `f3ad87c3287d2d31c86811b058ddad04beb63b2f0e82172e6ed70671fb2f1a6e` |
| 04 | `04_clinical_integridad.sql` | APROBADA | `6f21c82b4ccb2bff1b4eada84a0de4ad9a6aafefca200285e2a5320c5822f9fb` |
| 05 | `05_ia_investigacion.sql` | APROBADA | `045ac6a52109779a3d42dde5aa56d62a227531d77a16c5d726386ddcee382f0e` |
| 06 | `06_ia_analisis.sql` | APROBADA | `bfb2cd70a5e0631be3a084bf7b57ddce906afe466d65b72d53f49253a4569079` |
| 07 | `07_ia_integridad.sql` | APROBADA | `3388f091564c14e2d515a9b8e91ebd83ac47cbfb2b2738283e7e842c05968aff` |

01 crea identidad/contextos; 02 contenido; 03 concesiones/auditoría; 04 triggers clínicos; 05 investigación; 06 análisis y clave candidata de dental_photos; 07 triggers de IA. La migración administrativa DI-151 se ejecuta después, separadamente y sin cambiar su fuente histórica.

## Resultados ejecutados

Última ejecución completa desde una base limpia: **118 comprobaciones aprobadas y 0 fallidas**. Cada fila siguiente procede de ejecución SQL, no de fixtures declarados como éxitos. Después de incorporar la comprobación del último administrador y observar explícitamente los bloqueos administrativos, se repitió el banco completo.

| Prueba | Clasificación | Resultado |
|---|---|---|
| Baseline QA vacío: Auth oficial y cinco tablas de catálogo | entorno | APROBADA |
| Migraciones conservan columnas y tipos de las cinco tablas existentes | compatibilidad | APROBADA |
| 21 tablas propuestas con RLS habilitada | integridad | APROBADA |
| Relaciones válidas: dos pacientes, dos clínicas, dos orígenes | integridad | APROBADA |
| Clínica inexistente rechazada | integridad | APROBADA |
| Paciente inexistente rechazado | integridad | APROBADA |
| Corrección de atención con otro paciente rechazada | integridad | APROBADA |
| Corrección de atención con otro origen rechazada | integridad | APROBADA |
| Corrección sin motivo rechazada | integridad | APROBADA |
| Corrección válida append-only | integridad | APROBADA |
| Bifurcación de correcciones rechazada | integridad | APROBADA |
| Entrada reemplazada de otra atención rechazada | integridad | APROBADA |
| Dato desconocido no puede aparentar descripción real | integridad | APROBADA |
| Concesión de otro paciente no admite recurso manipulado | integridad | APROBADA |
| Recurso autorizado duplicado rechazado | integridad | APROBADA |
| Reasignación de paciente bloqueada | integridad | APROBADA |
| Reasignación de membresía bloqueada | integridad | APROBADA |
| Cambio de destinatario de concesión bloqueado | integridad | APROBADA |
| Revocación irreversible | integridad | APROBADA |
| Borrado de contenido histórico bloqueado | integridad | APROBADA |
| Edición de atención bloqueada | integridad | APROBADA |
| Autoacreditación profesional rechazada | integridad | APROBADA |
| Profesional no aprobado no puede quedar verificado | integridad | APROBADA |
| Membresías activas solapadas rechazadas | integridad | APROBADA |
| Documento no puede apuntar a otro paciente | integridad | APROBADA |
| Conservación clínica impide borrar identidad referenciada | integridad | APROBADA |
| Matriz de confusión válida coincide con tamaño de muestra | integridad | APROBADA |
| Matriz con valores negativos rechazada | integridad | APROBADA |
| Matriz con suma incorrecta rechazada | integridad | APROBADA |
| Modelo sin métricas no puede declararse evaluado | integridad | APROBADA |
| Dataset asociado a modelo no admite edición | integridad | APROBADA |
| Evaluación no se puede reescribir | integridad | APROBADA |
| FK de análisis rechaza propietario distinto de la foto | integridad | APROBADA |
| FK del job rechaza autorización y propietario cruzados | integridad | APROBADA |
| Idempotencia de job rechaza duplicado de propietario y clave | integridad | APROBADA |
| Job no puede quedar exitoso sin resultado | integridad | APROBADA |
| Job y resultado no evaluable se completan atómicamente | integridad | APROBADA |
| Worker no puede tomar lease todavía vigente | integridad | APROBADA |
| Foto revocada sigue pudiendo eliminar metadata y análisis propios | integridad | APROBADA |
| Paciente puede borrar metadata propia tras revocar con RLS existente | RLS existente y compatibilidad CASCADE | APROBADA |
| Paciente lee solo su perfil por RLS | RLS existente | APROBADA |
| Paciente no puede modificar perfil ajeno | RLS existente | APROBADA |
| Cliente no puede editar app_metadata ni elevar rol | permisos SQL | APROBADA |
| visitante: ACL clínica bloquea acceso directo | permisos SQL | APROBADA |
| visitante: RLS deniega las 21 tablas aun con SELECT temporal | RLS propuesta default-deny | APROBADA |
| paciente: ACL clínica bloquea acceso directo | permisos SQL | APROBADA |
| paciente: RLS deniega las 21 tablas aun con SELECT temporal | RLS propuesta default-deny | APROBADA |
| odontólogo: ACL clínica bloquea acceso directo | permisos SQL | APROBADA |
| odontólogo: RLS deniega las 21 tablas aun con SELECT temporal | RLS propuesta default-deny | APROBADA |
| superusuario: ACL clínica bloquea acceso directo | permisos SQL | APROBADA |
| superusuario: RLS deniega las 21 tablas aun con SELECT temporal | RLS propuesta default-deny | APROBADA |
| INSERT clínico queda bloqueado por RLS con privilegio temporal | RLS propuesta default-deny | APROBADA |
| Superusuario no puede modificar auditoría clínica | permisos SQL | APROBADA |
| service_role no recibe acceso clínico por ACL | permisos SQL; no evidencia RLS | APROBADA |
| Prototipo: paciente accede a sus dos atenciones | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: paciente no accede a otro paciente | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: profesional autorizado solo recibe un recurso | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: profesional ajeno no accede por ID | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: misma clínica no concede acceso general | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: autorización vencida deniega | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: autorización revocada deniega | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: superusuario no recibe historial ajeno | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: contexto clínico de otro profesional deniega | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: rol Auth retirado se vuelve a consultar | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: membresía suspendida deniega | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: cuenta profesional suspendida deniega | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: nueva verificación rechazada deniega | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: consentimiento propio se puede revocar | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: revocación ajena se rechaza | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: reintento de revocación conserva fecha | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: concesión e idempotencia mismo UUID y contenido | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: idempotencia no admite contenido distinto | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: paciente no concede recurso ajeno | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: fallo de auditoría impide entregar historial | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: auditoría denegada persiste sin datos clínicos | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: auditoría permitida antes de respuesta | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: auditoría no admite edición | prototipo QA; no RPC implementado | APROBADA |
| Prototipo: fallo de auditoría revierte revocación | prototipo QA; no RPC implementado | APROBADA |
| Migración DI-151 sobre Auth oficial local | administración | APROBADA |
| Suite SQL administrativa adaptada al Auth oficial | administración | APROBADA |
| Catálogo real SQL: public.profiles | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: public.dentists | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: public.appointment_requests | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: public.patient_consents | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: public.dental_photos | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: dentaia_admin.revisiones_roles | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: dentaia_admin.aprobaciones_roles | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: dentaia_admin.auditoria_roles | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinics | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.professional_accounts | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.professional_verifications | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinic_memberships | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.patient_records | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinical_encounters | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinical_entries | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinical_documents | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinical_access_grants | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinical_grant_resources | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: clinical.clinical_access_audit | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.dataset_versions | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.dataset_items | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.model_versions | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.analysis_authorizations | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.analysis_jobs | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.analysis_results | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.educational_recommendations | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.result_recommendations | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.evaluation_runs | catálogo PostgreSQL | APROBADA |
| Catálogo real SQL: ml.evaluation_metrics | catálogo PostgreSQL | APROBADA |
| Lectura primero: revocación espera y nuevas lecturas deniegan | concurrencia del prototipo QA | APROBADA |
| Revocación primero: lectura espera y revalida denegación | concurrencia del prototipo QA | APROBADA |
| Dos lecturas autorizadas simultáneas usan locks compatibles | concurrencia del prototipo QA | APROBADA |
| Concesión concurrente idempotente crea solo una fila | concurrencia del prototipo QA | APROBADA |
| Suspensión concurrente de contexto se revalida al leer | concurrencia del prototipo QA | APROBADA |
| Vencimiento durante espera usa reloj real y deniega | concurrencia del prototipo QA | APROBADA |
| DI-151: solicitudes simultáneas con misma clave producen una auditoría | concurrencia administrativa real SQL | APROBADA |
| DI-151: dos escrituras de misma revisión rechazan la segunda obsoleta | concurrencia administrativa real SQL | APROBADA |
| Último administrador conserva rol al rechazarse su retirada propia | administración | APROBADA |

Catálogo físico obtenido por SELECT: **29 tablas, 219 columnas, 201 restricciones y 84 índices**. El verificador adicional comprobó PK, FK y sus acciones DELETE, UNIQUE, cantidad/validación de CHECK, exclusiones GiST e índices: **29/29 tablas aprobadas**, 0 fallidas. Evidencia: [CATALOGO_VALIDADO.json](pruebas_sql/CATALOGO_VALIDADO.json).

## Permisos: qué quedó validado y qué sigue pendiente

| Perfil | Verificación real SQL | Límite |
|---|---|---|
| Visitante | Acceso privado bloqueado por ACL y RLS | No hay sesión HTTP en este banco |
| Paciente | Perfil propio y borrado propio de fotos con RLS existente; sin acceso a filas ajenas | Lectura clínica y gestión de concesiones solo en prototipo QA; faltan RPC reales |
| Odontólogo | RLS clínica cerrada; prototipo rechaza IDs ajenos, contexto distinto, vencimiento y revocación | No se declara operativo el servicio profesional real |
| Superusuario | Guarda administrativa SQL, auditoría, aprobaciones y concurrencia; sin acceso clínico directo | AAL2/factores sintéticos, no desafío TOTP real |

## Interpretación de seguridad

Las restricciones PK/FK/CHECK/UNIQUE/exclusión y triggers se prueban como dueño QA. Esas aprobaciones demuestran integridad, no autorización. Las identidades sintéticas incluyen dos pacientes, dos clínicas, dos profesionales autorizados y uno sin concesión, con atenciones de distintos orígenes y permisos vigentes/vencidos/revocados.

El bloqueo por privilegios SQL se registra separado de RLS. Para observar RLS, un GRANT de SELECT local se limita a una transacción reversible y luego se cambia a anon/authenticated: las 21 tablas nuevas continúan sin filas visibles por default-deny. No se usa postgres ni service_role como evidencia positiva de RLS. El bloqueo de service_role es por ACL, dado su BYPASSRLS.

**Los siete borradores no incluyen los RPC clínicos de lectura, concesión y revocación.** Por tanto, el acceso clínico positivo del paciente/profesional y su gestión funcional de permisos siguen sin estar implementados en esos borradores. No se agregan políticas directas que permitan evitar la auditoría para obtener un resultado favorable.

El prototipo bajo esquema `qa` demuestra por separado una posibilidad de implementación: derivar actor, consultar rol fresco, validar contexto/recurso, bloquear filas, insertar auditoría mínima y devolver solo después de éxito. Los eventos denegados no incorporan contenido clínico ni recursos ajenos; el fallo de auditoría aborta respuesta y modificaciones. No es un endpoint desplegado ni una implementación completa aprobada para producción.

Ese prototipo devuelve únicamente autorización y recuentos sintéticos: no implementa la proyección completa del historial ni descarga de documentos. La evidencia de concurrencia se conserva con espera observada por sesión en RESULTADOS.json. Las versiones/digests oficiales y los atributos efectivos de roles están en [ENTORNO.json](pruebas_sql/ENTORNO.json).

## Concurrencia y límites de las garantías

Las carreras usan conexiones PostgreSQL independientes y observan esperas en pg_stat_activity. El orden del prototipo es identidad/paciente/contexto/concesión. La lectura autorizada que obtiene el bloqueo primero puede terminar; la revocación espera. Cuando la revocación confirma primero, la nueva lectura espera y vuelve a validar, sin entregar contenido. Se usa clock_timestamp al revisar vencimiento después de esperar.

Estas pruebas no cortan una respuesta HTTP ya autorizada ni recuperan bytes descargados. Cada nueva página/descarga debe revalidar; el endpoint y el proxy de documentos aún requieren implementación. Los locks del prototipo no prueban todos los escritores futuros ni todos los órdenes posibles de bloqueo.

## Administración y compatibilidad Auth

La migración canónica de DI-151 se conserva intacta. Su suite histórica utilizaba tablas Auth mínimas y VALUES posicionales. El adaptador versionado aquí utiliza el esquema oficial local con columnas explícitas, confirmación, aud y timestamps; la copia ejecutada queda en `pruebas_sql/admin_adaptado_qa.sql` cuando se alcanza esa fase.

Los factores verificados/sesiones AAL2 son filas sintéticas para probar guardas SQL y compatibilidad, no un login MFA real ni un JWT firmado. La suite verifica persistencia, namespaces ajenos, aprobaciones independientes, autoedición, MFA requerido, idempotencia, revisión obsoleta, pérdida de autorización y rollback ante fallo de auditoría. La rama mantiene controles de DI-150 sin cambios.

Se comprobó un único administrador restante: su intento de retirarse fue rechazado con CAMBIO_PROPIO_PROHIBIDO y su rol permaneció intacto. Esto demuestra ese invariante, pero no cubre directamente la rama SQL ULTIMO_SUPERUSUARIO_PROTEGIDO ni todos los escritores externos. Las operaciones sobre auth.users siguen requiriendo revisión de compatibilidad gestionada y escritor único antes de rollout.

## Errores e intentos conservados

Los siete borradores se aplicaron sin errores y no requirieron cambios. Las correcciones fueron exclusivamente del banco: (1) ALTER DATABASE no permitía fijar el parámetro custom QA con el rol postgres gestionado; se sustituyó por SET en cada conexión QA; (2) el comparador confundía time con su nombre canónico time without time zone; se añadió la equivalencia, sin alterar columna ni modelo. Se repitió todo desde una base limpia después de esos ajustes.
Se conservaron 4 intentos en [INTENTOS.json](pruebas_sql/INTENTOS.json). Los errores de preparación/fixtures no se confunden con errores de los borradores. La última ejecución y cada SHA aplicado están en [RESULTADOS.json](pruebas_sql/RESULTADOS.json).

| Intento | Aplicaciones SQL aprobadas | Pruebas aprobadas/fallidas | Bloqueo |
|---|---|---|---|
| 1 | 0/7 | 0/0 | ERROR:  permission denied to set parameter "dentaia.architecture_draft" |
| 2 | 7/7 | 116/1 | Ninguno |
| 3 | 7/7 | 117/0 | Ninguno |
| 4 | 7/7 | 118/0 | Ninguno |

## Regresión del repositorio — separada de SQL

| Comando ejecutado | Resultado |
|---|---|
| `node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"` | 231/231 aprobadas, cero fallos/canceladas/omitidas |
| `npm run typecheck` | Aprobado |
| `npm run build` | Aprobado |
| `npm audit --json` | 0 vulnerabilidades |
| `git diff --check` | Sin errores |
| Validador documental | 360/360 repetidas al cierre; no hubo cambios en los siete borradores |

Los logs locales originales de Node/build/audit se guardaron temporalmente fuera del repositorio; no se versionan archivos de entorno ni credenciales. Esta tabla registra la ejecución de esta sesión, no es un resultado que el generador infiera de las fechas.

## Qué falta y qué se puede solicitar

- **Ninguna migración queda declarada apta para producción por esta prueba local.** La aplicación correcta del DDL permite solicitar revisión técnica de las fases que no tengan errores pendientes, no su ejecución automática en Dental-IA.
- Para las cinco tablas existentes, conservar el comportamiento actual y revisar la única ampliación de clave candidata al llegar a IA.
- Para las tres administrativas: revisar compatibilidad Auth, permisos efectivos, escritor único, pruebas HTTP AAL2 y concurrencia específica antes de una autorización de rollout independiente.
- Para las once clínicas: acordar verificación profesional/roles/retención, convertir el protocolo ensayado en RPC reales auditados, implementar errores/idempotencia completos e integrar vistas y documentos privados. No habilitar SELECT directo de contenido.
- Para las diez IA: mantener diseño futuro. Faltan licencias, datasets reales, evaluación reproducible, revisión profesional, worker con identidad mínima, lease y reconciliación completos.
- No ejecutado aquí: autenticación HTTP con dos JWT reales, expiración real de sesión, Storage/bytes/URLs y descargas concurrentes, entrenamiento/inferencia, validación clínica, carga/rendimiento o restauración de backups.

## Reproducción y preservación

Consultar [instrucciones del banco](pruebas_sql/README.md). El ejecutor no acepta una URL remota; requiere nombre exacto de contenedor/base. Para repetir desde limpio solo puede recrear la base QA explícita con --reset-qa. No se borran documentación previa, historial Git ni volúmenes de otros proyectos.

Las fuentes originales de arquitectura, los 31 hallazgos y el código de DI-151 se conservan. Los resultados del prototipo no se presentan como funcionalidades existentes ni como validación clínica.
