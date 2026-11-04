# Contratos API revisados

**Fase 4:** los tres Route Handlers clínicos ya están implementados y probados por HTTP con JWT de Auth local; consultar [VALIDACION_HTTP_JWT.md](VALIDACION_HTTP_JWT.md). Están apagados en producción y no se afirma despliegue en main/Vercel.

**Nota histórica de Fase 3 (superada para estas tres rutas por Fase 4):** hay tres [RPC clínicos implementados y probados en QA](IMPLEMENTACION_SERVICIOS_CLINICOS.md). No son nuevas rutas Next: las rutas HTTP de este catálogo siguen propuestas. El cursor SQL es una tupla no confiable; el futuro BFF debe firmar/vincular el cursor HTTP y mapear el envelope `ok/status`. No se modificaron interfaces ni proveedores de otros integrantes.

El JSON [CONTRATOS_API.json](CONTRATOS_API.json) es el índice único: 15 métodos con código en rama (ocho clínicos/profesionales de QA) y 10 propuestos; ninguno de IA operativo. Los errores comunes del guard incluyen 500 inesperado y 503 por proveedor. Los nuevos Route Handlers no están integrados en main; se conservan cerrados en producción.

Las operaciones personales actuales siguen usando el SDK sin nuevos endpoints Next. El nuevo catálogo no crea rutas ni amplía permisos por estar documentado. Los límites numéricos futuros son propuestas por validar, no rendimiento medido.

### GET /api/administracion/acceso

| Aspecto | Definición revisada |
|---|---|
| Estado | codigo_en_rama |
| Autorizado | Superusuario AAL2 |
| Solicitud | `Bearer; sin cuerpo` |
| Respuesta mínima | `{autorizado:true}` |
| Errores | 401,403,500,503 |
| Persistencia | Auth / fixtures, sin tabla de negocio propia |
| Validaciones | DI-150 getUser/getClaims; rol actual y factor verificado. No garantiza despliegue. |

### GET /api/administracion/usuarios

| Aspecto | Definición revisada |
|---|---|
| Estado | sintetico_en_rama |
| Autorizado | Superusuario AAL2 |
| Solicitud | `q,rol,estado,pagina,tamano` |
| Respuesta mínima | `origen:sintetico,usuarios,total,pagina,paginas,tamano` |
| Errores | 400,401,403,500,503 |
| Persistencia | Auth / fixtures, sin tabla de negocio propia |
| Validaciones | Consulta cerrada y proveedor sintético; no es Auth Admin. |

### POST /api/administracion/roles/validar

| Aspecto | Definición revisada |
|---|---|
| Estado | sintetico_en_rama |
| Autorizado | Superusuario AAL2 |
| Solicitud | `{operacion:validar_cambio_rol,usuarioId,rol}` |
| Respuesta mínima | `{modo:solo_validacion,aplicado:false,...}` |
| Errores | 400,401,403,404,413,500,503 |
| Persistencia | Auth / fixtures, sin tabla de negocio propia |
| Validaciones | JSON <=2048 bytes; actor del servidor; nunca persiste. |

### GET /api/administracion/usuarios/reales

| Aspecto | Definición revisada |
|---|---|
| Estado | real_condicionado_en_rama |
| Autorizado | Superusuario AAL2 + opt-in servidor |
| Solicitud | `q<=80; rol/estado cerrados; pagina 1..1000; tamano 5/10/20` |
| Respuesta mínima | `origen:supabase,consistencia:lectura_no_transaccional,usuarios,total,pagina,paginas,tamano` |
| Errores | 400,401,403,500,503 |
| Persistencia | public.profiles |
| Validaciones | Auth Admin + profiles; escaneo máximo 2000; sin datos clínicos, factores o emails en DTO. |

### GET /api/administracion/roles

| Aspecto | Definición revisada |
|---|---|
| Estado | codigo_en_rama_requiere_migracion |
| Autorizado | Superusuario AAL2 y TOTP reciente |
| Solicitud | `usuarioId UUID único` |
| Respuesta mínima | `codigo,resultado,revision,asignacion,solicitudId:null` |
| Errores | 400,401,403,404,409,500,503 |
| Persistencia | dentaia_admin.revisiones_roles |
| Validaciones | La función común SQL revalida sesión y AMR TOTP 5 minutos también en GET; depende de bandera/RPC. |

### POST /api/administracion/roles

| Aspecto | Definición revisada |
|---|---|
| Estado | codigo_en_rama_requiere_migracion |
| Autorizado | Superusuario AAL2, TOTP reciente y aprobación independiente |
| Solicitud | `{usuarioId,operacion,rol,revisionEsperada,asignacionEsperada,aprobacionId}; Idempotency-Key` |
| Respuesta mínima | `codigo,resultado,revision,asignacion,solicitudId` |
| Errores | 400,401,403,404,409,413,500,503 |
| Persistencia | dentaia_admin.revisiones_roles, dentaia_admin.aprobaciones_roles, dentaia_admin.auditoria_roles |
| Validaciones | Origin igual; Sec-Fetch-Site same-origin si presente; JSON<=2048; MFA del objetivo al promover; sin cambios propios; último administrador; estado incierto se reconcilia sin clave nueva. |

### GET /api/desarrollo/validar-lectura-admin

| Aspecto | Definición revisada |
|---|---|
| Estado | solo_desarrollo |
| Autorizado | Guard real en cada caso |
| Solicitud | `Bearer propio, sin cuerpo` |
| Respuesta mínima | `recuentos,estados,coherencia sin filas privadas` |
| Errores | 401,403,404,500,503 |
| Persistencia | public.profiles |
| Validaciones | 404 fuera de development; no copia tokens ni simula AAL2. |

### GET /api/professional/me

| Aspecto | Definicion actual F5 |
|---|---|
| Estado | codigo_next_qa_local_con_rpc |
| Autorizado | Identidad actual; paciente propietario o profesional verificado y contexto propio activo segun operacion |
| Solicitud | Bearer; limit 1..50 (20 defecto), afterId UUID; membershipId obligatorio solo patients/requests; status requested/cancelled solo requests |
| Respuesta minima | ok,apiVersion:clinical.workspace.v1,environment:qa_local,kind,data:{professionalId,dentistId,contexts:[{membershipId,clinicId,clinicName,validFrom,validUntil}]},nextAfterId,requestId |
| Errores | [400, 401, 403, 404, 503] |
| Validacion | get_clinical_workspace con JWT de usuario, auditoria obligatoria, sin datos de contacto ni privilegios por aparecer en dentists. Solo QA local y apagado en production. |

### GET /api/professional/patients

| Aspecto | Definicion actual F5 |
|---|---|
| Estado | codigo_next_qa_local_con_rpc |
| Autorizado | Identidad actual; paciente propietario o profesional verificado y contexto propio activo segun operacion |
| Solicitud | Bearer; limit 1..50 (20 defecto), afterId UUID; membershipId obligatorio solo patients/requests; status requested/cancelled solo requests |
| Respuesta minima | ok,apiVersion:clinical.workspace.v1,environment:qa_local,kind,data:{membershipId,items:[{patientId}]},nextAfterId,requestId |
| Errores | [400, 401, 403, 404, 503] |
| Validacion | get_clinical_workspace con JWT de usuario, auditoria obligatoria, sin datos de contacto ni privilegios por aparecer en dentists. Solo QA local y apagado en production. |

### GET /api/professional/requests

| Aspecto | Definicion actual F5 |
|---|---|
| Estado | codigo_next_qa_local_con_rpc |
| Autorizado | Identidad actual; paciente propietario o profesional verificado y contexto propio activo segun operacion |
| Solicitud | Bearer; limit 1..50 (20 defecto), afterId UUID; membershipId obligatorio solo patients/requests; status requested/cancelled solo requests |
| Respuesta minima | ok,apiVersion:clinical.workspace.v1,environment:qa_local,kind,data:{professionalId,membershipId,items:[{id,status,createdAt,preferredDate,preferredTime,isDemo}]},nextAfterId,requestId |
| Errores | [400, 401, 403, 404, 503] |
| Validacion | get_clinical_workspace con JWT de usuario, auditoria obligatoria, sin datos de contacto ni privilegios por aparecer en dentists. Solo QA local y apagado en production. |

### GET /api/clinical/patients/me

| Aspecto | Definicion actual F5 |
|---|---|
| Estado | codigo_next_qa_local_con_rpc |
| Autorizado | Identidad actual; paciente propietario o profesional verificado y contexto propio activo segun operacion |
| Solicitud | Bearer; sin IDs de identidad ni contexto; limit opcional validado, sin afterId |
| Respuesta minima | ok,apiVersion:clinical.workspace.v1,environment:qa_local,kind,data:{patientId},nextAfterId:null,requestId |
| Errores | [400, 401, 403, 404, 503] |
| Validacion | get_clinical_workspace con JWT de usuario, auditoria obligatoria, sin datos de contacto ni privilegios por aparecer en dentists. Solo QA local y apagado en production. |

### GET /api/clinical/patients/:patientId/history

| Aspecto | Contrato implementado |
|---|---|
| Estado | Implementado únicamente en QA local |
| Autorizado | Propietario u odontólogo autorizado |
| Solicitud | membershipId opcional para propio; limit 1..50; cursor v1 cifrado y firmado |
| Respuesta | HTTP 200: {ok,apiVersion:clinical.v1,origen,environment,estado,caso,entries,nextCursor,requestId} |
| Errores | 400, 401, 403, 404, 503 |
| Persistencia | clinical.patient_records, clinical.clinic_memberships, clinical.clinical_access_grants, clinical.clinical_grant_resources, clinical.clinical_encounters, clinical.clinical_entries, clinical.clinical_documents, clinical.clinical_access_audit |
| Validaciones | JWT SDK + getUser; concesión/rol/contexto frescos en RPC; DTO cerrado; cursor AES-256-GCM+HMAC, vinculado a actor/sesión/paciente/profesional/clínica/contexto/filtros; no-store. Sin descarga clínica. |


### GET /api/clinical/access-grants

| Aspecto | Definicion actual F5 |
|---|---|
| Estado | codigo_next_qa_local_con_rpc |
| Autorizado | Identidad actual; paciente propietario o profesional verificado y contexto propio activo segun operacion |
| Solicitud | Bearer; limit 1..50 (20 defecto), afterId UUID; membershipId obligatorio solo patients/requests; status requested/cancelled solo requests |
| Respuesta minima | ok,apiVersion:clinical.workspace.v1,environment:qa_local,kind,data:{patientId,items:[{id,membershipId,estado,expiresAt,revokedAt,policyVersion,encounterIds}]},nextAfterId,requestId |
| Errores | [400, 401, 403, 404, 503] |
| Validacion | get_clinical_workspace con JWT de usuario, auditoria obligatoria, sin datos de contacto ni privilegios por aparecer en dentists. Solo QA local y apagado en production. |

### POST /api/clinical/access-grants

| Aspecto | Contrato implementado |
|---|---|
| Estado | Implementado únicamente en QA local |
| Autorizado | Paciente propietario |
| Solicitud | {membershipId,encounterIds,expiresAt,policyVersion,accepted:true}; Idempotency-Key UUID; sin actor/patientId/purpose |
| Respuesta | HTTP 201/200: {ok,id,estado,expiresAt,revokedAt,replayed,requestId} |
| Errores | 400, 401, 403, 404, 409, 413, 415, 503 |
| Persistencia | clinical.clinical_access_grants, clinical.clinical_grant_resources, clinical.clinical_access_audit |
| Validaciones | JWT firmado verificado SDK + getUser fresco; RPC deriva paciente, política/finalidad y audita. Cuerpo cerrado <=8192 bytes; roles canónicos; Origin; no-store. Solo QA local; apagado en producción. |


### POST /api/clinical/access-grants/:id/revoke

| Aspecto | Contrato implementado |
|---|---|
| Estado | Implementado únicamente en QA local |
| Autorizado | Paciente propietario |
| Solicitud | {} JSON; id UUID de ruta; Bearer del propietario |
| Respuesta | HTTP 200: {ok,id,revokedAt,requestId} |
| Errores | 400, 401, 403, 404, 413, 415, 503 |
| Persistencia | clinical.clinical_access_grants, clinical.clinical_access_audit |
| Validaciones | JWT real; propiedad y revocación idempotente en RPC; sin actor del cuerpo; Origin; no-store; rollback si falla auditoría. |


### GET /api/clinical/documents/:id/content

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Propietario o permiso profesional por recurso |
| Solicitud | `membershipId; no bucket/path del cliente` |
| Respuesta mínima | `Stream privado, Content-Type permitido, Cache-Control no-store` |
| Errores | 400,401,403,404,503 |
| Persistencia | clinical.clinical_documents, clinical.clinical_access_audit |
| Validaciones | Auditar antes de stream; autorización por solicitud; controlar disponibilidad, contexto y límites de Storage. Bytes ya autorizados no se retiran por revocar. |

### POST /api/administracion/professionals/:id/verification

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Superusuario AAL2 con acción explícita de verificación |
| Solicitud | `{decision,reference,reason,expectedLatestReviewId}; Idempotency-Key` |
| Respuesta mínima | `{verificationId,decision,professionalStatus}` |
| Errores | 400,401,403,409,503 |
| Persistencia | clinical.professional_accounts, clinical.professional_verifications, clinical.clinical_access_audit |
| Validaciones | Sin autoaprobación; reviewer del servidor; lock y comparación de última revisión. No concede Auth odontologo automáticamente; DI-151 requiere ampliación aprobada. |

### POST /api/administracion/clinics

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Operador de registro explícitamente autorizado, AAL2 |
| Solicitud | `{name,location}; Idempotency-Key` |
| Respuesta mínima | `{id,status}` |
| Errores | 400,401,403,409,503 |
| Persistencia | clinical.clinics, clinical.clinical_access_audit |
| Validaciones | Solo datos operativos de clínica. No acceso a pacientes o capacidad clínica implícita. Procedimiento de provisión pendiente. |

### POST /api/administracion/clinic-memberships

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Operador de membresías autorizado, AAL2 |
| Solicitud | `{clinicId,professionalId,validFrom,validUntil}; Idempotency-Key` |
| Respuesta mínima | `{id,status,validFrom,validUntil}` |
| Errores | 400,401,403,409,503 |
| Persistencia | clinical.clinic_memberships, clinical.professional_accounts, clinical.clinical_access_audit |
| Validaciones | Profesional verificado, fechas válidas, sin solapamiento. No autoasignación ni rebinding de una membresía existente. |

### POST /api/administracion/clinic-memberships/:id/suspend

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Operador de membresías autorizado, AAL2 |
| Solicitud | `{expectedStatus}; Idempotency-Key` |
| Respuesta mínima | `{id,status:suspended}` |
| Errores | 400,401,403,409,503 |
| Persistencia | clinical.clinic_memberships, clinical.clinical_access_audit |
| Validaciones | Transición y auditoría atómicas; nuevas consultas revalidan estado. No modifica clínica/profesional de origen. |

### POST /api/analysis/authorizations

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Propietario de foto |
| Solicitud | `{photoId,policyVersion,expiresAt,accepted:true}` |
| Respuesta mínima | `{id,purpose:exploratory_image_analysis,expiresAt}` |
| Errores | 400,401,403,422,503 |
| Persistencia | ml.analysis_authorizations, public.dental_photos |
| Validaciones | Propiedad compuesta; política/texto configurados por equipo, no del cliente. No entrenamiento ni acceso clínico. |

### POST /api/analysis/authorizations/:id/revoke

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Propietario emisor |
| Solicitud | `{}` |
| Respuesta mínima | `{id,revokedAt}` |
| Errores | 400,401,403,404,503 |
| Persistencia | ml.analysis_authorizations, ml.analysis_jobs |
| Validaciones | Revocar y cancelar queued atómicamente; no entregar resultados nuevos tras revocar. No deshace cómputo ya realizado. |

### POST /api/analysis/jobs

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Propietario autorizado |
| Solicitud | `{photoId,modelId,authorizationId}; Idempotency-Key` |
| Respuesta mínima | `202 {id,status:queued,requestId}` |
| Errores | 400,401,403,409,422,503 |
| Persistencia | ml.analysis_jobs, ml.analysis_authorizations, ml.model_versions |
| Validaciones | Mismo triple foto/owner/autorización y modelo evaluado. Comparar payload de idempotencia, no resolverlo solo con UNIQUE. |

### GET /api/analysis/jobs/:id

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Propietario derivado |
| Solicitud | `UUID` |
| Respuesta mínima | `{id,status,resultId,errorCode,requestId}` |
| Errores | 400,401,403,404,503 |
| Persistencia | ml.analysis_jobs |
| Validaciones | Sin lease_id ni acceso al worker. No fallback de otro propietario. |

### GET /api/analysis/results/:id

| Aspecto | Definición revisada |
|---|---|
| Estado | propuesto_no_implementado |
| Autorizado | Propietario con autorización vigente |
| Solicitud | `UUID` |
| Respuesta mínima | `{id,modelVersion,qualityStatus,label,score,limitations,recommendations}` |
| Errores | 400,401,403,404,503 |
| Persistencia | ml.analysis_results, ml.result_recommendations, ml.educational_recommendations, ml.analysis_jobs |
| Validaciones | No evaluable tiene clase/score NULL. No devolver artefactos ni diagnósticos clínicos; permisos profesionales futuros no se presuponen. |

## Compatibilidad con el proveedor de Anelis

La fuente existente acepta patientId/contextId/escenario y devuelve estado/caso/entries/origen:sintetico/permisoSimulado. Ese escenario es una demostración, no una credencial. El adaptador real debe rechazar escenario del cliente y traducir errores/ausencias sin datos de fallback. Propuesta clinical.v1 conserva caso y entries, usa origen:supabase y no se etiqueta como simulado. La interfaz de origen se amplía de manera explícita en un PR de integración, no mediante un cast que esconda discrepancias. No se modifica aquí la UI de Anelis.

Ejemplo exclusivamente sintético del futuro DTO (no respuesta real ejecutada):

```json
{
  "apiVersion": "clinical.v1",
  "origen": "sintetico",
  "estado": "listo",
  "caso": {
    "patientId": "00000000-0000-4000-8000-000000000001",
    "professionalContext": "Profesional de prueba",
    "clinicContext": "Clínica de prueba"
  },
  "entries": [
    {
      "encounterId": "00000000-0000-4000-8000-000000000002",
      "attendedAt": "2026-10-01T15:00:00Z",
      "recordedAt": "2026-10-01T15:10:00Z",
      "background": {
        "state": "unknown",
        "value": null
      },
      "diagnoses": [],
      "treatments": [],
      "exams": []
    }
  ],
  "nextCursor": null,
  "requestId": "00000000-0000-4000-8000-000000000003"
}
```

Los servicios reales pueden resolver nombres de procedencia desde la publicación dentists o, en una consulta ya autorizada, el nombre mínimo de profiles del profesional de origen; nunca correos, factores o credenciales Auth. Un nombre actual no equivale al nombre histórico exacto de una fecha: el ID estable es la atribución, y snapshots legales requerirían otro acuerdo.

No se habilitan POST/PATCH de contenido clínico asistencial en el MVP de lectura. La carga/importación real, autorización de escritura asistencial y validez de exámenes requieren alcance adicional; un permiso de lectura no autoriza registrar o corregir tratamientos. Tampoco existe backend/endpoint de entrenamiento actual.

## Operaciones SDK actuales, sin rutas Next inventadas

| Recurso | Operaciones actuales | Contrato mínimo y seguridad |
|---|---|---|
| Auth | signUp, signInWithPassword, signOut, getUser | Credenciales solo SDK; confirmación y sesión según Auth. Sin permisos administrativos del registro público. |
| profiles | leer/insertar/actualizar nombre | Usuario propio; full_name 2..120; RLS y permisos de columna. |
| dentists | consulta activa y filtros/detalle | Ficha académica; precios ilustrativos; no identidad profesional ni agenda real. |
| appointment_requests | crear/listar/cancelar propias | requested/cancelled, is_demo, destinatario activo al crear y UPDATE limitado a status. |
| patient_consents | crear/leer/revocar propios | Finalidad academic_photo_storage; no clínica/IA. |
| dental_photos y Storage | upload/download/remove y metadata | JPG/PNG/WebP, 1..8388608 bytes, propietario, consentimiento y borrado reintentable. |

## Provisionamiento pendiente y límites de idempotencia

Las rutas de alta de clínica, verificación y membresía son contratos futuros de operador, no servicios ya disponibles. Las altas pueden vincular su Idempotency-Key al UUID de la entidad, comparando también actor/entrada y la evidencia auditada. Una suspensión necesita serializar actor/operación/clave y registrar su resultado antes de responder; no basta UPDATE status ni asumir que request_id es UNIQUE. El evento mínimo de acceso no es por sí solo un ledger genérico de todos los payloads. Revisar ese procedimiento y su evidencia antes de habilitar esas rutas; mientras tanto la provisión del MVP sintético es controlada en QA, no escritura desde la UI. No se añaden tablas genéricas especulativas para procesos no acordados.
