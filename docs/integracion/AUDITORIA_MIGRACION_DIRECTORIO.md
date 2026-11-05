# Auditoría de compatibilidad de la migración de directorio y reseñas

**Fecha:** 2026-11-05
**Proyecto inspeccionado:** Supabase Dental-IA (`vwmdknzjyvmsdqpepykz`)
**Rama:** `develop`
**SHA antes de esta auditoría:** `7318895a597dd8689964fcaf2bcc38f648c8ec5c`
**Alcance:** metadatos PostgreSQL/Supabase únicamente. No se consultaron filas de perfiles, clínicas, solicitudes, reseñas ni historias clínicas; no se aplicaron DDL/DML ni se cambiaron grants, políticas o datos remotos.

## Resultado de la comparación

La lectura del catálogo Supabase confirmó que aún no existen `public.dentist_public_locations`, `public.dentist_reviews`, `public.dentist_review_reports`, los cuatro índices propuestos ni la función `public.prevent_professional_self_review()`. No hay colisión de nombres con esos objetos. La migración remota más reciente es `20261104010757`; el archivo local usa una versión posterior (`20261105160341`).

`public.dentists` ya tiene RLS y una política de lectura pública para odontólogos activos. Su esquema tiene el perfil público y `is_demo`, pero no dirección ni coordenadas. `clinical.clinics` tiene un campo de ubicación de texto, sin latitud o longitud. Las asociaciones están en `clinical.professional_accounts` y `clinical.clinic_memberships`; estas tablas mantienen políticas limitadas al ejecutor clínico.

PostGIS no está instalado actualmente. El catálogo de extensiones confirma que PostGIS 3.3.7 está disponible en el esquema `extensions`. Las funciones `auth.uid()` y `auth.jwt()` existen; los nombres de función, índice y tabla nuevos no existen.

La migración crea solo tres tablas nuevas, dos índices GIST/BTREE parciales y una función de trigger. No altera `dentists`, `appointment_requests`, `clinical.*`, grants ni RLS existentes. Sus claves foráneas apuntan a relaciones existentes: sede→dentista y clínica; reseña→odontólogo, solicitud y autor; reporte→reseña y reportante. Las políticas actuales de `appointment_requests` limitan la lectura a la persona propietaria y la creación a solicitudes propias.

## Seguridad y problemas detectados

### Coordenadas de consultorio

La tabla de ubicaciones activa RLS, revoca todos los privilegios de `public`, `anon`, `authenticated` y `service_role`, y concede a `anon`/`authenticated` únicamente `SELECT` de `id`, `dentist_id`, nombre/dirección, coordenadas y fecha. No expone `clinic_id`, membresía, estado de publicación ni geometría. La política requiere ubicación publicada y dentista activo. Por tanto, un paciente no puede insertar, cambiar ni publicar coordenadas mediante Data API.

Las dos claves foráneas solo comprueban que el dentista y la clínica existan; no prueban que el profesional esté verificado ni que tenga una membresía vigente en esa clínica. Como el cliente carece de escritura, esto no habilita al paciente a inventar el vínculo. Antes de que un proceso confiable inserte ubicaciones, ese proceso debe validar `professional_accounts.status = 'verified'`, clínica activa, membresía activa y vigencia. La migración todavía no implementa un publicador de ubicaciones.

### Reseñas

La proyección pública excluye `author_user_id` y `moderation_status`; solo publica filas moderadas para perfiles activos. Reportes no tienen lectura pública ni lectura para usuarios autenticados. La inserción de reseñas solo admite las columnas de odontólogo, solicitud, calificación y comentario; autor y estado se fijan con valores del servidor. La política requiere identidad propia, rol paciente activo, no tener rol odontólogo, solicitud propia no demo y estado `completed`, y la restricción única permite una reseña por solicitud. Se añadió un trigger `SECURITY DEFINER` con `search_path = pg_catalog`, nombres de esquema cualificados y ejecución revocada, que consulta la asociación clínica privada y bloquea la autorreseña sin exponer esa asociación como RPC.

**Limitación estructural confirmada:** en el esquema remoto actual, `appointment_requests.is_demo` tiene `CHECK (is_demo)` y `status` solo permite `requested` o `cancelled`. Por ello, ninguna solicitud actual puede satisfacer `is_demo = false AND status = 'completed'`; el control es fail-closed y no se debe debilitar para habilitar reseñas académicas. No hay fuente actual para una visita real completada. La interfaz no tendrá reseñas elegibles hasta que se diseñe un registro confiable de atenciones reales y se audite su autorización.

Las claves foráneas de reseña y reporte usan `ON DELETE CASCADE` para que una solicitud/cuenta eliminada no quede bloqueada por reseñas o reportes dependientes. La eliminación de esos registros de contenido derivado es intencional y queda descrita en los comentarios SQL.

### Compatibilidad sin migración

El cliente mantiene la consulta base de `dentists` separada de las consultas opcionales de ubicaciones y reseñas. Si las tablas no existen, o existen sin filas, conserva el listado y perfil; presenta los datos opcionales vacíos/no disponibles y no inventa marcadores ni estrellas. Se añadieron pruebas que simulan `PGRST205` para las tablas ausentes. Las consultas y proyecciones no leen el esquema `clinical`.

## Rollback

El rollback ahora requiere la marca de esta migración en cada tabla y función, aborta si encuentra filas en cualquiera de las tablas y no usa `CASCADE`. Conserva PostGIS. Así no borra información de una tabla homónima preexistente ni ubicaciones/reseñas/reportes añadidos tras aplicar el cambio. Si hay datos, el rollback se detiene y exige una decisión manual. La protección fue validada por tests de contrato SQL, no ejecutando SQL contra una base.

## Posibilidad de validación local

Una prueba aislada con Supabase Local es técnicamente posible con Docker y una línea base de esquema reproducible. Este entorno no está listo: `docker info` no encuentra el daemon de Docker; el repositorio no contiene `supabase/config.toml` y solo tiene dos migraciones locales frente a siete versiones registradas en el proyecto remoto. Sin restaurar el esquema base y ejecutar Docker, no se puede afirmar que un `supabase start/db reset/db lint` reproduzca la base actual. No se creó una rama remota de Supabase ni se exportaron datos.

Para una validación fiel: restaurar/iniciar Docker; preparar una base local vacía con la línea base aprobada de `public`, `clinical` y los stubs de `auth`; aplicar únicamente migraciones locales versionadas; ejecutar la migración; verificar catálogos, grants, RLS y trigger con roles `anon`/`authenticated`; probar rollback vacío y la negativa ante datos; destruir exclusivamente esa base efímera. Esta prueba local debe preceder cualquier aplicación remota futura.

## Correcciones locales y pruebas

- Se añadió un control de autorreseña contra la asociación clínica privada y se revocó su ejecución directa.
- La lectura de reseñas publicadas requiere que el odontólogo siga activo; la inserción requiere claims DentaIA activos.
- Se cambiaron las FK de contenido derivado a `ON DELETE CASCADE` para permitir la eliminación de cuentas y solicitudes.
- El rollback comprueba marcas de propiedad y contenido antes de eliminar objetos.
- Se extrajeron helpers de compatibilidad del directorio y se añadieron pruebas para tablas ausentes/vacías y contratos de grants, RLS, elegibilidad, autorreseña y rollback.

Validaciones locales: `npm run typecheck` aprobado; `npm run build` aprobado; suite `node --experimental-strip-types --test` sobre los archivos `src/**/*.test.mjs`: **426 aprobadas, 0 fallidas**; `git diff --check` aprobado. Las pruebas SQL son de contrato estático: no sustituyen un `db lint`, ejecución transaccional ni prueba RLS real.

## Orden seguro de despliegue

1. El código de frontend puede desplegarse antes de la migración: las tablas ausentes se tratan como capacidades no disponibles y no bloquean los perfiles/listado. El mapa y reseñas no estarán operativos hasta contar con esquema y datos autorizados.
2. No aplicar esta migración a Supabase remoto en este cambio. Primero completar la validación local sobre la línea base real.
3. Antes de poblar ubicaciones, implementar/revisar el proceso confiable que compruebe perfil verificado, clínica y membresía vigente, y estado de publicación. No habilitar escritura desde el cliente.
4. Antes de habilitar el formulario de reseñas para uso real, implementar una fuente auditada de atenciones completadas reales. Mantener excluidas solicitudes demo y no expandir la constraint académica de solicitudes.
5. Aplicar después la migración revisada, verificar RLS/grants con roles de prueba y solo entonces cargar ubicaciones autorizadas o moderar reseñas.
6. Si fuera necesario revertir: usar el rollback solo en la base objetivo y sin datos en las tablas nuevas; si tiene filas, exportar y acordar retención antes de cualquier retiro.

## Conclusión

**El código puede publicarse sin aplicar todavía la migración; no requiere otra capa temporal de compatibilidad.** La compatibilidad para tablas ausentes ya está implementada y probada. En ese estado, el directorio conserva perfiles, pero no mostrará ubicaciones ni reseñas. La migración no debe aplicarse hasta completar la prueba local reproducible y el proceso confiable de publicación; el flujo de reseñas reales requiere además una fuente de atenciones completadas que hoy no existe.
