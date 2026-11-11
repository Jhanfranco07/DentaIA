# Fase 4 — validación HTTP, JWT y contratos Next.js

Fecha: **03/11/2026, America/Lima**. Rama `docs/auditoria-arquitectura-integral`. Trabajo local, sin commits, push, PR, merge, cambios de Vercel, Jira o Supabase remoto.

## Resultado verificable

**60 comprobaciones HTTP aprobadas, cero fallidas**: 59 de la batería Auth/Next/PostgREST y una comprobación adicional del cierre en el build local de producción. Se distinguen de las pruebas SQL y de los dobles unitarios.

Se implementaron tres Route Handlers aislados y se reutilizaron los tres RPC de Fase 3. No se modificaron interfaces de Anelis/Angie/Stephan, DI-151, dependencias, workflows ni modelos de datos. No se asume que esta rama o las vistas estén fusionadas en main.

## Entorno y preservación

- Docker Desktop, cliente/servidor 29.9.2, contexto desktop-linux; cinco contenedores oficiales ya existentes y saludables. Sin contenedores adicionales.
- Supabase CLI 3.0.0, PostgreSQL 17.11, GoTrue v2.197.0, PostgREST v16.5. Next.js 15.5.28, SDK Supabase 2.118.0 y Node.js 22.18.0.
- Antes de preparar HTTP se verificaron 120 hashes previos y las firmas SHA de las migraciones asociadas a las 78 pruebas SQL. Esas evidencias se conservaron como históricas; no se contaron como pruebas HTTP.
- Se comprobó que postgres, la base del stack local usada por Auth y PostgREST, tenía cero usuarios y cero tablas públicas de negocio. Se instaló allí un baseline vacío y una copia de estructura de clinical/clinical_service y de los wrappers ya validados en Fase 3. No se ejecutaron sus guardas de migración contra otro proyecto ni se relajaron: es un bootstrap de pruebas con verificación Docker local/propiedad y una transacción atómica.
- Las bases dentaia_arch_qa_fase2 y dentaia_arch_qa_fase3 permanecen intactas. Cada reinicio local comprobó que conservaban sus atenciones. Las funciones reutilizadas se toman de la base Fase 3, sin modificar sus borradores.
- El esquema marcador dentaia_http_qa identifica el banco. El preparador aborta en una base no vacía sin ese marcador o ante cuentas no pertenecientes a esta prueba. No acepta URLs remotas.
- Se prepararon seis cuentas sintéticas confirmadas por Auth Admin local: dos pacientes, dos odontólogos, una cuenta sin rol profesional y un superusuario. Solo la preparación y los cambios de rol de prueba utilizan el cliente administrativo local. Las operaciones ordinarias emplean clave publicable y JWT del usuario. No se probó registro/confirmación por correo.

El cierre compara trece definiciones RPC con Fase 3 (normalizando solo retornos de carro), verifica wrappers INVOKER, propietario privado de privilegio mínimo y ausencia de SELECT clínico directo para authenticated. No quedaron triggers de fallo. [Entorno comprobado](http_jwt/ENTORNO_VALIDADO.json). De los 120 archivos anteriores, 114 permanecen idénticos y seis contienen actualizaciones documentales previstas; ninguno fue eliminado. [Preservación y escaneo de secretos](http_jwt/PRESERVACION.json).

## JWT realmente emitidos y verificados

El algoritmo observado fue **ES256**. Los logins se hicieron por signInWithPassword contra GoTrue local y los tokens se verificaron con getClaims. Next usa getClaims y getUser, comprueba sub/session_id/exp, cuenta confirmada/no anónima y la asignación vigente de app_metadata.dentaia. No decodifica un token del usuario para autorizar ni confía en user_metadata o roles antiguos de un JWT.

Se reutilizó el lector puro de contrato de DI-150 y se exige además unicidad de roles. La autorización clínica por acción permanece en el RPC: vuelve a consultar Auth, sesión, profesional, clínica, membresía y concesiones. Dejar esa decisión en el RPC permite auditar denegaciones normales sin duplicar la autoridad de permisos.

La configuración Auth local pasó temporalmente de 3600 a 60 segundos. Se retuvo un token emitido por Auth sin modificarlo, se esperó su exp y se comprobó HTTP 401. La configuración original fue restaurada mediante finally y el stack reiniciado: **restauración verificada**. No se guardaron contraseñas, tokens, claves o archivos .env.

El SDK Admin local solo crea/reutiliza cuentas marcadas de QA, preservando metadatos ajenos. No se utiliza service_role como identidad de paciente o profesional. Las claves se obtienen del CLI local en memoria; nunca del .env del proyecto ni de Dental-IA.

## Endpoints implementados

| Método y ruta | Solicitud | Resultado |
|---|---|---|
| POST /api/clinical/access-grants | Bearer; Idempotency-Key UUID; JSON membershipId, encounterIds, expiresAt, policyVersion, accepted:true | 201 nueva; 200 reintento; no acepta actorId, patientId, roles o purpose arbitrarios |
| POST /api/clinical/access-grants/:id/revoke | Bearer del propietario; id UUID; JSON {} | 200 y fecha persistente; 403 si ajena |
| GET /api/clinical/patients/:patientId/history | Bearer; membershipId para profesional; limit 1..50; cursor opcional | 200 clinical.v1, solo alcance autorizado; 403 si no hay permiso |

Se eligieron las rutas inglesas ya documentadas; no se crearon alias españoles duplicados. El catálogo [CONTRATOS_API.json](CONTRATOS_API.json) y sus tres secciones Markdown se actualizaron: diez métodos con código en rama y quince propuestos. No se declara disponibilidad de estos endpoints en main ni en Vercel.

## RPC y códigos HTTP reales

Se reutilizan grant_clinical_access, revoke_clinical_access y get_authorized_clinical_history. También se llamaron directamente por HTTP PostgREST, con JWT de paciente/odontólogo, para comprobar que una respuesta de transporte 200 puede contener un envelope denegado. Next lo transforma al HTTP correcto.

| Situación | HTTP Next |
|---|---|
| Sin JWT, token inválido/manipulado, token caducado o sesión cerrada | 401 |
| Rol/contexto/alcance/propiedad no autorizados | 403 |
| Parámetros, UUID, cursor o claves desconocidas inválidos | 400 |
| Clave idempotente con contenido distinto | 409 |
| Cuerpo >8192 bytes | 413 |
| Content-Type no JSON | 415 (verificación unitaria) |
| Fallo de RPC/auditoría/disponibilidad | 503 |
| Desactivado o NODE_ENV=production | 404 |

No se exponen mensajes PostgREST, SQLSTATE, stack, cuerpo recibido o errores de Auth en respuestas. El DTO se proyecta explícitamente: se valida el patientId devuelto, se descartan campos extra y no se reenvían claves, correos Auth ni rutas/buckets/URLs privadas. Las fechas PostgreSQL de seis decimales se conservan, sin truncarlas al paginar.

Todas las respuestas incluyen private/no-store, CDN-Cache-Control no-store, Vercel-CDN-Cache-Control no-store y Vary: Authorization. Las escrituras verifican Origin y Sec-Fetch-Site; no se habilita CORS. No se acepta identidad en query, cuerpo o cookies: la autenticación clínica usa Bearer explícito.

## Cursor HTTP firmado y cifrado

Formato estable v1 con IV aleatorio, ciphertext, tag GCM y HMAC. AES-256-GCM cifra el payload y HMAC-SHA256 firma su representación; HKDF deriva claves distintas para cifrado/firma desde un secreto exclusivo del servidor. Se rechazan codificaciones base64url no canónicas y se comparan firmas en tiempo constante.

Vinculación: actor, sesión, paciente, membershipId, profesional, clínica, limit y versión del contrato. El contexto profesional/clínico se toma de la respuesta RPC autorizada y se vuelve a contrastar en páginas posteriores. La posición SQL contiene instante e ID, pero viaja cifrada; no hay información clínica en claro en el cursor.

Vigencia normal propuesta: 300 segundos, configurable de 1 a 900 y nunca mayor que el JWT. En QA se usaron 2 segundos y se esperó su vencimiento real. Rotar el secreto invalida cursores anteriores; no cambia concesiones clínicas. El cursor no concede permisos: el RPC revalida en cada página.

## Variables del servidor y cierre por defecto

| Variable | Uso |
|---|---|
| DENTAIA_CLINICAL_HTTP_ENABLED | Opt-in exacto true; producción permanece cerrada aunque sea true |
| DENTAIA_CLINICAL_SUPABASE_URL | Solo API local http loopback; no existe fallback a variables remotas |
| DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY | Solo clave publicable/anon; rechaza una configuración service_role |
| DENTAIA_CLINICAL_CURSOR_SECRET | Base64url de al menos 32 bytes aleatorios; nunca NEXT_PUBLIC ni archivo versionado |
| DENTAIA_CLINICAL_CURSOR_TTL_SECONDS | 300 por defecto; QA 2; rango técnico 1..900 |

El harness genera la clave de cursor en memoria y configura solo el proceso hijo Next en 127.0.0.1:3104. No escribe .env ni modifica el servidor de trabajo de otra persona. Los clientes ordinarios del adaptador no tienen Auth Admin. El build local se inició aparte en 3105 con NODE_ENV=production y flag true: devolvió 404, sin abrir la API.

## Matriz HTTP realmente ejecutada

| Escenario | Resultado | HTTP observado |
|---|---|---|
| Login y JWT firmado emitido por Auth local: patient1 | APROBADA | 200 |
| Login y JWT firmado emitido por Auth local: patient2 | APROBADA | 200 |
| Login y JWT firmado emitido por Auth local: dentist1 | APROBADA | 200 |
| Login y JWT firmado emitido por Auth local: dentist2 | APROBADA | 200 |
| Login y JWT firmado emitido por Auth local: nonprofessional | APROBADA | 200 |
| Login y JWT firmado emitido por Auth local: superuser | APROBADA | 200 |
| JWT ausente devuelve 401 | APROBADA | 401 |
| JWT inválido devuelve 401 | APROBADA | 401 |
| JWT manipulado sin nueva firma devuelve 401 | APROBADA | 401 |
| Paciente concede autorización propia mediante HTTP | APROBADA | 201 |
| Reintento HTTP de concesión respeta idempotencia | APROBADA | 200 |
| Misma clave con contenido diferente devuelve 409 | APROBADA | 409 |
| Paciente no concede recursos clínicos de otro paciente | APROBADA | 403 |
| No se acepta actorId del cuerpo | APROBADA | 400 |
| No se acepta rol del cuerpo | APROBADA | 400 |
| Clínica/profesional inexistente se rechazan | APROBADA | 403 |
| Odontólogo autorizado consulta dos clínicas por HTTP | APROBADA | 200 |
| Paciente consulta únicamente su historial propio | APROBADA | 200 |
| Acceso cruzado de pacientes denegado | APROBADA | 403 |
| Odontólogo sin autorización de otra clínica denegado | APROBADA | 403 |
| Usuario sin rol profesional denegado | APROBADA | 403 |
| Superusuario no recibe acceso clínico automático | APROBADA | 403 |
| Contexto ajeno no puede declararse propio | APROBADA | 403 |
| Contexto propio distinto no hereda concesión | APROBADA | 403 |
| Paciente inexistente no revela información | APROBADA | 403 |
| Identificador malformado devuelve 400 | APROBADA | 400 |
| Consulta duplicada/ambigua devuelve 400 | APROBADA | 400 |
| Cuerpo supera límite devuelve 413 | APROBADA | 413 |
| Origen cruzado en escritura devuelve 403 | APROBADA | 403 |
| Cursor cifrado no contiene fechas o IDs en claro | APROBADA | 200 |
| Cursor firmado pagina sin duplicar registros | APROBADA | 200 |
| Cursor manipulado devuelve 400 | APROBADA | 400 |
| Cursor de otra identidad devuelve 400 | APROBADA | 400 |
| Cursor de otro contexto clínico devuelve 400 | APROBADA | 400 |
| Cursor con otro filtro limit devuelve 400 | APROBADA | 400 |
| Cursor realmente vencido devuelve 400 | APROBADA | 400 |
| Alcance limitado no incluye otras atenciones | APROBADA | 200 |
| Permiso realmente vencido deniega nuevas lecturas | APROBADA | 403 |
| Paciente no revoca autorización ajena | APROBADA | 403 |
| Denegación HTTP conserva auditoría protegida tras commit | APROBADA | 403 |
| Lectura HTTP permitida deja auditoría antes de entrega | APROBADA | 200 |
| JWT anterior no conserva el rol retirado en Auth | APROBADA | 403 |
| Cambio de pertenencia clínica se evalúa en servidor | APROBADA | 403 |
| user_metadata editable no concede rol profesional | APROBADA | 403 |
| Fallo real de auditoría no entrega historial HTTP | APROBADA | 503 |
| Fallo de auditoría revierte concesión HTTP | APROBADA | 503 |
| Fallo de auditoría revierte revocación HTTP | APROBADA | 503 |
| Dos consultas HTTP concurrentes son autorizadas | APROBADA | [200, 200] |
| RPC grant por HTTP usa JWT del paciente, no service_role | APROBADA | 200 |
| RPC historial por HTTP respeta alcance autorizado | APROBADA | 200 |
| RPC revoke por HTTP usa JWT del propietario | APROBADA | 200 |
| Next traduce denegación RPC HTTP 200 a HTTP 403 | APROBADA | 403 |
| HTTP lectura primero: revocación espera y nuevas lecturas fallan | APROBADA | [200, 200, 403] |
| HTTP revocación primero: lectura espera y no recibe historial | APROBADA | [200, 403] |
| Revocación HTTP impide nueva consulta | APROBADA | 403 |
| Reintento de revocación HTTP conserva estado | APROBADA | [200, 200] |
| JWT capturado antes del logout no abre nuevas lecturas | APROBADA | 401 |
| Otra sesión legítima conserva su acceso independiente | APROBADA | 200 |
| JWT realmente caducado devuelve HTTP 401 | APROBADA | 401 |
| Build local mantiene API clínica cerrada en producción incluso con flag true | APROBADA | 404 |

La matriz contiene pruebas compuestas y seis logins/verificaciones SDK; no equivale al número de requests individuales. Contadores instrumentados del harness: {"auth": 22, "next": 61, "rpc": 4}. No incluyen todas las llamadas internas de Next a Auth ni todos los sondeos de arranque. [Resultados](http_jwt/RESULTADOS.json), [cierre de producción local](http_jwt/PRODUCCION_CERRADA.json).

## Auditoría y concurrencia

Las lecturas permitidas y las denegaciones normales de los RPC se comprobaron en la tabla protegida después del commit, por requestId de la respuesta. Los eventos denegados no guardan el paciente ajeno. El fallo artificial de auditoría se inyectó solo en una tabla de QA local; HTTP devolvió 503 y no hubo historial ni persistencia de concesión/revocación incompleta. El trigger temporal se retiró en finally; no se desactivó RLS.

Los rechazos previos al RPC (JWT, formato, Origin, cursor) generan clinical_security con requestId, operación, status y código; no incluyen token, URL/ID del paciente, cuerpo o contenido clínico. Ese canal técnico aún no es una plataforma central de auditoría durable. Cuando se invoca un RPC, body.requestId identifica su evento DB; X-Request-Id es la traza del gateway.

Se ejecutaron consultas HTTP concurrentes y dos órdenes de lectura/revocación con locks de fixture y dos esperas PostgREST observadas. Si la lectura entra primero puede completar 200 y revocar espera; la siguiente consulta es 403. Si revocar entra primero, la lectura espera y devuelve 403 sin historial. Se comprobaron también rol retirado con JWT anterior, suspensión de membresía y reintentos.

No se promete retirar contenido ya entregado. Un token puede seguir teniendo firma/exp válidas después del logout; getUser/RPC y la comprobación de auth.sessions bloquean nuevas consultas. El test usó una sesión de login adicional, la cerró realmente y comprobó que otra sesión legítima permanecía independiente.

## Regresión, archivos y correcciones

| Verificación | Resultado |
|---|---|
| Suite completa Node.js | 255/255 aprobadas: 231 anteriores +24 nuevas unitarias |
| TypeScript | npm run typecheck, exit 0 |
| Build | npm run build, exit 0; incluye los tres Route Handlers |
| Dependencias | npm audit --audit-level=low: 0 vulnerabilidades |
| Git | git diff --check sin errores; sin staging/commit |

Las pruebas unitarias de validadores/cursor/adaptador utilizan dobles explícitos; no se cuentan como JWT o HTTP reales. La matriz HTTP anterior sí usa Auth, PostgREST y Next reales.

Archivos funcionales nuevos: tres route.ts bajo src/app/api/clinical y cinco módulos bajo src/features/clinica-http (servidor, http, cursor, DTO y validaciones); dos archivos de pruebas .test.mjs. No se modificó ningún módulo existente de cuenta, directorio, solicitudes, fotografías, autorización o administración.

Pruebas y documentos: http_jwt/local.mjs, ejecutar.mjs, preparar_sql.py, fixtures.sql, produccion_cerrada.mjs, contratos y evidencias. Se actualiza el validador documental para verificar los diez métodos contra los Route Handlers reales y permitir solo estos dos directorios nuevos; no se debilitan checks de DI-151 ni de otros módulos.

Correcciones realizadas: separadores SQL en el bootstrap de wrappers (la transacción abortó sin dejar un esquema parcial); fechas sintéticas de membresía para que precedan las atenciones históricas (el trigger de origen se conservó); tipos TypeScript de un status opcional y del thenable RPC; contexto de trabajo del CLI para evitar un archivo temporal cli-latest dentro del repo. No se corrigieron problemas relajando autorización/RLS. La duración original de Auth se restauró incluso al interrumpirse una fixture.

Se conservaron 3 intentos de la batería en [INTENTOS.json](http_jwt/INTENTOS.json). El primer intento quedó bloqueado tras seis logins por la fixture temporal; no se marcó como batería superada. La evidencia final no contiene fallos. El campo de restauración del primer intento no estaba instrumentado correctamente; se verificó manualmente la configuración 3600 y se corrigió la instrumentación en los posteriores.

## Integración siguiente y límites

- DI-145/157: preparar con Anelis un adaptador del proveedor sintético al DTO clinical.v1, estados y procedencia, sin usar escenario/actor/permisos del cliente como autoridad. Sus componentes y ramas no se modificaron.
- DI-146: preservar el panel de solicitudes/recomendaciones de Angie. No se amplió automáticamente su historia con UI clínica.
- DI-36/34: revisar endpoints, CORS/Origin según transporte, cursor, configuración, idempotencia, privilegios y observabilidad antes de integrar. Faltan resolutores/listados propios de identidad clínica y concesiones para completar una UI de gestión.
- DI-144/151: no se alteraron sus controles, MFA, escrituras o auditoría; superusuario no implica acceso clínico. El cambio de roles ensayado solo afecta una cuenta ficticia local mediante preparación Auth Admin.
- Pendiente de aprobación: procedimiento de verificación profesional, política/texto de consentimiento, plazos, retención/anonimización, operación de bajas y despliegue. La política QA-NO-CLINICO-v1 no acredita consentimiento clínico real.
- No ejecutado: interfaces visuales, integración efectiva de las ramas de compañeros, documentos/Storage y descargas, pruebas de carga/seguridad exhaustivas, recuperación, sistemas externos o uso clínico. No se implementó IA.
- La clave de cursor y este proveedor se habilitaron solo en el proceso local de QA. Un release real requiere otra configuración y revisión explícita: actualmente producción y URLs no locales están cerradas por diseño.

**Conclusión:** comunicación HTTP autenticada comprobada localmente, con autorización y auditoría reales sobre datos sintéticos. Preparada para revisar el contrato con las vistas; **no lista para producción ni pacientes reales**. No se aplicó ninguna migración a Dental-IA ni se modificó Vercel/Jira.

Referencias primarias: [verificación getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims), [configuración local y jwt_expiry](https://supabase.com/docs/guides/local-development/cli/config). Las aprobaciones concretas se basan en las ejecuciones locales enlazadas, no solo en esas guías.
