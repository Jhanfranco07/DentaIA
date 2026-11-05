# DI-156 — Implementación de la vista profesional

**Proyecto:** DentaIA
**Historia relacionada:** DI-145 — Vista del odontólogo
**Insumo de requisitos:** [DI-154](./DI-154-analisis-requisitos-vista-profesional.md)
**Estado:** primera versión funcional de interfaz con datos exclusivamente sintéticos.

## Objetivo

Implementar la vista /profesional como una demostración de consulta de historial clínico compartido de solo lectura. La entrega permite revisar la estructura, procedencia y estados de interfaz previstos, sin consultar información clínica real ni afirmar autorización clínica implementada.

## Alcance implementado

- Selección local entre dos casos ficticios.
- Cronología ordenada por fecha de atención, con fecha de registro, profesional responsable y clínica de origen.
- Detalle desplegable de antecedentes, diagnósticos, tratamientos y referencias de exámenes.
- Distinción visible entre dato no registrado, dato desconocido y examen no disponible.
- Estados visuales simulados de carga, vacío, acceso denegado y error.
- Limpieza de caso y atenciones al cambiar de caso o de escenario, antes de resolver la nueva vista.
- Separación explícita entre historial clínico y solicitudes de demostración. La vista no consulta ni administra appointment_requests.

## Arquitectura y componentes

| Archivo | Responsabilidad |
| --- | --- |
| src/app/(modulos)/profesional/page.tsx | Página delgada que delega la interfaz al feature. |
| src/features/profesional/ProfesionalDemo.tsx | Componente cliente que controla el caso y el escenario de demostración. |
| src/features/profesional/EstadoHistorial.tsx | Renderiza estados, resumen del caso, cronología y detalle de atenciones. |
| src/features/profesional/historial-sintetico.ts | Tipos, fixtures sintéticas, formateo, orden cronológico y transiciones de estado. |
| src/features/profesional/profesional.module.css | Estilos locales, adaptables y coherentes con las variables visuales existentes. |
| src/features/profesional/historial-sintetico.test.mjs | Pruebas aisladas de utilidades y transiciones. |

La página no declara un segundo elemento main; se integra con el contenedor de rutas existente. La interacción se limita al componente cliente del feature y no modifica componentes globales, tipos generados ni el cliente de Supabase.

## Datos sintéticos

Las fixtures incluyen dos pacientes de demostración, profesionales y clínicas ficticias. Cada atención contiene identificadores sintéticos internos, fechas, procedencia, campos clínicos de ejemplo y referencias de exámenes. Ningún dato procede de Supabase, de historias clínicas reales, de fotografías ni de solicitudes.

Los estados de campo son:

- **registrado:** muestra el texto sintético asociado.
- **no_registrado:** informa que no existe valor en la fuente sintética.
- **desconocido:** informa que el dato se desconoce en la fuente sintética.
- **no_disponible** para exámenes: muestra la referencia y aclara que no se presenta contenido ni se infiere vigencia clínica.

## Estados simulados de interfaz

El selector de escenario es una herramienta visible de demostración. No autentica usuarios ni evalúa rol, alcance, vigencia, concesiones, revocaciones o auditoría.

| Escenario seleccionado | Resultado visual | Datos visibles |
| --- | --- | --- |
| Contenido sintético | Cronología y detalle del caso seleccionado. | Solo fixtures locales. |
| Sin datos | Mensaje de estado vacío. | Ninguno. |
| Acceso denegado | Alerta de denegación simulada. | Ninguno. |
| Error de carga | Alerta de error segura. | Ninguno. |

Cada cambio inicia en estado de carga y limpia caso y atenciones; tras la demora local de demostración se resuelve el escenario. Así no permanece visible información del caso anterior durante carga, denegación o error.

La interfaz usa etiquetas, fieldset, controles nativos, elementos time, navegación con nombre accesible, details para el detalle y regiones de estado o alerta según corresponda.

## Pruebas automatizadas

Se añadieron pruebas aisladas para:

- Orden cronológico sin mutar las fixtures.
- Formateo y rechazo de fechas inválidas.
- Distinción entre datos registrados, no registrados y desconocidos.
- Transición inicial de carga sin datos residuales.
- Resolución del caso seleccionado.
- Limpieza de datos en vacío, denegación, error y caso desconocido.

Resultados reportados:

- Suite automatizada: **96 pruebas aprobadas, 0 fallos**.
- Typecheck: correcto.
- Build de producción: correcto, incluida la ruta /profesional.

## Validación visual manual

La persona responsable confirmó manualmente que la interfaz y sus interacciones funcionan visualmente. Esta comprobación manual es distinta de las pruebas automatizadas: valida el comportamiento observable de selección, estados y detalle de la interfaz, pero no demuestra permisos, persistencia, RLS, auditoría ni acceso clínico real. No se reportan capturas ni resultados adicionales.

## Limitaciones y continuidad en DI-157

DI-156 no implementa autorización clínica. Siguen pendientes de definir e implementar en el backend o base de datos:

- Identidad y rol profesional verificables.
- Contexto real de profesional, paciente y clínica.
- Concesiones de acceso, alcance, vigencia y revocación.
- Fuente real de atenciones y referencias clínicas.
- Auditoría de lecturas permitidas y denegadas, con comportamiento de fallo cerrado.
- Contrato de servicio que entregue solo datos autorizados y códigos seguros de error.

Al existir ese contrato aprobado, los escenarios locales deberán sustituirse por respuestas del servicio autorizado. La interfaz no debe usar la sesión del navegador ni los controles visuales como mecanismo de autorización.
