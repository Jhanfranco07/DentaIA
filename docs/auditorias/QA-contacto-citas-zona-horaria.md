# QA de contactos y citas: zona horaria

La prueba `scripts/qa/directorio/01_contacto_citas.sql` creaba una cita para
`current_date` de la sesión. La función `gestionar_cita_profesional` solo permite
completar citas confirmadas cuya fecha no sea posterior a la fecha de Lima.
Con una sesión UTC, entre 00:00 y 04:59 UTC ambas fechas pueden diferir.

Se fija `America/Lima` en la sesión de QA. No se modifican migraciones,
autorizaciones, políticas RLS ni las restricciones de transición de producción.

## Comprobación local

Se ejecutaron el entorno sintético, ambas migraciones de contactos/citas y la
prueba SQL completa en PostgreSQL embebido PGlite. Para reproducir el límite
de fecha se sustituyeron `now()` y `current_date` en las entradas del ejecutor
temporal por expresiones del mismo instante fijo, conservando las conversiones
de zona horaria. Estas sustituciones no se aplicaron a los archivos del proyecto.

- Original, instante `2026-11-23 01:15:00+00`: reproduce `TRANSICION_INVALIDA`.
- Corregida: pasa a las 01:15, 04:59, 05:01 y 17:15 UTC del mismo día.
- Compilación de producción: aprobada.
- Vitest: 116 pruebas aprobadas.

La repetición de GitHub Actions con su servicio PostgreSQL 17 queda pendiente
de publicar el cambio en la rama del PR.
