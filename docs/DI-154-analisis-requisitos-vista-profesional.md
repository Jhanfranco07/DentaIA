# DI-154 — Análisis de requisitos de la vista profesional

**Proyecto:** DentaIA · **Historia:** DI-145 — Vista del odontólogo · **Sprint:** S5 — Desarrollo y testeo  
**Responsable:** Anelis · **Fecha de análisis:** 30/10/2026 · **Tipo de entregable:** especificación inicial para revisión  
**Fuente de alcance:** descripción y criterios de aceptación de DI-154 en Jira; guía `docs/DESARROLLO.md` del repositorio.

> **Estado:** este documento propone requisitos y contratos para revisión. No demuestra que existan tablas de historia clínica, permisos entre clínicas, auditoría ni interoperabilidad externa. Se usarán únicamente identidades, clínicas y datos clínicos **sintéticos** durante el prototipo.

## 1. Objetivo y límites

Definir el alcance de la vista profesional de DentaIA y la **consulta inicial de solo lectura** de un historial clínico odontológico compartido entre clínicas, con autorización explícita, trazabilidad de procedencia y protección frente a accesos indebidos. Este análisis es insumo para DI-155 (diseño), DI-156 (componentes), DI-157 (contrato/servicio) y DI-159 (verificación), sujeto a los acuerdos del equipo.

No se implementan en DI-154 ni el historial clínico real ni su intercambio con sistemas externos. El **historial de solicitudes** (`appointment_requests`) y los **reportes educativos/preventivos** son conceptos distintos de las **atenciones clínicas**; no deben presentarse como entradas de historia clínica.

## 2. Actores y reglas de acceso

- **Paciente:** titular de la información; puede conceder y revocar permisos mediante una operación autenticada en el entorno de prueba.
- **Profesional:** consulta exclusivamente registros incluidos en una concesión vigente y dentro de su alcance; tener rol de odontólogo no basta.
- **Clínica de contexto:** institución desde la cual actúa el profesional; debe quedar identificada al evaluar el permiso y al auditar la lectura.
- **Sistema:** valida identidad, concesión, vigencia, alcance y contexto **antes** de devolver datos; deniega por defecto.

**Regla central:** conocer el identificador de un paciente, pertenecer a una clínica o tener rol profesional **no concede acceso global**. La autorización se evalúa en el servicio/base de datos, no solamente ocultando elementos de la interfaz.

## 3. Campos mínimos del historial clínico

| Campo | Descripción / regla |
| --- | --- |
| `patient_id` | Identificador estable del mismo paciente entre clínicas en el entorno de prueba; no usar nombre como clave. |
| `encounter_id` | Identificador único de cada atención o registro. |
| `attended_at` | Fecha de atención; puede diferir de la fecha de carga. |
| `recorded_at` | Fecha en que se registró la entrada. |
| `professional_id` | Profesional responsable de la entrada. |
| `origin_clinic_id` | Clínica de origen; conservarla al consultar desde otra clínica. |
| `background` | Antecedentes disponibles. |
| `diagnoses` | Diagnósticos consignados en el registro sintético. |
| `treatments` | Tratamientos consignados. |
| `exams` / `references` | Exámenes o referencias disponibles, con fecha y estado de disponibilidad. |

**Ausente ≠ desconocido:** `no_registrado` indica que no hay un valor en la fuente; `desconocido` indica que se desconoce el dato. No completar campos faltantes con información inventada. Una referencia a examen no disponible debe mostrarse como tal, sin simular su contenido. La vigencia clínica de un examen antiguo la determina el profesional; la aplicación no debe declararlo válido automáticamente.

## 4. Requisitos funcionales

| ID | Requisito | Comprobación esperada |
| --- | --- | --- |
| RF-01 | Validar identidad y rol profesional. | Un usuario no autenticado o sin rol habilitado no accede a datos protegidos. |
| RF-02 | Identificar paciente, profesional y clínica de contexto. | Toda consulta tiene estos identificadores y registra el contexto. |
| RF-03 | Permitir al paciente conceder acceso con alcance y vigencia definidos. | La concesión autenticada habilita solo lo autorizado. |
| RF-04 | Permitir revocar acceso. | Tras revocación, las siguientes lecturas se deniegan y la UI retira los datos visibles. |
| RF-05 | Consultar cronología y detalle clínico en solo lectura. | Cada atención muestra fechas, profesional y clínica de origen, incluso si proviene de otra clínica. |
| RF-06 | Diferenciar antecedentes, diagnósticos, tratamientos, exámenes y referencias. | Se indican datos ausentes, desconocidos y referencias no disponibles sin inventarlos. |
| RF-07 | Controlar vencimiento y alcance del permiso. | Permisos vencidos o fuera de alcance no permiten lectura. |
| RF-08 | Auditar accesos permitidos y denegados. | Cada intento genera un registro de auditoría; si no se puede registrar, no se entregan datos. |
| RF-09 | Manejar carga, vacío, error y acceso denegado. | Se informa el estado sin revelar datos protegidos; al cambiar de paciente/contexto se limpian datos previos. |
| RF-10 | Separar historial clínico, solicitudes y reportes educativos. | No se mezclan categorías ni se presenta un reporte educativo como diagnóstico clínico. |

## 5. Matriz de autorización propuesta

La evaluación requiere **paciente + profesional + clínica de contexto + permiso + alcance + vigencia**. La siguiente matriz es una especificación, no una prueba ejecutada.

| Escenario | Concesión del paciente | Contexto y alcance | Resultado |
| --- | --- | --- | --- |
| Profesional A consulta paciente P desde clínica 1 | Vigente | Coincide con el alcance | **Permitir** solo campos autorizados y auditar |
| Profesional B consulta P desde clínica 2 | Vigente | Incluye a B y clínica 2 | **Permitir** dentro del alcance y conservar origen de cada entrada |
| Profesional C consulta P | Ninguna | Aunque conoce `patient_id` | **Denegar** y auditar |
| Profesional A consulta P | Vencida | Antes autorizada | **Denegar** y auditar |
| Profesional A consulta P | Revocada | Antes autorizada | **Denegar**, limpiar datos visibles y auditar |
| Profesional A consulta otro paciente Q | Solo existe permiso para P | Paciente distinto | **Denegar** y auditar |
| Servicio de auditoría falla | Cualquiera | No puede dejar constancia de la lectura | **Denegar sin entregar datos** |

## 6. Contratos de servicio propuestos (no implementados)

**Identificadores y concesiones:**

- `Patient`: `patient_id` estable.
- `ProfessionalContext`: `professional_id`, `clinic_id`, identidad autenticada y rol validado.
- `AccessGrant`: `grant_id`, `patient_id`, `professional_id`, `clinic_id`, `scope` (campos/registros autorizados), `granted_at`, `expires_at`, `revoked_at`.
- `ClinicalEntry`: `encounter_id`, `patient_id`, `attended_at`, `recorded_at`, `professional_id`, `origin_clinic_id`, antecedentes, diagnósticos, tratamientos, exámenes y referencias, con indicadores de ausencia/desconocimiento.

**Operaciones previstas:**

| Operación | Actor | Resultado / condiciones |
| --- | --- | --- |
| `grantAccess(patient, professional, clinic, scope, expiry)` | Paciente autenticado | Crea concesión verificable; validar alcance y vencimiento. |
| `revokeAccess(grantId)` | Paciente titular autenticado | Revoca concesión; futuras lecturas deben fallar. |
| `listClinicalEntries(patientId, context)` | Profesional autenticado | Cronología filtrada por permiso vigente; no devuelve datos si falla auditoría. |
| `getClinicalEntry(patientId, encounterId, context)` | Profesional autenticado | Detalle de solo lectura, con procedencia; misma autorización y auditoría. |

**Respuesta de lectura:** `allowed`, `entries`/`entry` únicamente si está permitido, `error_code` seguro si falla (`UNAUTHENTICATED`, `FORBIDDEN`, `GRANT_EXPIRED`, `GRANT_REVOKED`, `AUDIT_UNAVAILABLE`, `SERVICE_ERROR`), y un identificador de auditoría cuando corresponda. Evitar respuestas que revelen datos clínicos o existencia de pacientes a usuarios no autorizados. El contrato definitivo y el mecanismo de auditoría requieren acuerdo con DI-157.

## 7. Inventario de datos y servicios: existente, pendiente y simulado

| Elemento | Estado identificado | Límite |
| --- | --- | --- |
| Next.js y rutas de módulos | Existente según guía de desarrollo | La nueva vista profesional debe diseñarse en su propia ruta sin alterar módulos ajenos. |
| Supabase Auth / cliente de navegador | Existente según guía | La sesión por sí sola no acredita acceso clínico. |
| `dentists` | Tabla documentada en la guía | Directorio, **no** historial clínico. |
| `appointment_requests` | Tabla documentada en la guía | Solicitudes de demostración, **no** atenciones clínicas. |
| Fotos y consentimientos de prueba | Operaciones descritas en la guía para otro módulo | No equivalen a consentimiento para compartir historial entre clínicas. |
| Tabla de pacientes clínicos, atenciones, concesiones y auditoría | **Pendiente de confirmar** con equipo/esquema real | No afirmar que existe ni que tiene RLS configurada. |
| Integración externa entre clínicas | **Fuera del alcance confirmado** | No afirmar interoperabilidad real. |
| Proveedor sintético de prueba | **Propuesto, pendiente de implementar** | Datos ficticios y etiqueta visible «Demostración»; sustituible por servicio autorizado sin cambiar la interfaz. |

Antes de DI-156/DI-157 se debe inspeccionar el esquema vigente y confirmar responsables, API, tablas, RLS, concesión/revocación y auditoría. Este inventario no es una auditoría técnica del backend.

## 8. Escenarios de validación por preparar

1. **Dos clínicas, un paciente:** P tiene una atención sintética en clínica 1 y otra en clínica 2; profesional autorizado ve ambas con sus clínicas y fechas de origen, si el alcance lo permite.
2. **Profesional no autorizado:** C conoce el ID de P, pero la lectura es denegada.
3. **Permiso revocado:** P revoca acceso a A; se impiden nuevas lecturas y se elimina de la vista información previamente cargada.
4. **Permiso vencido:** la consulta posterior al vencimiento no entrega entradas.
5. **Alcance limitado:** el profesional recibe solo los registros/campos cubiertos por la concesión.
6. **Examen antiguo:** se muestra su fecha y se indica que el profesional evalúa su vigencia; no hay validación clínica automática.
7. **Datos incompletos:** se distinguen ausente, desconocido y referencia de examen no disponible.
8. **Fallo de auditoría o servicio:** no se entregan datos si no se puede registrar el acceso; la interfaz muestra un error seguro.
9. **Cambio de paciente o clínica:** la interfaz elimina datos previos antes de consultar el nuevo contexto.

Estos son **casos diseñados**, no resultados de pruebas realizadas ni evidencia de interoperabilidad.

## 9. Requisitos no funcionales

- **Seguridad y privacidad:** denegación por defecto, autorización en servidor/base de datos, mínimo privilegio, sin datos clínicos reales en prototipos ni secretos en frontend.
- **Auditoría:** registro de accesos permitidos y denegados; fallo cerrado si la auditoría no está disponible.
- **Accesibilidad:** navegación con teclado, foco visible, etiquetas comprensibles y estados anunciados adecuadamente.
- **Adaptabilidad:** panel legible en escritorio y móvil; sin pérdida de información de procedencia.
- **Consistencia:** no conservar datos de otro paciente al cambiar de contexto; distinguir contenido clínico de demostración y educativo.

## 10. Dependencias, decisiones y entrega

**Dependencias:** DI-145 (historia principal), contrato de roles de administración, DI-36 (autorización), DI-42 (reportes), DI-155 (interfaz), DI-156 (componentes), DI-157 (servicio/contrato) y DI-159 (verificación).

**Por confirmar con Jhan/equipo:** esquema de datos real, responsable de operaciones de concesión/revocación, definición exacta de `scope`, mecanismo de auditoría, ruta de la vista, rol profesional y cómo se integra el proveedor sintético. No ampliar unilateralmente DI-146.

**Evidencia esperada de DI-154:** este archivo `.md` versionado en rama propia y commit identificado con `DI-154`; enlace del commit o PR registrado en Jira. La redacción del análisis **no significa** que sus contratos hayan sido aprobados ni que los escenarios se hayan ejecutado.
