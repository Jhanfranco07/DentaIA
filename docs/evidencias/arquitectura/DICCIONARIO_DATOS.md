# Diccionario de datos

Cinco tablas de negocio existentes; tres tablas administrativas definidas en una migración de rama no aplicada; veintiuna tablas nuevas de diseño clínico e IA. Total objetivo: 29 tablas de negocio. Auth y Storage son esquemas gestionados adicionales y no se incluyen en ese total. Nombres de nuevas tablas son propuestas, no acuerdos del equipo.

Convenciones propuestas: UUID estables; fechas UTC timestamptz; texto en UTF-8; campos NULL no se rellenan con valores ficticios. PK implica NOT NULL. Tipos, NULL y defaults del bloque existente proceden del catálogo, no de inferencias del código.

## public.profiles

**Estado:** Existente en Supabase. Perfil personal editable, distinto de identidad Auth y autorización.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | sin default | PK | id |
| full_name | text | no | sin default |  | full name |
| created_at | timestamptz | no | now() |  | created at |


**Restricciones:** CHECK (((length(btrim(full_name)) >= 2) AND (length(btrim(full_name)) <= 120))); FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; PRIMARY KEY (id)

**Índices:** CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)

**Conservación:** Conservar comportamiento observado: Auth CASCADE para propietario; FK a consentimiento/directorio restringida; eliminación del objeto Storage es operación separada. Política de conservación clínica futura pendiente.

## public.dentists

**Estado:** Existente en Supabase. Ficha pública del directorio académico; no acredita cuenta profesional.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | id |
| slug | text | no | sin default |  | slug |
| name | text | no | sin default |  | name |
| specialty | text | no | sin default |  | specialty |
| district | text | no | sin default |  | district |
| consultation_price | numeric | no | sin default |  | consultation price |
| currency | text | no | 'PEN'::text |  | currency |
| initials | text | no | sin default |  | initials |
| avatar_color | text | no | sin default |  | avatar color |
| description | text | no | sin default |  | description |
| is_demo | bool | no | true |  | is demo |
| is_active | bool | no | true |  | is active |
| created_at | timestamptz | no | now() |  | created at |


**Restricciones:** CHECK ((consultation_price >= (0)::numeric)); CHECK ((currency = 'PEN'::text)); CHECK (is_demo); PRIMARY KEY (id); UNIQUE (slug)

**Índices:** CREATE INDEX dentists_district_specialty_idx ON public.dentists USING btree (district, specialty); CREATE UNIQUE INDEX dentists_pkey ON public.dentists USING btree (id); CREATE UNIQUE INDEX dentists_slug_key ON public.dentists USING btree (slug)

**Conservación:** Conservar comportamiento observado: Auth CASCADE para propietario; FK a consentimiento/directorio restringida; eliminación del objeto Storage es operación separada. Política de conservación clínica futura pendiente.

## public.appointment_requests

**Estado:** Existente en Supabase. Solicitudes académicas; no son citas confirmadas ni historia clínica.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | id |
| user_id | uuid | no | auth.uid() |  | user id |
| dentist_id | uuid | no | sin default |  | dentist id |
| contact_name | text | no | sin default |  | contact name |
| contact_email | text | no | sin default |  | contact email |
| preferred_date | date | no | sin default |  | preferred date |
| preferred_time | time | sí | sin default |  | preferred time |
| message | text | no | ''::text |  | message |
| status | text | no | 'requested'::text |  | status |
| is_demo | bool | no | true |  | is demo |
| created_at | timestamptz | no | now() |  | created at |


**Restricciones:** CHECK (((length(contact_email) <= 254) AND (contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text))); CHECK (((length(btrim(contact_name)) >= 2) AND (length(btrim(contact_name)) <= 120))); FOREIGN KEY (dentist_id) REFERENCES dentists(id); CHECK (is_demo); CHECK ((length(message) <= 1000)); PRIMARY KEY (id); CHECK ((status = ANY (ARRAY['requested'::text, 'cancelled'::text]))); FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

**Índices:** CREATE INDEX appointment_requests_dentist_idx ON public.appointment_requests USING btree (dentist_id); CREATE UNIQUE INDEX appointment_requests_pkey ON public.appointment_requests USING btree (id); CREATE INDEX appointment_requests_user_idx ON public.appointment_requests USING btree (user_id, created_at DESC)

**Conservación:** Conservar comportamiento observado: Auth CASCADE para propietario; FK a consentimiento/directorio restringida; eliminación del objeto Storage es operación separada. Política de conservación clínica futura pendiente.

## public.patient_consents

**Estado:** Existente en Supabase. Consentimiento exclusivo de almacenamiento académico de fotos.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | id |
| user_id | uuid | no | auth.uid() |  | user id |
| policy_version | text | no | sin default |  | policy version |
| consent_text | text | no | sin default |  | consent text |
| purpose | text | no | 'academic_photo_storage'::text |  | purpose |
| accepted_at | timestamptz | no | now() |  | accepted at |
| revoked_at | timestamptz | sí | sin default |  | revoked at |


**Restricciones:** CHECK (((revoked_at IS NULL) OR (revoked_at >= accepted_at))); CHECK (((length(btrim(consent_text)) >= 20) AND (length(btrim(consent_text)) <= 5000))); PRIMARY KEY (id); CHECK (((length(btrim(policy_version)) >= 1) AND (length(btrim(policy_version)) <= 80))); CHECK ((purpose = 'academic_photo_storage'::text)); FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; UNIQUE (user_id, id)

**Índices:** CREATE UNIQUE INDEX patient_consents_pkey ON public.patient_consents USING btree (id); CREATE UNIQUE INDEX patient_consents_user_id_id_key ON public.patient_consents USING btree (user_id, id); CREATE INDEX patient_consents_user_idx ON public.patient_consents USING btree (user_id)

**Conservación:** Conservar comportamiento observado: Auth CASCADE para propietario; FK a consentimiento/directorio restringida; eliminación del objeto Storage es operación separada. Política de conservación clínica futura pendiente.

## public.dental_photos

**Estado:** Existente en Supabase. Metadatos de objetos privados, no el binario.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | id |
| user_id | uuid | no | auth.uid() |  | user id |
| consent_id | uuid | no | sin default |  | consent id |
| bucket_id | text | no | 'dental-photos'::text |  | bucket id |
| object_path | text | no | sin default |  | object path |
| original_filename | text | no | sin default |  | original filename |
| mime_type | text | no | sin default |  | mime type |
| size_bytes | int8 | no | sin default |  | size bytes |
| created_at | timestamptz | no | now() |  | created at |


**Restricciones:** CHECK ((bucket_id = 'dental-photos'::text)); CHECK (((object_path ~~ ((((user_id)::text || '/'::text) || (consent_id)::text) || '/%'::text)) AND (length(split_part(object_path, '/'::text, 3)) > 0))); CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]))); UNIQUE (object_path); CHECK (((length(original_filename) >= 1) AND (length(original_filename) <= 255))); PRIMARY KEY (id); CHECK (((size_bytes >= 1) AND (size_bytes <= 8388608))); FOREIGN KEY (user_id, consent_id) REFERENCES patient_consents(user_id, id); FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

**Índices:** CREATE UNIQUE INDEX dental_photos_object_path_key ON public.dental_photos USING btree (object_path); CREATE UNIQUE INDEX dental_photos_pkey ON public.dental_photos USING btree (id); CREATE INDEX dental_photos_user_consent_idx ON public.dental_photos USING btree (user_id, consent_id)

**Conservación:** Conservar comportamiento observado: Auth CASCADE para propietario; FK a consentimiento/directorio restringida; eliminación del objeto Storage es operación separada. Política de conservación clínica futura pendiente.

## dentaia_admin.revisiones_roles

**Estado:** Migración en rama; no aplicada. Versión para concurrencia del protocolo de roles; ya definida en migración de rama, ausente remotamente.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| usuario_id | uuid | no | sin default | PK | usuario id |
| revision | integer | no | sin default |  | CHECK revision >= 0 |


**Restricciones:** Identificador de Auth lógico, deliberadamente sin FK para no bloquear bajas de Auth. No crear una segunda autoridad de roles.

**Índices:** PK usuario_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## dentaia_admin.aprobaciones_roles

**Estado:** Migración en rama; no aplicada. Aprobación independiente de una transición exacta.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | sin default | PK | id |
| actor_id | uuid | no | sin default |  | actor id |
| objetivo_id | uuid | no | sin default |  | objetivo id |
| aprobado_por | uuid | no | sin default |  | aprobado por |
| operacion | text | no | sin default |  | asignar o revocar |
| rol | text | no | sin default |  | paciente, odontologo o superusuario |
| revision_esperada | integer | no | sin default |  | revision esperada |
| asignacion_esperada | jsonb | sí | sin default |  | asignacion esperada |
| creada_en | timestamptz | no | clock_timestamp() |  | creada en |
| vence_en | timestamptz | no | sin default |  | vence en |
| consumida_por | uuid | sí | sin default |  | consumida por |


**Restricciones:** Actor, objetivo y aprobador distintos; vence_en > creada_en; revisión >=0. UUID de Auth y solicitud lógicos, sin FK según migración. No añadir FK nuevas a esta migración sin revisión.

**Índices:** PK id; propuesto índice parcial vence_en WHERE consumida_por IS NULL

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## dentaia_admin.auditoria_roles

**Estado:** Migración en rama; no aplicada. Evento mínimo durable del protocolo de roles.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| actor_id | uuid | no | sin default | PK compuesto | actor id |
| solicitud_id | uuid | no | sin default | PK compuesto | solicitud id |
| objetivo_id | uuid | no | sin default |  | objetivo id |
| aprobacion_id | uuid | no | sin default |  | aprobacion id |
| peticion | jsonb | no | sin default |  | peticion |
| anterior | jsonb | sí | sin default |  | anterior |
| posterior | jsonb | sí | sin default |  | posterior |
| resultado | jsonb | no | sin default |  | resultado |
| registrada_en | timestamptz | no | clock_timestamp() |  | registrada en |


**Restricciones:** PK(actor_id,solicitud_id). Identificadores deliberadamente sin FK. No guardar contraseñas, tokens ni contenido clínico. INSERT en misma transacción que cambio y consumo de aprobación.

**Índices:** PK compuesta; propuesto objetivo_id, registrada_en DESC

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinics

**Estado:** Propuesta. Organización clínica dentro de DentaIA, sin integración externa implícita.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| name | text | no | sin default |  | name |
| location | text | sí | sin default |  | location |
| status | text | no | 'active' |  | Estado: active, inactive |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** Nombre no vacío; ubicación mínima necesaria. No se agrega RUC ni información legal no requerida.

**Índices:** status, name

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.professional_accounts

**Estado:** Propuesta. Vincula una identidad Auth con una única ficha existente de odontólogo; no duplica su nombre público.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| user_id | uuid | no | sin default |  → auth.users.id | Referencia a auth.users.id |
| dentist_id | uuid | no | sin default |  → public.dentists.id | Referencia a public.dentists.id |
| status | text | no | 'pending' |  | Estado: pending, verified, suspended |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** UNIQUE(user_id); UNIQUE(dentist_id). Asignación manual revisada; no inferir identidad por email ni por aparecer en el directorio.

**Índices:** UNIQUE user_id; UNIQUE dentist_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.professional_verifications

**Estado:** Propuesta. Historial de revisión profesional con acceso restringido.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| professional_id | uuid | no | sin default |  → clinical.professional_accounts.id | Referencia a clinical.professional_accounts.id |
| reviewed_by | uuid | no | sin default |  → auth.users.id | Referencia a auth.users.id |
| decision | text | no | sin default |  | verified, rejected, revoked |
| reference | text | no | sin default |  | Referencia protegida del expediente de verificación; sin publicar documentos |
| reason | text | no | sin default |  | reason |
| reviewed_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** No autoaprobación; actor autorizado separado de la persona revisada. Decisión no concede por sí sola rol Auth ni membresía clínica.

**Índices:** professional_id, reviewed_at DESC

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinic_memberships

**Estado:** Propuesta. Pertenencia de profesional a clínica, independiente del permiso del paciente.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| clinic_id | uuid | no | sin default |  → clinical.clinics.id | Referencia a clinical.clinics.id |
| professional_id | uuid | no | sin default |  → clinical.professional_accounts.id | Referencia a clinical.professional_accounts.id |
| status | text | no | 'active' |  | Estado: active, suspended, ended |
| valid_from | timestamptz | no | now() |  | Instante UTC registrado por el servidor |
| valid_until | timestamptz | sí | sin default |  | valid until |


**Restricciones:** UNIQUE(clinic_id,professional_id); valid_until NULL o mayor a valid_from. Las reactivaciones preservan historial en auditoría; no se sobrescriben afiliaciones para cambiar procedencia.

**Índices:** UNIQUE clinic_id,professional_id; professional_id,status

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.patient_records

**Estado:** Propuesta. Identificador estable del paciente entre clínicas; nombre personal se obtiene de profiles.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| user_id | uuid | no | sin default |  → auth.users.id | Referencia a auth.users.id |
| status | text | no | 'active' |  | Estado: active, restricted, archived |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** UNIQUE(user_id). No duplicar paciente por clínica. Sin DNI, edad u otros datos clínicos no requeridos por el MVP.

**Índices:** UNIQUE user_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinical_encounters

**Estado:** Propuesta. Atención con paciente, clínica de origen y profesional responsable.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| patient_id | uuid | no | sin default |  → clinical.patient_records.id | Referencia a clinical.patient_records.id |
| membership_id | uuid | no | sin default |  → clinical.clinic_memberships.id | Referencia a clinical.clinic_memberships.id |
| attended_at | timestamptz | no | sin default |  | attended at |
| recorded_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |
| status | text | no | 'recorded' |  | Estado: recorded, amended, voided |
| replaces_id | uuid | sí | sin default |  → clinical.clinical_encounters.id | Referencia a clinical.clinical_encounters.id |


**Restricciones:** La membresía define clínica y profesional de origen; attended_at no se sustituye por recorded_at. Correcciones versionadas y justificadas, sin borrado destructivo; impedir ciclos en replaces_id.

**Índices:** patient_id,attended_at DESC,id; membership_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinical_entries

**Estado:** Propuesta. Antecedente, diagnóstico o tratamiento registrado por profesional; sin inferencia automática.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| encounter_id | uuid | no | sin default |  → clinical.clinical_encounters.id | Referencia a clinical.clinical_encounters.id |
| kind | text | no | sin default |  | background, diagnosis, treatment |
| information_state | text | no | sin default |  | recorded, not_recorded, unknown |
| description | text | sí | sin default |  | description |
| code_system | text | sí | sin default |  | code system |
| code | text | sí | sin default |  | code |
| recorded_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |
| replaces_id | uuid | sí | sin default |  → clinical.clinical_entries.id | Referencia a clinical.clinical_entries.id |


**Restricciones:** CHECK kind e information_state; description obligatoria cuando recorded, NULL cuando unknown/not_recorded. code y code_system ambos presentes o ambos NULL. No es una tabla de predicciones IA.

**Índices:** encounter_id,kind; replaces_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinical_documents

**Estado:** Propuesta. Examen o documento de una atención, con procedencia y referencia privada.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| encounter_id | uuid | no | sin default |  → clinical.clinical_encounters.id | Referencia a clinical.clinical_encounters.id |
| kind | text | no | sin default |  | exam, document |
| title | text | no | sin default |  | title |
| exam_date | date | sí | sin default |  | exam date |
| availability | text | no | sin default |  | available, unavailable |
| bucket_id | text | sí | sin default |  | bucket id |
| object_path | text | sí | sin default |  | object path |
| mime_type | text | sí | sin default |  | mime type |
| size_bytes | bigint | sí | sin default |  | size bytes |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** UNIQUE(bucket_id,object_path). available exige objeto privado y MIME/tamaño válidos; unavailable no inventa archivo. exam_date obligatoria para examen si es conocida; ausencia se informa. Sin campo is_valid automático: decisión clínica del profesional.

**Índices:** encounter_id,exam_date DESC; UNIQUE bucket_id,object_path

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinical_access_grants

**Estado:** Propuesta. Concesión del paciente a una membresía profesional concreta y finalidad.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| patient_id | uuid | no | sin default |  → clinical.patient_records.id | Referencia a clinical.patient_records.id |
| membership_id | uuid | no | sin default |  → clinical.clinic_memberships.id | Referencia a clinical.clinic_memberships.id |
| purpose | text | no | sin default |  | purpose |
| policy_version | text | no | sin default |  | policy version |
| granted_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |
| expires_at | timestamptz | no | sin default |  | expires at |
| revoked_at | timestamptz | sí | sin default |  | revoked at |
| scope_mode | text | no | 'selected_encounters' |  | MVP: solo selected_encounters |


**Restricciones:** Paciente emisor se deriva de Auth, no del cuerpo. expires_at > granted_at; revoked_at NULL o >=granted_at. No otorgar acceso a otra clínica por cambiar contexto; default sin recursos = sin acceso. No concede escritura.

**Índices:** patient_id,membership_id,expires_at; parcial patient_id,membership_id WHERE revoked_at IS NULL

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinical_grant_resources

**Estado:** Propuesta. Atenciones concretas incluidas en una concesión; evita compartir futuros registros automáticamente.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| grant_id | uuid | no | sin default | PK compuesto → clinical.clinical_access_grants.id | Referencia a clinical.clinical_access_grants.id |
| encounter_id | uuid | no | sin default | PK compuesto → clinical.clinical_encounters.id | Referencia a clinical.clinical_encounters.id |


**Restricciones:** PK(grant_id,encounter_id); comprobar mismo paciente entre concesión y atención en función autorizada y constraint trigger propuesto. No aceptar una atención ajena.

**Índices:** PK grant_id,encounter_id; encounter_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## clinical.clinical_access_audit

**Estado:** Propuesta. Registro permitido/denegado y de concesión/revocación sin copiar historial.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| request_id | uuid | no | sin default |  | request id |
| actor_user_id | uuid | sí | sin default |  → auth.users.id | Referencia a auth.users.id |
| patient_id | uuid | sí | sin default |  → clinical.patient_records.id | Referencia a clinical.patient_records.id |
| membership_id | uuid | sí | sin default |  → clinical.clinic_memberships.id | Referencia a clinical.clinic_memberships.id |
| grant_id | uuid | sí | sin default |  → clinical.clinical_access_grants.id | Referencia a clinical.clinical_access_grants.id |
| operation | text | no | sin default |  | history_read, document_read, grant, revoke |
| outcome | text | no | sin default |  | allowed, denied, error |
| reason_code | text | no | sin default |  | reason code |
| occurred_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** Sin FK al paciente solicitado inexistente: guardar NULL y razón genérica; no registrar identificadores arbitrarios de URL como FK válida. request_id no reemplaza id: múltiples eventos por solicitud. Sin texto clínico ni IP por defecto. Auditoría no editable por consultante.

**Índices:** patient_id,occurred_at DESC; actor_user_id,occurred_at DESC; request_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.dataset_versions

**Estado:** Propuesta. Origen, licencia y partición de un dataset de investigación.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| name | text | no | sin default |  | name |
| version | text | no | sin default |  | version |
| source_uri | text | no | sin default |  | source uri |
| license | text | no | sin default |  | license |
| permission_reference | text | no | sin default |  | permission reference |
| manifest_sha256 | text | no | sin default |  | manifest sha256 |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** UNIQUE(name,version). Permisos de entrenamiento separados del consentimiento fotográfico. URI del manifiesto, no datos personales.

**Índices:** UNIQUE name,version

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.dataset_items

**Estado:** Propuesta. Ítem seudonimizado con etiqueta y split congelado.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| dataset_id | uuid | no | sin default |  → ml.dataset_versions.id | Referencia a ml.dataset_versions.id |
| subject_key | text | no | sin default |  | subject key |
| object_reference | text | no | sin default |  | object reference |
| image_sha256 | text | no | sin default |  | image sha256 |
| label | text | no | sin default |  | label |
| split | text | no | sin default |  | train, validation, test |


**Restricciones:** UNIQUE(dataset_id,image_sha256). Un subject_key solo puede estar en un split de cada versión; validación agregada del manifiesto antes de congelar. No relacionar subject_key con Auth ni reciclar fotos del MVP.

**Índices:** UNIQUE dataset_id,image_sha256; dataset_id,subject_key,split

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.model_versions

**Estado:** Propuesta. Artefacto de modelo exploratorio y preprocesamiento reproducible.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| dataset_id | uuid | no | sin default |  → ml.dataset_versions.id | Referencia a ml.dataset_versions.id |
| name | text | no | sin default |  | name |
| version | text | no | sin default |  | version |
| artifact_uri | text | no | sin default |  | artifact uri |
| artifact_sha256 | text | no | sin default |  | artifact sha256 |
| preprocessing_version | text | no | sin default |  | preprocessing version |
| code_commit | text | no | sin default |  | code commit |
| status | text | no | 'draft' |  | Estado: draft, evaluated, retired |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** UNIQUE(name,version). Estado evaluated requiere evaluación real y límites; no significa validación clínica. Artefacto firmado/hash verificado antes de cargar.

**Índices:** UNIQUE name,version

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.analysis_authorizations

**Estado:** Propuesta. Autorización explícita propuesta para análisis de una fotografía, distinta del almacenamiento y del entrenamiento.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| owner_user_id | uuid | no | sin default |  → auth.users.id | Referencia a auth.users.id |
| photo_id | uuid | no | sin default |  → public.dental_photos.id | Referencia a public.dental_photos.id |
| purpose | text | no | 'exploratory_image_analysis' |  | purpose |
| policy_version | text | no | sin default |  | policy version |
| consent_text | text | no | sin default |  | consent text |
| granted_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |
| expires_at | timestamptz | no | sin default |  | expires at |
| revoked_at | timestamptz | sí | sin default |  | revoked at |


**Restricciones:** purpose solo exploratory_image_analysis; expires_at>granted_at y revoked_at NULL o >=granted_at. Comprobar foto del mismo propietario. No autoriza entrenamiento ni acceso profesional. Texto/política requieren revisión antes de usar datos personales.

**Índices:** owner_user_id,photo_id,expires_at; parcial photo_id WHERE revoked_at IS NULL

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.analysis_jobs

**Estado:** Propuesta. Trabajo futuro de análisis de una foto, sujeto a finalidad autorizada aparte.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| photo_id | uuid | no | sin default |  → public.dental_photos.id | Referencia a public.dental_photos.id |
| model_id | uuid | no | sin default |  → ml.model_versions.id | Referencia a ml.model_versions.id |
| owner_user_id | uuid | no | sin default |  → auth.users.id | Referencia a auth.users.id |
| authorization_id | uuid | no | sin default |  → ml.analysis_authorizations.id | Referencia a ml.analysis_authorizations.id |
| idempotency_key | uuid | no | sin default |  | idempotency key |
| status | text | no | 'queued' |  | Estado: queued, processing, succeeded, failed, cancelled |
| error_code | text | sí | sin default |  | error code |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |
| finished_at | timestamptz | sí | sin default |  | finished at |


**Restricciones:** UNIQUE(owner_user_id,idempotency_key). Verificar mismo propietario/foto/autorización vigente; deshabilitado hasta implementar y revisar autorización específica. Revalidar antes de procesar y devolver; revocación cancela queued y evita nuevas respuestas, con límites del procesamiento en curso documentados.

**Índices:** UNIQUE owner_user_id,idempotency_key; status,created_at; photo_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.analysis_results

**Estado:** Propuesta. Resultado orientativo persistido solo si existe ejecución real.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| job_id | uuid | no | sin default |  → ml.analysis_jobs.id | Referencia a ml.analysis_jobs.id |
| label | text | no | sin default |  | label |
| score | numeric | sí | sin default |  | score |
| limitations | text | no | sin default |  | limitations |
| disclaimer_version | text | no | sin default |  | disclaimer version |
| quality_status | text | no | sin default |  | usable, not_evaluable |
| created_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** UNIQUE(job_id); score NULL o [0,1], no probabilidad clínica calibrada implícita. not_evaluable no devuelve hallazgos inventados.

**Índices:** UNIQUE job_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.educational_recommendations

**Estado:** Propuesta. Catálogo versionado de recomendaciones explicables revisables.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| code | text | no | sin default |  | code |
| version | text | no | sin default |  | version |
| text | text | no | sin default |  | text |
| source_reference | text | no | sin default |  | source reference |
| review_status | text | no | 'draft' |  | draft, reviewed, retired |


**Restricciones:** UNIQUE(code,version). Fuente y revisión profesional registradas antes de publicitar respaldo clínico.

**Índices:** UNIQUE code,version

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.result_recommendations

**Estado:** Propuesta. Relación de resultado y recomendación con motivo explicable.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| result_id | uuid | no | sin default | PK compuesto → ml.analysis_results.id | Referencia a ml.analysis_results.id |
| recommendation_id | uuid | no | sin default | PK compuesto → ml.educational_recommendations.id | Referencia a ml.educational_recommendations.id |
| reason | text | no | sin default |  | reason |


**Restricciones:** PK(result_id,recommendation_id). Motivo basado en salida disponible, nunca diagnóstico autónomo.

**Índices:** PK result_id,recommendation_id

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.evaluation_runs

**Estado:** Propuesta. Ejecución reproducible de evaluación, independiente de inferencia de un paciente.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK | Identificador estable generado por el servidor |
| model_id | uuid | no | sin default |  → ml.model_versions.id | Referencia a ml.model_versions.id |
| dataset_id | uuid | no | sin default |  → ml.dataset_versions.id | Referencia a ml.dataset_versions.id |
| split | text | no | 'test' |  | split |
| sample_size | integer | no | sin default |  | sample size |
| config | jsonb | no | sin default |  | config |
| artifact_reference | text | no | sin default |  | artifact reference |
| executed_at | timestamptz | no | now() |  | Instante UTC registrado por el servidor |


**Restricciones:** sample_size>0; dataset/split de evaluación declarado y sin fuga; registrar hardware/semilla/config sin secretos.

**Índices:** model_id,executed_at DESC

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.

## ml.evaluation_metrics

**Estado:** Propuesta. Métrica por clase/promedio y matriz de confusión de una ejecución.
| Columna | Tipo PostgreSQL | NULL | Default | Clave / FK | Descripción |
|---|---|---|---|---|---|
| run_id | uuid | no | sin default | PK compuesto → ml.evaluation_runs.id | Referencia a ml.evaluation_runs.id |
| name | text | no | sin default | PK compuesto | precision, recall, f1, confusion_matrix |
| label | text | no | 'aggregate' | PK compuesto | label |
| value | numeric | sí | sin default |  | value |
| matrix | jsonb | sí | sin default |  | matrix |


**Restricciones:** PK(run_id,name,label). Métricas escalares con value [0,1] y matrix NULL; confusion_matrix con matrix de conteos >=0 y value NULL. No fabricar métricas.

**Índices:** PK run_id,name,label

**Conservación:** RESTRICT: sin borrado en cascada del historial. Retención y anonimización requieren política aprobada.
