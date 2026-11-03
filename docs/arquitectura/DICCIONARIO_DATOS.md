# Diccionario de datos revisado

Fuente única: [MODELO_DATOS.json](MODELO_DATOS.json). **29 tablas, 219 columnas**: las 214 originales revisadas y cinco adiciones justificadas (dos razones de corrección y tres campos de lease). No se aplicó ninguna modificación remota.

Los tipos, NULL y defaults de las cinco tablas existentes se conservan según catálogo. Los estados y límites nuevos son una propuesta explícita pendiente de acuerdo del equipo. RLS/GRANT no se deducen de una FK. La lectura de contenido clínico exige auditoría, incluso para su propietario.

## public.profiles

Perfil personal editable, distinto de identidad Auth y autorización.

**Estado:** Existente en Supabase; fase `existente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | — | PK; id → auth.users(id) | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| full_name | text | no | — | ;  | Dato de Perfil personal editable, distinto de identidad Auth y autorización: full name. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**Restricciones observadas:** CHECK (((length(btrim(full_name)) >= 2) AND (length(btrim(full_name)) <= 120))); FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; PRIMARY KEY (id)

**Índices observados:** CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)

- FK `(id) → auth.users(id)`; ON DELETE CASCADE.

**Conservación:** Auth ON DELETE CASCADE. Solo perfil básico propio; no conserva datos clínicos ni roles.

## public.dentists

Ficha pública del directorio académico; no acredita cuenta profesional.

**Estado:** Existente en Supabase; fase `existente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| slug | text | no | — | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: slug. |
| name | text | no | — | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: name. |
| specialty | text | no | — | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: specialty. |
| district | text | no | — | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: district. |
| consultation_price | numeric | no | — | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: consultation price. |
| currency | text | no | 'PEN'::text | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: currency. |
| initials | text | no | — | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: initials. |
| avatar_color | text | no | — | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: avatar color. |
| description | text | no | — | ;  | Contenido correspondiente a la entidad; los textos clínicos solo se entregan tras auditar. |
| is_demo | boolean | no | true | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: is demo. |
| is_active | boolean | no | true | ;  | Dato de Ficha pública del directorio académico; no acredita cuenta profesional: is active. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (slug).

**Restricciones observadas:** CHECK ((consultation_price >= (0)::numeric)); CHECK ((currency = 'PEN'::text)); CHECK (is_demo); PRIMARY KEY (id); UNIQUE (slug)

**Índices observados:** CREATE INDEX dentists_district_specialty_idx ON public.dentists USING btree (district, specialty); CREATE UNIQUE INDEX dentists_pkey ON public.dentists USING btree (id); CREATE UNIQUE INDEX dentists_slug_key ON public.dentists USING btree (slug)


**Conservación:** Sin FK a Auth. Las solicitudes referencian la ficha con NO ACTION; desactivar evita borrar procedencia. CHECK is_demo sigue vigente.

## public.appointment_requests

Solicitudes académicas; no son citas confirmadas ni historia clínica.

**Estado:** Existente en Supabase; fase `existente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| user_id | uuid | no | auth.uid() | ; user_id → auth.users(id) | Identidad común de Supabase Auth; nunca un correo ni un identificador de clínica. |
| dentist_id | uuid | no | — | ; dentist_id → public.dentists(id) | Ficha pública destinataria de la solicitud académica; no identifica clínica de atención. |
| contact_name | text | no | — | ;  | Dato de Solicitudes académicas; no son citas confirmadas ni historia clínica: contact name. |
| contact_email | text | no | — | ;  | Dato de Solicitudes académicas; no son citas confirmadas ni historia clínica: contact email. |
| preferred_date | date | no | — | ;  | Dato de Solicitudes académicas; no son citas confirmadas ni historia clínica: preferred date. |
| preferred_time | time | sí | — | ;  | Dato de Solicitudes académicas; no son citas confirmadas ni historia clínica: preferred time. |
| message | text | no | ''::text | ;  | Dato de Solicitudes académicas; no son citas confirmadas ni historia clínica: message. |
| status | text | no | 'requested'::text | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| is_demo | boolean | no | true | ;  | Dato de Solicitudes académicas; no son citas confirmadas ni historia clínica: is demo. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**Restricciones observadas:** CHECK (((length(contact_email) <= 254) AND (contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text))); CHECK (((length(btrim(contact_name)) >= 2) AND (length(btrim(contact_name)) <= 120))); FOREIGN KEY (dentist_id) REFERENCES dentists(id); CHECK (is_demo); CHECK ((length(message) <= 1000)); PRIMARY KEY (id); CHECK ((status = ANY (ARRAY['requested'::text, 'cancelled'::text]))); FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

**Índices observados:** CREATE INDEX appointment_requests_dentist_idx ON public.appointment_requests USING btree (dentist_id); CREATE UNIQUE INDEX appointment_requests_pkey ON public.appointment_requests USING btree (id); CREATE INDEX appointment_requests_user_idx ON public.appointment_requests USING btree (user_id, created_at DESC)

- FK `(user_id) → auth.users(id)`; ON DELETE CASCADE.
- FK `(dentist_id) → public.dentists(id)`; ON DELETE NO ACTION.

**Conservación:** Auth ON DELETE CASCADE; dentist_id ON DELETE NO ACTION. Solicitud académica, no atención clínica.

## public.patient_consents

Consentimiento exclusivo de almacenamiento académico de fotos.

**Estado:** Existente en Supabase; fase `existente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| user_id | uuid | no | auth.uid() | ; user_id → auth.users(id) | Identidad común de Supabase Auth; nunca un correo ni un identificador de clínica. |
| policy_version | text | no | — | ;  | Versión de finalidad/texto aprobada por el equipo antes de habilitar el servicio. |
| consent_text | text | no | — | ;  | Dato de Consentimiento exclusivo de almacenamiento académico de fotos: consent text. |
| purpose | text | no | 'academic_photo_storage'::text | ;  | Finalidad expresa de esta autorización; no se amplía por conveniencia de otro módulo. |
| accepted_at | timestamptz | no | now() | ;  | Dato de Consentimiento exclusivo de almacenamiento académico de fotos: accepted at. |
| revoked_at | timestamptz | sí | — | ;  | Revocación irreversible para este registro; NULL solo significa no revocado, no vigencia garantizada. |

**PK:** `id`. **UNIQUE:** (user_id,id).

**Restricciones observadas:** CHECK (((revoked_at IS NULL) OR (revoked_at >= accepted_at))); CHECK (((length(btrim(consent_text)) >= 20) AND (length(btrim(consent_text)) <= 5000))); PRIMARY KEY (id); CHECK (((length(btrim(policy_version)) >= 1) AND (length(btrim(policy_version)) <= 80))); CHECK ((purpose = 'academic_photo_storage'::text)); FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; UNIQUE (user_id, id)

**Índices observados:** CREATE UNIQUE INDEX patient_consents_pkey ON public.patient_consents USING btree (id); CREATE UNIQUE INDEX patient_consents_user_id_id_key ON public.patient_consents USING btree (user_id, id); CREATE INDEX patient_consents_user_idx ON public.patient_consents USING btree (user_id)

- FK `(user_id) → auth.users(id)`; ON DELETE CASCADE.

**Conservación:** Auth ON DELETE CASCADE; una foto impide borrar su consentimiento por FK NO ACTION mientras exista. Revocar no equivale a borrar.

## public.dental_photos

Metadatos de objetos privados, no el binario.

**Estado:** Existente en Supabase; fase `existente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| user_id | uuid | no | auth.uid() | ; user_id → auth.users(id); user_id,consent_id → public.patient_consents(user_id,id) | Identidad común de Supabase Auth; nunca un correo ni un identificador de clínica. |
| consent_id | uuid | no | — | ; user_id,consent_id → public.patient_consents(user_id,id) | Dato de Metadatos de objetos privados, no el binario: consent id. |
| bucket_id | text | no | 'dental-photos'::text | ;  | Identificador del bucket privado; no es una autorización de lectura. |
| object_path | text | no | — | ;  | Clave de objeto privado, nunca URL pública ni URL firmada persistida. |
| original_filename | text | no | — | ;  | Dato de Metadatos de objetos privados, no el binario: original filename. |
| mime_type | text | no | — | ;  | Tipo permitido verificado por contenido además de extensión/metadata. |
| size_bytes | bigint | no | — | ;  | Tamaño entero positivo; se valida también contra el archivo real. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (object_path).

**Restricciones observadas:** CHECK ((bucket_id = 'dental-photos'::text)); CHECK (((object_path ~~ ((((user_id)::text || '/'::text) || (consent_id)::text) || '/%'::text)) AND (length(split_part(object_path, '/'::text, 3)) > 0))); CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]))); UNIQUE (object_path); CHECK (((length(original_filename) >= 1) AND (length(original_filename) <= 255))); PRIMARY KEY (id); CHECK (((size_bytes >= 1) AND (size_bytes <= 8388608))); FOREIGN KEY (user_id, consent_id) REFERENCES patient_consents(user_id, id); FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

**Índices observados:** CREATE UNIQUE INDEX dental_photos_object_path_key ON public.dental_photos USING btree (object_path); CREATE UNIQUE INDEX dental_photos_pkey ON public.dental_photos USING btree (id); CREATE INDEX dental_photos_user_consent_idx ON public.dental_photos USING btree (user_id, consent_id)

**Clave candidata solo propuesta para IA:** [['id', 'user_id']]. No existe en el catálogo observado; se añade únicamente en el borrador 06 para la FK compuesta de propietario.

- FK `(user_id) → auth.users(id)`; ON DELETE CASCADE.
- FK `(user_id,consent_id) → public.patient_consents(user_id,id)`; ON DELETE NO ACTION.

**Conservación:** Auth ON DELETE CASCADE; consentimiento compuesto ON DELETE NO ACTION. Borrar metadatos no borra Storage; conservar el algoritmo reintentable actual.

## dentaia_admin.revisiones_roles

Versión para concurrencia del protocolo de roles; ya definida en migración de rama, ausente remotamente.

**Estado:** Migración en rama; no aplicada; fase `administrativa_pendiente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| usuario_id | uuid | no | — | PK;  | Dato de Versión para concurrencia del protocolo de roles; ya definida en migración de rama, ausente remotamente: usuario id. |
| revision | integer | no | — | ;  | Versión monotónica de asignación; no se reutiliza como rol canónico. |

**PK:** `usuario_id`. **UNIQUE:** ninguna adicional.

**CHECK:** revision >= 0.

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.


**Conservación:** Sin FK a Auth por decisión de DI-151: la baja de una cuenta no borra la evidencia. Sin UPDATE/DELETE ordinarios de auditoría; revisión y aprobación solo por el protocolo existente. No se inventa una FK RESTRICT.

## dentaia_admin.aprobaciones_roles

Aprobación independiente de una transición exacta.

**Estado:** Migración en rama; no aplicada; fase `administrativa_pendiente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | — | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| actor_id | uuid | no | — | ;  | Identidad del actor validado; el cliente no la elige como autoridad. |
| objetivo_id | uuid | no | — | ;  | Dato de Aprobación independiente de una transición exacta: objetivo id. |
| aprobado_por | uuid | no | — | ;  | Aprobador independiente de actor y objetivo; no habilita autoaprobación. |
| operacion | text | no | — | ;  | asignar o revocar |
| rol | text | no | — | ;  | paciente, odontologo o superusuario |
| revision_esperada | integer | no | — | ;  | Versión aprobada/esperada para detectar conflictos; no un permiso del cliente. |
| asignacion_esperada | jsonb | sí | — | ;  | Snapshot mínimo del namespace DentaIA para comparación; no credenciales ni metadata completa. |
| creada_en | timestamptz | no | clock_timestamp() | ;  | Dato de Aprobación independiente de una transición exacta: creada en. |
| vence_en | timestamptz | no | — | ;  | Dato de Aprobación independiente de una transición exacta: vence en. |
| consumida_por | uuid | sí | — | ;  | Solicitud que consumió la aprobación; NULL antes de su uso. |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**CHECK:** operacion IN ('asignar','revocar'); rol IN ('paciente','odontologo','superusuario'); revision_esperada >= 0; aprobado_por <> actor_id AND aprobado_por <> objetivo_id AND actor_id <> objetivo_id; vence_en > creada_en.

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.


**Conservación:** Sin FK a Auth por decisión de DI-151: la baja de una cuenta no borra la evidencia. Sin UPDATE/DELETE ordinarios de auditoría; revisión y aprobación solo por el protocolo existente. No se inventa una FK RESTRICT.

## dentaia_admin.auditoria_roles

Evento mínimo durable del protocolo de roles.

**Estado:** Migración en rama; no aplicada; fase `administrativa_pendiente`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| actor_id | uuid | no | — | PK compuesto;  | Identidad del actor validado; el cliente no la elige como autoridad. |
| solicitud_id | uuid | no | — | PK compuesto;  | Dato de Evento mínimo durable del protocolo de roles: solicitud id. |
| objetivo_id | uuid | no | — | ;  | Dato de Evento mínimo durable del protocolo de roles: objetivo id. |
| aprobacion_id | uuid | no | — | ;  | Aprobación exacta y de un solo uso de la transición. |
| peticion | jsonb | no | — | ;  | Entrada mínima de la transición auditada, sin secretos ni contenido clínico. |
| anterior | jsonb | sí | — | ;  | Snapshot mínimo previo del rol, no del usuario Auth completo. |
| posterior | jsonb | sí | — | ;  | Snapshot mínimo confirmado después de la transición. |
| resultado | jsonb | no | — | ;  | Resultado estable del intento; una respuesta HTTP perdida no prueba rollback. |
| registrada_en | timestamptz | no | clock_timestamp() | ;  | Dato de Evento mínimo durable del protocolo de roles: registrada en. |

**PK:** `actor_id, solicitud_id`. **UNIQUE:** ninguna adicional.

**CHECK:** sin CHECK adicionales en la migración existente.

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.


**Conservación:** Sin FK a Auth por decisión de DI-151: la baja de una cuenta no borra la evidencia. Sin UPDATE/DELETE ordinarios de auditoría; revisión y aprobación solo por el protocolo existente. No se inventa una FK RESTRICT.

## clinical.clinics

Organización clínica dentro de DentaIA, sin integración externa implícita.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| name | text | no | — | ;  | Dato de Organización clínica dentro de DentaIA, sin integración externa implícita: name. |
| location | text | sí | — | ;  | Dato de Organización clínica dentro de DentaIA, sin integración externa implícita: location. |
| status | text | no | 'active' | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**CHECK:** length(btrim(name)) BETWEEN 1 AND 200; status IN ('active','inactive'); location IS NULL OR length(location) <= 300.

**Índices recomendados adicionales:** (status, name).


**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.professional_accounts

Vincula una identidad Auth con una única ficha existente de odontólogo; no duplica su nombre público.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| user_id | uuid | no | — | ; user_id → auth.users(id) | Identidad común de Supabase Auth; nunca un correo ni un identificador de clínica. |
| dentist_id | uuid | sí | — | ; dentist_id → public.dentists(id) | Referencia a la ficha pública única; puede estar ausente antes de publicar al profesional. |
| status | text | no | 'pending' | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (user_id); (dentist_id).

**CHECK:** status IN ('pending','verified','suspended').

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.

- FK `(user_id) → auth.users(id)`; ON DELETE RESTRICT.
- FK `(dentist_id) → public.dentists(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.professional_verifications

Historial de revisión profesional con acceso restringido.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| professional_id | uuid | no | — | ; professional_id → clinical.professional_accounts(id) | Perfil profesional vinculado de forma única a Auth; no es un rol por sí mismo. |
| reviewed_by | uuid | no | — | ; reviewed_by → auth.users(id) | Referencia a auth.users.id |
| decision | text | no | — | ;  | verified, rejected, revoked |
| reference | text | no | — | ;  | Referencia protegida del expediente de verificación; sin publicar documentos |
| reason | text | no | — | ;  | Dato de Historial de revisión profesional con acceso restringido: reason. |
| reviewed_at | timestamptz | no | now() | ;  | Instante UTC registrado por el servidor |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**CHECK:** decision IN ('approved','rejected'); length(btrim(reference)) BETWEEN 1 AND 300; length(btrim(reason)) BETWEEN 1 AND 1000.

**Índices recomendados adicionales:** (professional_id, reviewed_at DESC, id); (reviewed_by).

- FK `(professional_id) → clinical.professional_accounts(id)`; ON DELETE RESTRICT.
- FK `(reviewed_by) → auth.users(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.clinic_memberships

Pertenencia de profesional a clínica, independiente del permiso del paciente.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| clinic_id | uuid | no | — | ; clinic_id → clinical.clinics(id) | Clínica a la que pertenece esta membresía, no la clínica activa enviada libremente por la UI. |
| professional_id | uuid | no | — | ; professional_id → clinical.professional_accounts(id) | Perfil profesional vinculado de forma única a Auth; no es un rol por sí mismo. |
| status | text | no | 'active' | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| valid_from | timestamptz | no | now() | ;  | Inicio del episodio de membresía; las pertenencias futuras no autorizan acceso actual. |
| valid_until | timestamptz | sí | — | ;  | Fin exclusivo del episodio; NULL representa un intervalo abierto. |

**PK:** `id`. **UNIQUE:** (clinic_id,professional_id,valid_from).

**CHECK:** status IN ('active','inactive','suspended'); valid_until IS NULL OR valid_until > valid_from.

**Índices recomendados adicionales:** (professional_id, status).

- FK `(clinic_id) → clinical.clinics(id)`; ON DELETE RESTRICT.
- FK `(professional_id) → clinical.professional_accounts(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

**Exclusión:** sin solapamiento de rangos activos para el mismo profesional/clínica; btree_gist requerido. Identidad y origen no se reasignan.

## clinical.patient_records

Identificador estable del paciente entre clínicas; nombre personal se obtiene de profiles.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| user_id | uuid | no | — | ; user_id → auth.users(id) | Identidad común de Supabase Auth; nunca un correo ni un identificador de clínica. |
| status | text | no | 'active' | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (user_id).

**CHECK:** status IN ('active','archived').

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.

- FK `(user_id) → auth.users(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.clinical_encounters

Atención con paciente, clínica de origen y profesional responsable.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| patient_id | uuid | no | — | ; patient_id → clinical.patient_records(id); replaces_id,patient_id,membership_id → clinical.clinical_encounters(id,patient_id,membership_id) | Identificador clínico único del paciente, distinto de auth.users.id. |
| membership_id | uuid | no | — | ; membership_id → clinical.clinic_memberships(id); replaces_id,patient_id,membership_id → clinical.clinical_encounters(id,patient_id,membership_id) | Contexto de profesional y clínica; su identidad no se reasigna a otra persona o sede. |
| attended_at | timestamptz | no | — | ;  | Instante de la atención de origen; no se reemplaza por el instante de carga. |
| recorded_at | timestamptz | no | now() | ;  | Fecha de incorporación del registro al sistema, separada de la fecha asistencial. |
| status | text | no | 'recorded' | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| replaces_id | uuid | sí | — | ; replaces_id,patient_id,membership_id → clinical.clinical_encounters(id,patient_id,membership_id) | Versión anterior del mismo origen; UNIQUE impide bifurcaciones y la relación compuesta impide cambiar de paciente. |
| correction_reason | text | sí | — | ;  | Justificación obligatoria de una corrección; sin contenido en un registro inicial. |

**PK:** `id`. **UNIQUE:** (id,patient_id,membership_id); (replaces_id).

**CHECK:** status IN ('recorded','voided'); replaces_id IS NULL OR replaces_id <> id; (replaces_id IS NULL AND correction_reason IS NULL) OR (replaces_id IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 1 AND 1000 AND correction_reason IS NOT NULL); status <> 'voided' OR replaces_id IS NOT NULL.

**Índices recomendados adicionales:** (patient_id, attended_at DESC, id DESC); (membership_id).

- FK `(patient_id) → clinical.patient_records(id)`; ON DELETE RESTRICT.
- FK `(membership_id) → clinical.clinic_memberships(id)`; ON DELETE RESTRICT.
- FK `(replaces_id,patient_id,membership_id) → clinical.clinical_encounters(id,patient_id,membership_id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.clinical_entries

Antecedente, diagnóstico o tratamiento registrado por profesional; sin inferencia automática.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| encounter_id | uuid | no | — | ; encounter_id → clinical.clinical_encounters(id); replaces_id,encounter_id,kind → clinical.clinical_entries(id,encounter_id,kind) | Atención de origen de esta información; no equivale a una solicitud de demostración. |
| kind | text | no | — | ; replaces_id,encounter_id,kind → clinical.clinical_entries(id,encounter_id,kind) | background, diagnosis, treatment |
| information_state | text | no | — | ;  | Distingue dato registrado, desconocido y no registrado; no inventa contenido. |
| description | text | sí | — | ;  | Contenido correspondiente a la entidad; los textos clínicos solo se entregan tras auditar. |
| code_system | text | sí | — | ;  | Dato de Antecedente, diagnóstico o tratamiento registrado por profesional; sin inferencia automática: code system. |
| code | text | sí | — | ;  | Dato de Antecedente, diagnóstico o tratamiento registrado por profesional; sin inferencia automática: code. |
| recorded_at | timestamptz | no | now() | ;  | Fecha de incorporación del registro al sistema, separada de la fecha asistencial. |
| replaces_id | uuid | sí | — | ; replaces_id,encounter_id,kind → clinical.clinical_entries(id,encounter_id,kind) | Versión anterior del mismo origen; UNIQUE impide bifurcaciones y la relación compuesta impide cambiar de paciente. |
| correction_reason | text | sí | — | ;  | Justificación obligatoria de una corrección; sin contenido en un registro inicial. |

**PK:** `id`. **UNIQUE:** (id,encounter_id,kind); (replaces_id).

**CHECK:** kind IN ('background','diagnosis','treatment'); information_state IN ('recorded','unknown','not_recorded'); (information_state = 'recorded' AND description IS NOT NULL AND length(btrim(description)) BETWEEN 1 AND 10000) OR (information_state <> 'recorded' AND description IS NULL AND code IS NULL AND code_system IS NULL); (code IS NULL) = (code_system IS NULL); replaces_id IS NULL OR replaces_id <> id; (replaces_id IS NULL AND correction_reason IS NULL) OR (replaces_id IS NOT NULL AND correction_reason IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 1 AND 1000).

**Índices recomendados adicionales:** (encounter_id, kind, recorded_at DESC).

- FK `(encounter_id) → clinical.clinical_encounters(id)`; ON DELETE RESTRICT.
- FK `(replaces_id,encounter_id,kind) → clinical.clinical_entries(id,encounter_id,kind)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.clinical_documents

Examen o documento de una atención, con procedencia y referencia privada.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| encounter_id | uuid | no | — | ; encounter_id → clinical.clinical_encounters(id) | Atención de origen de esta información; no equivale a una solicitud de demostración. |
| kind | text | no | — | ;  | exam, document |
| title | text | no | — | ;  | Dato de Examen o documento de una atención, con procedencia y referencia privada: title. |
| exam_date | date | sí | — | ;  | Dato de Examen o documento de una atención, con procedencia y referencia privada: exam date. |
| availability | text | no | — | ;  | available, unavailable |
| bucket_id | text | sí | — | ;  | Identificador del bucket privado; no es una autorización de lectura. |
| object_path | text | sí | — | ;  | Clave de objeto privado, nunca URL pública ni URL firmada persistida. |
| mime_type | text | sí | — | ;  | Tipo permitido verificado por contenido además de extensión/metadata. |
| size_bytes | bigint | sí | — | ;  | Tamaño entero positivo; se valida también contra el archivo real. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (bucket_id,object_path).

**CHECK:** kind IN ('exam','document'); length(btrim(title)) BETWEEN 1 AND 200; availability IN ('available','unavailable'); (availability = 'available' AND bucket_id = 'dentaia-clinical-documents' AND object_path IS NOT NULL AND mime_type IN ('application/pdf','image/jpeg','image/png','image/webp') AND size_bytes BETWEEN 1 AND 8388608 AND bucket_id IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL) OR (availability = 'unavailable' AND bucket_id IS NULL AND object_path IS NULL AND mime_type IS NULL AND size_bytes IS NULL); object_path IS NULL OR (length(object_path) BETWEEN 1 AND 512 AND object_path !~ '(^|/)\.\.?(/|$)').

**Índices recomendados adicionales:** (encounter_id, exam_date DESC).

- FK `(encounter_id) → clinical.clinical_encounters(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.clinical_access_grants

Concesión del paciente a una membresía profesional concreta y finalidad.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| patient_id | uuid | no | — | ; patient_id → clinical.patient_records(id) | Identificador clínico único del paciente, distinto de auth.users.id. |
| membership_id | uuid | no | — | ; membership_id → clinical.clinic_memberships(id) | Contexto de profesional y clínica; su identidad no se reasigna a otra persona o sede. |
| purpose | text | no | — | ;  | Finalidad expresa de esta autorización; no se amplía por conveniencia de otro módulo. |
| policy_version | text | no | — | ;  | Versión de finalidad/texto aprobada por el equipo antes de habilitar el servicio. |
| granted_at | timestamptz | no | now() | ;  | Momento de concesión por el propietario autenticado, no proporcionado por un tercero. |
| expires_at | timestamptz | no | — | ;  | Límite de vigencia; se comprueba con el reloj del servidor. |
| revoked_at | timestamptz | sí | — | ;  | Revocación irreversible para este registro; NULL solo significa no revocado, no vigencia garantizada. |
| scope_mode | text | no | 'selected_encounters' | ;  | MVP: solo selected_encounters |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**CHECK:** expires_at > granted_at; revoked_at IS NULL OR revoked_at >= granted_at; scope_mode = 'selected_encounters'; length(btrim(purpose)) BETWEEN 1 AND 100; length(btrim(policy_version)) BETWEEN 1 AND 80.

**Índices recomendados adicionales:** (patient_id, membership_id, expires_at) WHERE revoked_at IS NULL; (membership_id).

- FK `(patient_id) → clinical.patient_records(id)`; ON DELETE RESTRICT.
- FK `(membership_id) → clinical.clinic_memberships(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.clinical_grant_resources

Atenciones concretas incluidas en una concesión; evita compartir futuros registros automáticamente.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| grant_id | uuid | no | — | PK compuesto; grant_id → clinical.clinical_access_grants(id) | Concesión concreta de lectura del paciente; alcance y vigencia se revalidan en cada acceso. |
| encounter_id | uuid | no | — | PK compuesto; encounter_id → clinical.clinical_encounters(id) | Atención de origen de esta información; no equivale a una solicitud de demostración. |

**PK:** `grant_id, encounter_id`. **UNIQUE:** ninguna adicional.

**CHECK:** sin CHECK adicionales en la migración existente.

**Índices recomendados adicionales:** (encounter_id).

- FK `(grant_id) → clinical.clinical_access_grants(id)`; ON DELETE RESTRICT.
- FK `(encounter_id) → clinical.clinical_encounters(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## clinical.clinical_access_audit

Registro permitido/denegado y de concesión/revocación sin copiar historial.

**Estado:** Propuesta; fase `mvp_sintetico_condicionado`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| request_id | uuid | no | — | ;  | Correlación generada por el servidor; no contiene identificadores clínicos libres. |
| actor_user_id | uuid | sí | — | ; actor_user_id → auth.users(id) | Referencia a auth.users.id |
| patient_id | uuid | sí | — | ; patient_id → clinical.patient_records(id) | Identificador clínico único del paciente, distinto de auth.users.id. |
| membership_id | uuid | sí | — | ; membership_id → clinical.clinic_memberships(id) | Contexto de profesional y clínica; su identidad no se reasigna a otra persona o sede. |
| grant_id | uuid | sí | — | ; grant_id → clinical.clinical_access_grants(id) | Concesión concreta de lectura del paciente; alcance y vigencia se revalidan en cada acceso. |
| operation | text | no | — | ;  | history_read, document_read, grant, revoke |
| outcome | text | no | — | ;  | Resultado allowed/denied/error; la auditoría debe persistir antes de entregar contenido. |
| reason_code | text | no | — | ;  | Código saneado de decisión/error, sin textos de salud ni secretos. |
| occurred_at | timestamptz | no | now() | ;  | Instante UTC registrado por el servidor |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**CHECK:** outcome IN ('allowed','denied','error'); operation IN ('read_history','read_document','grant_access','revoke_access','read_professional_requests','list_authorized_patients','verify_professional','membership_change','register_clinical'); reason_code ~ '^[A-Z][A-Z0-9_]{0,79}$'.

**Índices recomendados adicionales:** (patient_id, occurred_at DESC); (actor_user_id, occurred_at DESC); (request_id); (membership_id); (grant_id).

- FK `(actor_user_id) → auth.users(id)`; ON DELETE RESTRICT.
- FK `(patient_id) → clinical.patient_records(id)`; ON DELETE RESTRICT.
- FK `(membership_id) → clinical.clinic_memberships(id)`; ON DELETE RESTRICT.
- FK `(grant_id) → clinical.clinical_access_grants(id)`; ON DELETE RESTRICT.

**Conservación:** RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.

## ml.dataset_versions

Origen, licencia y partición de un dataset de investigación.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| name | text | no | — | ;  | Dato de Origen, licencia y partición de un dataset de investigación: name. |
| version | text | no | — | ;  | Dato de Origen, licencia y partición de un dataset de investigación: version. |
| source_uri | text | no | — | ;  | Dato de Origen, licencia y partición de un dataset de investigación: source uri. |
| license | text | no | — | ;  | Dato de Origen, licencia y partición de un dataset de investigación: license. |
| permission_reference | text | no | — | ;  | Dato de Origen, licencia y partición de un dataset de investigación: permission reference. |
| manifest_sha256 | text | no | — | ;  | Dato de Origen, licencia y partición de un dataset de investigación: manifest sha256. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (name,version).

**CHECK:** length(btrim(name)) BETWEEN 1 AND 120; length(btrim(version)) BETWEEN 1 AND 80; manifest_sha256 ~ '^[0-9a-f]{64}$'; length(btrim(source_uri)) > 0; length(btrim(license)) > 0; length(btrim(permission_reference)) > 0.

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.


**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.dataset_items

Ítem seudonimizado con etiqueta y split congelado.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| dataset_id | uuid | no | — | ; dataset_id → ml.dataset_versions(id) | Versión reproducible del dataset; no fotografías personales reutilizadas automáticamente. |
| subject_key | text | no | — | ;  | Pseudónimo exclusivo del dataset; no referencia a una persona Auth ni permiso clínico. |
| object_reference | text | no | — | ;  | Dato de Ítem seudonimizado con etiqueta y split congelado: object reference. |
| image_sha256 | text | no | — | ;  | Dato de Ítem seudonimizado con etiqueta y split congelado: image sha256. |
| label | text | no | — | ;  | Clase o etiqueta en el contexto de esta tabla; un resultado no evaluable no tiene hallazgo. |
| split | text | no | — | ;  | Partición del experimento; un mismo sujeto no cruza splits en la misma versión. |

**PK:** `id`. **UNIQUE:** (dataset_id,image_sha256).

**CHECK:** split IN ('train','validation','test'); image_sha256 ~ '^[0-9a-f]{64}$'; length(btrim(subject_key)) BETWEEN 1 AND 128; length(btrim(label)) BETWEEN 1 AND 120; length(btrim(object_reference)) > 0.

**Índices recomendados adicionales:** (dataset_id, subject_key, split).

- FK `(dataset_id) → ml.dataset_versions(id)`; ON DELETE RESTRICT.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

**Exclusión:** `(dataset_id =, subject_key =, split <>)` impide fuga del mismo sujeto entre particiones de una versión, incluso en concurrencia. No demuestra independencia entre datasets distintos.

## ml.model_versions

Artefacto de modelo exploratorio y preprocesamiento reproducible.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| dataset_id | uuid | no | — | ; dataset_id → ml.dataset_versions(id) | Versión reproducible del dataset; no fotografías personales reutilizadas automáticamente. |
| name | text | no | — | ;  | Dato de Artefacto de modelo exploratorio y preprocesamiento reproducible: name. |
| version | text | no | — | ;  | Dato de Artefacto de modelo exploratorio y preprocesamiento reproducible: version. |
| artifact_uri | text | no | — | ;  | Referencia privada al artefacto, sin credenciales embebidas ni URL firmada persistida. |
| artifact_sha256 | text | no | — | ;  | Dato de Artefacto de modelo exploratorio y preprocesamiento reproducible: artifact sha256. |
| preprocessing_version | text | no | — | ;  | Dato de Artefacto de modelo exploratorio y preprocesamiento reproducible: preprocessing version. |
| code_commit | text | no | — | ;  | Dato de Artefacto de modelo exploratorio y preprocesamiento reproducible: code commit. |
| status | text | no | 'draft' | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (name,version).

**CHECK:** status IN ('draft','evaluated','retired'); artifact_sha256 ~ '^[0-9a-f]{64}$'; code_commit ~ '^[0-9a-f]{40}([0-9a-f]{24})?$'; length(btrim(name)) > 0; length(btrim(version)) > 0; length(btrim(preprocessing_version)) > 0; length(btrim(artifact_uri)) > 0.

**Índices recomendados adicionales:** (dataset_id).

- FK `(dataset_id) → ml.dataset_versions(id)`; ON DELETE RESTRICT.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.analysis_authorizations

Autorización explícita propuesta para análisis de una fotografía, distinta del almacenamiento y del entrenamiento.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| owner_user_id | uuid | no | — | ; owner_user_id → auth.users(id); photo_id,owner_user_id → public.dental_photos(id,user_id) | Identidad Auth del propietario; coincide con la fotografía/autorización mediante FK compuesta. |
| photo_id | uuid | no | — | ; photo_id,owner_user_id → public.dental_photos(id,user_id) | Referencia a public.dental_photos.id |
| purpose | text | no | 'exploratory_image_analysis' | ;  | Finalidad expresa de esta autorización; no se amplía por conveniencia de otro módulo. |
| policy_version | text | no | — | ;  | Versión de finalidad/texto aprobada por el equipo antes de habilitar el servicio. |
| consent_text | text | no | — | ;  | Dato de Autorización explícita propuesta para análisis de una fotografía, distinta del almacenamiento y del entrenamiento: consent text. |
| granted_at | timestamptz | no | now() | ;  | Momento de concesión por el propietario autenticado, no proporcionado por un tercero. |
| expires_at | timestamptz | no | — | ;  | Límite de vigencia; se comprueba con el reloj del servidor. |
| revoked_at | timestamptz | sí | — | ;  | Revocación irreversible para este registro; NULL solo significa no revocado, no vigencia garantizada. |

**PK:** `id`. **UNIQUE:** (id,photo_id,owner_user_id).

**CHECK:** purpose = 'exploratory_image_analysis'; expires_at > granted_at; revoked_at IS NULL OR revoked_at >= granted_at; length(btrim(policy_version)) BETWEEN 1 AND 80; length(btrim(consent_text)) BETWEEN 20 AND 5000.

**Índices recomendados adicionales:** (owner_user_id, photo_id, expires_at); (photo_id) WHERE revoked_at IS NULL; (photo_id, owner_user_id).

- FK `(owner_user_id) → auth.users(id)`; ON DELETE CASCADE.
- FK `(photo_id,owner_user_id) → public.dental_photos(id,user_id)`; ON DELETE CASCADE.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.analysis_jobs

Trabajo futuro de análisis de una foto, sujeto a finalidad autorizada aparte.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| photo_id | uuid | no | — | ; photo_id → public.dental_photos(id); authorization_id,photo_id,owner_user_id → ml.analysis_authorizations(id,photo_id,owner_user_id) | Referencia a public.dental_photos.id |
| model_id | uuid | no | — | ; model_id → ml.model_versions(id) | Versión del modelo exploratorio; la evaluación no equivale a validación clínica. |
| owner_user_id | uuid | no | — | ; owner_user_id → auth.users(id); authorization_id,photo_id,owner_user_id → ml.analysis_authorizations(id,photo_id,owner_user_id) | Identidad Auth del propietario; coincide con la fotografía/autorización mediante FK compuesta. |
| authorization_id | uuid | no | — | ; authorization_id,photo_id,owner_user_id → ml.analysis_authorizations(id,photo_id,owner_user_id) | Autorización específica para esa foto y propietario, distinta de almacenamiento o clínica. |
| idempotency_key | uuid | no | — | ;  | Dato de Trabajo futuro de análisis de una foto, sujeto a finalidad autorizada aparte: idempotency key. |
| status | text | no | 'queued' | ;  | Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado. |
| error_code | text | sí | — | ;  | Dato de Trabajo futuro de análisis de una foto, sujeto a finalidad autorizada aparte: error code. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |
| finished_at | timestamptz | sí | — | ;  | Dato de Trabajo futuro de análisis de una foto, sujeto a finalidad autorizada aparte: finished at. |
| lease_id | uuid | sí | — | ;  | Identificador privado de la reserva vigente del trabajador, no expuesto al paciente. |
| lease_expires_at | timestamptz | sí | — | ;  | Vencimiento de la reserva; se revalida antes de completar el trabajo. |
| attempt_count | integer | no | 0 | ;  | Número de reservas intentadas; límite de reintentos por acordar en el trabajador. |

**PK:** `id`. **UNIQUE:** (owner_user_id,idempotency_key).

**CHECK:** status IN ('queued','running','succeeded','failed','cancelled'); attempt_count >= 0; (status = 'running' AND lease_id IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'running' AND lease_id IS NULL AND lease_expires_at IS NULL); (status IN ('succeeded','failed','cancelled')) = (finished_at IS NOT NULL); finished_at IS NULL OR finished_at >= created_at; status <> 'failed' OR error_code IS NOT NULL; error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{0,79}$'.

**Índices recomendados adicionales:** (status, created_at); (photo_id); (model_id); (authorization_id, photo_id, owner_user_id).

- FK `(owner_user_id) → auth.users(id)`; ON DELETE CASCADE.
- FK `(photo_id) → public.dental_photos(id)`; ON DELETE CASCADE.
- FK `(model_id) → ml.model_versions(id)`; ON DELETE RESTRICT.
- FK `(authorization_id,photo_id,owner_user_id) → ml.analysis_authorizations(id,photo_id,owner_user_id)`; ON DELETE CASCADE.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.analysis_results

Resultado orientativo persistido solo si existe ejecución real.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| job_id | uuid | no | — | ; job_id → ml.analysis_jobs(id) | Ejecución concreta; máximo un resultado por trabajo. |
| label | text | sí | — | ;  | Clase o etiqueta en el contexto de esta tabla; un resultado no evaluable no tiene hallazgo. |
| score | numeric | sí | — | ;  | Puntuación exploratoria opcional entre cero y uno, no probabilidad clínica validada. |
| limitations | text | no | — | ;  | Dato de Resultado orientativo persistido solo si existe ejecución real: limitations. |
| disclaimer_version | text | no | — | ;  | Dato de Resultado orientativo persistido solo si existe ejecución real: disclaimer version. |
| quality_status | text | no | — | ;  | Determina si existe salida evaluable; not_evaluable impide inventar clase o score. |
| created_at | timestamptz | no | now() | ;  | Instante de creación persistido en UTC; no implica fecha de atención. |

**PK:** `id`. **UNIQUE:** (job_id).

**CHECK:** quality_status IN ('evaluable','not_evaluable'); score IS NULL OR score BETWEEN 0 AND 1; (quality_status = 'not_evaluable' AND label IS NULL AND score IS NULL) OR (quality_status = 'evaluable' AND label IS NOT NULL AND length(btrim(label)) > 0); length(btrim(limitations)) > 0; length(btrim(disclaimer_version)) > 0.

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.

- FK `(job_id) → ml.analysis_jobs(id)`; ON DELETE CASCADE.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.educational_recommendations

Catálogo versionado de recomendaciones explicables revisables.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| code | text | no | — | ;  | Dato de Catálogo versionado de recomendaciones explicables revisables: code. |
| version | text | no | — | ;  | Dato de Catálogo versionado de recomendaciones explicables revisables: version. |
| text | text | no | — | ;  | Dato de Catálogo versionado de recomendaciones explicables revisables: text. |
| source_reference | text | no | — | ;  | Dato de Catálogo versionado de recomendaciones explicables revisables: source reference. |
| review_status | text | no | 'draft' | ;  | draft, reviewed, retired |

**PK:** `id`. **UNIQUE:** (code,version).

**CHECK:** review_status IN ('draft','reviewed','retired'); length(btrim(code)) > 0; length(btrim(version)) > 0; length(btrim(text)) > 0; length(btrim(source_reference)) > 0.

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.


**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.result_recommendations

Relación de resultado y recomendación con motivo explicable.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| result_id | uuid | no | — | PK compuesto; result_id → ml.analysis_results(id) | Referencia a ml.analysis_results.id |
| recommendation_id | uuid | no | — | PK compuesto; recommendation_id → ml.educational_recommendations(id) | Referencia a ml.educational_recommendations.id |
| reason | text | no | — | ;  | Dato de Relación de resultado y recomendación con motivo explicable: reason. |

**PK:** `result_id, recommendation_id`. **UNIQUE:** ninguna adicional.

**CHECK:** length(btrim(reason)) > 0.

**Índices recomendados adicionales:** (recommendation_id).

- FK `(result_id) → ml.analysis_results(id)`; ON DELETE CASCADE.
- FK `(recommendation_id) → ml.educational_recommendations(id)`; ON DELETE RESTRICT.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.evaluation_runs

Ejecución reproducible de evaluación, independiente de inferencia de un paciente.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK;  | UUID estable de la entidad; no sustituye la comprobación de acceso. |
| model_id | uuid | no | — | ; model_id → ml.model_versions(id) | Versión del modelo exploratorio; la evaluación no equivale a validación clínica. |
| dataset_id | uuid | no | — | ; dataset_id → ml.dataset_versions(id) | Versión reproducible del dataset; no fotografías personales reutilizadas automáticamente. |
| split | text | no | 'test' | ;  | Partición del experimento; un mismo sujeto no cruza splits en la misma versión. |
| sample_size | integer | no | — | ;  | Cantidad real evaluada, positiva; no una métrica inventada. |
| config | jsonb | no | — | ;  | Parámetros reproducibles del experimento; sin claves, tokens o información clínica. |
| artifact_reference | text | no | — | ;  | Dato de Ejecución reproducible de evaluación, independiente de inferencia de un paciente: artifact reference. |
| executed_at | timestamptz | no | now() | ;  | Instante UTC registrado por el servidor |

**PK:** `id`. **UNIQUE:** ninguna adicional.

**CHECK:** split IN ('train','validation','test'); sample_size > 0; jsonb_typeof(config) = 'object'; length(btrim(artifact_reference)) > 0.

**Índices recomendados adicionales:** (model_id, executed_at DESC); (dataset_id).

- FK `(model_id) → ml.model_versions(id)`; ON DELETE RESTRICT.
- FK `(dataset_id) → ml.dataset_versions(id)`; ON DELETE RESTRICT.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.

## ml.evaluation_metrics

Métrica por clase/promedio y matriz de confusión de una ejecución.

**Estado:** Propuesta; fase `futuro_ia`.

| Columna | Tipo | NULL | Default | Clave / referencia | Significado |
|---|---|---|---|---|---|
| run_id | uuid | no | — | PK compuesto; run_id → ml.evaluation_runs(id) | Referencia a ml.evaluation_runs.id |
| name | text | no | — | PK compuesto;  | precision, recall, f1, confusion_matrix |
| label | text | no | 'aggregate' | PK compuesto;  | Clase o etiqueta en el contexto de esta tabla; un resultado no evaluable no tiene hallazgo. |
| value | numeric | sí | — | ;  | Métrica escalar; NULL solo para matriz de confusión. |
| matrix | jsonb | sí | — | ;  | Matriz cuadrada de conteos enteros no negativos; validación vinculada a sample_size. |

**PK:** `run_id, name, label`. **UNIQUE:** ninguna adicional.

**CHECK:** name IN ('accuracy','precision','recall','f1','auc','confusion_matrix'); (name = 'confusion_matrix' AND value IS NULL AND matrix IS NOT NULL) OR (name <> 'confusion_matrix' AND value IS NOT NULL AND value BETWEEN 0 AND 1 AND matrix IS NULL); length(btrim(label)) > 0.

**Índices recomendados adicionales:** PK/UNIQUE/FK cubiertas; medir antes de añadir.

- FK `(run_id) → ml.evaluation_runs(id)`; ON DELETE RESTRICT.

**Conservación:** Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.
