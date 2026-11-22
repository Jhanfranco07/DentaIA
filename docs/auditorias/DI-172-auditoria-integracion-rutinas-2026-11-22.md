# Auditoría funcional de Mis rutinas — 22/11/2026

## Alcance y evidencias
Revisión del código de `RutinasPaciente.tsx`, `datos.ts`, `contrato.ts`, `modelo.ts`, migración DI-172, integración con Denti y guías de buenas prácticas. Comprobación **solo lectura** en el proyecto Supabase Dental-IA.

El proyecto remoto contiene un plan `general-preventive` v1 publicado y tres actividades. Las tablas `oral_care_routine_plans`, `oral_care_routine_activities` y `patient_routine_completions` tienen RLS activo (1, 1 y 3 políticas respectivamente). Se comprobaron registros persistidos sin consultar información identificable de pacientes. Esto **no** constituye prueba E2E del navegador o de JWT de dos cuentas.

## Flujo funcional esperado
1. El paciente autenticado abre `/paciente/rutinas` y ve su plan preventivo vigente.
2. Ve qué actividades le quedan, el porcentaje real y las actividades agrupadas por momento del día.
3. Puede consultar la guía correspondiente antes de realizar una actividad.
4. Solo marca o desmarca actividades del día actual. Las marcas se registran bajo su cuenta con RLS.
5. El progreso se recalcula y Denti puede mostrar un aviso flotante a partir de las marcas persistidas.
6. El historial anterior permanece de solo lectura y utiliza la versión de plan de cada fecha.
7. Si hay un error de conexión, se muestra error recuperable, sin inventar cumplimiento.

## Hallazgos y prioridades
| Prioridad | Hallazgo | Situación |
| --- | --- | --- |
| Alta | No existen asignaciones individuales de planes: el proveedor solo elige `general-preventive`. | Pendiente de diseño y migración segura |
| Alta | No hay flujo odontólogo → paciente → asignación/aprobación de rutina ni permisos para ello. | Pendiente |
| Alta | No existe adaptación validada de actividades tras resultados de visión dental; no usar detecciones como diagnóstico. | Pendiente |
| Alta | Las guías educativas no estaban enlazadas desde las actividades del día. | Corregido en esta rama con enlaces a guías existentes |
| Media | No había resumen visible con avance, días registrados y días completos. | Corregido en esta rama con métricas derivadas de registros |
| Media | No se destacaba la siguiente actividad ni botón de regreso a hoy. | Corregido en esta rama |
| Media | El día local se calculaba al renderizar sin mecanismo de actualización de reloj. | Mejorado con actualización en foco y periódica |
| Media | Cada operación vuelve a leer todo el historial, con paginación de 500 marcas. Puede escalar mal. | Pendiente de optimización por rangos/caché |
| Media | Los planes no publicados dejan de estar en el catálogo de historial; evaluar conservación de la interpretación histórica en ese caso. | Pendiente de análisis |
| Media | Falta validación E2E con dos sesiones Auth reales y prueba visual móvil/escritorio en entorno aislado. | Pendiente |
| Baja | Las notificaciones de Denti usan la rutina real del día, pero falta configuración explícita de frecuencia y horarios preferidos. | Pendiente |

## Mejoras incorporadas aquí
- Tarjetas de avance verificable basadas en marcas de Supabase; sin cifras inventadas.
- Una sección de siguiente paso que nunca marca actividades automáticamente.
- Accesos a las guías publicadas de cepillado e hilo dental.
- Regreso al día actual desde el historial y actualización de fecha de Lima.
- Limpieza de estado si no existe sesión de paciente.

## Validación pendiente
Comprobar en el preview con un paciente de pruebas: lectura de plan, marcar/desmarcar, historial de solo lectura, guía correcta, retorno a hoy, modo oscuro, pantalla móvil y aviso de Denti. No usar datos reales para pruebas destructivas. La futura personalización necesita modelo de asignaciones, autorización profesional, aceptación del paciente y auditoría de cambios; debe tratarse como una historia independiente.
