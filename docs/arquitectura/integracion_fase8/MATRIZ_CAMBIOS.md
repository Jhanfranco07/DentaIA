# Matriz de integración incremental — Dental-IA

Metadatos de lectura del 03/11/2026. No contiene filas ni credenciales. No es autorización de ejecución.

| Objeto | Estado remoto | Cambio requerido | Riesgo | Acción propuesta |
|---|---|---|---|---|
| public.profiles | existente | ninguno | medio | Conservar columnas, filas, FK y RLS; NO recrear |
| public.profiles.id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.profiles.full_name | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.profiles.created_at | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists | existente | ninguno | medio | Conservar columnas, filas, FK y RLS; NO recrear |
| public.dentists.id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.slug | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.name | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.specialty | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.district | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.consultation_price | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.currency | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.initials | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.avatar_color | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.description | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.is_demo | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.is_active | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dentists.created_at | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests | existente | ninguno | medio | Conservar columnas, filas, FK y RLS; NO recrear |
| public.appointment_requests.id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.user_id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.dentist_id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.contact_name | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.contact_email | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.preferred_date | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.preferred_time | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.message | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.status | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.is_demo | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.appointment_requests.created_at | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.patient_consents | existente | ninguno | medio | Conservar columnas, filas, FK y RLS; NO recrear |
| public.patient_consents.id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.patient_consents.user_id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.patient_consents.policy_version | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.patient_consents.consent_text | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.patient_consents.purpose | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.patient_consents.accepted_at | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.patient_consents.revoked_at | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos | existente | ninguno | medio | Conservar columnas, filas, FK y RLS; NO recrear |
| public.dental_photos.id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.user_id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.consent_id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.bucket_id | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.object_path | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.original_filename | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.mime_type | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.size_bytes | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| public.dental_photos.created_at | existente | ninguno | bajo | Preservar tipo/default/nulabilidad reales; no ALTER de columnas originales |
| dentaia_admin.revisiones_roles | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| dentaia_admin.revisiones_roles.usuario_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.revisiones_roles.revision | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| dentaia_admin.aprobaciones_roles.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.actor_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.objetivo_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.aprobado_por | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.operacion | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.rol | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.revision_esperada | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.asignacion_esperada | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.creada_en | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.vence_en | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.aprobaciones_roles.consumida_por | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| dentaia_admin.auditoria_roles.actor_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.solicitud_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.objetivo_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.aprobacion_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.peticion | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.anterior | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.posterior | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.resultado | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| dentaia_admin.auditoria_roles.registrada_en | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinics | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinics.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinics.name | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinics.location | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinics.status | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinics.created_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_accounts | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.professional_accounts.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_accounts.user_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_accounts.dentist_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_accounts.status | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_accounts.created_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_verifications | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.professional_verifications.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_verifications.professional_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_verifications.reviewed_by | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_verifications.decision | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_verifications.reference | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_verifications.reason | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.professional_verifications.reviewed_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinic_memberships | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinic_memberships.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinic_memberships.clinic_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinic_memberships.professional_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinic_memberships.status | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinic_memberships.valid_from | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinic_memberships.valid_until | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.patient_records | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.patient_records.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.patient_records.user_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.patient_records.status | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.patient_records.created_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinical_encounters.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters.patient_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters.membership_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters.attended_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters.recorded_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters.status | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters.replaces_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_encounters.correction_reason | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinical_entries.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.encounter_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.kind | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.information_state | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.description | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.code_system | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.code | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.recorded_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.replaces_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_entries.correction_reason | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinical_documents.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.encounter_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.kind | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.title | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.exam_date | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.availability | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.bucket_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.object_path | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.mime_type | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.size_bytes | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_documents.created_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinical_access_grants.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.patient_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.membership_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.purpose | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.policy_version | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.granted_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.expires_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.revoked_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_grants.scope_mode | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_grant_resources | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinical_grant_resources.grant_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_grant_resources.encounter_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit | nueva | crear | medio | Crear vacía con restricciones/RLS; sin provisionar cuentas ni registros reales |
| clinical.clinical_access_audit.id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.request_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.actor_user_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.patient_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.membership_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.grant_id | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.operation | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.outcome | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.reason_code | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| clinical.clinical_access_audit.occurred_at | nueva | crear dentro de tabla nueva | medio | No agregarla a tablas originales ni duplicar Auth |
| public.dentaia_cambiar_roles_v1 | nuevo | crear | alto | ACL explícita; administrativo solo service_role servidor y controles completos; clínicos authenticated con autorización interna y configuración cerrada |
| public.grant_clinical_access | nuevo | crear | alto | ACL explícita; administrativo solo service_role servidor y controles completos; clínicos authenticated con autorización interna y configuración cerrada |
| public.revoke_clinical_access | nuevo | crear | alto | ACL explícita; administrativo solo service_role servidor y controles completos; clínicos authenticated con autorización interna y configuración cerrada |
| public.get_authorized_clinical_history | nuevo | crear | alto | ACL explícita; administrativo solo service_role servidor y controles completos; clínicos authenticated con autorización interna y configuración cerrada |
| public.get_clinical_workspace | nuevo | crear | alto | ACL explícita; administrativo solo service_role servidor y controles completos; clínicos authenticated con autorización interna y configuración cerrada |
| public.appointment_requests.requests_cancel | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.appointment_requests.requests_create | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.appointment_requests.requests_read | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.dental_photos.photos_create | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.dental_photos.photos_delete | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.dental_photos.photos_read | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.dentists.dentists_read | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.patient_consents.consents_create | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.patient_consents.consents_read | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.patient_consents.consents_revoke | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.profiles.profiles_create | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.profiles.profiles_read | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.profiles.profiles_update | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| storage.objects.dentaia_photo_delete | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| storage.objects.dentaia_photo_read | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| storage.objects.dentaia_photo_upload | existente | ninguno | medio | Preservar definición y roles actuales; Storage permanece privado |
| public.profiles.clinical_executor_provenance | nueva | crear | alto | Solo rol técnico NOLOGIN/NOBYPASSRLS, con SELECT de columnas mínimas y RPC autorizado; no cambia permisos de pacientes |
| public.appointment_requests.clinical_executor_requests | nueva | crear | alto | Solo rol técnico NOLOGIN/NOBYPASSRLS, con SELECT de columnas mínimas y RPC autorizado; no cambia permisos de pacientes |
| public.appointment_requests.appointment_requests_professional_page | nuevo | crear | medio | Parcial WHERE is_demo, no UNIQUE; bloqueo acotado por lock_timeout 2s |
| extensions.btree_gist | nueva | crear | medio | Necesaria para integridad de periodos; ensayar capacidad managed antes de aplicar |

Las 43 columnas públicas se mantienen; 99 pertenecen a 14 tablas nuevas. No hay tablas IA. La precisión real numeric(10,2) de dentists.consultation_price se conserva: no se sustituye por numeric sin escala.
La huella de deriva incluye tipos formateados, defaults/nulabilidad, ACL de tabla/columna, restricciones, índices y políticas. No es un respaldo ni una prueba criptográfica de la identidad del servidor.
