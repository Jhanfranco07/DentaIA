# Solicitudes — Anelis

Ruta `/solicitudes`, rama de primera ronda `feature/anelis-solicitudes`. **Antes de iniciar mejoras, completar y comprobar el módulo inicial** de registro, listado propio y cancelación de solicitudes de demostración, según [guía general](../../../docs/DESARROLLO.md). No es una reserva confirmada ni una cita clínica real.

## Primera ronda — entrega funcional

Con sesión autenticada, obtener odontólogos desde `dentists` sin importar el componente de Angie; insertar `appointment_requests` con odontólogo seleccionado, nombre, correo, fecha igual o posterior a hoy, hora opcional y mensaje máximo 1000 caracteres. Mostrar solicitudes propias y permitir cambiar estado únicamente de `requested` a `cancelled`. Supabase aplica RLS. Validar operaciones y errores con datos ficticios.

## Siguiente ronda — propuestas independientes

- **DI-27 — Corregir fallos funcionales del prototipo (Sprint 5, 27/10–09/11):** reparar un error real del formulario, validaciones o navegación. **DI-94:** revisar navegación, validaciones y errores; **DI-95:** registrar el fallo corregido, commits y build.
- **DI-26 — Priorizar e implementar mejoras de interfaz (Sprint 5):** mejorar pantalla de solicitudes solamente si hay necesidad observada; describir la evidencia y comparar antes/después. **DI-92/DI-93:** priorización y documentación. No inventar comentarios de pacientes.
- **DI-36 / DI-119 (Sprint 6):** pruebas de operaciones y permisos del backend cuando el flujo esté implementado.

## Pruebas y PR

Pruebas `*.test.mjs` con cliente simulado para validaciones, lista vacía, fecha, cancelación y estados. Pruebas con Supabase real y dos identidades aparte; no incluir credenciales en Git. Empezar desde `main` actualizada y trabajar solo en `src/app/(modulos)/solicitudes/**` y `src/features/solicitudes/**`. Commits propios y PR. Los tres pipelines comunes se ejecutan automáticamente; no crear pipelines individuales.

Guía general: [docs/DESARROLLO.md](../../../docs/DESARROLLO.md).


## Entregables numerados de Anelis

- **Avance 1 — PENDIENTE DE CONFIRMAR:** solicitudes de demostración, listado propio y cancelación; debe probarse y tener PR integrado antes de considerarse completado.
- **Avance 2 — DI-24–25 / DI-86–91:** escenarios, métricas, consentimiento/protocolo y pruebas de usabilidad con participantes reales; registro de hallazgos. **DI-27:** reparar errores detectados en formularios de solicitudes. No inventar participantes, comentarios ni métricas.
- **Avance 3 — DI-36 / DI-117–119:** reforzar persistencia y validaciones, probar permisos/autorización y operaciones de solicitud. **DI-39:** revisar calidad y privacidad de fotografías con evidencia; coordinar con dueño del módulo sin editarlo directamente.
- **Avance 4 — DI-42 / DI-134–135:** reporte preventivo explicable y vínculo con directorio, *solo orientación no diagnóstica*. **DI-43:** ejecutar/documentar pruebas y revisión odontológica únicamente si ocurren realmente.

**En paralelo:** DI-28 segmentación ya figura *Listo* (revisar evidencia) y DI-31 Business Model Canvas *En curso*. No son funcionalidades de solicitudes.

Crear rama independiente por avance, mantener código separado y resultados reproducibles. Ver [plan maestro](../../../docs/DESARROLLO.md).
