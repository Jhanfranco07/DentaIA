# Políticas por tabla y reglas de despliegue

**Fase 3 local:** los borradores 01–07 permanecen intactos. Los nuevos 08–10 agregan políticas únicamente para un [ejecutor clínico técnico sin login/BYPASSRLS](IMPLEMENTACION_SERVICIOS_CLINICOS.md), detrás de RPC auditados; no conceden acceso directo a pacientes, profesionales o administradores. El catálogo de ACL efectivo está en [CATALOGO_RPC.json](servicios_clinicos/pruebas/CATALOGO_RPC.json). Las políticas de IA no cambian.

Las expresiones siguientes del bloque actual son transcripción del catálogo. Las reglas futuras son especificaciones para revisar y probar, no políticas aplicadas. No se ejecuta SQL.

## RLS observada
| Esquema.tabla | Política | Rol | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| public.appointment_requests | requests_cancel | authenticated | UPDATE | (user_id = ( SELECT auth.uid() AS uid)) | ((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'cancelled'::text)) |
| public.appointment_requests | requests_create | authenticated | INSERT | — | ((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'requested'::text) AND (preferred_date >= CURRENT_DATE) AND (EXISTS ( SELECT 1    FROM dentists d   WHERE ((d.id = appointment_requests.dentist_id) AND d.is_active)))) |
| public.appointment_requests | requests_read | authenticated | SELECT | (user_id = ( SELECT auth.uid() AS uid)) | — |
| public.dental_photos | photos_create | authenticated | INSERT | — | ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1    FROM patient_consents c   WHERE ((c.id = dental_photos.consent_id) AND (c.user_id = ( SELECT auth.uid() AS uid)) AND (c.revoked_at IS NULL))))) |
| public.dental_photos | photos_delete | authenticated | DELETE | (user_id = ( SELECT auth.uid() AS uid)) | — |
| public.dental_photos | photos_read | authenticated | SELECT | (user_id = ( SELECT auth.uid() AS uid)) | — |
| public.dentists | dentists_read | anon,authenticated | SELECT | is_active | — |
| public.patient_consents | consents_create | authenticated | INSERT | — | ((user_id = ( SELECT auth.uid() AS uid)) AND (revoked_at IS NULL)) |
| public.patient_consents | consents_read | authenticated | SELECT | (user_id = ( SELECT auth.uid() AS uid)) | — |
| public.patient_consents | consents_revoke | authenticated | UPDATE | (user_id = ( SELECT auth.uid() AS uid)) | ((user_id = ( SELECT auth.uid() AS uid)) AND (revoked_at IS NOT NULL)) |
| public.profiles | profiles_create | authenticated | INSERT | — | (id = ( SELECT auth.uid() AS uid)) |
| public.profiles | profiles_read | authenticated | SELECT | (id = ( SELECT auth.uid() AS uid)) | — |
| public.profiles | profiles_update | authenticated | UPDATE | (id = ( SELECT auth.uid() AS uid)) | (id = ( SELECT auth.uid() AS uid)) |
| storage.objects | dentaia_photo_delete | authenticated | DELETE | ((bucket_id = 'dental-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)) | — |
| storage.objects | dentaia_photo_read | authenticated | SELECT | ((bucket_id = 'dental-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)) | — |
| storage.objects | dentaia_photo_upload | authenticated | INSERT | — | ((bucket_id = 'dental-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1    FROM patient_consents c   WHERE ((c.user_id = ( SELECT auth.uid() AS uid)) AND ((c.id)::text = (storage.foldername(objects.name))[2]) AND (c.revoked_at IS NULL))))) |


## Especificación de acceso propuesta por tabla

### dentaia_admin.revisiones_roles
| Operación | Regla |
|---|---|
| SELECT | Sin acceso directo anon/authenticated/service_role; RPC exclusivo con contexto validado |
| INSERT / UPDATE | Solo protocolo de función privilegiada revisada; auditoría sin UPDATE/DELETE ordinarios |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### dentaia_admin.aprobaciones_roles
| Operación | Regla |
|---|---|
| SELECT | Sin acceso directo anon/authenticated/service_role; RPC exclusivo con contexto validado |
| INSERT / UPDATE | Solo protocolo de función privilegiada revisada; auditoría sin UPDATE/DELETE ordinarios |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### dentaia_admin.auditoria_roles
| Operación | Regla |
|---|---|
| SELECT | Sin acceso directo anon/authenticated/service_role; RPC exclusivo con contexto validado |
| INSERT / UPDATE | Solo protocolo de función privilegiada revisada; auditoría sin UPDATE/DELETE ordinarios |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinics
| Operación | Regla |
|---|---|
| SELECT | Lectura mínima de clínicas activas vinculadas o referenciadas por entrada autorizada; publicación pública requiere decisión separada |
| INSERT / UPDATE | Solo operador de registro autorizado, sin rol clínico implícito |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.professional_accounts
| Operación | Regla |
|---|---|
| SELECT | Propia identidad profesional; proyección pública sigue en dentists |
| INSERT / UPDATE | Vinculación y suspensión solo mediante verificación revisada |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.professional_verifications
| Operación | Regla |
|---|---|
| SELECT | Profesional solo estado/resolución propia; documentación restringida al verificador |
| INSERT / UPDATE | Verificador independiente; INSERT de resolución, sin editar historial |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinic_memberships
| Operación | Regla |
|---|---|
| SELECT | Propias del profesional; paciente ve proyección del destinatario verificable |
| INSERT / UPDATE | Operador de membresías autorizado; no autoasignación |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.patient_records
| Operación | Regla |
|---|---|
| SELECT | Paciente propio o referencia mínima después de permiso clínico válido |
| INSERT / UPDATE | Crear propia identidad; no reasignar user_id |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinical_encounters
| Operación | Regla |
|---|---|
| SELECT | Paciente propio o membresía con concesión vigente y recurso seleccionado; solo servicio auditado |
| INSERT / UPDATE | MVP solo lectura sintética; futuras escrituras requieren alcance asistencial explícito y revisión; no basta permiso de lectura |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinical_entries
| Operación | Regla |
|---|---|
| SELECT | Heredar acceso del encounter; no devolver texto antes de autorizar y auditar |
| INSERT / UPDATE | Sin escrituras en MVP; correcciones futuras versionadas por profesional habilitado |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinical_documents
| Operación | Regla |
|---|---|
| SELECT | Heredar encounter y permiso de documento; descarga por servicio auditado |
| INSERT / UPDATE | Sin carga clínica real en MVP; futuro proveedor autorizado valida objeto y registra procedencia |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinical_access_grants
| Operación | Regla |
|---|---|
| SELECT | Paciente ve propias; profesional solo concesión dirigida a su membresía, sin lista de pacientes global |
| INSERT / UPDATE | Solo paciente emisor; concesión/revocación por función; no UPDATE de destinatario |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinical_grant_resources
| Operación | Regla |
|---|---|
| SELECT | Igual concesión; comprobar paciente coincidente |
| INSERT / UPDATE | Solo función de concesión del paciente; FK y validación cruzada |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### clinical.clinical_access_audit
| Operación | Regla |
|---|---|
| SELECT | Proyección propia del paciente; verificador clínico aún por acordar |
| INSERT / UPDATE | Solo función autorizada INSERT; sin UPDATE/DELETE por paciente/profesional |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.dataset_versions
| Operación | Regla |
|---|---|
| SELECT | Equipo de investigación aprobado; manifiestos sin datos personales |
| INSERT / UPDATE | Operador de dataset; congela versión y hash |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.dataset_items
| Operación | Regla |
|---|---|
| SELECT | Investigación aprobada y licencia; no público |
| INSERT / UPDATE | Operador de dataset antes de congelar, no upload de fotos personales del MVP |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.model_versions
| Operación | Regla |
|---|---|
| SELECT | Metadatos publicados aprobados; artefacto privado para runtime autorizado |
| INSERT / UPDATE | Investigación aprobada; estado evaluated requiere métricas reales |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.analysis_authorizations
| Operación | Regla |
|---|---|
| SELECT | Propietario propio |
| INSERT / UPDATE | Paciente propietario concede/revoca finalidad de una foto; no delegar al superusuario |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.analysis_jobs
| Operación | Regla |
|---|---|
| SELECT | Propietario; profesional solo contrato explícito futuro, no rol genérico |
| INSERT / UPDATE | Crear propietario autorizado; trabajador mínimo cambia estado; transiciones atómicas |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.analysis_results
| Operación | Regla |
|---|---|
| SELECT | Propietario derivado del job; sin lectura pública |
| INSERT / UPDATE | Solo trabajador del job autorizado; una salida por job; sin ediciones clínicas |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.educational_recommendations
| Operación | Regla |
|---|---|
| SELECT | Solo versiones revisadas en producto; borradores solo equipo de revisión |
| INSERT / UPDATE | Operador de contenido revisado; cambios crean versión |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.result_recommendations
| Operación | Regla |
|---|---|
| SELECT | Mismo acceso del resultado |
| INSERT / UPDATE | Solo trabajador del job, asociación a catálogo revisado |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.evaluation_runs
| Operación | Regla |
|---|---|
| SELECT | Equipo de evaluación autorizado; resumen publicable anonimizado |
| INSERT / UPDATE | Operador de evaluación; resultado de ejecución inmutable |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


### ml.evaluation_metrics
| Operación | Regla |
|---|---|
| SELECT | Según evaluation_run; métricas agregadas publicables tras revisión |
| INSERT / UPDATE | Operador de evaluación al cerrar ejecución; sin edición para fabricar resultados |
| DELETE | No ordinario; conservación/versionado y proceso aprobado |
| RLS y exposición | RLS habilitada al crear; sin políticas permisivas genéricas ni GRANT global. Esquema no expuesto por defecto; acceso mediante funciones/servicios revisados. |


## Invariantes de despliegue

No exponer clinical/ml a Data API sin una revisión explícita. La lista de esquemas expuestos no se verificó mediante configuración de proyecto: no inferir exposición de una tabla solo por su esquema. Para una política directa revisar SELECT junto con UPDATE y WITH CHECK; controlar columnas editables. El servicio privilegiado valida actor internamente y no es un puente SQL arbitrario. Identificar qué rol/grant usa cada RPC y probar llamada directa con anon/authenticated antes de habilitar. Para documentos, política de fila no equivale a política del objeto Storage. La consulta auditada no puede permitir un SELECT alternativo que evite la auditoría.
## Actualización de auditoría integral

## Estado efectivo del borrador

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

En IA, CASCADE de foto no autoriza lectura de ella: se limita a preservar el borrado. Los bytes Storage tienen controles separados. Las tablas de administración siguen el SQL DI-151 sin políticas nuevas ni una segunda fuente de roles.
