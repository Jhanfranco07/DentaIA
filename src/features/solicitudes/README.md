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
