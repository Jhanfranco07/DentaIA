# Fase 5 — consolidación e implementación del backend del MVP

Fecha de ejecución: **03/11/2026, America/Lima**. Rama `docs/auditoria-arquitectura-integral`, base `c992a14229d1bc838166dae200559b9aa7f7428c`. Responsable técnico: **Jhan Franco**, según el acuerdo con Anelis declarado por el responsable. **DI-36 conserva Sprint 6**; Jira no se modificó y la subtarea/historia no se declara terminada.

Esta entrega amplía el alcance documental inicial de F5: implementa servicios comunes, aplica el paquete completo en una base local limpia y verifica Auth, SQL, RLS, HTTP, Storage y administración con cuentas sintéticas. No despliega en Dental-IA, Vercel ni otro proyecto remoto. **No listo para producción ni uso clínico real.**

## 1. Auditoría, fuentes e historia que se conserva

- Al comenzar: rama correcta, cero modificaciones de archivos seguidos y staging vacío; documentación/evidencias F1–4 y servicios F4 sin seguimiento. Se conservaron los artefactos que existían al recibir el nuevo alcance, incluidos tres JSON del intento documental preliminar F5. Sus resultados no se cuentan como cierre de esta consolidación.
- [BASELINE_ANTES_CONSOLIDACION.json](backend_mvp/BASELINE_ANTES_CONSOLIDACION.json): 188 hashes anteriores. [AUDITORIA_GIT_INICIAL.json](integracion_fase5/AUDITORIA_GIT_INICIAL.json): clasificación inicial de 185 archivos F1–4. Son evidencia de integridad local, **no respaldo publicado**. No se creó commit, stash, PR, push ni merge.
- Docker Desktop 29.9.2, PostgreSQL 17.11, CLI 3.0.0, GoTrue v2.197.0, Storage v1.88, PostgREST v16.5, Node 22.18.0, Next 15.5.28 y SDK 2.118.0. Se reutilizó el stack oficial ya autorizado; sin otro backend, base de datos tecnológica o dependencias npm nuevas.
- Se revisaron README, auditoría, modelo físico, diccionario, seguridad/roles, políticas, contratos y evidencias SQL/RPC/JWT anteriores. Los 118/78/60 resultados históricos **no** se presentan como ejecuciones nuevas: abajo se distinguen las regresiones reejecutadas.
- `main` observado: `1bcb84956e755b4089494af43f983fd0d2e5bfad`. HEAD tiene ocho commits administrativos que main no contiene y le faltan ocho commits de main. `servidor.ts` reutiliza el lector de asignación DI-150, ausente de main. No proponer un PR directo como si el diff incluyese exclusivamente las fuentes clínicas ni sobreescribir landing/profesional con versiones antiguas.
- Las ramas de las vistas y sus estados no se modificaron. La verificación anterior de GitHub encontró `feature/anelis-di156-historial-demo` en `3f69a50`, con PR #18 cerrado **sin merge**, y `feature/vista-paciente` en `ac545b5`. No se asume integración de esas vistas ni aceptación de una ampliación por sus autoras.

## 2. Inventario integral y clasificación

La clasificación corresponde al entorno local de esta rama; no acredita despliegue productivo. «Probado» distingue debajo el método utilizado.

| Módulo | Tablas / persistencia | Servicios / superficie real | Estado y pendiente |
|---|---|---|---|
| Autenticación y usuarios | Auth gestionado: users, sessions, MFA | SDK signInWithPassword/getUser/getClaims/MFA; DI-150 acceso administrativo | **Implementado y probado localmente**: seis cuentas, firma JWT, MFA real, rechazo de sesión. Registro con entrega/confirmación de correo no reejecutado |
| Perfiles | public.profiles, FK Auth | Cuenta/perfiles.ts; SDK select/insert/update por propietario | **Implementado y probado localmente**: lectura, actualización/restauración, persistencia y dos JWT ajenos con cero filas |
| Roles y administración | app_metadata.dentaia y tres tablas dentaia_admin | RPC canónico dentaia_cambiar_roles_v1; siete métodos administrativos/de desarrollo existentes | **Implementado parcialmente** en transporte local: DI-150 y RPC con MFA/AAL2 reales probados; proveedores Next de lectura/escritura HTTPS no se habilitan ni modifican |
| Directorio | public.dentists, perfiles públicos ficticios | DirectorioLista/DentistaDetalle, SDK select filtrado por is_active | **Implementado y probado localmente**; aparecer en dentists no concede rol ni vincula automáticamente Auth |
| Clínicas y profesionales | clinics, professional_accounts, professional_verifications, clinic_memberships | Nuevo GET /api/professional/me, RPC workspace | **Implementado y probado localmente** para lectura de contextos verificados propios; aprobación profesional y altas/cambios operativos **bloqueados por decisión del equipo** |
| Solicitudes del paciente | public.appointment_requests | Servicios existentes obtenerMisSolicitudes/cancelarSolicitudDemo y formulario | **Implementado y probado localmente**: creación, consulta, cancelación, persistencia y RLS; solo requested/cancelled e is_demo |
| Solicitudes profesionales | La misma appointment_requests, enlace explícito professional_accounts.dentist_id | Nuevo GET /api/professional/requests | **Implementado y probado localmente**: vínculo verificado, filtros/paginación y contexto propio; no crea tabla ni clínica destino inexistente |
| Panel del paciente | Reutiliza profiles, solicitudes, fotografías y reporte de sesión | Sus componentes en rama de Angie; nuevo resolver /api/clinical/patients/me | Backend resolver **implementado y probado localmente**; integración visual **pendiente**, no se modifica su alcance Jira |
| Panel del odontólogo | Contextos y permisos clínicos; proveedor sintético separado | /api/professional/me, /patients y /requests más historial F4 | Backend **implementado y probado localmente**; proveedor/UI actual **simulado**, falta adaptación acordada de tipos y estados |
| Pacientes autorizados | patient_records, grants y resources | Nuevo GET /api/professional/patients | **Implementado y probado localmente**: solo IDs clínicos autorizados, sin Auth UUID, contactos o texto clínico; revocación elimina nuevas lecturas |
| Historial compartido | encounters, entries, documents y procedencia de clínica/profesional | RPC get_authorized_clinical_history y GET F4 | **Implementado y probado localmente**: alcance, dos clínicas, cursor, auditoría, revocación/carreras; carga/edición asistencial completa no implementada |
| Autorizaciones clínicas | clinical_access_grants / clinical_grant_resources | grant_clinical_access, revoke_clinical_access y nueva lista propia | **Implementado y probado localmente**; texto/política clínicos y vigencia productiva **bloqueados por decisión del equipo** |
| Consentimiento de fotos | public.patient_consents, purpose academic_photo_storage | Flujo original, SDK insert/update revoked_at | **Implementado y probado localmente**, propósito específico; no autoriza acceso clínico o análisis IA |
| Fotografías privadas | public.dental_photos, Storage dental-photos | SDK upload/download/list y eliminarFotografia original | **Implementado y probado localmente**: PNG sintético, dos JWT, URL pública denegada, revocación/borrado/reintento, tamaño y MIME; sin fotos clínicas reales |
| Auditoría clínica | clinical.clinical_access_audit | Auditoría previa y denegaciones por RPC; logs mínimos del gateway | **Implementado y probado localmente**; agregador durable de rechazos anteriores al RPC **diseñado, pendiente** |
| Auditoría administrativa | dentaia_admin.auditoria_roles | Transacción única de cambios Auth/revisión/aprobación/auditoría | **Implementado y probado localmente** con AAL2 real: persistencia, idempotencia, concurrencia y rollback ante fallo. No se reemplaza DI-151 |
| Documentos clínicos | clinical_documents, referencias sin URL pública | DTO de historial; endpoint de contenido aún propuesto | **Diseñado, pendiente de implementación**: bucket clínico, política/retención y descarga reautorizada/auditada. No reutilizar bucket/consentimiento de fotos para otro fin |
| Resultados educativos | Reporte de sesión / fixtures locales | Módulos educativos actuales, sin persistencia clínica automática | **Simulado**, deliberadamente separado; no son diagnósticos registrados ni inferencia |
| Procesamiento de imágenes e IA | Diez tablas ml solo documentadas | Endpoints de analysis propuestos, no operativos | **Futuro, fuera del alcance del MVP**; sin entrenamiento ni instalación de esas tablas en el paquete MVP |

No se duplica Auth, profiles, dentists, appointment_requests, patient_consents, dental_photos ni sus clientes. No se modificaron los componentes visuales de cuenta, directorio, solicitudes, fotografías, panel o profesional.

## 3. Modelo físico del MVP: 19 tablas, 142 columnas

El modelo integral conserva **29 tablas / 219 columnas** como visión arquitectónica. Para este paquete se excluyen las **10 tablas / 77 columnas de IA**: **19 tablas / 142 columnas**, comprobadas en PostgreSQL, sin añadir tablas para alcanzar una cifra artificial. Auth y Storage son infraestructura gestionada, no nuevas tablas de negocio. [MODELO_MVP.json](backend_mvp/MODELO_MVP.json).

| Dominio | Tablas incluidas | Origen y aplicación |
|---|---|---|
| Cinco públicas | profiles, dentists, appointment_requests, patient_consents, dental_photos | Existencia remota observada en inventario F1; F5 no volvió a consultar ni modificar Dental-IA. Baseline vacío reconstruido en QA desde columnas/constraints/índices/políticas verificadas |
| Tres administrativas | revisiones_roles, aprobaciones_roles, auditoria_roles | Migración DI-151 canónica sin cambios, aplicada solo a QA; no se acredita aplicación remota por esta entrega |
| Cinco de identidad clínica | clinics, professional_accounts, professional_verifications, clinic_memberships, patient_records | Propuestas F1 y borradores 01; ahora incluidas en inicialización limpia del MVP |
| Tres de contenido | clinical_encounters, clinical_entries, clinical_documents | Borrador 02; correcciones/procedencia/estados explícitos, sin datos clínicos reales |
| Tres de acceso | clinical_access_grants, clinical_grant_resources, clinical_access_audit | Borrador 03; integridad complementada por 04 y RPC 08–10 |

Catálogo real del paquete limpio: **118 restricciones, 54 índices, RLS activado en las 19 tablas, cero tablas ml**. El incremental solo añade un índice parcial de solicitudes por dentist/status/id, una política para el rol técnico y dos operaciones al vocabulario de auditoría; no agrega tabla/columna ni amplía estados de solicitudes.

Relaciones relevantes: profile.id refiere a Auth; paciente clínico estable tiene user_id UNIQUE; profesional tiene user_id UNIQUE y dentist_id opcional UNIQUE; pertenencia identifica profesional/clínica/periodo y excluye solapamientos activos. La ficha pública no es identidad autenticada. Una vinculación profesional no nula no se puede reasignar silenciosamente, verificado por el rechazo de una fixture errónea.

Atenciones/entradas conservan autor, fechas y origen. FK compuestas y triggers impiden recursos de otro paciente, cambio de procedencia, ciclos y correcciones sin motivo. Historial/auditoría son inmutables; FK clínicas usan RESTRICT, mientras el MVP público conserva sus CASCADE/NO ACTION originales. Auditoría de roles carece deliberadamente de FK Auth para conservar evidencia. Retención, anonimización y bajas reales requieren procedimiento aprobado: **no se añadió borrado clínico** ni se usan transacciones compartidas entre Auth API, SQL y Storage.

## 4. Paquete SQL y reproducibilidad

[MIGRACIONES_DESDE_CERO.json](backend_mvp/MIGRACIONES_DESDE_CERO.json) registra cada fuente y SHA aplicada a `dentaia_arch_qa_fase5`, base nueva del Docker local. Se copiaron exclusivamente estructuras oficiales de Auth; no filas, usuarios o secretos de Dental-IA. Orden:

1. Baseline de cinco tablas públicas vacías, índices, FK y RLS del inventario; Auth oficial y extensiones compatibles.
2. `supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql`, **sin editar**.
3. `borradores_sql/01_clinical_identidad.sql`, 02 contenido, 03 permisos/auditoría, 04 integridad, **sin editar**.
4. `servicios_clinicos/sql/08_identidad_y_privilegios.sql`, 09 autorizaciones, 10 historial, **sin editar**.
5. Nuevo [20261103195335_di36_servicios_comunes_mvp.sql](backend_mvp/20261103195335_di36_servicios_comunes_mvp.sql), nombre generado mediante `supabase migration new` del CLI existente, preparado fuera del directorio de autodespliegue del repositorio.

El nuevo incremental contiene un RPC público INVOKER `get_clinical_workspace`, una función privada de privilegio mínimo y operaciones patient/professional/grants/patients/requests. Añade `read_context` y `list_own_grants` a una CHECK existente de auditoría; no cambia las otras operaciones. Configuración clínica **sigue apagada por defecto**. Función privada propiedad de dentaia_clinical_executor, NOLOGIN/NOBYPASSRLS; CREATE se retira al finalizar. Rol del cliente no puede asumir ese rol técnico.

Los dos registros históricos de migración remota de octubre constan en las evidencias F1; sus fuentes originales no están versionadas en supabase/migrations. No se inventaron archivos históricos ni se reescribieron: el baseline reconstruido sirve para QA, **no constituye recuperación de su historial de migraciones**. Solo existe el SQL administrativo canónico y el paquete documental revisable; no ejecutar db push automáticamente.

`preparar.py` rechaza URL/DOCKER_HOST/destino ajeno y base existente por defecto. `--recrear-qa-propia` exige nombre constante y comentario DENTAIA_PHASE5_SYNTHETIC_ONLY; solo recrea esa base sintética, nunca postgres ni F2/F3. La última inicialización completa usa el SHA corregido del incremental y se comprobó desde cero. No se instalaron 05–07 de IA en el MVP.

Para HTTP se utiliza postgres del mismo stack, donde Auth/REST/Storage oficiales están conectados. [preparar_http.py](backend_mvp/preparar_http.py) exige el marcador local de F4 y solo cuentas marcadas de QA; incorpora el paquete incremental/DI-151 y replica las tres políticas originales de Storage y su bucket privado. No sustituye políticas existentes por otras más permisivas. [PREPARACION_HTTP.json](backend_mvp/PREPARACION_HTTP.json).

## 5. Servicios y contratos preparados para las vistas

[CONTRATOS_API.json](CONTRATOS_API.json) y [CONTRATOS_API.md](CONTRATOS_API.md) describen **15 métodos de rama y 10 propuestos**. Ocho métodos clínicos/profesionales están implementados y apagados en producción. Tipos de integración documentales: [CONTRATOS_CLIENTE.ts](backend_mvp/CONTRATOS_CLIENTE.ts). No se instalaron APIs redundantes para operaciones ya disponibles por SDK y RLS.

| Endpoint / operación existente | Método / DTO | Autorización y validación | Estado / dependencias |
|---|---|---|---|
| /api/clinical/patients/me | GET; workspace kind patient, data.patientId | JWT vigente, rol paciente, registro propio activo; sin userId/patientId cliente | **Nuevo, probado**. No crea automáticamente identidad clínica tras registro Auth |
| /api/professional/me | GET; kind professional; professionalId,dentistId,contexts | Rol profesional vigente, verificación aprobada, contextos propios activos; afterId/limit | **Nuevo, probado**. No confundir IDs con nombres o actor autorizado |
| /api/professional/requests | GET; kind requests; items{id,status,createdAt,preferredDate,preferredTime,isDemo} | membershipId obligatorio, vínculo dentist_id propio verificado; filtros requested/cancelled y keyset | **Nuevo, probado**. Omite user_id, correo, nombre y mensaje; no cambia estados ni concede historial |
| /api/professional/patients | GET; kind patients; items{patientId} | Contexto propio y concesiones vigentes con recursos; auditoría previa | **Nuevo, probado**. No es un directorio público de pacientes; no incluye datos clínicos |
| /api/clinical/access-grants | GET; kind grants; items de concesión propia y alcance | Paciente propietario; afterId/limit; no aceptar identidad ajena | **Nuevo, probado**. Requiere política y UX aprobadas para uso real |
| /api/clinical/access-grants | POST; membershipId,encounterIds,expiresAt,policyVersion,accepted:true | Paciente de sesión; Idempotency-Key UUID, 1..100 recursos, cuerpo <=8192 bytes | F4 **verificado nuevamente en regresión** con éxito; 201 nueva, 200 replay, 409 si cambia cuerpo |
| /api/clinical/access-grants/:id/revoke | POST `{}`; id,revokedAt | Propietario autenticado; reintento preserva fecha | F4 **verificado nuevamente en regresión** con éxito; no borra auditoría |
| /api/clinical/patients/:patientId/history | GET; clinical.v1, caso, entries,nextCursor | Profesional+contexto+concesión o paciente propio sin membershipId; cursor firmado/cifrado ligado a identidad/sesión/contexto/filtros | F4 **verificado nuevamente en regresión** con éxito; datos de dos clínicas, campos ausentes y procedencia |
| Auth /auth/v1/* | SDK oficial, login/logout/claims/MFA | Firma real y cuenta actual; nunca user_metadata para privilegios | Existente. No se implementa Auth alternativo ni se almacenan tokens adicionales |
| profiles y dentists /rest/v1/* | SDK de módulos existentes; tipos Database | RLS de propietario / catálogo público activo; validaciones de módulos existentes | Reutilizados, sin modificar sus interfaces |
| appointment_requests /rest/v1/* | Insert/select propios, update status=cancelled | Usuario de sesión, is_demo, estados existentes, RLS | Reutilizados y probados con dos JWT; no se duplicó tabla ni endpoint paciente |
| patient_consents, dental_photos y /storage/v1/* | SDK original y eliminarFotografia | Propietario/ruta/consentimiento, MIME y 8 MiB; bucket privado | Reutilizados y probados; sin URL pública permanente ni consentimiento para otro propósito |
| /api/administracion/acceso | GET; DI-150 | Superusuario actual + MFA/AAL2 real | Probado 401/403/200, sin cambiar controles |
| /api/administracion/usuarios/reales | GET; DTO mínimo y filtros originales | AAL2 y proveedor privado opt-in HTTPS | Implementado en DI-151, **no habilitado en local HTTP**. Auth Admin solo se consultó como operador local, recuento sin PII |
| /api/administracion/roles | GET/POST; protocolo original | AAL2 reciente, aprobación independiente, revisión, clave idempotente | RPC original probado con Auth real; adaptador Next HTTPS **permanece apagado**, no se declara flujo HTTP de escritura habilitado |

Los cinco nuevos GET comparten envelope `ok, apiVersion:clinical.workspace.v1, environment:qa_local, kind, data, nextAfterId, requestId`. Paginación keyset UUID, límite 1..50 (20 defecto); afterId no confiere permisos. La consulta de historial F4 conserva su cursor firmado opaco, no se sustituye por afterId. No se aceptan queries duplicadas, IDs malformados, actor/rol/escenario arbitrarios o estados nuevos.

### Ejemplos sintéticos y estados de interfaz

```http
GET /api/professional/requests?membershipId=40000000-0000-4000-8000-000000000033&status=requested&limit=20
Authorization: Bearer <sesion QA obtenida por SDK en memoria>
```

```json
{"ok":true,"apiVersion":"clinical.workspace.v1","environment":"qa_local","kind":"requests","data":{"professionalId":"40000000-0000-4000-8000-000000000023","membershipId":"40000000-0000-4000-8000-000000000033","items":[]},"nextAfterId":null,"requestId":"40000000-0000-4000-8000-000000000091"}
```

Este ejemplo es ilustrativo, no un log. Para conceder: POST con Idempotency-Key UUID y `{membershipId,encounterIds,expiresAt,policyVersion,accepted:true}`; no enviar patientId, actorId, roles ni purpose. Para revocar: POST `/api/clinical/access-grants/:id/revoke` con `{}`. Consultar historial profesional enviando patientId y membershipId; historial propio usa el ID resuelto por patients/me y omite membershipId.

| Respuesta | Estado UI / acción segura |
|---|---|
| Pendiente | Cargando; limpiar paciente/contexto anteriores, cancelar y descartar respuestas tardías |
| 200 con items/entries | Listo; respetar origen, precisión de fechas, multiplicidad, nulos/correcciones y paginación |
| 200 con lista vacía / sin_datos | Vacío autorizado; no fabricar registros ni usar fixtures como fallback del proveedor real |
| 201 / 200 replay | Éxito solo tras verificar estado/fechas. Replay de concesión revocada o vencida no la reactiva |
| 400 INVALID_REQUEST / INVALID_CURSOR | Corregir entrada o reiniciar paginación; no bucle automático |
| 401 AUTHENTICATION_REQUIRED | Limpiar datos y autenticar legítimamente con retorno interno validado |
| 403 ACCESS_DENIED | Denegado genérico; no revelar si el ID ajeno existe |
| 404 NOT_FOUND | Servicio apagado; no significa paciente inexistente |
| 409 IDEMPOTENCY_CONFLICT | Revisar intención; no generar otra clave silenciosamente |
| 413 / 415 | Tamaño o MIME/cuerpo no admitidos; corregir antes de reenviar |
| 503 SERVICE_UNAVAILABLE / red | No entregar historial residual; reintento explícito manteniendo clave de escritura |

Integración futura de Anelis: proveedor asíncrono separado, sin pasar datos reales a obtenerCaso/obtenerConcesion ni usar escenario como autoridad. Su contrato fija origen sintético y usa campos escalares/nombres, mientras el HTTP usa UUID/arrays y origen supabase con entorno QA. Acordar mapeo, nulos, correcciones y exámenes sin URL; no hacer casts para ocultar incompatibilidades.

Integración futura de Angie: reutilizar perfil/solicitudes/fotos existentes. Las concesiones clínicas quedan preparadas como backend, pero no se modifica DI-146 ni se añade UI unilateralmente. Faltan selección segura de destinatarios elegibles y política/UX aprobadas. Un reporte educativo de sesión no se transforma en historia clínica persistida.

Ambas vistas deben usar sesión del **mismo proyecto QA**, Bearer explícito y mismo origen Next, sin service_role ni tokens en query/logs. No ampliar useSesion para publicar secretos. Nunca cachear historia en localStorage/sessionStorage o mezclarla con el reporte educativo. Ante cambio de sesión/paciente/clínica o denegación, vaciar datos antes de resolver una nueva lectura. Roles en cliente solo orientan UI; servidor/SQL deciden.

## 6. Seguridad y garantías verificadas

Se conserva getClaims+getUser y la lectura actual de app_metadata.dentaia; SQL revalida Auth/sesión vigente, profesional, clínica, verificación y alcance. Cambio de rol y suspensión de membresía se rechazan con JWT anterior. Conocer un UUID o aparecer en dentists no autoriza una solicitud profesional o historial.

Nueva política de solicitudes: exclusivamente rol técnico acotado, con SELECT **solo de columnas mínimas**. No se concedió SELECT global a authenticated ni contacto al ejecutor. La función resuelve el profesional de la sesión y su dentist_id, comprueba contexto y audita. Solicitudes no tienen clínica destino: el contexto verifica al profesional, no fabrica una relación de clínica en la tabla existente.

Auditoría clínica y de roles debe persistir antes de entregar/aplicar. Se ejecutaron fallos artificiales **solo en QA**, observando denegación/rollback; los triggers temporales se retiraron. Auditoría no contiene diagnósticos, tratamientos, imagen, contraseña, QR, códigos TOTP o tokens. Gateway solo registra traza/operación/código; falta todavía su canal durable central.

Next exige NODE_ENV distinto de production **y** flag true; URL solo loopback y clave publicable, sin fallback remoto. Las **ocho** rutas retornaron 404/no-store en build production aun con flag true. RPC también comprueban configuración privada apagada por defecto. **Excepción deliberada:** revoke_clinical_access permite al propietario revocar cuando se desactivan nuevas concesiones/lecturas; no afirmar que configuration apaga las tres operaciones. Cerrar Next tampoco sustituye controles de PostgREST directo.

Revocación no retira bytes ya entregados. Lectura que bloquea primero puede terminar; revocación primero impide la lectura posterior. Cada página se reautoriza. Historial propio/profesional y nuevas listas nunca usan service_role como actor. El protocolo DI-151 conserva su credencial privilegiada exclusiva del servidor para su única RPC, con contexto extraído de sesión AAL2 verificada y nueva validación SQL; no se prestó esa credencial al navegador o al backend clínico ordinario.

Al terminar, el cierre restauró también `clinical_service.configuration()` a su definición desactivada en los bancos HTTP y MVP SQL locales. Las fixtures solo estuvieron habilitadas durante pruebas autorizadas; para repetir se ejecuta su preparación explícita. La revocación propia conserva la excepción de seguridad ya descrita.

## 7. Pruebas realmente ejecutadas y fallos conservados

| Comprobación nueva | Resultado y tipo de evidencia |
|---|---|
| Paquete desde cero | Nueve fuentes SQL aplicadas, 19 tablas/142 columnas, 118 constraints/54 índices, RLS true, IA 0; enabled=false antes de fixtures |
| Regresión SQL/RPC y concurrencia | **78/78 aprobadas**, sobre base MVP nueva con claims SQL sintéticos; no se presentan como JWT firmados. Incluye ocho carreras y persistencia/auditoría |
| Regresión HTTP de F4 | **59/59 aprobadas** reejecutadas contra Next/GoTrue/REST reales: ES256, vencimiento real, logout, alcance, cursor, auditoría y carreras |
| Escenarios nuevos MVP | **45 escenarios únicos con último resultado aprobado**, no una sola batería integral sin fallos: 36 datos/servicios y nueve administrativos. Se corrigieron fixtures y se repitieron solo los escenarios afectados; intentos íntegros conservados |
| Storage límites adicional | **3/3 aprobadas**: MIME 415, tamaño >8 MiB 413, carpeta de otro usuario 403; consentimiento de QA quedó revocado |
| Producción local | **8/8 rutas cerradas** HTTP 404 con flag true y no-store; sin desplegar Vercel |
| Suite Node del repositorio | **269/269 aprobadas**: 255 anteriores +14 nuevas de workspace; las nuevas usan dobles para errores/DTO, no se cuentan como backend real |
| TypeScript y build | Aprobados, ocho rutas clínicas/profesionales incluidas; sin modificar next-env.d.ts |
| Dependencias | npm audit en todos los niveles: **0 vulnerabilidades** |
| Integridad y secretos | Verificación final de hashes y diff-check, sin credenciales ni archivos .env nuevos; detalle en cierre de preservación |

Evidencias: [paquete limpio](backend_mvp/MIGRACIONES_DESDE_CERO.json), [SQL](backend_mvp/REGRESION_SQL.json), [regresión HTTP](backend_mvp/REGRESION_HTTP_F4.json), [últimos resultados por escenario y estado final](backend_mvp/CIERRE_INTEGRACION.json), [límites Storage](backend_mvp/STORAGE_LIMITES.json), [producción cerrada](backend_mvp/PRODUCCION_CERRADA.json), [verificaciones técnicas](backend_mvp/VERIFICACIONES_FINALES.json). Las operaciones SDK prueban persistencia/respuesta del servicio; las etiquetas fijas storage/metadatos/rpcHttp de los intentos no sustituyen instrumentación de códigos de red. Los HTTP Next y límites negativos indicados sí se comprobaron explícitamente.

### Problemas identificados y correcciones

- Primer banco SQL se inició durante el reinicio requerido para expirar JWT: PostgreSQL estaba arrancando. Se registró el bloqueo y se serializó el ensayo respecto a reinicios; no se cuenta como prueba aprobada.
- Un caso «authenticated no adopta ejecutor» se ejecutó primero con sesión postgres y SET ROLE, que no prueba la capacidad del login real. Se corrigió el banco para usar **authenticator por TCP** en los casos marcados, con contraseña local solo en stdin/memoria. Resultado final 78/78; no se amplió ningún privilegio.
- La consulta profesional usaba SELECT * internamente con privilegios de columna mínimos y devolvió 503. Se corrigió la proyección del incremental, **sin otorgar columnas de contacto**. Se volvió a inicializar el paquete limpio con su SHA corregido.
- Fixtures iniciales usaban purpose photo_storage, distinto del CHECK aprobado academic_photo_storage; y el TOTP local estaba desactivado. Se corrigió la fixture y se habilitó temporalmente TOTP en config local, nunca saltando AAL2 o creando claims falsos. GoTrue emitió la sesión AAL2; DI-150 respondió 200. El autenticador de QA fue efímero en memoria, nunca un secreto publicado.
- Repetir el banco intentó reasignar un dentist_id ya vinculado: el trigger inmutable lo rechazó. Se corrigió el banco para **reutilizar** su vínculo de QA, no relajar el trigger. Se retiraron solo solicitudes sintéticas identificadas de intentos anteriores para que la paginación tuviera un dataset reproducible.
- El wrapper de restauración agotó el plazo de CLI al arrancar el stack. El archivo ya se había restaurado; se repitió start local sin borrar volúmenes y se verificaron config y variables efectivas: JWT 3600, TOTP enroll/verify false, cinco contenedores disponibles, seis cuentas QA, ningún factor TOTP ni trigger de fallo y ninguna fotografía de QA activa. F2/F3 conservan tres atenciones cada una. No se presenta el wrapper fallido como exitoso.
- [INTENTOS_HTTP_MVP.json](backend_mvp/INTENTOS_HTTP_MVP.json) conserva 32/12, 41/3 y 36/0 de los ensayos; el cierre identifica el intento exacto del último resultado por escenario. [INTENTOS_SQL.json](backend_mvp/INTENTOS_SQL.json) conserva los bloqueos/fallos SQL anteriores y el resultado final.

No se reejecutaron navegador/UI del equipo, entrega de correo de registro, suspensión real de cuenta Auth, carga clínica, aprobación profesional operativa, descarga de documentos clínicos, dispositivos físicos, carga masiva, recuperación de un proyecto alojado ni validación clínica. La protección del último administrador conserva el protocolo y pruebas automatizadas anteriores; no se presenta como un nuevo ensayo HTTP destructivo de último administrador.

## 8. Reproducción local y propuesta de QA independiente

Solo con el Docker QA ya preparado y las herramientas existentes, desde la raíz del repositorio:

```powershell
docker info
docker ps
python docs/arquitectura/backend_mvp/preparar.py
python docs/arquitectura/backend_mvp/preparar_http.py
node docs/arquitectura/backend_mvp/regresion_http_f4.mjs
python docs/arquitectura/backend_mvp/regresion_sql.py
node docs/arquitectura/backend_mvp/mfa_local.mjs
node --experimental-strip-types docs/arquitectura/backend_mvp/validar_http_mvp.mjs --solo-datos
node docs/arquitectura/backend_mvp/validar_storage_limites.mjs
node --experimental-strip-types --test "src/features/**/*.test.mjs"
npm run typecheck
npm run build
node docs/arquitectura/backend_mvp/verificar_produccion.mjs
node docs/arquitectura/backend_mvp/cerrar_evidencias.mjs
npm audit --audit-level=low
git diff --check
```

Son comandos **locales de QA sintético**: preparación aplica SQL y los bancos escriben fixtures. `preparar.py` se detiene si la base existe; para repetir desde cero usar solo `--recrear-qa-propia` tras verificar su marcador y que ninguna prueba la usa. La fixture SQL se crea una vez por base limpia. No ejecutar bancos mientras otro reinicia el stack; no ejecutar build mientras Next dev comparte .next. Los puertos 3104/3107/3106 deben estar libres y los procesos se detienen por PID propio. La configuración de credenciales se obtiene en memoria del CLI local, nunca del .env remoto. El banco MFA puede exigir recuperación manual si CLI agota el plazo; verificar salud y configuración antes de continuar.

### QA alojado futuro — procedimiento propuesto, no ejecutado

1. Aprobar creación/coste/responsables de **un proyecto QA separado**, sin vincular Dental-IA ni copiar datos/usuarios. Registrar ref/URL permitidos y prohibir explícitamente el ID de Dental-IA. Guardar secretos en el almacén del entorno, nunca en ejemplos/versionado/chat.
2. Workspace de QA independiente, CLI/versiones fijadas, snapshot lógico **solo de esquema** y aprobación de baseline. No recrear Auth/Storage gestionados ni inventar migraciones históricas; establecer un historial baseline revisado. Validar PostgreSQL/extensiones/owners y privilegios de lectura/bloqueo auth.users/auth.sessions.
3. Empaquetar el orden anterior como nuevas migraciones revisadas, conservando fuentes históricas. Los borradores exigen nombre dentaia_arch_qa_* y marca qa_only: **no funcionan directamente en un proyecto alojado cuyo DB es postgres**. No quitar guardas con un reemplazo; diseñar allowlist/atestación de destino y artefactos QA específicos antes de aplicar.
4. Inicializar exclusivamente QA con servicios apagados. Verificar RLS/ACL, privados, índices/FK, advisors y grants de funciones, incluido rechazo directo REST. No instalar tablas IA ni activar cambios administrativos por accidente. Cuentas profesionales/roles no se otorgan por aparecer en directorio.
5. Configurar Auth QA y TOTP legítimo para administradores; no desactivar DI-150, confirmación de correo o RLS. Crear cuentas ficticias autorizadas y permisos de alcance limitado. Aprobaciones de roles tienen actor/revisor distintos y auditoría, no botones ficticios de administración.
6. El adaptador HTTP actual bloquea URL no loopback y production. Para un Preview de QA se requiere **otro cambio explícito** de configuración con allowlist QA y protección del despliegue, pruebas negativas de proyecto equivocado y autorización. No basta cambiar una variable. Los adaptadores HTTPS DI-151 no deben recibir una excepción insegura de producción para facilitar QA.
7. Repetir desde limpio restricciones, JWT reales, dos cuentas, lectura/escritura permitida/denegada, auditoría fallida, concurrencia, idempotencia, logout/caducidad, tamaño/MIME y recuperación. Integrar y probar las UI con sus autoras sin fallback sintético ni caché clínica. Registrar resultados nuevos de ese QA; los de este informe no los sustituyen.
8. Respaldar esquema, versiones, hashes y evidencia de auditoría antes de activar. Prueba de restauración en QA con sus propios datos sintéticos. Si hay fallo, cerrar nuevas concesiones/lecturas en DB y adapter, conservar revocación propia por RPC y trazas; corrección hacia delante, sin DROP de historial/auditoría o desactivar RLS. Rotar secreto de cursor invalida cursores, **no** permisos/JWT ni contenido ya entregado. Reset solo de QA desechable identificado, nunca de Dental-IA.

## 9. Pendientes y criterio de integración GitHub

**Bloqueados por decisión del equipo:** política/texto/vigencia de consentimiento clínico, procedimiento de verificación y acreditación profesional, retención/anonimización y bajas, asignación operativa de pertenencias, activación y entorno QA alojado. Los límites técnicos de página/recursos no sustituyen acuerdos clínicos.

**Diseñados, pendientes:** selección segura de destinatarios elegibles para el paciente, altas de identidad clínica/membresías con verificación, descarga clínica auditada, canal durable de rechazos del gateway y observabilidad, experiencia de concesiones acordada con Angie y adaptación del proveedor de Anelis. La lista de solicitudes profesional es un resumen mínimo; no se añadió acceso a contactos/mensajes de pacientes ni nuevos estados.

**Integración incompleta:** ocho commits DI-144–151 aún fuera de main; importación del lector de roles requiere esa base o extracción acordada. No llevar en un mismo PR como efectos implícitos la landing antigua ni una integración administrativa no revisada. Nueva propuesta de PR: `feat(DI-36): consolidar backend MVP y servicios comunes en QA`, hacia la base acordada tras revisar la dependencia administrativa (o apilado explícitamente contra feature/superusuario-admin). No se crea ahora.

Al autorizar publicación: preservar primero los archivos sin seguimiento, preparar una rama desde la base actualizada, trasladar por alcance únicamente backend/docs/evidencias, revisar diff de merge-base y combinar con las vistas en un entorno temporal. Exigir CI/Security/Tests, Preview cerrado y nuevas pruebas de combinación; no se han ejecutado GitHub Actions ni Vercel para estos cambios porque no hay commit/push/PR. Migraciones siguen siendo un paquete QA revisable, sin autodespliegue.

Archivos funcionales de esta entrega: nuevo workspace.ts y workspace.test.mjs; ampliación de http.ts/servidor.ts y GET de access-grants; cuatro Route Handlers nuevos bajo clinical/patients/me y professional/{me,patients,requests}. SQL/harness/contratos/evidencias en backend_mvp; actualización justificada de catálogo, validador documental, README y manifiesto. DI-151 y las fuentes originales F1–4 se preservan salvo los adaptadores/contratos expresamente ampliados.

Evidencias utilizables después para DI-36: inventario/modelo MVP, paquete ordenado y hashes desde vacío, RLS/ACL/constraints, nuevo RPC y cinco lecturas HTTP, tests SQL/JWT/Storage/roles con sus límites y cierre productivo. **No equivalen a DI-36 Listo**: faltan revisión/versionado/integración, criterios pendientes y validación de las vistas. El acuerdo de responsabilidad deberá regularizarse posteriormente en Jira por una actividad autorizada.

Referencias oficiales: [funciones y privilegios](https://supabase.com/docs/guides/database/functions), [entornos separados](https://supabase.com/docs/guides/deployment/managing-environments), [enrolamiento MFA](https://supabase.com/docs/reference/javascript/auth-mfa-enroll), [desafío/verificación](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify). Las guías no autorizan cambios remotos; las aprobaciones concretas de este informe provienen de ejecuciones locales.
