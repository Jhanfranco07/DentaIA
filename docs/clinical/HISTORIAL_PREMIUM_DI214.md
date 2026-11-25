
# DI-214 · Historial de evaluaciones Premium

El paciente consulta sus evaluaciones en **Mis resultados**. El odontólogo elige el contexto y el paciente en el portal clínico y abre **Consultar evaluaciones compartidas**. Next verifica la sesión vigente, reutiliza las restricciones de origen y entorno del BFF clínico y llama a Supabase con el JWT del usuario. Las respuestas de historial y descarga se sirven con caché privada deshabilitada. Las rutas Premium tienen una URL fija y reciben contexto, selección y paginación en el cuerpo para mantener los identificadores fuera del registro de URL de Next.

## Arquitectura y datos

| Capa | Archivos y contratos |
| --- | --- |
| Paciente y odontólogo | src/features/analisis/MisResultados.tsx, src/features/profesional/ProfesionalClinico.tsx y src/features/premium-vision/PremiumHistory.tsx |
| BFF | src/app/api/patient/premium-history y src/app/api/professional/premium-history, src/features/clinica-http y src/features/premium-vision/history-http.ts |
| Contrato y comparación | src/features/premium-vision/history.ts y dentaia.premium-vision-result.v1 |
| Ingestión y DI-42 | src/features/premium-vision/history-server.ts |
| Esquema | supabase/migrations/20261125102804_di214_premium_evaluation_history.sql |

La migración agrega tres tablas privadas con RLS. Guarda la respuesta v1 completa, fecha de evaluación, protocolo de captura si consta, identificadores de consentimiento y vínculo opcional a la galería. El estado, el proveedor y el modelo se leen del contrato original. La paginación usa el orden estable de fecha e identificador. Un UUID de operación estable por paciente permite reintentos idénticos y detecta cambios de contenido. Un bloqueo transaccional por paciente serializa altas, retiradas y reintentos. La lectura profesional también toma los bloqueos de concesión de DI-36 y registra auditoría antes de devolver datos.

El consentimiento para procesamiento temporal sigue bajo DI-211. DI-214 registra dos decisiones longitudinales con la versión di214.v1, una para guardar resultados y otra para vincular fotos. La segunda exige también que la foto pertenezca al mismo usuario y que siga vigente el consentimiento de galería. Para compartir se requiere una acción explícita del paciente sobre una concesión DI-36 vigente y una evaluación concreta. El paciente decide si incluye la foto. Cualquier revocación relevante corta las nuevas consultas y descargas. La autorización se vincula al identificador del objeto original. El BFF comprueba además la huella SHA-256 del contenido antes de entregarlo. Sustituir el archivo en la misma ruta no amplía la concesión. Las fotos se descargan por el endpoint autenticado de Storage. La política profesional no permite emitir URLs firmadas, listar objetos ni cambiar sus permisos.

La retirada del consentimiento de resultados corta nuevas escrituras y acceso profesional a los resultados asociados. El paciente conserva acceso a los resultados previos y puede eliminarlos, incluso cuando vence Premium. Una nueva aceptación habilita nuevas escrituras con un identificador de consentimiento distinto. Retirar el consentimiento fotográfico elimina las referencias al original en DI-214. La eliminación del original se realiza en la galería, que conserva su ciclo de vida independiente. El borrado de la evaluación retira su carga clínica y sus concesiones, conserva una marca sin resultado para idempotencia y deja intactas las atenciones o diagnósticos legítimos de DI-36. La conservación del historial se mantiene hasta que el paciente lo elimine o se aplique la baja del titular según la política del entorno. La auditoría existente conserva su política de retención. La activación con datos reales requiere aprobar la retención de marcas y consentimientos, incluidos backups, y el procedimiento de baja de expedientes clínicos.

La comparación cuenta regiones detectadas por categoría solo entre evaluaciones completas con igual proveedor, identificador y versión de modelo, contrato, dimensiones de imagen y protocolo frontal documentado. También exige calidad adecuada sin incidencias ni limitaciones y rechaza discrepancias observadas en los identificadores de la taxonomía. DI-211 debe versionar los pesos, la taxonomía y la configuración de inferencia como una unidad para que una misma versión sea comparable. El contrato actual no registra variaciones de luz, postura o distancia. Una diferencia de recuento carece de interpretación clínica. Todos los estados permanecen disponibles para consulta individual.

## Dependencias

- **DI-211** mantiene deshabilitada la inferencia. La escritura queda preparada para el orquestador de un proveedor autorizado. Este debe verificar sesión, plan, capacidad y consentimiento temporal, aplicar el limitador de análisis antes de leer la imagen, validar la salida y conservar la misma clave de operación en los reintentos. El adaptador de servidor valida el contrato y, si se solicita vínculo, coteja los bytes con la foto privada. PostgreSQL comprueba la firma, su vigencia, el plan efectivo, el titular y los consentimientos originales. El cliente nunca recibe la clave de firma. Hasta integrar el proveedor no hay ruta de inferencia ni de ingestión HTTP.
- **DI-213 / PR #118** usa recursos propios y comparte el BFF y DI-36. No se necesita su migración para ejecutar DI-214. La política de DI-213 se limita a Smile y la de DI-214 a la galería dental. Al reconciliar ambos cambios del BFF, conservar en el tipo RpcClinico tanto access_clinical_odontogram como access_premium_history y las dos rutas. El portal mantiene paneles independientes.
- **DI-42 / DI-259**. En main, el generador PDF existente recibe CasoDemo y su imagen educativa. La proyección premiumPreventiveReportSource prepara fecha, resultado v1 y protocolo para una futura interfaz de DI-42. Hasta contar con esa interfaz y validar su autorización y descarga privada, la vista no ofrece un enlace de reporte Premium.
- **DI-215** puede consumir datos preventivos desde la misma frontera autorizada. El seguimiento de rutinas y Denti conservan sus contratos.
- **DI-216** puede consumir la disponibilidad del historial y el plan efectivo del servidor. La capacidad premium_visual_evaluation conserva implemented: false.

## QA local con servicios reales

El contenedor exclusivo se llama dentaia_di214_qa. API local en 127.0.0.1:57421, PostgreSQL en 57422 y Next en localhost:57430. No vincular el proyecto local a Supabase alojado. Para reproducir, copiar supabase/config.toml a un directorio ignorado, cambiar project_id y todos los puertos a un rango libre, y desactivar la carga automática de migraciones y semillas en esa copia. Iniciar Auth, PostgREST, Storage y la base con el CLI fijado en package-lock.json. El script QA asume los puertos y nombre indicados.

Ejecutar node scripts/qa-di214-migrations.mjs en el stack limpio. El script comprueba que la base no tenga cuentas Auth ni el esquema funcional, aplica el historial completo de main e inserta los componentes 02, 03 y 04 de DI-36 Fase 8 con la adaptación de guardas exclusiva de QA. Con --with-di213, incluye la migración exacta del PR #118 antes de DI-214. Las migraciones históricas conservan sus archivos originales. Para comprobar el orden inverso sobre el esquema ya preparado, ejecutar la migración DI-213 en una transacción local que finalice con ROLLBACK.

Ejecutar scripts/qa-di214-supabase.mjs con DI214_LOCAL_PUBLIC_KEY y DI214_LOCAL_SERVICE_KEY tomadas de supabase status del stack local. La clave administrativa solo crea las cuentas sintéticas mediante Auth. El CRUD evaluado usa los JWT reales de esas cuentas y las políticas de Supabase. DI214_RUN selecciona el sufijo de las cuentas. DI214_WRITE_APP_ENV=1 crea el archivo ignorado .env.local si no existe. Guardar estas claves fuera de logs y control de versiones. Ejecutar después Next en desarrollo y scripts/qa-di214-browser.mjs con el mismo DI214_RUN y el Chromium de Playwright disponible. Las dos pruebas están fuera del pipeline remoto porque inician y modifican únicamente el stack sintético local. La suite Node del pipeline existente recoge history.test.mjs automáticamente.

En el navegador, entrar en /desarrollo/acceso, iniciar sesión con el paciente y abrir /resultados. Ampliar un resultado, comparar dos evaluaciones completas y recargar. En otra sesión, ingresar con el odontólogo y abrir /profesional, elegir **Paciente autorizado** y consultar sus evaluaciones. Retirar el alcance desde el detalle del paciente impide al odontólogo volver a leer o descargar esa evaluación. Puede restaurarse con la concesión clínica vigente. La descarga previa ya entregada se conserva del lado del destinatario.

## Runbook remoto · pendiente de autorización y verificación del esquema

1. Consultar el esquema real con una cuenta de inspección, incluyendo historial de migraciones, roles, permisos y versión de Storage. Confirmar que DI-36 y las suscripciones Premium tienen los contratos esperados. Verificar compatibilidad con DI-213 si ya estuviera aplicado y revisar la política de liberación de logs operativos para rutas con identificadores, incluidos los logs de Next, gateway, PostgREST y Storage. Confirmar backups, retención, procedimientos de baja y ventana aprobada para cambios.
2. Ejecutar las consultas de solo lectura de abajo. Contrastar con el DDL de la rama y el SHA real de main. Ensayar primero en un entorno local con el mismo esquema autorizado usando cuentas sintéticas. Verificar las funciones y extensiones antes de separar cualquier activación de ingestión.
3. Aplicar los prerrequisitos ya aprobados que falten según el historial real. DI-214 va después de DI-36, galería y Premium. Si se integran ambas historias en el mismo lote, ordenar DI-213 y DI-214 por sus versiones, 20261125061658 y 20261125102804, respectivamente. Ejecutar la migración de DI-214 una sola vez mediante el mecanismo Supabase aprobado para ese entorno. La migración usa una transacción.
4. Verificar las ACL y RLS antes de desplegar el BFF. Con JWT sintéticos, repetir el acceso por paciente, profesional autorizado, profesional ajeno, expiración, revocación, lectura directa y firma de URLs, y comprobar que las respuestas sean privadas. Inspeccionar la auditoría por códigos, sin extraer datos clínicos. Verificar regresiones de Storage, DI-36, Smile y el portal. Mantener la capacidad de inferencia deshabilitada.
5. Provisionar la clave hex de 32 bytes solo al aprobar DI-211. El servidor de Next recibe DENTAIA_PREMIUM_INGEST_HMAC_HEX y el operador autoriza la misma clave en Vault con el nombre di214_premium_ingest_v1. Rotar de forma coordinada. La clave ausente deshabilita toda escritura autenticada que pretenda importar resultados. Mantener corto el tiempo de vida de las firmas. Revisar que errores y logs de la infraestructura no incluyan parámetros de RPC.
6. Ante un fallo de DDL, comprobar que la transacción se revirtió e inspeccionar el historial antes de reintentar. Si la migración ya se aplicó y hay datos, revertir el despliegue de aplicación y, si es necesario, bloquear EXECUTE del RPC y retirar la política di214_shared_photo_download mediante una migración de contención aprobada. Revocar la clave de ingestión. Conservar tablas, datos y auditoría para reparación, y validar el acceso a las funciones preexistentes. Aplicar una corrección aditiva antes de reactivar.

### Consultas de inspección

~~~sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT to_regclass('clinical.clinical_access_grants'),
       to_regclass('clinical.premium_evaluations'),
       to_regclass('clinical.odontogram_events'),
       to_regclass('public.dental_photos'),
       to_regclass('public.premium_subscriptions'),
       to_regclass('vault.decrypted_secrets'),
       to_regprocedure('storage.allow_only_operation(text)'),
       to_regprocedure('clinical_service.identity_context(uuid)'),
       to_regprocedure('clinical_service.lock_context(uuid,uuid)'),
       to_regprocedure('extensions.hmac(bytea,bytea,text)');
SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles
WHERE rolname = 'dentaia_clinical_executor';
SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies
WHERE tablename IN ('objects', 'premium_history_consents', 'premium_evaluations', 'premium_grant_evaluations')
ORDER BY schemaname, tablename, policyname;
SELECT c.relname, c.relrowsecurity, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='clinical' AND c.relname LIKE 'premium_%';
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id='dental-photos';
SHOW log_parameter_max_length_on_error;
~~~

## Auditoría independiente y validación manual

El 25 de noviembre de 2026, el solicitante confirmó la validación manual satisfactoria y comunicó el dictamen de Claude **APROBADO CON OBSERVACIONES**, con recomendación de publicar un Draft PR. Se atendieron las seis observaciones y se mantuvo el alcance del incremento.

- **OBS-1 · Ejecutor y frontera RPC.** En PostgreSQL local 17.12, dentaia_clinical_executor tiene NOLOGIN y carece de SUPERUSER, BYPASSRLS, CREATEROLE, CREATEDB y REPLICATION. Sus únicas membresías entrantes directas corresponden a postgres. Supabase Admin también resulta habilitado en pg_has_role por su condición de superusuario. anon, authenticated, authenticator y service_role carecen de membresía efectiva y capacidad SET ROLE hacia el ejecutor. Las tres tablas Premium tienen RLS y excluyen a esos roles de sus ACL de acceso. El wrapper public.access_premium_history es SECURITY INVOKER y solo concede EXECUTE API a authenticated. El EXECUTE de authenticated sobre premium_history y premium_shared_photo_allowed permite, respectivamente, el wrapper y la política de Storage. Los ayudantes de Vault, referencia de fotos y trigger carecen de EXECUTE para los roles API. PostgREST local expone public y graphql_public. Peticiones directas autenticadas a las funciones internas en clinical_service y a las tablas en clinical devolvieron 406, y el wrapper rechazó la sesión anónima.
- **OBS-2 · Identidad dentro de SECURITY DEFINER.** El cambio de usuario efectivo de PostgreSQL eleva los privilegios para ejecutar el cuerpo. auth.uid() sigue leyendo el sub de los claims que PostgREST y Storage configuran desde el JWT validado de la sesión original. current_user en un SECURITY DEFINER identifica al propietario de la función y jamás se usa como identidad del solicitante. La autorización clínica comprueba ese actor mediante identity_context() y session_current(), y valida el alcance del recurso. El invariante presupone que un cliente API no puede establecer ni mutar el contexto JWT de PostgreSQL ni actuar como el ejecutor. Las comprobaciones remotas deben incluir esa frontera, además de las ACL.
- **OBS-3 · Comparación HMAC.** Se conserva la comparación de los SHA-256 del MAC esperado y del recibido mediante igualdad de bytea. PostgreSQL no garantiza tiempo constante para esa igualdad. Comparar los resúmenes en lugar del MAC directamente reduce la información que una diferencia de tiempo podría reflejar. Queda un riesgo residual de canal lateral y no se ha medido su magnitud. Una primitiva de comparación en tiempo constante auditada por el equipo queda como mejora futura antes de ampliar exposición.
- **OBS-4 · Rendimiento de Storage.** Se difiere eliminar trabajo duplicado entre el BFF y la política de Storage. Una optimización futura debe mantener los controles de identidad, concesión, auditoría e integridad y medir el costo con EXPLAIN y pruebas de concurrencia. Cada nueva descarga vuelve a verificar la autorización. Cualquier diseño compartido que reutilice la autorización debe preservar la efectividad de la revocación. Esta entrega conserva las consultas actuales y sus respuestas no-store.
- **OBS-5 · Foto sin identificador.** premium_history devuelve un sobre 400 para photo con evaluation_id nulo antes de consultar permisos de expedientes o fotografías. Pruebas directas con sesión de paciente y odontólogo en PostgREST local comprobaron un sobre 400 sin datos, tanto para null explícito como para el parámetro omitido. La prueba reproducible queda en scripts/qa-di214-supabase.mjs.
- **OBS-6 · Referencia de foto.** Pruebas directas de historyPhoto cubren recorrido de rutas literal y codificado, MIME inválido, longitud y caracteres incorrectos del digest y proyección de un caso válido. La suite focalizada pasó 10 de 10, junto con TypeScript y git diff --check.

### Comprobaciones remotas de OBS-1 antes de habilitar

Consultar el catálogo con un operador autorizado y confirmar los atributos del ejecutor, sus membresías entrantes y salientes y la ausencia de ADMIN, INHERIT y SET explotables desde roles de aplicación. Comparar las ACL, propietarios, SECURITY DEFINER y search_path de las firmas de DI-214 contra la migración. Verificar la configuración efectiva en Data API, incluidas posibles diferencias entre la consola, pgrst.db_schemas y la configuración runtime. clinical y clinical_service deben quedar excluidos. Con JWT sintéticos y las claves del entorno autorizado, verificar que los perfiles de esquema privado sean rechazados por PostgREST, que las tablas Premium carezcan de acceso directo y que solo el wrapper correspondiente sea accesible a authenticated con las comprobaciones del actor conservadas. Completar estas comprobaciones también en el Preview protegido según su política, antes de habilitar tráfico clínico o ingestión HMAC.

~~~sql
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication
FROM pg_roles WHERE rolname = 'dentaia_clinical_executor';

SELECT rolname,
       pg_has_role(oid, 'dentaia_clinical_executor', 'MEMBER') AS member,
       pg_has_role(oid, 'dentaia_clinical_executor', 'SET') AS can_set
FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'authenticator', 'service_role', 'postgres', 'supabase_admin');

SELECT parent.rolname AS granted, child.rolname AS member, m.admin_option, m.inherit_option, m.set_option
FROM pg_auth_members m
JOIN pg_roles parent ON parent.oid = m.roleid
JOIN pg_roles child ON child.oid = m.member
WHERE 'dentaia_clinical_executor' IN (parent.rolname, child.rolname);

SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS signature,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig, p.proacl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('access_premium_history','premium_history','premium_ingest_proof',
                    'premium_photo_reference','premium_shared_photo_allowed','clear_premium_photo_binding');
~~~

[Esquemas expuestos de PostgREST](https://supabase.com/docs/guides/api/using-custom-schemas) · [RLS y roles de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Trazabilidad y evidencia

| Jira | Entrega de esta etapa |
| --- | --- |
| DI-251 | Persistencia real, reintentos concurrentes y lectura posterior. |
| DI-252 | Consentimientos separados y referencia a foto privada de la galería. |
| DI-253 | Fecha de evaluación, modelo, estado y contrato original. |
| DI-254 | RLS privada, concesiones, validaciones directas con JWT y Storage. |
| DI-255 | Historial paginado, detalle y comparación en el paciente. |
| DI-256 | Reglas conservadoras de comparabilidad y pruebas Node. |
| DI-257 | Acceso desde el contexto profesional vigente con auditoría DI-36. |
| DI-258 | Autorización y revocación de alcance sobre la concesión existente. |
| DI-259 | Proyección preparada. Descarga pendiente de la interfaz de DI-42. |

En PostgreSQL 17.12 se verificó el orden completo en un stack limpio con DI-213, y se probó DI-214 de forma independiente con Auth, PostgREST y Storage reales. Chromium validó la recarga, la comparación, la descarga privada y la revocación y restauración del permiso. Las pruebas reales cubrieron también la denegación al reemplazar el objeto en la misma ruta. La regresión local pasó con 579 pruebas Node, 120 Vitest, 23 Playwright de captura y smoke público, build, TypeScript y lint SQL sin errores en clinical ni clinical_service. npm audit reportó 0 vulnerabilidades. Las 23 pruebas públicas usan el aislamiento y los dobles existentes. El recorrido de historial es independiente y usa los servicios reales del stack local. Se corrigieron dos prerrequisitos de la fixture, registrar la verificación profesional antes de activar al odontólogo y fechar la atención dentro del periodo de membresía. Se ajustó la resolución de los nombres del conflicto SQL tras probar la aceptación y se usó la ruta autenticada explícita de Storage para comprobar que descargar no concediera firma de URLs. Falta validar el esquema Supabase remoto y sus controles de despliegue. No se autorizó publicación ni activación de inferencia.
