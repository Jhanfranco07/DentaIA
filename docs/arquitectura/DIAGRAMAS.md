# Diagramas revisados y renderizados

17 fuentes editables y 17 SVG. DER generado del mismo modelo de 29 tablas/219 columnas; Auth y otras entidades externas referenciadas no se cuentan como nuevas tablas de negocio. Las tres tablas administrativas sin FK se muestran sin relaciones físicas inventadas.

Los SVG permiten zoom. Renderizar no prueba SQL, RLS ni semántica de producción. La auditoría explica los cambios de cardinalidad y el error sintáctico reproducido.

## 01-logica

[Fuente](diagramas/01-logica.mmd) · [SVG](renderizados/01-logica.svg)

```mermaid
flowchart TD
  U["Navegador: público, paciente y profesional"] --> P["Next.js: presentación existente"]
  P --> SDK["SDK personal existente: JWT propio"]
  SDK --> R["Supabase Auth / Data API / Storage con RLS"]
  P --> A["Administración: código en rama, no integrado"]
  A --> G["DI-150: identidad, rol actual y AAL2"]
  G --> S["Adaptadores server-only; opt-in"]
  S --> DB["Auth Admin / RPC DI-151; requiere migración"]
  P -. "propuesto" .-> H["Next.js: servicio clínico autorizado"]
  H -.-> TX["PostgreSQL: permiso y auditoría antes de entregar"]
  P -. "futuro" .-> IA["Trabajo exploratorio de visión"]
  IA -.-> ML["Dataset, modelo y evaluación; sin diagnóstico"]
```

## 02-fisica

[Fuente](diagramas/02-fisica.mmd) · [SVG](renderizados/02-fisica.svg)

```mermaid
flowchart TD
  B["Navegador"] -->|HTTPS| V["Vercel: aplicación Next.js integrada"]
  B -->|HTTPS + JWT propio| SB["Supabase: Auth, Data API y Storage"]
  V -. "al integrar administración" .-> SB
  GH["GitHub: main y ramas"] --> AC["GitHub Actions: CI, Tests y Security"]
  GH -->|integración de despliegue observada| V
  V -. "futuro; proveedor sin decidir" .-> AI["Servicio de visión"]
  AI -. "acceso mínimo; no bucket público" .-> SB
```

## 03-componentes

[Fuente](diagramas/03-componentes.mmd) · [SVG](renderizados/03-componentes.svg)

```mermaid
flowchart TD
  APP["App Router"] --> PUB["Inicio, privacidad y directorio"]
  APP --> CU["Cuenta y sesión"]
  CU --> PA["Panel paciente en rama"]
  PA --> F["Fotografías y solicitudes personales"]
  APP --> PRO["Vista profesional: demo integrada / historial en rama"]
  PRO -.-> CL["Contrato clínico futuro"]
  APP --> AD["Administración en rama"]
  AD --> GU["Guard DI-150"]
  GU --> RE["Lectura Auth Admin + profiles"]
  GU --> WR["RPC de roles; bandera y migración requeridas"]
  CL -.-> AUD["Permisos por paciente y auditoría clínica"]
```

## 04-der-general

[Fuente](diagramas/04-der-general.mmd) · [SVG](renderizados/04-der-general.svg)

```mermaid
erDiagram
  public_profiles {
    uuid id PK,FK
  }
  public_dentists {
    uuid id PK
  }
  public_appointment_requests {
    uuid id PK
  }
  public_patient_consents {
    uuid id PK
  }
  public_dental_photos {
    uuid id PK
  }
  dentaia_admin_revisiones_roles {
    uuid usuario_id PK
  }
  dentaia_admin_aprobaciones_roles {
    uuid id PK
  }
  dentaia_admin_auditoria_roles {
    uuid actor_id PK
    uuid solicitud_id PK
  }
  clinical_clinics {
    uuid id PK
  }
  clinical_professional_accounts {
    uuid id PK
  }
  clinical_professional_verifications {
    uuid id PK
  }
  clinical_clinic_memberships {
    uuid id PK
  }
  clinical_patient_records {
    uuid id PK
  }
  clinical_clinical_encounters {
    uuid id PK
  }
  clinical_clinical_entries {
    uuid id PK
  }
  clinical_clinical_documents {
    uuid id PK
  }
  clinical_clinical_access_grants {
    uuid id PK
  }
  clinical_clinical_grant_resources {
    uuid grant_id PK,FK
    uuid encounter_id PK,FK
  }
  clinical_clinical_access_audit {
    uuid id PK
  }
  ml_dataset_versions {
    uuid id PK
  }
  ml_dataset_items {
    uuid id PK
  }
  ml_model_versions {
    uuid id PK
  }
  ml_analysis_authorizations {
    uuid id PK
  }
  ml_analysis_jobs {
    uuid id PK
  }
  ml_analysis_results {
    uuid id PK
  }
  ml_educational_recommendations {
    uuid id PK
  }
  ml_result_recommendations {
    uuid result_id PK,FK
    uuid recommendation_id PK,FK
  }
  ml_evaluation_runs {
    uuid id PK
  }
  ml_evaluation_metrics {
    uuid run_id PK,FK
    text name PK
    text label PK
  }
  auth_users {
    uuid id PK
  }
  auth_users ||--o| public_profiles : "id"
  auth_users ||--o{ public_appointment_requests : "user_id"
  public_dentists ||--o{ public_appointment_requests : "dentist_id"
  auth_users ||--o{ public_patient_consents : "user_id"
  auth_users ||--o{ public_dental_photos : "user_id"
  public_patient_consents ||--o{ public_dental_photos : "user_id,consent_id"
  auth_users ||--o| clinical_professional_accounts : "user_id"
  public_dentists o|--o| clinical_professional_accounts : "dentist_id"
  clinical_professional_accounts ||--o{ clinical_professional_verifications : "professional_id"
  auth_users ||--o{ clinical_professional_verifications : "reviewed_by"
  clinical_clinics ||--o{ clinical_clinic_memberships : "clinic_id"
  clinical_professional_accounts ||--o{ clinical_clinic_memberships : "professional_id"
  auth_users ||--o| clinical_patient_records : "user_id"
  clinical_patient_records ||--o{ clinical_clinical_encounters : "patient_id"
  clinical_clinic_memberships ||--o{ clinical_clinical_encounters : "membership_id"
  clinical_clinical_encounters o|--o| clinical_clinical_encounters : "replaces_id,patient_id,membership_id"
  clinical_clinical_encounters ||--o{ clinical_clinical_entries : "encounter_id"
  clinical_clinical_entries o|--o| clinical_clinical_entries : "replaces_id,encounter_id,kind"
  clinical_clinical_encounters ||--o{ clinical_clinical_documents : "encounter_id"
  clinical_patient_records ||--o{ clinical_clinical_access_grants : "patient_id"
  clinical_clinic_memberships ||--o{ clinical_clinical_access_grants : "membership_id"
  clinical_clinical_access_grants ||--o{ clinical_clinical_grant_resources : "grant_id"
  clinical_clinical_encounters ||--o{ clinical_clinical_grant_resources : "encounter_id"
  auth_users o|--o{ clinical_clinical_access_audit : "actor_user_id"
  clinical_patient_records o|--o{ clinical_clinical_access_audit : "patient_id"
  clinical_clinic_memberships o|--o{ clinical_clinical_access_audit : "membership_id"
  clinical_clinical_access_grants o|--o{ clinical_clinical_access_audit : "grant_id"
  ml_dataset_versions ||--o{ ml_dataset_items : "dataset_id"
  ml_dataset_versions ||--o{ ml_model_versions : "dataset_id"
  auth_users ||--o{ ml_analysis_authorizations : "owner_user_id"
  public_dental_photos ||--o{ ml_analysis_authorizations : "photo_id,owner_user_id"
  auth_users ||--o{ ml_analysis_jobs : "owner_user_id"
  public_dental_photos ||--o{ ml_analysis_jobs : "photo_id"
  ml_model_versions ||--o{ ml_analysis_jobs : "model_id"
  ml_analysis_authorizations ||--o{ ml_analysis_jobs : "authorization_id,photo_id,owner_user_id"
  ml_analysis_jobs ||--o| ml_analysis_results : "job_id"
  ml_analysis_results ||--o{ ml_result_recommendations : "result_id"
  ml_educational_recommendations ||--o{ ml_result_recommendations : "recommendation_id"
  ml_model_versions ||--o{ ml_evaluation_runs : "model_id"
  ml_dataset_versions ||--o{ ml_evaluation_runs : "dataset_id"
  ml_evaluation_runs ||--o{ ml_evaluation_metrics : "run_id"
```

## 05-der-administracion

[Fuente](diagramas/05-der-administracion.mmd) · [SVG](renderizados/05-der-administracion.svg)

```mermaid
erDiagram
  dentaia_admin_revisiones_roles {
    uuid usuario_id PK
    integer revision
  }
  dentaia_admin_aprobaciones_roles {
    uuid id PK
    uuid actor_id
    uuid objetivo_id
    uuid aprobado_por
    text operacion
    text rol
    integer revision_esperada
    jsonb asignacion_esperada
    timestamptz creada_en
    timestamptz vence_en
    uuid consumida_por
  }
  dentaia_admin_auditoria_roles {
    uuid actor_id PK
    uuid solicitud_id PK
    uuid objetivo_id
    uuid aprobacion_id
    jsonb peticion
    jsonb anterior
    jsonb posterior
    jsonb resultado
    timestamptz registrada_en
  }
```

## 06-der-paciente

[Fuente](diagramas/06-der-paciente.mmd) · [SVG](renderizados/06-der-paciente.svg)

```mermaid
erDiagram
  public_profiles {
    uuid id PK,FK
    text full_name
    timestamptz created_at
  }
  public_dentists {
    uuid id PK
    text slug
    text name
    text specialty
    text district
    numeric consultation_price
    text currency
    text initials
    text avatar_color
    text description
    boolean is_demo
    boolean is_active
    timestamptz created_at
  }
  public_appointment_requests {
    uuid id PK
    uuid user_id FK
    uuid dentist_id FK
    text contact_name
    text contact_email
    date preferred_date
    time preferred_time
    text message
    text status
    boolean is_demo
    timestamptz created_at
  }
  public_patient_consents {
    uuid id PK
    uuid user_id FK
    text policy_version
    text consent_text
    text purpose
    timestamptz accepted_at
    timestamptz revoked_at
  }
  public_dental_photos {
    uuid id PK
    uuid user_id FK
    uuid consent_id FK
    text bucket_id
    text object_path
    text original_filename
    text mime_type
    bigint size_bytes
    timestamptz created_at
  }
  auth_users {
    uuid id PK
  }
  auth_users ||--o| public_profiles : "id"
  auth_users ||--o{ public_appointment_requests : "user_id"
  public_dentists ||--o{ public_appointment_requests : "dentist_id"
  auth_users ||--o{ public_patient_consents : "user_id"
  auth_users ||--o{ public_dental_photos : "user_id"
  public_patient_consents ||--o{ public_dental_photos : "user_id,consent_id"
```

## 07-der-clinico

[Fuente](diagramas/07-der-clinico.mmd) · [SVG](renderizados/07-der-clinico.svg)

```mermaid
erDiagram
  clinical_clinics {
    uuid id PK
    text name
    text location
    text status
    timestamptz created_at
  }
  clinical_professional_accounts {
    uuid id PK
    uuid user_id FK
    uuid dentist_id FK
    text status
    timestamptz created_at
  }
  clinical_professional_verifications {
    uuid id PK
    uuid professional_id FK
    uuid reviewed_by FK
    text decision
    text reference
    text reason
    timestamptz reviewed_at
  }
  clinical_clinic_memberships {
    uuid id PK
    uuid clinic_id FK
    uuid professional_id FK
    text status
    timestamptz valid_from
    timestamptz valid_until
  }
  clinical_patient_records {
    uuid id PK
    uuid user_id FK
    text status
    timestamptz created_at
  }
  clinical_clinical_encounters {
    uuid id PK
    uuid patient_id FK
    uuid membership_id FK
    timestamptz attended_at
    timestamptz recorded_at
    text status
    uuid replaces_id FK
    text correction_reason
  }
  clinical_clinical_entries {
    uuid id PK
    uuid encounter_id FK
    text kind FK
    text information_state
    text description
    text code_system
    text code
    timestamptz recorded_at
    uuid replaces_id FK
    text correction_reason
  }
  clinical_clinical_documents {
    uuid id PK
    uuid encounter_id FK
    text kind
    text title
    date exam_date
    text availability
    text bucket_id
    text object_path
    text mime_type
    bigint size_bytes
    timestamptz created_at
  }
  clinical_clinical_access_grants {
    uuid id PK
    uuid patient_id FK
    uuid membership_id FK
    text purpose
    text policy_version
    timestamptz granted_at
    timestamptz expires_at
    timestamptz revoked_at
    text scope_mode
  }
  clinical_clinical_grant_resources {
    uuid grant_id PK,FK
    uuid encounter_id PK,FK
  }
  clinical_clinical_access_audit {
    uuid id PK
    uuid request_id
    uuid actor_user_id FK
    uuid patient_id FK
    uuid membership_id FK
    uuid grant_id FK
    text operation
    text outcome
    text reason_code
    timestamptz occurred_at
  }
  auth_users {
    uuid id PK
  }
  auth_users ||--o| clinical_professional_accounts : "user_id"
  public_dentists {
    uuid id PK
  }
  public_dentists o|--o| clinical_professional_accounts : "dentist_id"
  clinical_professional_accounts ||--o{ clinical_professional_verifications : "professional_id"
  auth_users ||--o{ clinical_professional_verifications : "reviewed_by"
  clinical_clinics ||--o{ clinical_clinic_memberships : "clinic_id"
  clinical_professional_accounts ||--o{ clinical_clinic_memberships : "professional_id"
  auth_users ||--o| clinical_patient_records : "user_id"
  clinical_patient_records ||--o{ clinical_clinical_encounters : "patient_id"
  clinical_clinic_memberships ||--o{ clinical_clinical_encounters : "membership_id"
  clinical_clinical_encounters o|--o| clinical_clinical_encounters : "replaces_id,patient_id,membership_id"
  clinical_clinical_encounters ||--o{ clinical_clinical_entries : "encounter_id"
  clinical_clinical_entries o|--o| clinical_clinical_entries : "replaces_id,encounter_id,kind"
  clinical_clinical_encounters ||--o{ clinical_clinical_documents : "encounter_id"
  clinical_patient_records ||--o{ clinical_clinical_access_grants : "patient_id"
  clinical_clinic_memberships ||--o{ clinical_clinical_access_grants : "membership_id"
  clinical_clinical_access_grants ||--o{ clinical_clinical_grant_resources : "grant_id"
  clinical_clinical_encounters ||--o{ clinical_clinical_grant_resources : "encounter_id"
  auth_users o|--o{ clinical_clinical_access_audit : "actor_user_id"
  clinical_patient_records o|--o{ clinical_clinical_access_audit : "patient_id"
  clinical_clinic_memberships o|--o{ clinical_clinical_access_audit : "membership_id"
  clinical_clinical_access_grants o|--o{ clinical_clinical_access_audit : "grant_id"
```

## 08-der-ia

[Fuente](diagramas/08-der-ia.mmd) · [SVG](renderizados/08-der-ia.svg)

```mermaid
erDiagram
  ml_dataset_versions {
    uuid id PK
    text name
    text version
    text source_uri
    text license
    text permission_reference
    text manifest_sha256
    timestamptz created_at
  }
  ml_dataset_items {
    uuid id PK
    uuid dataset_id FK
    text subject_key
    text object_reference
    text image_sha256
    text label
    text split
  }
  ml_model_versions {
    uuid id PK
    uuid dataset_id FK
    text name
    text version
    text artifact_uri
    text artifact_sha256
    text preprocessing_version
    text code_commit
    text status
    timestamptz created_at
  }
  ml_analysis_authorizations {
    uuid id PK
    uuid owner_user_id FK
    uuid photo_id FK
    text purpose
    text policy_version
    text consent_text
    timestamptz granted_at
    timestamptz expires_at
    timestamptz revoked_at
  }
  ml_analysis_jobs {
    uuid id PK
    uuid photo_id FK
    uuid model_id FK
    uuid owner_user_id FK
    uuid authorization_id FK
    uuid idempotency_key
    text status
    text error_code
    timestamptz created_at
    timestamptz finished_at
    uuid lease_id
    timestamptz lease_expires_at
    integer attempt_count
  }
  ml_analysis_results {
    uuid id PK
    uuid job_id FK
    text label
    numeric score
    text limitations
    text disclaimer_version
    text quality_status
    timestamptz created_at
  }
  ml_educational_recommendations {
    uuid id PK
    text code
    text version
    text text
    text source_reference
    text review_status
  }
  ml_result_recommendations {
    uuid result_id PK,FK
    uuid recommendation_id PK,FK
    text reason
  }
  ml_evaluation_runs {
    uuid id PK
    uuid model_id FK
    uuid dataset_id FK
    text split
    integer sample_size
    jsonb config
    text artifact_reference
    timestamptz executed_at
  }
  ml_evaluation_metrics {
    uuid run_id PK,FK
    text name PK
    text label PK
    numeric value
    jsonb matrix
  }
  ml_dataset_versions ||--o{ ml_dataset_items : "dataset_id"
  ml_dataset_versions ||--o{ ml_model_versions : "dataset_id"
  auth_users {
    uuid id PK
  }
  auth_users ||--o{ ml_analysis_authorizations : "owner_user_id"
  public_dental_photos {
    uuid id PK
  }
  public_dental_photos ||--o{ ml_analysis_authorizations : "photo_id,owner_user_id"
  auth_users ||--o{ ml_analysis_jobs : "owner_user_id"
  public_dental_photos ||--o{ ml_analysis_jobs : "photo_id"
  ml_model_versions ||--o{ ml_analysis_jobs : "model_id"
  ml_analysis_authorizations ||--o{ ml_analysis_jobs : "authorization_id,photo_id,owner_user_id"
  ml_analysis_jobs ||--o| ml_analysis_results : "job_id"
  ml_analysis_results ||--o{ ml_result_recommendations : "result_id"
  ml_educational_recommendations ||--o{ ml_result_recommendations : "recommendation_id"
  ml_model_versions ||--o{ ml_evaluation_runs : "model_id"
  ml_dataset_versions ||--o{ ml_evaluation_runs : "dataset_id"
  ml_evaluation_runs ||--o{ ml_evaluation_metrics : "run_id"
```

## 09-casos-uso

[Fuente](diagramas/09-casos-uso.mmd) · [SVG](renderizados/09-casos-uso.svg)

```mermaid
flowchart TD
  V["Visitante"] --> P["Consultar inicio, directorio y demo educativa"]
  V --> L["Registrarse e iniciar sesión"]
  PAC["Paciente autenticado"] --> M["Gestionar perfil, solicitudes y fotos propias"]
  PAC -. "propuesto" .-> C["Conceder o revocar acceso clínico"]
  OD["Odontólogo verificado"] -. "propuesto" .-> H["Consultar historial autorizado entre clínicas"]
  OD -.-> X["Revisar procedencia y vigencia de exámenes"]
  SU["Superusuario AAL2"] --> A["Consultar usuarios con habilitación privada"]
  SU --> R["Solicitar cambio aprobado de roles"]
  AP["Aprobador independiente"] --> R
  R --> AU["Auditoría administrativa"]
```

## 10-autenticacion

[Fuente](diagramas/10-autenticacion.mmd) · [SVG](renderizados/10-autenticacion.svg)

```mermaid
sequenceDiagram
  participant U as Usuario
  participant N as Next.js
  participant A as Supabase Auth
  U->>A: Login existente
  A-->>U: Sesión propia
  U->>A: Challenge TOTP cuando corresponda
  A-->>U: Token AAL2
  U->>N: Solicitud con Bearer
  N->>A: getUser y getClaims
  A-->>N: Identidad, roles actuales y claims verificados
  alt Superusuario vigente y AAL2
    N-->>U: Respuesta autorizada mínima
  else Sin permiso o sesión
    N-->>U: 401 / 403, 503 si indisponible
  end
```

## 11-solicitudes

[Fuente](diagramas/11-solicitudes.mmd) · [SVG](renderizados/11-solicitudes.svg)

```mermaid
sequenceDiagram
  participant P as Paciente
  participant C as Cliente Next.js
  participant D as Supabase Data API
  P->>C: Solicitud académica propia
  C->>D: INSERT con JWT y campos permitidos
  D->>D: RLS propietario, ficha activa y CHECK is_demo
  D-->>C: requested o error
  C-->>P: Solicitud registrada, no cita confirmada
  P->>C: Cancelar solicitud propia
  C->>D: UPDATE status requested a cancelled
  D-->>C: Fila afectada o rechazo
  opt Consulta profesional propuesta, aún no implementada
    C->>D: RPC por cuenta profesional verificada y ficha vinculada
    D->>D: Comprobar destinatario dentist_id y auditar acceso
    D-->>C: Solo solicitudes destinadas al profesional
  end
  Note over C,D: No hay clínica destino en appointment_requests, no inferirla de la UI
```

## 12-historial

[Fuente](diagramas/12-historial.mmd) · [SVG](renderizados/12-historial.svg)

```mermaid
sequenceDiagram
  participant O as Odontólogo
  participant S as Next.js clínico propuesto
  participant D as PostgreSQL
  O->>S: Paciente, membresía y cursor ligado al contexto
  S->>S: Verificar sesión, rechazar escenario o actor del cliente
  S->>D: Lectura auditada, no SELECT directo de contenido
  D->>D: Bloquear identidad, paciente, contexto y concesiones vigentes
  D->>D: Validar rol actual, verificación y recursos seleccionados
  alt Permitido
    D->>D: INSERT auditoría mínima y preparar página autorizada
    D-->>S: Commit y proyección sin rutas de objetos
    S-->>O: Historial permitido con origen y fechas
  else Denegado
    D->>D: INSERT auditoría sin contenido ni ID ajeno validado
    D-->>S: Commit y denegación controlada
    S-->>O: 403 o 404 genérico
  end
  Note over S,D: Fallo de auditoría: no entregar contenido
  Note over O,D: Revocar bloquea nuevas lecturas, no retira páginas ya autorizadas
```

## 13-permisos

[Fuente](diagramas/13-permisos.mmd) · [SVG](renderizados/13-permisos.svg)

```mermaid
sequenceDiagram
  participant P as Paciente
  participant S as Next.js propuesto
  participant D as PostgreSQL
  P->>S: Conceder atenciones seleccionadas con Idempotency-Key
  S->>D: Identidad verificada y parámetros cerrados
  D->>D: Derivar paciente, validar destinatario y mismo paciente de recursos
  D->>D: Transacción: concesión, recursos y auditoría
  D-->>S: Commit, misma clave y datos devuelve concesión previa
  S-->>P: Estado actual, no reactivar concesión revocada
  P->>S: Revocar concesión propia
  S->>D: Bloquear mismo paciente y concesión en modo exclusivo
  D->>D: Revocación irreversible y auditoría
  D-->>P: Confirmar después del commit
  Note over S,D: Lectores usan bloqueos compartidos compatibles con esta serialización
  Note over P,D: Solicitudes y consentimiento fotográfico no otorgan este permiso
```

## 14-roles

[Fuente](diagramas/14-roles.mmd) · [SVG](renderizados/14-roles.svg)

```mermaid
sequenceDiagram
  participant U as Superusuario
  participant N as Endpoint de roles
  participant D as RPC propuesto en migración
  U->>N: Cambio, revisión, aprobación y clave idempotente
  N->>N: Guard AAL2, origen y JSON válidos
  alt Escrituras deshabilitadas
    N-->>U: 503 sin crear adaptador privilegiado
  else Entorno aprobado y migración disponible
    N->>D: Contexto verificado y solicitud exacta
    D->>D: Bloqueos, revalidar actor, TOTP reciente y aprobación
    D->>D: Cambio Auth, revisión, consumo y auditoría atómicos
    D-->>N: Resultado o conflicto de versión
    N-->>U: Confirmado, si incierto, reintentar misma clave
  end
```

## 15-fotografias

[Fuente](diagramas/15-fotografias.mmd) · [SVG](renderizados/15-fotografias.svg)

```mermaid
flowchart TD
  I["Imagen local"] --> V["Validación de formato, tamaño y decodificación"]
  V --> CH{"Finalidad"}
  CH -->|demo actual| DE["Caso reconocido y PDF educativo local"]
  CH -->|almacenamiento actual| CO["Sesión y consentimiento académico vigente"]
  CO --> ST["Bucket privado dental-photos"]
  ST --> ME["Metadatos; compensación o reconciliación"]
  ME --> EL["Borrado actual: Storage y después metadatos, reintentable"]
  ME -. "futuro: autorización distinta y foto del propietario" .-> AU["analysis_authorizations"]
  AU -.-> J["Job con modelo, idempotencia y lease"]
  J -.-> Q{"Calidad y autorización siguen vigentes"}
  Q -. "sí" .-> RE["Resultado orientativo y recomendaciones"]
  Q -. "no" .-> NE["Cancelar o no evaluable; sin hallazgos inventados"]
  EL -. "futuro: CASCADE de análisis personal" .-> LIM["No bloquear borrado actual; datasets separados"]
```

## 16-despliegue

[Fuente](diagramas/16-despliegue.mmd) · [SVG](renderizados/16-despliegue.svg)

```mermaid
flowchart TD
  N["Cliente web HTTPS"] --> V["Vercel: Next.js estático y servidor"]
  V --> ENV["Configuración privada de servidor por entorno"]
  N --> AU["Supabase Auth"]
  N --> ST["Data API / Storage: JWT propio y RLS"]
  V -. "administración al integrar rama" .-> AD["Auth Admin / RPC restringido"]
  AD --> DB["PostgreSQL gestionado"]
  ST --> DB
  V -. "diseño futuro" .-> AI["Runtime de visión sin proveedor seleccionado"]
```

## 17-cicd

[Fuente](diagramas/17-cicd.mmd) · [SVG](renderizados/17-cicd.svg)

```mermaid
flowchart TD
  F["Push feature o PR a main"] --> CI["CI: npm ci, typecheck y build"]
  F --> TE["Tests Node 22 aislados"]
  PR["PR a main / push main / manual"] --> SE["Security: npm audit"]
  CI --> RV["Revisión y decisión humana de integración"]
  TE --> RV
  SE --> RV
  RV --> MA["main; integración futura autorizada"]
  MA --> VE["Vercel: despliegue por integración observada"]
  VE --> QA["Propuesto: smoke y observabilidad saneada"]
```
