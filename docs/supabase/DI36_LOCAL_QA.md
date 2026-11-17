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
