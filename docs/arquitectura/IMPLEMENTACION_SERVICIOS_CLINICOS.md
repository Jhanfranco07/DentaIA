# Fase 3 — servicios clínicos seguros y contratos de integración

**Actualización posterior:** la [Fase 4](VALIDACION_HTTP_JWT.md) ya implementó tres rutas Next y realizó las pruebas HTTP con JWT de Auth local que aquí figuraban pendientes. Este informe conserva el alcance y las evidencias SQL de Fase 3; las vistas, el despliegue y la aprobación clínica siguen pendientes.

Fecha: **03/11/2026, America/Lima**. Rama `docs/auditoria-arquitectura-integral`, base Git c992a142. Implementación exclusivamente local y revisable; no desplegada a Dental-IA ni lista para producción.

## Alcance y evidencia previa

Se verificaron los 103 hashes del paquete previo y los SHA de los siete borradores asociados a las 118 pruebas SQL de Fase 2. Esa evidencia es histórica: no se presentó como ejecución nueva. Se revisaron modelo, diccionario, permisos, contratos, protocolo transaccional y criterios locales de DI-34/36/145/146/157. Los 31 hallazgos originales se conservan.

No existían RPC clínicos en el código funcional de esta rama. DI-150/151 protegen administración y no conceden permiso clínico; no se modificaron. Los proveedores sintéticos de la vista profesional descritos en la auditoría tampoco sustituyen esta implementación.

Se implementaron tres RPC con datos persistidos, sobre la base local **`dentaia_arch_qa_fase3`**, dentro del contenedor Supabase existente. Se conservaron `dentaia_arch_qa_fase2` y sus pruebas. No se crearon contenedores adicionales, tablas de negocio, otro backend, rutas Next.js ni pantallas.

## Archivos y orden de aplicación

| Orden | Archivo | Contenido |
|---|---|---|
| Previo | Borradores 01–04 de Fase 1 | Once tablas clínicas e invariantes; originales sin modificar |
| 08 | [Identidad y privilegios](servicios_clinicos/sql/08_identidad_y_privilegios.sql) | Rol técnico mínimo, identidad, sesiones, auditoría y políticas exclusivas del ejecutor |
| 09 | [Autorizaciones](servicios_clinicos/sql/09_autorizaciones.sql) | Concesión/revocación y wrappers públicos |
| 10 | [Historial](servicios_clinicos/sql/10_historial_autorizado.sql) | Proyección autorizada, paginación y auditoría |

Son **borradores**, no migraciones canónicas instaladas en `supabase/migrations`. No se aplicaron 05–07 de IA ni la migración administrativa en esta base. El catálogo local verifica **16 tablas, 120 columnas y RLS habilitado**: las cinco del MVP y las once clínicas. [Metadatos efectivos](servicios_clinicos/pruebas/CATALOGO_RPC.json).

Los archivos nuevos están en `servicios_clinicos/sql/` y `servicios_clinicos/pruebas/`; este informe y el índice enlazan las evidencias. Los scripts y resultados anteriores permanecen intactos.

## Frontera de identidad y privilegios

1. El transporte previsto es JWT de usuario verificado por PostgREST. PostgreSQL deriva `auth.uid()`, `session_id` y `exp`; no hay parámetro actor, rol ni userId elegido por el cliente.
2. El helper privado `identity_context` vuelve a leer Auth: cuenta confirmada, no anónima, no borrada/bloqueada, sesión existente/no vencida y asignación canónica `app_metadata.dentaia`.
3. El contrato exige versión **numérica** 1, estado activo, entre uno y tres roles conocidos sin duplicados. No usa `user_metadata` ni roles antiguos de un JWT como autoridad. Un `superusuario` sin permiso clínico no obtiene historias ajenas.
4. Clínica, profesional y membresía deben estar habilitados; la membresía debe corresponder al actor y estar vigente. Se requiere última verificación aprobada. La provisión profesional de QA es ficticia: no acredita un procedimiento real aprobado.
5. Se vuelve a comprobar el reloj después de esperas relevantes. El rol clínico no exige AAL2 porque esa decisión clínica no está aprobada; MFA/AAL2 de administración se conserva sin cambios.

Los wrappers públicos son **SECURITY INVOKER**. Las operaciones privadas son SECURITY DEFINER, propiedad de `dentaia_clinical_executor`: **NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT**. Ni anon, authenticated, service_role ni authenticator pueden adoptar ese rol.

Solo el helper privado de identidad necesita propietario `postgres` para leer/bloquear campos mínimos de Auth. Está fuera de esquemas expuestos y no es ejecutable por clientes. No escribe Auth y no devuelve contraseñas, tokens, factores MFA ni metadatos ajenos a DentaIA. El ejecutor no recibe SELECT de credenciales Auth ni de rutas privadas de documentos.

Todos los objetos usan nombres cualificados y `search_path=''`. Los EXECUTE predeterminados de PUBLIC se revocan. `authenticated` solo puede ejecutar los tres wrappers y sus correspondientes entradas privadas, con idénticos controles; no puede ejecutar helpers ni la configuración.

### RLS y permisos técnicos

- El acceso directo del cliente a `clinical.*` sigue cerrado. No se agregó SELECT/UPDATE clínico para pacientes, odontólogos o administradores.
- Las políticas nuevas se limitan al rol ejecutor: SELECT necesario; INSERT de concesiones/recursos/auditoría; UPDATE de `revoked_at`.
- PostgreSQL exige UPDATE de alguna columna para usar SELECT FOR SHARE/UPDATE. Se concede UPDATE de `id` solo al rol técnico en las tablas que bloquea. No existe RPC para editar esos IDs; la identidad y el historial mantienen sus triggers de inmutabilidad.
- No se conceden UPDATE/DELETE de auditoría. Los triggers existentes también rechazan su modificación.
- La política de profiles para el ejecutor solo permite resolver nombre mínimo de procedencia en una consulta ya autorizada. No amplía la RLS de usuarios normales.

## Configuración cerrada por defecto

`clinical_service.configuration()` devuelve inicialmente `enabled:false`. No se habilita con un GUC o JSON enviado por el cliente. Solo un operador autorizado puede reemplazar su definición.

La fixture local configura explícitamente `QA-NO-CLINICO-v1`, finalidad `academic_shared_history_qa`, vigencia máxima de 24 horas, hasta 100 recursos, 50 atenciones por página y 100 objetos anidados por atención. Son **parámetros técnicos/sintéticos de QA**, no una aprobación de política clínica, consentimiento legal o reglas comerciales del equipo.

La lectura y las nuevas concesiones quedan desactivadas sin configuración. La revocación propia continúa disponible para una cuenta vigente, incluso si se desactivan nuevas concesiones o cambia su rol: sigue siendo el propietario del registro, no una excepción para terceros.

## Contratos RPC implementados

Índice estructurado: [CONTRATOS_RPC.json](servicios_clinicos/CONTRATOS_RPC.json). Sus tres nombres se contrastaron contra el catálogo SQL realmente instalado; no declara rutas HTTP existentes.

### `grant_clinical_access`

```text
p_id: uuid                         -- Idempotency-Key de la concesión
p_membership_id: uuid              -- profesional + clínica destinatarios
p_encounter_ids: uuid[]            -- conjunto explícito no vacío y sin duplicados
p_expires_at: timestamptz           -- instante absoluto finito
p_policy_version: text
p_accepted: boolean                -- debe ser true
```

El paciente se resuelve desde la sesión y patient_records; no se acepta patientId en el cuerpo. Se validan rol paciente, propiedad de todas las atenciones, destinatario vigente/verificado, política configurada y vencimiento. No se usa consentimiento fotográfico ni una solicitud de atención para conceder acceso.

El UUID de idempotencia es la PK de la concesión. Un advisory lock serializa la misma clave entre cuentas; después se bloquean paciente, contexto y recursos. Un reintento compara propietario, contexto, vencimiento, política, finalidad y conjunto completo de recursos. Cambiar contenido o colisionar con otra cuenta devuelve conflicto sin revelar sus datos. No se amplían recursos ni se reactiva una concesión revocada por repetir la clave.

Éxito: `{ok:true,status:201|200,id,estado,expiresAt,revokedAt,replayed,requestId}`. Estado: vigente, vencido o revocado. Escrituras y auditoría se confirman en una transacción.

Tablas: patient_records, professional_accounts, professional_verifications, clinics, clinic_memberships, clinical_encounters, clinical_access_grants, clinical_grant_resources, clinical_access_audit y lectura mínima de Auth.

### `revoke_clinical_access`

```text
p_id: uuid
```

Deriva propietario desde la sesión. Bloquea su patient_record y su concesión; no bloquea ni devuelve la concesión de otro paciente. Marca revoked_at una sola vez usando el reloj del servidor; no borra ni cambia alcance/destinatario. Puede revocar permisos vencidos.

Éxito: `{ok:true,status:200,id,revokedAt,requestId}`. Repetir conserva la misma fecha. Si falla auditoría, la revocación se revierte por completo. Tablas: patient_records, clinical_access_grants y clinical_access_audit.

### `get_authorized_clinical_history`

```text
p_patient_id: uuid
p_membership_id: uuid|null          -- obligatorio para profesional; null para propio
p_limit: integer = 20
p_before_at: timestamptz|null
p_before_id: uuid|null              -- ambos campos de cursor juntos
```

El paciente con rol vigente consulta lo propio. El profesional requiere rol, verificación, contexto propio y concesiones activas. Se bloquean todas las concesiones relevantes y se consulta la **unión de sus recursos**, sin conceder toda la clínica ni limitar el historial a la clínica creadora.

Respuesta compatible como contrato de adaptación:

```text
{ok,status,apiVersion:"clinical.v1",origen:"supabase",environment:"qa_local",
 estado:"listo"|"sin_datos",caso,entries,nextCursor,requestId}
```

Cada atención conserva IDs/fechas, reemplazos y motivo de corrección, clínica y profesional de origen. `clinicalEntries` conserva las versiones; background muestra la última entrada terminal como resumen, sin inventar texto. diagnoses/treatments contienen entradas terminales, sin convertirlas en diagnósticos validados. Los estados unknown/not_recorded y valores null se respetan. exams solo contiene metadatos permitidos; no hay bucket, path, URL pública o firmada.

La clínica/profesional de origen son procedencia histórica, no el contexto lector. Un nombre actual no certifica su nombre histórico; si falta profiles, se devuelve null. No se filtran atenciones porque el profesional de origen ya no esté activo.

Paginación estable `(attended_at DESC,id DESC)`. El cursor SQL es una tupla **no confiable**, nunca una capacidad: cada página vuelve a autorizar paciente/contexto/recursos. La futura API Next debe firmar y vincular su cursor HTTP, según el contrato anterior, antes de traducirlo a esta tupla. Esa firma todavía no está implementada. Si una página excede el límite anidado no se entrega un historial parcial silencioso.

## Errores y auditoría

Las denegaciones normales devuelven `{ok:false,status,code,requestId}` sin caso, paciente ni entradas. Códigos estables: INVALID_REQUEST (400), AUTHENTICATION_REQUIRED (401), ACCESS_DENIED (403), IDEMPOTENCY_CONFLICT (409), SERVICE_UNAVAILABLE (503). Una asignación canónica inválida se trata como identidad no habilitada (401); no se infieren permisos por tener un JWT previamente válido.

**Estos status son del envelope SQL.** No se afirma haber medido esos HTTP: PostgREST normalmente transporta un JSON devuelto con HTTP 200. La API Next futura debe comprobar `ok/status` y mapearlos, no usar únicamente la ausencia de `error` de supabase-js.

La auditoría genera requestId en servidor y almacena actor, paciente autorizado, membresía/contexto, concesión efectiva, operación, instante, resultado y motivo seguro. La membresía conserva una clínica inmutable. Con múltiples concesiones se inserta un evento por concesión efectiva, con el mismo requestId; no se copian contenidos clínicos.

Una denegación no lanza una excepción que elimine su propio evento. Conserva actor identificado y contexto propio validado; no registra el paciente/grant ajeno que el solicitante intentó adivinar. La prueba de COMMIT y nueva conexión verifica que el evento persiste.

Si falla el INSERT de auditoría o una operación inesperada, el wrapper falla con `P0001 / CLINICAL_OPERATION_UNAVAILABLE`, sin contenido. La transacción revierte concesión/revocación; no se promete registrar dentro de una auditoría que está indisponible. El transporte futuro necesita un log técnico saneado para ese incidente.

Límites: un rechazo anterior al RPC (firma JWT inválida, falta de EXECUTE, UUID no convertible, función/parámetros inexistentes) no puede ser auditado por una función que no se ejecutó. No se concede acceso a anon para intentar solucionar eso. Corresponde al gateway/BFF registrar el incidente mínimo, sin datos clínicos.

## Concurrencia y atomicidad

Orden: identidades Auth por UUID, sesión, paciente, profesional/clínica, membresía, concesiones por UUID y recursos. La concesión usa además un lock de su clave antes del paciente. La lectura comparte locks; revocar obtiene locks exclusivos compatibles con el protocolo.

Si la lectura se autoriza primero puede terminar y revocar espera hasta su commit. Si revocar confirma primero, nuevas lecturas esperan/revalidan y no reciben contenido. Las esperas no extienden vencimientos: se usa clock_timestamp y se revalida la sesión después de esperar. No se prometen cancelación de una respuesta ya autorizada, recuperación de bytes vistos ni revocación de descargas aún no implementadas.

Se añadió `verification_context_lock`: una nueva revisión profesional bloquea exclusivamente su cuenta antes de insertarse. Así no puede aparecer un rechazo concurrente después de que un lector validó la aprobación previa. Complementa 04 sin modificarlo; no implementa ni autoriza el procedimiento real de acreditación.

La atomicidad es PostgreSQL: permisos, auditoría y resultados SQL dentro de su transacción. No incluye Storage ni HTTP. La función no puede forzar el commit del llamador: los clientes no deben tener conexión SQL directa, y el futuro BFF debe esperar la confirmación de PostgREST antes de entregar/streaming. Un administrador de base de datos puede alterar objetos o revertir su propia transacción; no se declara auditoría inviolable frente a ese administrador.

## Pruebas efectivamente ejecutadas

La última batería aprobó **78/78**, desde una base Fase 3 limpia: 67 casos y ocho carreras SQL, dos comprobaciones de persistencia entre conexiones y una comprobación de auditoría denegada tras COMMIT. [Resultados](servicios_clinicos/pruebas/RESULTADOS.json), [intentos y errores conservados](servicios_clinicos/pruebas/INTENTOS.json), [reproducción](servicios_clinicos/README.md).

Incluye: positivo entre dos clínicas; alcance parcial y unión de concesiones; aislamiento; rol/contexto incorrectos; suspensión; permiso ausente/vencido/revocado; manipulación de IDs/cursor; cambios de rol y user_metadata; sesión ausente/borrada/expirada; política y aceptación; idempotencia; rollback ante fallo de auditoría; ACL, helpers privados y metadatos del rol ejecutor; límites de carga y DTO sin credenciales/rutas.

Las ocho carreras observaron sesiones/esperas reales en pg_stat_activity: lectura–revocación en ambos órdenes, dos consultas, suspensión de membresía, nueva verificación rechazada, permiso que vence durante espera, expiración SQL del JWT durante espera y concesión duplicada concurrente.

Son **ejecuciones reales de PostgreSQL con datos y claims sintéticos**. Once casos utilizan la conexión técnica authenticator; su contraseña local se toma exclusivamente en memoria del REST local, sin imprimirla ni guardarla. No se utiliza .env ni ninguna credencial de Dental-IA. El resto prepara cambios controlados como operador y luego cambia a authenticated para invocar los RPC.

**NO EJECUTADO:** firma/verificación HTTP con dos JWT emitidos realmente por GoTrue, login/MFA interactivos, expiración real de una sesión HTTP, descarga de documentos/Storage, pantallas, rendimiento, backups ni uso clínico. Auth oficial está copiado como esquema vacío en la base QA; los servicios HTTP del stack siguen conectados a su base local postgres.

### Errores y correcciones

1. La prueba inicial de SET ROLE usaba session_user postgres, miembro autorizado del rol ejecutor para instalar funciones. No representaba un cliente: se reemplazó por conexión real authenticator; se verifica el rechazo efectivo sin usar privilegios del operador como evidencia.
2. Revisión de contrato: se hizo estricta la versión numérica y la unicidad de roles, compartiendo valid_assignment para actor/destinatario. Se revalida sesión y vigencia al terminar esperas de concesión.
3. Una fixture de límite de página insertaba entradas como operador y ejecutaba sus triggers diferidos después de cambiar a authenticated. Se ejecutaron las restricciones de esa preparación antes del cambio de rol, sin relajar permisos ni modificar los triggers históricos.
4. Se repitió todo desde una base limpia. Los intentos fallidos se conservan; no se ocultaron ni se desactivó ninguna validación.

## Contratos para las vistas y dependencias

### Regresión ejecutada nuevamente

| Comprobación | Resultado de esta fase |
|---|---|
| Node.js test runner del repositorio | **231/231 aprobadas**, cero fallos/omitidas/canceladas |
| `npm run typecheck` | Aprobado, exit 0 |
| `npm run build` | Aprobado, exit 0 |
| `npm audit --audit-level=low` | **0 vulnerabilidades**, exit 0 |
| `git diff --check` | Sin errores |

Los logs de regresión se conservaron temporalmente fuera del repositorio. Estas comprobaciones no sustituyen los ensayos SQL ni prueban las nuevas rutas HTTP. No se modificaron dependencias, workflows ni código de aplicación.

| Área | Integración siguiente | Límite |
|---|---|---|
| DI-145 / DI-157 — Anelis | Adaptador del puerto de historial al DTO clinical.v1; enviar contexto y paciente objetivo, nunca escenario/actor/permisos del cliente | Su proveedor sintético y sus interfaces no fueron modificados; debe resolver sus tipos/estados de presentación |
| DI-36 — backend | Rutas propuestas de historial/concesión/revocación; verificar JWT, Origin/CSRF según transporte, límites y no-store; reenviar JWT del usuario al RPC | No usar service_role como actor ni hacer SET de claims desde JSON; faltan rutas y cursor HTTP firmado |
| DI-34 — arquitectura | Revisar política, privilegios y orden de locks; crear migraciones canónicas para ambiente aprobado | No aplicar automáticamente estos borradores a Dental-IA |
| DI-146 — Angie | Mantener panel de solicitudes/recomendaciones; futura integración de concesiones solo con alcance aceptado | No se añadió historial clínico a su historia ni se modificó su UI |
| Administración | Provisionar identidad/verificación/membresía mediante proceso aprobado | No se modificaron DI-150/151 ni se implementó un alta de profesionales/roles |

Los endpoints Next de [CONTRATOS_API.md](CONTRATOS_API.md) siguen propuestos. No hay rutas HTTP nuevas en esta fase. Para integrar completamente se necesitan también resolutores seguros de identidad clínica propia/contextos y listado de concesiones propias; no se debe abrir SELECT directo para suplirlos. La consulta de solicitudes no implica acceso al historial.

## Decisiones y riesgos pendientes

- Procedimiento de verificación profesional y aprobación del equipo; provisión/membresías y escritor único conforme al protocolo de locks.
- Texto/finalidad/versiones de consentimiento, plazos de concesión, conservación/anonimización y gestión de bajas de Auth. Las FK clínicas RESTRICT siguen vigentes.
- HTTP autenticado completo, cursor firmado, no-store, manejo seguro de errores/reintentos, rate limiting y auditoría técnica de rechazos previos al RPC.
- Adaptadores de ambas vistas, listados/identidad propios, documentos privados y descarga auditada; no se implementa escritura asistencial ni intercambio con clínicas reales.
- Las garantías concurrentes se comprobaron para los flujos probados; no equivalen a carga productiva ni cubren todos los futuros escritores o todos los posibles deadlocks.
- No hay transacción compartida con Storage, entrenamiento/inferencia ni validación clínica.

**Recomendación:** revisar estos borradores y contratos con Jhan/Anelis antes de integrar un proveedor en las vistas. La siguiente validación debe usar JWT HTTP reales en QA y revisar despliegue/retención/política con el equipo. No habilitar clínica real ni declarar listo para producción. No se modificaron Jira, Supabase remoto, otras ramas ni funcionalidades existentes; sin commit/push/PR/merge.

Referencias técnicas primarias: [funciones y privilegios en Supabase](https://supabase.com/docs/guides/database/functions), [RLS en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). Las garantías concretas descritas aquí se respaldan por los SQL y resultados locales enlazados, no solo por estas guías.
