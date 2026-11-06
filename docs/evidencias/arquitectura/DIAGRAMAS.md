# Diagramas editables

Los trazos discontinuos indican propuestas o integraciones aún no comprobadas. Los DER detallados son físicos de diseño: no implican tablas remotas existentes. El DER general resume dominios; el inventario completo está en los DER por dominio y el diccionario.

## 01-logica

[Fuente Mermaid](diagramas/01-logica.mmd)

```mermaid
flowchart TD
  U["Navegador: público, paciente y profesional"] --> P["Next.js: presentación y estado"]
  P --> SDK["SDK cliente: flujos personales existentes"]
  SDK --> R["Data API y Storage con RLS"]
  P --> A["Route Handlers: administración en rama"]
  A --> G["Guard: identidad, rol vigente y AAL2"]
  G --> S["Servicios y adaptadores server-only"]
  S --> DB["Supabase Auth y PostgreSQL"]
  S -. "propuesto" .-> H["Servicio clínico: permisos y auditoría"]
  H -.-> R
  S -. "propuesto" .-> IA["Visión exploratoria aislada"]
```

## 02-fisica

[Fuente Mermaid](diagramas/02-fisica.mmd)

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

[Fuente Mermaid](diagramas/03-componentes.mmd)

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

[Fuente Mermaid](diagramas/04-der-general.mmd)

```mermaid
erDiagram
  AUTH_USERS ||--o| PROFILES : perfil
  AUTH_USERS ||--o| PROFESSIONAL_ACCOUNTS : identidad
  DENTISTS ||--o| PROFESSIONAL_ACCOUNTS : ficha
  PROFESSIONAL_ACCOUNTS ||--o{ CLINIC_MEMBERSHIPS : pertenece
  CLINICS ||--o{ CLINIC_MEMBERSHIPS : organiza
  AUTH_USERS ||--o| PATIENT_RECORDS : paciente
  PATIENT_RECORDS ||--o{ CLINICAL_ENCOUNTERS : conserva
  CLINIC_MEMBERSHIPS ||--o{ CLINICAL_ENCOUNTERS : origen
  CLINICAL_ENCOUNTERS ||--o{ CLINICAL_ENTRIES : contiene
  CLINICAL_ENCOUNTERS ||--o{ CLINICAL_DOCUMENTS : examenes
  PATIENT_RECORDS ||--o{ CLINICAL_ACCESS_GRANTS : concede
  CLINIC_MEMBERSHIPS ||--o{ CLINICAL_ACCESS_GRANTS : recibe
  CLINICAL_ACCESS_GRANTS ||--o{ CLINICAL_GRANT_RESOURCES : delimita
  CLINICAL_ENCOUNTERS ||--o{ CLINICAL_GRANT_RESOURCES : recurso
  AUTH_USERS ||--o{ APPOINTMENT_REQUESTS : solicita
  DENTISTS ||--o{ APPOINTMENT_REQUESTS : destino
  AUTH_USERS ||--o{ PATIENT_CONSENTS : consiente
  PATIENT_CONSENTS ||--o{ DENTAL_PHOTOS : ampara
  DENTAL_PHOTOS ||--o{ ANALYSIS_JOBS : futuro
  MODEL_VERSIONS ||--o{ ANALYSIS_JOBS : utiliza
  ANALYSIS_JOBS ||--o| ANALYSIS_RESULTS : produce
```

## 05-der-administracion

[Fuente Mermaid](diagramas/05-der-administracion.mmd)

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

## 07-der-clinico

[Fuente Mermaid](diagramas/07-der-clinico.mmd)

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
    }
    clinical_clinical_entries {
        uuid id PK
        uuid encounter_id FK
        text kind
        text information_state
        text description
        text code_system
        text code
        timestamptz recorded_at
        uuid replaces_id FK
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
        uuid grant_id PK
        uuid encounter_id PK
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
    clinical_professional_accounts ||--o{ clinical_professional_verifications : "professional_id"
    clinical_clinics ||--o{ clinical_clinic_memberships : "clinic_id"
    clinical_professional_accounts ||--o{ clinical_clinic_memberships : "professional_id"
    clinical_patient_records ||--o{ clinical_clinical_encounters : "patient_id"
    clinical_clinic_memberships ||--o{ clinical_clinical_encounters : "membership_id"
    clinical_clinical_encounters o|--o{ clinical_clinical_encounters : "replaces_id"
    clinical_clinical_encounters ||--o{ clinical_clinical_entries : "encounter_id"
    clinical_clinical_entries o|--o{ clinical_clinical_entries : "replaces_id"
    clinical_clinical_encounters ||--o{ clinical_clinical_documents : "encounter_id"
    clinical_patient_records ||--o{ clinical_clinical_access_grants : "patient_id"
    clinical_clinic_memberships ||--o{ clinical_clinical_access_grants : "membership_id"
    clinical_clinical_access_grants ||--o{ clinical_clinical_grant_resources : "grant_id"
    clinical_clinical_encounters ||--o{ clinical_clinical_grant_resources : "encounter_id"
    clinical_patient_records o|--o{ clinical_clinical_access_audit : "patient_id"
    clinical_clinic_memberships o|--o{ clinical_clinical_access_audit : "membership_id"
    clinical_clinical_access_grants o|--o{ clinical_clinical_access_audit : "grant_id"
```

## 08-der-ia

[Fuente Mermaid](diagramas/08-der-ia.mmd)

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
        uuid result_id PK
        uuid recommendation_id PK
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
        uuid run_id PK
        text name PK
        text label PK
        numeric value
        jsonb matrix
    }
    ml_dataset_versions ||--o{ ml_dataset_items : "dataset_id"
    ml_dataset_versions ||--o{ ml_model_versions : "dataset_id"
    ml_model_versions ||--o{ ml_analysis_jobs : "model_id"
    ml_analysis_authorizations ||--o{ ml_analysis_jobs : "authorization_id"
    ml_analysis_jobs ||--o{ ml_analysis_results : "job_id"
    ml_analysis_results ||--o{ ml_result_recommendations : "result_id"
    ml_educational_recommendations ||--o{ ml_result_recommendations : "recommendation_id"
    ml_model_versions ||--o{ ml_evaluation_runs : "model_id"
    ml_dataset_versions ||--o{ ml_evaluation_runs : "dataset_id"
    ml_evaluation_runs ||--o{ ml_evaluation_metrics : "run_id"
```

## 06-der-paciente

[Fuente Mermaid](diagramas/06-der-paciente.mmd)

```mermaid
erDiagram
  auth_users ||--o| public_profiles : id
  auth_users ||--o{ public_appointment_requests : user_id
  public_dentists ||--o{ public_appointment_requests : dentist_id
  auth_users ||--o{ public_patient_consents : user_id
  auth_users ||--o{ public_dental_photos : user_id
  public_patient_consents ||--o{ public_dental_photos : "user_id y consent_id"
```

## 09-casos-uso

[Fuente Mermaid](diagramas/09-casos-uso.mmd)

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

[Fuente Mermaid](diagramas/10-autenticacion.mmd)

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
    N-->>U: 401 / 403; 503 si indisponible
  end
```

## 11-solicitudes

[Fuente Mermaid](diagramas/11-solicitudes.mmd)

```mermaid
sequenceDiagram
  participant P as Paciente
  participant C as Cliente Next.js
  participant D as Supabase Data API
  P->>C: Solicitar atención académica
  C->>D: INSERT con JWT, validación de formulario
  D->>D: RLS propietario y profesional activo
  D-->>C: requested o error
  C-->>P: Estado sin prometer reserva
  P->>C: Cancelar solicitud propia
  C->>D: UPDATE requested a cancelled con filtros
  D->>D: RLS y privilegios de columna
  D-->>C: Fila afectada o rechazo
```

## 12-historial

[Fuente Mermaid](diagramas/12-historial.mmd)

```mermaid
sequenceDiagram
  participant O as Odontólogo
  participant S as Servicio clínico propuesto
  participant D as PostgreSQL
  O->>S: Paciente y contexto de clínica
  S->>S: Identidad verificada, sin confiar en IDs del cliente
  S->>D: RPC lectura autorizada con límite
  D->>D: Bloquear concesión; verificar membresía, vigencia y recursos
  alt Permitido
    D->>D: Registrar acceso y preparar entradas autorizadas
    D-->>S: Commit y resultado mínimo con procedencia
    S-->>O: Historial permitido
  else Denegado
    D->>D: Registrar denegación sin contenido clínico
    D-->>S: Resultado denegado, no excepción que revierta auditoría
    S-->>O: Rechazo genérico
  end
  Note over S,D: Si falla auditoría: sin historial; error controlado
```

## 13-permisos

[Fuente Mermaid](diagramas/13-permisos.mmd)

```mermaid
sequenceDiagram
  participant P as Paciente
  participant S as API propuesta
  participant D as PostgreSQL
  P->>S: Conceder recursos a profesional y clínica
  S->>D: Identidad propia, vigencia y recursos
  D->>D: Transacción: concesión y auditoría
  D-->>P: Confirmación
  P->>S: Revocar concesión propia
  S->>D: Bloqueo y marca revoked_at; auditoría
  D-->>P: Revocación confirmada
  Note over P,D: Próximas consultas rechazan; datos ya vistos no se borran de la memoria del receptor
```

## 14-roles

[Fuente Mermaid](diagramas/14-roles.mmd)

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
    D->>D: Bloqueos; revalidar actor, TOTP reciente y aprobación
    D->>D: Cambio Auth, revisión, consumo y auditoría atómicos
    D-->>N: Resultado o conflicto de versión
    N-->>U: Confirmado; si incierto, reintentar misma clave
  end
```

## 15-fotografias

[Fuente Mermaid](diagramas/15-fotografias.mmd)

```mermaid
flowchart TD
  I["Archivo local"] --> V["Validar formato, tamaño y decodificación"]
  V --> CH{"Finalidad elegida"}
  CH -->|demo local| DE["Caso reconocido: observación preparada y PDF educativo"]
  CH -->|almacenamiento| CO["Sesión y consentimiento académico vigente"]
  CO --> ST["Storage privado: propietario/consentimiento/objeto"]
  ST --> ME["Registrar metadatos; compensar si falla"]
  ME --> EL["Borrado reintentable: archivo y luego metadatos"]
  ME -. "futuro; consentimiento distinto" .-> IA["Validación de calidad y trabajo de visión"]
  IA -.-> RE["Resultado orientativo versionado; sin diagnóstico"]
```

## 16-despliegue

[Fuente Mermaid](diagramas/16-despliegue.mmd)

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

[Fuente Mermaid](diagramas/17-cicd.mmd)

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
