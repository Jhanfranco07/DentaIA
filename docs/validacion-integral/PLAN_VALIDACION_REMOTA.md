# Plan de validación remota segura

## Estado previo

El repositorio contiene la migración `supabase/migrations/20261105223000_directory_demo_locations.sql` y los scripts `supabase/demo-data/seed_directorio_20_sprint6.sql` y `cleanup_directorio_20_sprint6.sql`. No se halló un proyecto DentaIA QA separado accesible al conector de esta sesión. El ref público de `.env.example` **no debe asumirse de pruebas**. Esta ronda no hizo consultas SQL ni escrituras en ese proyecto. La [guía oficial de entornos](https://supabase.com/docs/guides/deployment/managing-environments) recomienda separar staging y producción; el [changelog CLI v3](https://supabase.com/changelog/supabase-cli-v3) advierte cambios de comportamiento, por lo que hay que verificar versión/`--help` antes de usar CLI.

## Precondiciones antes de cualquier carga

1. El propietario designa por escrito el **ref QA** y confirma que es independiente de producción, sin pacientes ni profesionales reales. Registrar responsable, fecha, esquema base y método de recuperación. No reutilizar el ref de `.env.example` por inferencia.
2. Obtener acceso QA por canal seguro. Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son públicas para Next; credenciales SQL quedan fuera del repositorio, capturas y logs. No crear cuentas Auth ni modificar roles para este dataset.
3. Con inspección **de solo lectura**, comprobar `to_regclass('public.directory_demo_locations')`, versión de migración, columnas/restricciones, `relrowsecurity`, política de lectura publicada, grants de solo `SELECT` para `anon/authenticated`, ausencia de grants DML, y exposición de `public` en Data API. Consultar conteo de slugs reservados y colisiones; no consultar filas de pacientes.
4. Comparar el esquema QA con la migración versionada. Si falta, preparar migración aprobada por el equipo; no improvisar DDL durante esta validación. Verificar que el deployment Next QA usa el ref QA y no URL/clave de producción.
5. Revisar el SQL exacto generado mediante `node --experimental-strip-types scripts/directorio-demo.mjs check` y diff. Confirmar un respaldo o snapshot QA antes de la transacción.

## Ejecución propuesta, solo tras autorización específica

Con conexión `psql` al proyecto QA designado, desde una estación autorizada y sin imprimir credenciales:

```powershell
psql -X -v ON_ERROR_STOP=1 -d '<conexion-QA-obtenida-seguramente>' -f supabase/demo-data/seed_directorio_20_sprint6.sql
psql -X -v ON_ERROR_STOP=1 -d '<conexion-QA-obtenida-seguramente>' -f supabase/demo-data/seed_directorio_20_sprint6.sql
psql -X -v ON_ERROR_STOP=1 -d '<conexion-QA-obtenida-seguramente>' -c "select count(*), count(distinct slug) from public.directory_demo_locations where slug like 'odontologo-demo-s6-%' and is_demo and is_published and not requests_enabled;"
```

Esperado: 20 y 20; registrar `INSERT`/`NOTICE`, conteo previo y posterior, y la identidad del entorno (sin secreto). Comprobar desde Data API como `anon` que solo los puntos publicados son legibles; confirmar que no se permite `INSERT`, `UPDATE` ni `DELETE` cliente. En navegador QA comprobar lista, búsqueda, especialidad, distrito, ficha, selección de marcador y aviso demo en 320/390/768/1024/1440 px. Verificar que no hay enlace a ruta ni solicitud real para estos 20 perfiles. Probar cuentas sintéticas autorizadas para paciente, odontólogo y superusuario/AAL2 según la matriz, sin datos reales.

## Reversión y límites

Ejecutar `cleanup_directorio_20_sprint6.sql` **solo en el mismo QA**, tras confirmar que los slugs pertenecen al dataset. Verificar 0 nuevos y que los conteos de otras filas no variaron. Si el seed falla, la transacción revierte; investigar antes de reintentar. El cleanup restringe slug, `is_demo`, `requests_enabled=false` y nombre del punto, por lo que no borra el demo anterior `clinica-demo-la-molina`. Nunca ejecutar contra producción. Si no existe QA separado o autorización concreta, mantener la carga pendiente y continuar solo con pruebas locales.
