# Harness local DI-36

`scripts/supabase/run-di36-local-qa.ps1` valida primero que el destino sea el
contenedor Docker local `supabase_db_DentaIA`, comprueba los cuatro SHA-256
originales y genera copias temporales fuera de `supabase/migrations`.

La única adaptación cambia la primera rama de identificación: en vez de aceptar
el proyecto remoto, exige que `postgres` tenga el marcador
`DENTAIA_PHASE8_SYNTHETIC_ONLY` y la GUC
`dentaia.integration_approval=fase8_local_simulation`. Conserva la huella del
esquema, el DDL, RLS, ACL, funciones y triggers. Las fuentes originales no se
modifican ni las copias temporales se versionan.

Para un ensayo limpio, desactivar temporalmente `db.migrations.enabled` solo
en el archivo de trabajo local, ejecutar `supabase stop --no-backup` y
`supabase start`, aplicar las dos migraciones recuperadas de octubre mediante
`psql -v ON_ERROR_STOP=1`, y por ultimo ejecutar el harness. Restaurar
inmediatamente `db.migrations.enabled = true`; ese ajuste temporal nunca se
versiona. El 16 de noviembre este procedimiento termino con salida 0 para las
cuatro DI-36.

Si alguna migracion falla, el harness no ejecuta la siguiente y conserva en el
directorio temporal indicado los SQL adaptados y un archivo `.log` por
migracion. La salida identifica la migracion y el codigo de salida de `psql`.

## Reconstruccion completa de PR #75

En el stack local limpio de PR #75, la secuencia completa fue: octubre, DI-36
con este harness, ubicaciones/resenas, workflows, demo locations, payments,
DI-172 como dependencia externa temporal, y las migraciones DI-131, Smile,
Premium y `payments_failed_status`. DI-151 se excluyo solo en esta base de QA
porque crea funcionalmente los mismos objetos de Administracion que DI-36.
Los archivos SQL historicos y sus hashes permanecieron intactos.

DI-172 se obtuvo de `origin/feature/DI-172-rutinas` sin cambiar esa rama ni
incorporar su migracion a PR #75. El SQL probado tuvo SHA-256
`f21a6050bd8fea9d6dd5a2a49cd5422e98c35f700c3336e22203f56b16f88795`.
Las pruebas pgTAP pasaron: DI-172 45, DI-131 9, Smile 7, pagos fallidos 3 y
Premium RLS 6 (70 aserciones en total). DI-172 se ejecuto como
`supabase_admin`, rol superusuario de esta base local requerido por su
preflight.

La generacion TypeScript local cubrio 19 tablas: las 16 de esta rama coinciden
en nombres y columnas con `src/lib/supabase/database.types.ts`; se incorporo
`dentist_services`, que faltaba. Las otras tres tablas pertenecen a DI-172 y
no se agregan al contrato de produccion mientras esa migracion siga siendo
externa.

El stack se uso sin vincular un proyecto Supabase. No se ejecuto SQL remoto ni
se modifico su historial. Production sigue bloqueada hasta comprobar el
historial remoto en modo solo lectura, obtener aprobacion y planificar el
despliegue autorizado. Esta QA no sustituye pruebas reales de Stripe Sandbox.
