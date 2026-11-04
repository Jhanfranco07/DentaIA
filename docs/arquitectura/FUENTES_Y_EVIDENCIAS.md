# Fuentes verificadas de esta auditoría

Fecha 03/11/2026, America/Lima. Las fuentes originales siguen en ../evidencias/arquitectura y sus hashes se comprueban sin modificarlas. Este documento sustituye las afirmaciones de inspección de la copia inicial; no atribuye a esta ejecución los 160 archivos o estados de Vercel citados por el paquete anterior.

## Git local y GitHub

Repositorio conectado confirmado mediante GitHub, refs actualizadas con git fetch y archivos contrastados mediante git show, sin checkout de ramas de compañeros. Rama de documentación desde c992a142; no commits ni publicación.

| Ref | SHA |
|---|---|
| origin/main | 1bcb84956e755b4089494af43f983fd0d2e5bfad |
| origin/feature/superusuario-admin | c992a14229d1bc838166dae200559b9aa7f7428c |
| origin/feature/vista-paciente | ac545b5d084961d96f9c3df832c291b4acbfdba7 |
| origin/feature/vista-odontologo | 2a2fc752c8ae7c3b704bcb8182835efebbf04a22 |
| origin/feature/anelis-di156-historial-demo | 3f69a50ccdc1959b2329a30347adca6b24f984ad |
| origin/feature/anelis-vista-profesional-s5 | 6b9aa5ca189352bb7d17bdcb1ce82b1e42cd3376 |
| origin/feature/angie-avance3 | fd7c7cd26dcb26f7277ef39c549ce5160a4c565a |
| origin/feature/landing-comercial | 55d8023acf92a14fe44dc58d365cc5d5e3b0b114 |

La rama paciente avanzó desde el SHA 502790a6 del insumo a ac545b5d. main conserva la pantalla profesional sintética; el historial de la rama DI-156 usa un escenario simulado, no un servicio Supabase. Administración conserva sus controles y declaración manual; no se prueba aquí una escritura administrativa remota. El detalle de archivos/hashes está en FUENTES_VERIFICADAS.json.

## Jira

JQL project = DI, paginación 100 + 71: 171 incidencias con descripción. Se verificaron específicamente DI-34, DI-36, DI-144, DI-145 y DI-146 y se contrastaron criterios del resto del alcance. DI-144 figura En curso y DI-151 Listo; un estado administrativo no prueba una migración o un permiso efectivo. No se escribieron comentarios ni estados. Las descripciones y responsables mínimos de coordinación están en REQUISITOS_JIRA_VERIFICADOS.json.

## Supabase

Solo SELECT de catálogo y metadatos del bucket; ninguna fila de pacientes, perfiles, Auth, fotografías o resultados. PostgreSQL reporta **17.11**. Cinco tablas/43 columnas, 32 restricciones, 13 índices, 16 políticas y bucket dental-photos privado con 8 MiB y JPEG/PNG/WebP. No aparecen tablas/funciones de negocio dentaia_admin, clinical o ml. Migraciones aplicadas observadas: 20261025150315 dentaia_mvp_independent_modules y 20261025150507 allow_photo_owner_cleanup_after_consent_revocation.

Se inspeccionaron además 68 columnas de tablas Auth relevantes y 89 entradas de privilegios de columnas para anon/authenticated, sin valores de cuentas. pgcrypto 1.3 instalado; btree_gist disponible 1.7 pero sin instalar. No se cambia configuración ni se aplica DDL. Los JSON VERIFICADO contienen el catálogo, no secretos.

## Fuentes primarias de plataforma

- [Restricciones PostgreSQL](https://www.postgresql.org/docs/17/ddl-constraints.html): FK, CHECK/NULL, UNIQUE y exclusión.
- [btree_gist](https://www.postgresql.org/docs/17/btree-gist.html): igualdad y desigualdad en exclusiones; no se presenta como extensión instalada.
- [Funciones Supabase](https://supabase.com/docs/guides/database/functions): privilegios, search_path y elección de SECURITY INVOKER/DEFINER.
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [Auth](https://supabase.com/docs/guides/auth/managing-user-data).

No se revalidó el despliegue Vercel ni se disparó CI; sus estados del paquete anterior son evidencia histórica atribuida. Se revisaron los YAML actuales y el diseño de despliegue, sin introducir infraestructura sin evidencia.
