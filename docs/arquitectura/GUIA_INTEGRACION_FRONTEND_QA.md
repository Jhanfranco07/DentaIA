# Integración frontend con el backend QA de DentaIA

Fecha: 03/11/2026, America/Lima. Contratos revisados contra código en `docs/auditoria-arquitectura-integral`, baseline funcional `55d0683192c7754e690689652246541261f95550`. Esta entrega no modifica interfaces de Anelis o Angie ni amplía los criterios de DI-145/146.

**Disponibilidad:** backend real validado únicamente en Supabase Docker local. QA remoto BLOQUEADO por cupo Free; no existe URL de servicio compartido. Vercel producción y Preview mantienen 404 en las ocho rutas clínicas. No configurar Dental-IA como destino de este backend experimental.

## Rama, dependencias y configuración

1. Conservar el trabajo de cada integrante. Revisar los contratos con Jhan antes de integrar la rama completa: PR19 Draft incluye ocho commits administrativos aún ausentes de main. No copiar tablas, SQL o servicios a las ramas UI para duplicarlos.
2. Usar Node 22 (mínimo 22.9), `npm ci`; lockfile existente, sin dependencias nuevas. Backend compatible: ocho rutas y cuatro RPC de esta rama, no asumir que main los contiene.
3. Para pruebas sin Docker: mantener proveedor sintético explícito y estados mock; no se presenta como Supabase real. La alternativa alojada todavía NO existe. Para integración real hoy se necesita el stack local administrado por Jhan o una instalación local equivalente revisada.
4. El banco actual depende de Windows/Docker desktop-linux/CLI 3.0.0 y marcadores específicos. No ejecutar sus scripts contra otro proyecto ni trasladar claves locales entre máquinas. Los comandos siguientes describen el banco existente, no un instalador universal.
5. Obtener URL y clave **publicable local** desde el operador/CLI sin publicarlas en Git. `.env.local` está ignorado. Nunca compartir service_role, contraseña PostgreSQL, clave privada administrativa ni secreto de cursor con clientes.

Variables del servidor Next local (ejemplos sin claves):

```dotenv
# Solo development y Supabase local propio. No aplicar este bloque a Vercel.
DENTAIA_CLINICAL_HTTP_ENABLED=true
DENTAIA_CLINICAL_SUPABASE_URL=http://127.0.0.1:54321
DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY=<clave publicable local>
DENTAIA_CLINICAL_CURSOR_SECRET=<32 bytes aleatorios base64url, solo servidor>
DENTAIA_CLINICAL_CURSOR_TTL_SECONDS=300
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<misma clave publicable local>
DENTAIA_ADMIN_READS_ENABLED=false
DENTAIA_ROLE_WRITES_ENABLED=false
```

El secreto de cursor se genera localmente con un generador criptográfico, no con el ejemplo. No lleva prefijo NEXT_PUBLIC. No copiar `.env.local` existente de Dental-IA ni reemplazarlo automáticamente. Las variables clínicas no tienen fallback a la configuración Supabase pública. Si la configuración es incompleta o URL no loopback, la identidad devuelve 503; producción devuelve 404 antes de autenticar.

Preparación en el PC QA existente, comprobando los destinos y guardando cambios antes:

```powershell
# Instalación y comprobaciones de código
npm ci
npm run typecheck
npm run build
# Solo base QA marcada; aborta si existe y no se solicita recreación explícita
python docs/arquitectura/backend_mvp/preparar.py --fase7
# No añadir --recrear-qa-propia sin revisar comentario, contenido y efecto.
# El banco HTTP usa postgres local con marcador propio; no la copia SQL aislada.
python docs/arquitectura/http_jwt/preparar_sql.py bootstrap
python docs/arquitectura/backend_mvp/preparar_http.py --fase7
```

La creación de fixtures HTTP requiere UUID reales de seis cuentas GoTrue sintéticas; el harness `regresion_http_f4.mjs --fase7` los obtiene en memoria, prepara contextos y ensaya HTTP. Cambia temporalmente JWT local a 60 s, reinicia servicios, rota contraseñas SOLO de cuentas marcadas y finalmente restaura configuración. `mfa_local.mjs --fase7` ensaya el banco integral con TOTP temporal y restaura config. No ejecutar en paralelo ni en un stack compartido con sesiones de otros usuarios. Contraseñas de fixtures son efímeras: estas cuentas no constituyen credenciales compartidas de frontend. Para sesiones manuales el operador debe provisionar cuentas QA autorizadas y entregar acceso por canal seguro, nunca por docs/Git.

Tras el banco se cierra la configuración clínica SQL. Para una sesión de integración manual el operador debe aprobar explícitamente una ventana de QA con policyVersion/purpose/maxGrantSeconds coherentes y configurar `clinical_service.configuration()` únicamente en el banco marcado. No se da a pacientes capacidad de activar servicios, provisionar roles ni verificar profesionales. La reproducción automatizada puede ejecutarse sin dejar lectura habilitada permanentemente. Iniciar frontend: `npm run dev -- --hostname 127.0.0.1 --port 3000` con configuración propia local validada; sesión SDK debe pertenecer al MISMO Supabase que el BFF.

## Autenticación y consumo

Login por SDK oficial de Supabase con cuenta sintética, contraseña introducida personalmente/por canal seguro. JWT de paciente u odontólogo; nunca service_role como identidad. El BFF valida firma, getUser y asignación actual; SQL vuelve a validar sesión/rol/contexto/recurso. Mostrar un rol en UI no concede permisos. La ruta pública del frontend no es evidencia de autorización.

Ejemplo de patrón de consumo, **ilustrativo, no código ya integrado**:

```ts
// En el proveedor cliente de cada vista, reutilizando el cliente Supabase existente.
async function consultar<T>(path: string, signal: AbortSignal): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('SESION_REQUERIDA');
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: 'no-store', signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.code ?? 'ERROR_SERVICIO');
  return result as T; // Validar DTO en frontera del proveedor antes de renderizar.
}
```

getSession aquí solo entrega el token al transporte; NO toma la decisión de autorización. No registrar headers, JSON clínico o tokens en consola/localStorage propio/analítica. Usar fetch al mismo origen; no se habilitó CORS para un BFF compartido. Cancelar solicitudes obsoletas, descartar resultados después de logout o cambio de contexto y no cachear historias entre cuentas. No reenviar un cursor como autorización.

## Contratos TypeScript y reglas comunes

Tipos reutilizables documentados en [CONTRATOS_CLIENTE.ts](backend_mvp/CONTRATOS_CLIENTE.ts); fuente efectiva: `src/features/clinica-http/workspace.ts`, dto.ts, validaciones.ts, http.ts y servidor.ts. Revisar diferencias contra el SHA acordado antes de copiar contratos a un provider. Son tipos documentales, no SDK privilegiado.

- UUID canónico; paciente clínico != Auth user UUID; dentist_id del directorio != professionalId != membershipId.
- Workspace: `{ok:true,apiVersion:"clinical.workspace.v1",environment:"qa_local",kind,data,nextAfterId,requestId}`. Lista UUID ordenada, `afterId` y `limit` 1..50, defecto 20; nextAfterId null final. El paciente propio no admite afterId. Contexto profesional se selecciona mediante membershipId propio, no clinicId elegido libremente.
- Historial: `{ok:true,apiVersion:"clinical.v1",origen:"supabase",environment:"qa_local",estado,caso,entries,nextCursor,requestId}`. Cursor opaco cifrado/firmado ligado a actor, sesión, paciente, contexto y límite; conservar bytes y límite entre páginas. No truncar timestamp PostgreSQL ni fabricar beforeAt/beforeId.
- Error: `{ok:false,code,requestId}`; sin detalles SQL, JWT o identificadores clínicos en logs. Todas las respuestas no-store; requestId sirve para reportar incompatibilidades sin enviar datos sensibles.
- Query cerrada: duplicados/parámetros desconocidos rechazados; cuerpo JSON <=8192 bytes. No enviar actorId, roles, userId, patientId de Auth ni claves no previstas. Un HTTP200 de RPC puede ser envelope denegado; la UI consume el BFF, que lo traduce.

| HTTP | Tratamiento de interfaz |
|---|---|
| 200 | Renderizar DTO; listas vacías son estado vacío, no error |
| 201 | Concesión nueva persistida; solo después mostrar éxito |
| 400 INVALID_REQUEST / INVALID_CURSOR | Corregir campos o reiniciar paginación con el mismo contexto |
| 401 AUTHENTICATION_REQUIRED | Descartar datos y solicitar sesión legítima; no bucle infinito de reintentos |
| 403 ACCESS_DENIED | Mostrar acceso restringido, sin confirmar existencia de datos ajenos |
| 404 NOT_FOUND | Servicio cerrado o recurso no publicado; no sugerir desactivar guardas |
| 409 IDEMPOTENCY_CONFLICT | Refrescar estado y revisar operación; no reemplazar silenciosamente clave/cuerpo |
| 413 PAYLOAD_TOO_LARGE / 415 UNSUPPORTED_MEDIA_TYPE | Reducir cuerpo o usar application/json según contrato |
| 503 SERVICE_UNAVAILABLE | Mensaje neutral y reintento acotado; no afirmar éxito ni mostrar error interno |

## Anelis — DI-145, vista del odontólogo

| Método/ruta | Permiso y parámetros | DTO mínimo de data / disponibilidad |
|---|---|---|
| GET /api/professional/me | JWT odontólogo actual, verificación aprobada, membresías/clínicas activas; limit,afterId | professionalId,dentistId nullable,contexts[{membershipId,clinicId,clinicName,validFrom,validUntil}]; **local**, remoto bloqueado |
| GET /api/professional/requests | Mismo permiso + membershipId propio obligatorio; limit,afterId,status=requested o cancelled opcional | professionalId,membershipId,items[{id,status,createdAt,preferredDate,preferredTime,isDemo:true}]; **local**, remoto bloqueado |
| GET /api/professional/patients | Mismo permiso + membershipId propio; limit,afterId | membershipId,items[{patientId}]; solo pacientes con concesión vigente y recursos; **local**, remoto bloqueado |
| GET /api/clinical/patients/:patientId/history | JWT profesional + membershipId propio + concesión vigente con recursos; limit,cursor opcional | caso{patientId,professionalContext,clinicContext},entries con procedencia y nextCursor; **local**, remoto bloqueado |

No endpoint de edición de perfil odontológico ni alta/verificación profesional en este alcance. clinicId es informativo; las consultas requieren membershipId vigente de la sesión. El profesional solo recibe solicitudes vinculadas explícitamente a su dentist_id verificado; la tabla no tiene clínica destino y no se inventa ese vínculo. No se incluyen contacto, correo, mensaje ni Auth UUID del paciente en la respuesta profesional. No implementar nuevas operaciones de aceptación/cierre de solicitud: los estados existentes son requested/cancelled.

Ejemplos sintéticos (no logs):

```http
GET /api/professional/me?limit=20
GET /api/professional/requests?membershipId=40000000-0000-4000-8000-000000000033&status=requested&limit=20
GET /api/professional/patients?membershipId=40000000-0000-4000-8000-000000000033&limit=20
GET /api/clinical/patients/40000000-0000-4000-8000-000000000041/history?membershipId=40000000-0000-4000-8000-000000000033&limit=20
Authorization: Bearer <sesion sintetica en memoria>
```

```json
{"ok":true,"apiVersion":"clinical.workspace.v1","environment":"qa_local","kind":"professional","data":{"professionalId":"40000000-0000-4000-8000-000000000023","dentistId":null,"contexts":[]},"nextAfterId":null,"requestId":"40000000-0000-4000-8000-000000000091"}
```

```json
{"ok":true,"apiVersion":"clinical.workspace.v1","environment":"qa_local","kind":"requests","data":{"professionalId":"40000000-0000-4000-8000-000000000023","membershipId":"40000000-0000-4000-8000-000000000033","items":[]},"nextAfterId":null,"requestId":"40000000-0000-4000-8000-000000000091"}
```

```json
{"ok":true,"apiVersion":"clinical.workspace.v1","environment":"qa_local","kind":"patients","data":{"membershipId":"40000000-0000-4000-8000-000000000033","items":[{"patientId":"40000000-0000-4000-8000-000000000041"}]},"nextAfterId":null,"requestId":"40000000-0000-4000-8000-000000000091"}
```

```json
{"ok":true,"apiVersion":"clinical.v1","origen":"supabase","environment":"qa_local","estado":"sin_datos","caso":{"patientId":"40000000-0000-4000-8000-000000000041","professionalContext":"40000000-0000-4000-8000-000000000023","clinicContext":"40000000-0000-4000-8000-000000000011"},"entries":[],"nextCursor":null,"requestId":"40000000-0000-4000-8000-000000000091"}
```

Cada entrada de historial contiene encounterId, attendedAt/recordedAt, status, replacesId/correctionReason, origin{clinicId,clinicName,professionalId,professionalName}, background{state,value,entryId?}, clinicalEntries, diagnoses, treatments y exams sin object_path/URL de descarga. Estados recorded/unknown/not_recorded preservados; desconocido no es ausencia de enfermedad. Estado vacío de solicitudes != historial vacío. Loading/error por sección, cambiar clínica limpia selección y cursor; 403 tras revocación elimina datos protegidos de la vista. Descarga clínica no está implementada.

## Angie — DI-146, vista del paciente

| Método/ruta | Permiso y parámetros | DTO / disponibilidad |
|---|---|---|
| GET /api/clinical/patients/me | JWT paciente actual, ficha clínica propia activa; limit opcional, sin membershipId/afterId | kind patient,data{patientId}; **local**, remoto bloqueado |
| GET /api/clinical/access-grants | Paciente propietario; limit,afterId | patientId,items[{id,membershipId,estado,expiresAt,revokedAt,policyVersion,encounterIds}]; **local**, remoto bloqueado |
| POST /api/clinical/access-grants | Paciente de sesión; Idempotency-Key UUID; JSON de concesión | id,estado,expiresAt,revokedAt,replayed; HTTP201 nueva/200 replay; **local**, remoto bloqueado |
| POST /api/clinical/access-grants/:id/revoke | Paciente propietario, id UUID; cuerpo {} | id,revokedAt; HTTP200 reintento preserva fecha; **local**, remoto bloqueado |

Ejemplos sintéticos (no logs):

```http
GET /api/clinical/patients/me
GET /api/clinical/access-grants?limit=20
Authorization: Bearer <sesion sintetica en memoria>
```

```json
{"ok":true,"apiVersion":"clinical.workspace.v1","environment":"qa_local","kind":"patient","data":{"patientId":"40000000-0000-4000-8000-000000000041"},"nextAfterId":null,"requestId":"40000000-0000-4000-8000-000000000091"}
```

```json
{"ok":true,"apiVersion":"clinical.workspace.v1","environment":"qa_local","kind":"grants","data":{"patientId":"40000000-0000-4000-8000-000000000041","items":[]},"nextAfterId":null,"requestId":"40000000-0000-4000-8000-000000000091"}
```

```http
POST /api/clinical/access-grants
Authorization: Bearer <sesion sintetica en memoria>
Content-Type: application/json
Idempotency-Key: 40000000-0000-4000-8000-000000000071

{"membershipId":"40000000-0000-4000-8000-000000000033","encounterIds":["40000000-0000-4000-8000-000000000051"],"expiresAt":"2026-12-01T00:00:00Z","policyVersion":"QA-NO-CLINICO-v1","accepted":true}
```

La fecha es ilustrativa y deberá estar dentro de la vigencia máxima configurada en el banco de prueba; no copiarla como fixture siempre válida. 1..100 encounterIds únicos propios. Una clave UUID identifica una intención y se conserva con el mismo cuerpo en reintentos; un cuerpo distinto con misma clave produce 409.

```json
{"ok":true,"id":"40000000-0000-4000-8000-000000000071","estado":"vigente","expiresAt":"2026-12-01T00:00:00Z","revokedAt":null,"replayed":false,"requestId":"40000000-0000-4000-8000-000000000091"}
```

```http
POST /api/clinical/access-grants/40000000-0000-4000-8000-000000000071/revoke
Authorization: Bearer <sesion sintetica en memoria>
Content-Type: application/json

{}
```

```json
{"ok":true,"id":"40000000-0000-4000-8000-000000000071","revokedAt":"2026-11-03T18:00:00Z","requestId":"40000000-0000-4000-8000-000000000091"}
```

No se crea automáticamente patient_records por tener Auth/profiles. Sin ficha clínica activa se obtiene denegación, no se debe inventar un patientId. Falta resolver destinatarios elegibles mediante una UX/servicio aprobado; no usar un directorio público como prueba de verificación clínica. No habilitar consentimiento real con texto QA.

Operaciones personales **existentes**, sin endpoints duplicados:

- Perfil: `src/features/cuenta/perfiles.ts`, SDK profiles por id de sesión y RLS.
- Solicitudes propias: reutilizar los servicios del módulo solicitudes, SDK appointment_requests por propietario; registro/cancelación demo. Su historial de solicitudes NO es historial clínico compartido.
- Fotografías y consentimiento: módulo fotografías, patient_consents/dental_photos, bucket privado dental-photos. Solo propósito academic_photo_storage; sin fotos reales. Reutilizar eliminarFotografia, no implementar restauración por reupload tras revocación.
- Recomendaciones educativas/reportes: no convertir fixtures en historia clínica ni prometer IA/persistencia clínica no implementada.

## Estados de interfaz, errores e incompatibilidades

Cada recurso debe tener loading, ready, empty, error y restricted. Deshabilitar doble envío en UI sin sustituir idempotencia servidor. Mostrar éxito solo tras respuesta válida; ante 503 no inferir que una escritura no ocurrió, consultar/reintentar con la MISMA clave. Revocación refresca concesiones y lista profesional; JWT previo no preserva permiso revocado. Perder sesión limpia datos visibles y cursores.

Los providers sintéticos deben identificarse en UI de desarrollo; selección real explícita y sin fallback silencioso a mocks cuando falle Auth/RLS. No presentar pruebas de fixtures como Supabase real ni Vercel HTTP200 como validación de backend clínico.

Reportar: SHA backend/frontend, entorno (local/QA/mocks), endpoint/método, HTTP/code/requestId y pasos sintéticos. No adjuntar JWT, claves, correos reales, contraseñas, SQL de pacientes o historias. Solicitar revisión al responsable si el contrato no alcanza DI-145/146; no crear tablas/rutas nuevas sin acuerdo.

## Para entregar un backend compartido

QA remoto requiere cupo Free y referencia independiente, paquete managed aprobado, aislamiento remoto explícito, credenciales publicables QA y cuentas autorizadas por canal seguro; además definición de provisión/verificación profesional, consentimiento y retención. Probar allí Auth/JWT, RLS, cuatro RPC, ocho endpoints, Storage privado, revocación/auditoría/concurrencia. Una instancia local Next conectada a Supabase QA sigue siendo BFF local; no es automáticamente un backend HTTP alojado para todas las integrantes. Hospedar BFF QA exige diseño y autorización adicionales, manteniendo producción/Preview cerrados. Véase [informe de Fase 7](VALIDACION_SUPABASE_QA_FASE_7.md).
