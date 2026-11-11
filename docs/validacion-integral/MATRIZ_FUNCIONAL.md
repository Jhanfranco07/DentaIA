# Matriz funcional inicial · 11/11/2026

**Alcance de evidencia.** `U` = pruebas Node aisladas; `I` = integración local/sintética; `B` = Playwright con respuestas simuladas; `P` = PostgreSQL local; `R` = servicio remoto real. Un resultado `B` no acredita `R`. El detalle de ejecuciones está en [RESULTADOS_PRUEBAS.md](RESULTADOS_PRUEBAS.md). Las rutas protegidas requieren sesión y permisos verificados por el servidor y/o RLS; un fixture no sustituye esa verificación.

| Rol / función | Ruta y componente principal | Esperado y estado de implementación | Dependencia backend / Supabase | Prueba y resultado | Límite / severidad |
|---|---|---|---|---|---|
| Público: portada | `/`, `src/app/(public)/page.tsx` | Entrada y navegación pública implementadas | Ninguna para contenido estático | Build correcto | Revisión de contenido remoto pendiente · baja |
| Paciente: registro/login | `/cuenta`, `src/features/cuenta/*` | Formularios, validación y sesión con Supabase Auth implementados | Auth y correo de confirmación | U pasa; R pendiente | No se crearon cuentas remotas · alta para aceptación |
| Paciente: control de rol | `AccesoRol`, `useSesion` | Sin sesión o rol paciente, bloquear rutas privadas | Auth `getUser`, metadatos de rol verificados | U pasa; B reproducible: sin sesión, permitido, restringido y error | R pendiente · alta |
| Paciente: panel | `/panel`, `PanelPaciente` | Resumen privado y estados de servicio | API clínica `/api/clinical/patients/me`, Supabase | U pasa; B cinco anchos sin desborde | HTTP clínico real no habilitado en ensayo · alta |
| Paciente: directorio | `/directorio`, `DirectorioLista` | Listado, búsqueda, filtros, vacío/error | Lectura de `dentists`, `directory_demo_locations`, reseñas y ubicaciones | U pasa; B de PR #40: 20 perfiles, filtros y vacío; P: 20 puntos | R pendiente; seed remoto no ejecutado · media |
| Paciente: ficha | `/directorio/[id]`, `DentistaDetalle` | Ficha por UUID, aviso DEMO | Lectura Supabase; ficha demo requiere punto publicado | U/B de PR #40 pasan | R pendiente · media |
| Paciente: mapa | `MapaDirectorio`, en directorio/ficha | Marcador vinculado, coordenada demo explícita, sin rutas a local ficticio | MapLibre y teselas OSM; puntos Supabase | U/B de PR #40 pasan en cinco anchos | Red de teselas y datos remotos no validados · media |
| Paciente: solicitudes | `/solicitudes`, `FormularioSolicitud`, `MisSolicitudes` | Solicitudes existentes y estados, sin cita clínica real | `appointment_requests`, Auth y RLS | U pasa; B rol sintético/denegación pendientes | Crear solicitud remota no autorizado · alta |
| Paciente: perfil | `/cuenta`, componentes de cuenta | Consultar/editar perfil propio según RLS | Auth y tablas de perfiles | U pasa | Escritura real pendiente · media |
| Paciente: fotografías/consentimiento | `/fotografias`, `PhotosPageContent` | Consentimiento expreso antes de Storage privado; revocación y borrado | Auth, `patient_consents`, `dental_photos`, Storage/RLS | U pasa; B reproducible 18/18 y cinco anchos | Storage/RLS remotos pendientes · alta |
| Paciente: análisis educativo | `/analisis`, `AnalisisDental` | Flujo educativo sin diagnóstico automático habilitado | Casos sintéticos y contexto local | U pasa | No se valida visión artificial · media |
| Odontólogo: login/rol | `/cuenta`, `/profesional`, `AccesoRol` | Solo rol odontólogo; sesión expirada y error visible | Auth/rol | U pasa; B 12 comprobaciones sintéticas | R con cuenta verificada pendiente · alta |
| Odontólogo: panel/perfil | `/profesional`, `ProfesionalClinico` | Contextos de membresía y estado restringido | `/api/professional/me`, BFF clínico, Supabase | U pasa; B sintético pasa | Backend remoto deshabilitado en ensayo · alta |
| Odontólogo: solicitudes | `/profesional`, `ProfesionalClinico` | Lista por contexto autorizado y paginación | `/api/professional/requests`, rol/membresía | U integración local pasa; B sintético pasa | R pendiente · alta |
| Odontólogo: pacientes/historial | `/profesional`, `ProfesionalClinico` | Solo paciente autorizado; revocación y revalidación | `/api/professional/patients`, `/api/clinical/patients/[patientId]/history`, grants | U integración local pasa; B sintético pasa | R pendiente; no leer historia real · crítica si falla en QA |
| Superusuario: acceso/MFA | `/administracion`, `UsuariosAdministrativosConectados`, `DesafioMfaAdministrativo` | Rol activo, factor verificado y AAL2; 404/403 según entorno | Auth JWT, MFA, API administrativa | U pasa; B/R no comprobados aquí | Requiere cuenta autorizada y entorno QA · alta |
| Superusuario: panel/listados | `/administracion`, `PanelAdministrativoDemo`, `UsuariosAdministrativos` | Navegación, filtros y lectura solo con opt-in | `DENTAIA_ADMIN_READS_ENABLED`, secreto servidor, API | U pasa; B/R pendientes | Opt-in desactivado en ensayo; no habilitarlo para simular · alta |
| Superusuario: roles/sedes/reseñas | `/administracion`, gestores administrativos | Denegar escritura sin rol/AAL2 y controles del servidor | APIs, RPC y RLS | U de permisos, bloqueos y servicios pasa | R pendiente; no se hicieron cambios remotos · crítica si falla en QA |

**Lectura:** “implementado” identifica código y contratos presentes, no operación productiva comprobada. Los hallazgos priorizados están en [HALLAZGOS.md](HALLAZGOS.md).

## Matriz de aceptación remota

| Área | Resultado esperado | Evidencia mínima | Criterio de aprobación |
|---|---|---|---|
| Registro, login y recuperación | Alta, confirmación, sesión, cierre y recuperación funcionan solo en QA | Video/log de red sin secretos y correos de cuenta sintética | Casos positivos y token inválido/expirado; ninguna sesión cruza usuarios |
| Paciente | Solo ve y modifica recursos propios | Respuestas API y consultas de verificación sobre IDs sintéticos | Propietario recibe 2xx; otro paciente recibe 403/0 filas |
| Odontólogo | Accede solo con rol, cuenta verificada, membresía y concesión vigentes | Respuestas de `/api/professional/*` e historial con actores sintéticos | Contexto autorizado 2xx; rol, clínica o concesión ajenos 403 |
| Superusuario | Panel exige rol activo y decisiones del servidor | Evidencia de 401/403/2xx con cuentas QA | Sin rol 403; superusuario AAL1 bloqueado; AAL2 autorizado según función |
| MFA/AAL2 | Enrolamiento QA, desafío, elevación y expiración se respetan | `getAuthenticatorAssuranceLevel`, claims y respuestas API redactadas | Operación sensible falla en AAL1 y pasa en AAL2 sin confiar en UI |
| Roles y permisos | `app_metadata`/tablas autorizadas gobiernan acceso | Matriz de cuentas QA y respuestas por endpoint | Ningún `user_metadata`, header o query concede privilegios |
| RLS | Lectura/escritura queda limitada por identidad y propósito | Casos SQL/Data API como `anon`, paciente A/B, odontólogo y superusuario | Cada política positiva y negativa coincide con el contrato; no hay BOLA |
| Storage privado | Bucket `dental-photos` privado y objetos por propietario | Upload/download/delete con imagen sintética y usuario A/B | Propietario opera; usuario B y URL pública no acceden |
| Consentimiento/eliminación | No hay carga sin consentimiento; revocación bloquea nuevas cargas y borrado elimina metadato/objeto | Filas y objeto sintéticos antes/después | Secuencia completa consistente y sin objetos huérfanos |
| Directorio/MapLibre | 20 perfiles demo, filtros, fichas y marcadores; aviso visible y sin atención real | Conteos 20/20, capturas 5 anchos y navegación | IDs/slugs únicos, marcador↔perfil consistente, sin CTA/ruta clínica demo |
| Seed/cleanup | Seed idempotente y cleanup acotado | Salida transaccional, conteos previo/doble/posterior | 20 tras dos seeds; 0 del dataset tras cleanup; otras filas sin cambio |
| Operaciones clínicas QA | BFF habilitado solo en Preview QA y datos sintéticos | Variables de alcance, logs y pruebas de autorización | Sin producción; revocación y acceso cruzado se deniegan inmediatamente |
