# Contratos de APIs

main no contiene Route Handlers propios en el inventario inspeccionado. Sus flujos usan SDK de Supabase: no inventar endpoints Next para cuenta, directorio, fotos o solicitudes existentes. Las rutas admin existen en la rama c992a142; código existente no equivale a ruta desplegada y habilitada.

## GET /api/administracion/acceso
| Aspecto | Contrato |
|---|---|
| Estado | Rama admin |
| Finalidad | Auth: getUser/getClaims; sin tablas |
| Autorización | Superusuario AAL2 |
| Parámetros y validación | Bearer; sin parámetros de autoridad |
| Solicitud | Sin cuerpo |
| Respuesta | {autorizado:true} |
| Errores | 401 identidad, 403 permiso, 503 proveedor |
| Persistencia | Auth: getUser/getClaims; sin tablas |


## GET /api/administracion/usuarios
| Aspecto | Contrato |
|---|---|
| Estado | Rama admin, sintético |
| Finalidad | Proveedor sintético; ninguna escritura |
| Autorización | Superusuario AAL2 |
| Parámetros y validación | q,rol,estado,pagina,tamano; sin duplicados |
| Solicitud | Sin cuerpo |
| Respuesta | origen,total,pagina,paginas,tamano,usuarios con id/etiqueta/roles/origenRoles/estado |
| Errores | 400 consulta,401/403/503 |
| Persistencia | Proveedor sintético; ninguna escritura |


## POST /api/administracion/roles/validar
| Aspecto | Contrato |
|---|---|
| Estado | Rama admin, validación sintética |
| Finalidad | Sin persistencia; UUID, no autoascenso, campos cerrados |
| Autorización | Superusuario AAL2 |
| Parámetros y validación | JSON máximo 2048 bytes |
| Solicitud | {operacion:"validar_cambio_rol",usuarioId,rol} |
| Respuesta | {modo:"solo_validacion",aplicado:false,usuarioId,rol,mensaje} |
| Errores | 400,401,403,404,413,503 |
| Persistencia | Sin persistencia; UUID, no autoascenso, campos cerrados |


## GET /api/administracion/usuarios/reales
| Aspecto | Contrato |
|---|---|
| Estado | Rama admin, lectura real condicionada |
| Finalidad | Auth Admin + public.profiles; proyección mínima; máximo 2000 cuentas |
| Autorización | Superusuario AAL2 + bandera |
| Parámetros y validación | q<=80; rol=todos/paciente/odontologo/superusuario/sin_asignacion/asignacion_invalida; estado=todos/habilitada/suspendida/sin_confirmar/anonima/eliminada/inconsistente; pagina 1..1000; tamano 5/10/20; no duplicados ni actor/proveedor del cliente |
| Solicitud | Sin cuerpo |
| Respuesta | origen,consistencia,total,pagina,paginas,tamano,usuarios[id,perfil,cuenta,asignacion] |
| Errores | 400,401,403,503 |
| Persistencia | Auth Admin + public.profiles; proyección mínima; máximo 2000 cuentas |


## GET /api/administracion/roles
| Aspecto | Contrato |
|---|---|
| Estado | Rama admin; requiere migración/bandera |
| Finalidad | RPC dentaia_cambiar_roles_v1; lectura de revisión |
| Autorización | Superusuario AAL2 y sesión revalidada |
| Parámetros y validación | usuarioId UUID único |
| Solicitud | Sin cuerpo |
| Respuesta | codigo,resultado,revision,asignacion,solicitudId |
| Errores | 400,401,403,404,503 |
| Persistencia | RPC dentaia_cambiar_roles_v1; lectura de revisión |


## POST /api/administracion/roles
| Aspecto | Contrato |
|---|---|
| Estado | Rama admin; escrituras condicionadas |
| Finalidad | RPC; Auth namespace + revisiones/aprobaciones/auditoría. No desplegado en catálogo observado |
| Autorización | Superusuario AAL2, TOTP reciente y aprobación |
| Parámetros y validación | Origin mismo origen, Idempotency-Key UUID, JSON <=2048 bytes |
| Solicitud | {usuarioId,operacion,rol,revisionEsperada,asignacionEsperada,aprobacionId} |
| Respuesta | codigo,resultado,revision,asignacion,solicitudId |
| Errores | 400,401,403,404,409,413,503 |
| Persistencia | RPC; Auth namespace + revisiones/aprobaciones/auditoría. No desplegado en catálogo observado |


## GET /api/desarrollo/validar-lectura-admin
| Aspecto | Contrato |
|---|---|
| Estado | Rama admin, solo development |
| Finalidad | Invoca handler real; no bypass de Auth |
| Autorización | Sesión propia; guard en cada prueba |
| Parámetros y validación | Herramienta QA de matriz acotada |
| Solicitud | Sin cuerpo |
| Respuesta | Resumen saneado por escenario; sin filas clínicas |
| Errores | 401,403,404 fuera de desarrollo,503 |
| Persistencia | Invoca handler real; no bypass de Auth |


## GET /api/clinical/patients/:patientId/history
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | clinical.*; lectura autorizada y auditoría atómica |
| Autorización | Paciente propio / odontólogo autorizado |
| Parámetros y validación | membershipId, cursor opaco y limit <=50; ambos validados |
| Solicitud | Sin cuerpo |
| Respuesta | patientId,items,nextCursor,origin,requestId |
| Errores | 400,401,403,404 genérico,503 auditoría |
| Persistencia | clinical.*; lectura autorizada y auditoría atómica |


## POST /api/clinical/access-grants
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | clinical_access_grants + resources + audit; misma transacción |
| Autorización | Paciente propietario |
| Parámetros y validación | Idempotency-Key; no actor/patient de terceros |
| Solicitud | {membershipId,encounterIds,expiresAt,purpose,policyVersion} |
| Respuesta | {id,status:"active",expiresAt,requestId} |
| Errores | 400,401,403,409,422,503 |
| Persistencia | clinical_access_grants + resources + audit; misma transacción |


## POST /api/clinical/access-grants/:id/revoke
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | Marca revocación sin borrar historia; auditoría |
| Autorización | Paciente propietario |
| Parámetros y validación | UUID e idempotencia |
| Solicitud | {} |
| Respuesta | {id,revokedAt,requestId} |
| Errores | 400,401,403,404,503 |
| Persistencia | Marca revocación sin borrar historia; auditoría |


## GET /api/clinical/documents/:id/content
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | Autorizar y auditar; proxy a bucket clínico privado |
| Autorización | Propietario o permiso profesional vigente |
| Parámetros y validación | membershipId; no ruta Storage libre |
| Solicitud | Sin cuerpo |
| Respuesta | Stream privado; Content-Type y Cache-Control no-store |
| Errores | 401,403,404 genérico,413 límite,503 |
| Persistencia | Autorizar y auditar; proxy a bucket clínico privado |


## POST /api/analysis/authorizations
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | ml.analysis_authorizations; finalidad no entrenamiento |
| Autorización | Propietario de la fotografía |
| Parámetros y validación | JSON de campos cerrados; texto/política revisados por equipo |
| Solicitud | {photoId,policyVersion,expiresAt,accepted:true} |
| Respuesta | {id,purpose:"exploratory_image_analysis",expiresAt} |
| Errores | 400,401,403,422 finalidad,503 |
| Persistencia | ml.analysis_authorizations; finalidad no entrenamiento |


## POST /api/analysis/authorizations/:id/revoke
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | Revocación y cancelación de trabajos queued; límites del trabajo en curso explícitos |
| Autorización | Propietario emisor |
| Parámetros y validación | UUID e idempotencia |
| Solicitud | {} |
| Respuesta | {id,revokedAt} |
| Errores | 401,403,404,503 |
| Persistencia | Revocación y cancelación de trabajos queued; límites del trabajo en curso explícitos |


## POST /api/analysis/jobs
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto y bloqueado por consentimiento pendiente |
| Finalidad | ml.analysis_jobs; resolver autorización específica antes de ejecutar |
| Autorización | Propietario autorizado para análisis |
| Parámetros y validación | Idempotency-Key y versión de modelo aprobada |
| Solicitud | {photoId,modelId,authorizationId} |
| Respuesta | 202 {id,status:"queued",requestId} |
| Errores | 400,401,403,409,422 finalidad/calidad,503 |
| Persistencia | ml.analysis_jobs; resolver autorización específica antes de ejecutar |


## GET /api/analysis/jobs/:id
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | ml.analysis_jobs; no datos de terceros |
| Autorización | Propietario del job |
| Parámetros y validación | UUID |
| Solicitud | Sin cuerpo |
| Respuesta | {id,status,resultId,errorCode,requestId} |
| Errores | 401,403,404,503 |
| Persistencia | ml.analysis_jobs; no datos de terceros |


## GET /api/analysis/results/:id
| Aspecto | Contrato |
|---|---|
| Estado | Propuesto |
| Finalidad | ml.analysis_results y recomendaciones; no diagnóstico |
| Autorización | Propietario; profesional solo mediante permiso explícito futuro |
| Parámetros y validación | UUID |
| Solicitud | Sin cuerpo |
| Respuesta | {id,modelVersion,qualityStatus,observations,recommendations,limitations} |
| Errores | 401,403,404,503 |
| Persistencia | ml.analysis_results y recomendaciones; no diagnóstico |


## Operaciones SDK existentes (sin nueva ruta Next.js)

| Recurso | Operación actual | Entrada / respuesta | Validación y autorización |
|---|---|---|---|
| Supabase Auth | signUp/signInWithPassword/signOut/getUser | credenciales al SDK; sesión al cliente, nunca al log | validaciones de cuenta; configuración de confirmación remota no inspeccionada |
| profiles | select/insert/update de full_name | id propio, full_name; perfil mínimo | identidad propia y RLS; nombre 2–120 |
| dentists | select activo, filtros/detalle | slug/especialidad/distrito; ficha demo | RLS lectura pública; no equivale a profesional autenticado |
| appointment_requests | insert/listar/cancelar | contacto mínimo, preferencia, mensaje; requested/cancelled | dueño, fecha, profesional activo, email y límites; UPDATE solo status según privilegios |
| patient_consents | insert/leer/revocar | versión/texto/finalidad; id y fechas | propietario, finalidad fija y revocación; UPDATE solo columna permitida |
| dental_photos y Storage | upload/download/remove + metadatos | archivo JPG/PNG/WebP 1–8388608 bytes | propietario, consentimiento vigente, bucket/path; compensación y borrado reintentable |

No hay endpoint real de agenda, reserva confirmada, importación clínica externa ni inferencia IA demostrado. No se añade disponibilidad porque Jira no define agenda real. Un examen ausente se representa como no disponible, no como una URL inventada.

## DTO clínico sintético de diseño

```json
{"patientId":"00000000-0000-4000-8000-000000000001","origin":"synthetic","items":[{"encounterId":"00000000-0000-4000-8000-000000000002","attendedAt":"2026-10-01T15:00:00Z","recordedAt":"2026-10-01T15:10:00Z","originClinic":{"id":"00000000-0000-4000-8000-000000000003","name":"Clínica de prueba"},"professional":{"displayName":"Profesional de prueba"},"background":{"state":"unknown","value":null},"diagnoses":[],"treatments":[],"exams":[]}],"nextCursor":null,"requestId":"00000000-0000-4000-8000-000000000004"}
```

Es un ejemplo sintético del contrato propuesto, no respuesta del sistema actual. Cursor incorpora contexto/scope y firma del servidor para evitar reutilizarlo con otra identidad; no es una autorización. Límites y formatos deben acordarse con quienes implementen las vistas. La compatibilidad se probará con el puerto de historial actual, reemplazando el parámetro escenario por respuesta del servidor.

Los filtros reales de usuarios tienen un contrato distinto del proveedor sintético: no pasar nombres de campos de una fuente a otra sin adaptador. Ver documento versionado de DI-151. Toda futura mutación debe limitar campos, validar objeto y operación, comprobar permiso, auditar e implementar idempotencia cuando pueda repetirse. Los errores no distinguen identidad de paciente inexistente y paciente sin permiso ante un profesional ajeno.
