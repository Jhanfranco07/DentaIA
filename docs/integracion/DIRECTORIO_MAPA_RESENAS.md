# Directorio, mapa y reseñas — alcance y validación local

**Fecha:** 2026-11-05
**Rama:** `develop`
**Base revisada:** `53a3df135191f8a21924ad200f5e088676834b8e`
**Entorno:** Windows local, Node.js 22.17.0, Next.js 15.5.28. No se cargaron credenciales ni se accedió a Supabase remoto desde esta ejecución.

## Cambios preparados

- Se retiró el recorrido `/analisis/demo` de la navegación principal y sus CTA llevan al módulo `/analisis`. La ruta antigua redirige para conservar enlaces guardados. El motor de inferencia sigue marcado como pendiente; no se presentan resultados clínicos simulados como análisis real.
- El directorio conserva búsqueda por nombre, especialidad y distrito, y añade filtros de radio y orden por cercanía solo después de solicitar la geolocalización. Las distancias se expresan como línea recta.
- Se añadió un mapa MapLibre de carga dinámica en cliente, con marcadores para ubicaciones publicadas y atribución visible de OpenStreetMap. El usuario se sitúa localmente después de pulsar el botón; las coordenadas no se guardan en Supabase. Las solicitudes de teselas del mapa revelan al proveedor el área visible del mapa.
- Los perfiles listan las ubicaciones y enlaces de indicaciones que existan en la tabla pública; varias sedes por profesional están soportadas. Si falta la tabla o el perfil no tiene ubicaciones publicadas, el directorio y el perfil continúan mostrando estados sin inventar direcciones ni coordenadas.
- Las solicitudes reutilizan `/solicitudes?odontologo=<id>` y el estado actual de solicitudes académicas deja claro que solicitar orientación no confirma una cita.
- Las reseñas solo se leen cuando la tabla está disponible y las filas están publicadas; autor, correo y estado de moderación no se consultan en la proyección pública. La interfaz no asigna estrellas predeterminadas. La inserción local exige rol paciente, interacción no demo y estado completado, y se limita a una reseña por interacción; las solicitudes académicas existentes no son una prueba de atención completada. Reportes son privados y no legibles desde el cliente.
- El área del profesional enlaza su perfil público cuando el backend ya devuelve un vínculo verificado. No se añadieron ediciones privilegiadas ni cambios a JWT, roles, MFA/AAL2, controles clínicos o RLS existentes.
- El panel del paciente prioriza análisis, directorio y solicitudes; los accesos educativos duplicados se quitaron de navegación y footer.

## Datos y seguridad

En la revisión de esquema de solo lectura realizada durante esta tarea, `public.dentists` ya contiene perfiles, pero no direcciones ni coordenadas; `clinical.clinics` tiene un campo textual `location`, no coordenadas públicas. La relación de profesionales con clínicas vive en el esquema clínico. El cliente no consulta `clinical.*` ni recibe `clinic_id`.

Las migraciones `supabase/migrations/20261105210643_add_dentist_locations_and_reviews.sql` y `supabase/migrations/20261105220152_admin_workflows_clinics_and_reviews.sql` están aplicadas en Supabase Dental-IA. Se confirmó PostGIS 3.3.7, tablas, RPC administrativas, RLS y permisos: `anon` no puede ejecutar las RPC administrativas y `authenticated` sí, sujeto a los controles internos de sesión, rol y AAL2. Las reseñas requieren una interacción no demo completada propia y rol paciente sin rol odontólogo; las solicitudes académicas existentes no ofrecen atenciones elegibles.

La aplicación de ambas migraciones no alteró perfiles, membresías, solicitudes ni historiales clínicos; los conteos remotos de membresías y auditoría clínica antes y después fueron iguales. Las tablas de ubicaciones, reseñas y reportes están vacías, por lo que todavía no hay marcadores ni reseñas que mostrar. En Preview, los tres endpoints administrativos respondieron `401` sin sesión. No se realizaron escrituras funcionales porque no se presentó una sesión de superusuario con AAL2 ni datos autorizados de ubicación/interacción. El cliente no puede cambiar el estado `publication_status`.

`docs/integracion/rollback_geolocalizacion_resenas.sql` es un rollback manual revisable. Elimina las tres tablas de ubicaciones/reseñas y conserva PostGIS para no interferir con otras dependencias. No debe ejecutarse sin autorización porque destruye ubicaciones, reseñas y reportes creados tras la aplicación.

La consulta al esquema remoto fue de solo lectura. Los hallazgos se describen sin datos personales ni UUID de usuarios. El chequeo local `npm run check:supabase` no llegó a conectarse: en este worktree no se encontró `.env.local`; el comando terminó con “Copia .env.example a .env.local”. No se intentó autenticación.

## Mapas y atribución

Se eligió MapLibre GL JS para el mapa interactivo y teselas raster de OpenStreetMap, sin clave de Google Maps. El [inicio oficial de MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) documenta el uso de la librería en aplicaciones web. El mapa incorpora atribución visible y solo solicita teselas del área que el navegador visualiza. El servicio público de teselas OSM requiere atribución, usa la URL HTTPS oficial y no permite precarga masiva; revisar la [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) antes de exponer esta ruta a tráfico alto. Para producción o tráfico sostenido se debe seleccionar un proveedor con capacidad y condiciones adecuadas.

La migración usa el patrón documentado por Supabase PostGIS: extensión en un esquema dedicado e índice GiST para búsquedas geográficas. Ver [PostGIS en Supabase](https://supabase.com/docs/guides/database/extensions/postgis). Los grants públicos se declaran de forma explícita porque Supabase documentó el cambio de exposición de tablas del Data API en [su aviso de octubre de 2026](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Validaciones

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| `npm run typecheck` | Aprobado | TypeScript local |
| `npm run build` | Aprobado | Next.js 15.5.28; compilación, generación estática y trazas completadas |
| `node --experimental-strip-types --test <49 archivos src/**/*.test.mjs>` | 418 aprobadas, 0 fallidas | Suite automatizada local con dobles; incluye geolocalización, selección de múltiples sedes, marcadores y reseñas |
| `git diff --check` | Aprobado | Solo avisos CRLF/LF de Windows |
| `npm run check:supabase` | Pendiente | No había `.env.local`; no hubo conexión remota |
| Render local `/directorio` en navegador | Pendiente parcialmente | La ruta abrió; el directorio mostró estado de error de carga al no disponer de configuración/conectividad verificada. No se pudo revisar mapa, marcadores, filtros con datos ni perfiles cargados |
| RLS real, inserción/moderación de reseñas y ubicaciones | Pendiente | Migración no aplicada; no se realizaron escrituras remotas |
| E2E visual 390, 768, 1280 y 1440 px | Pendiente | La página de error fue lo único que pudo observarse en el navegador; no se afirma validación responsive completa |
| Regresión de autenticación, permisos y flujo de solicitudes con Supabase | Pendiente | No se usaron cuentas QA ni se ejecutaron sesiones reales |

El mapa y las tarjetas usan el mismo conjunto de profesionales filtrados; las funciones de radio, selección de la sede más cercana y creación de marcadores están cubiertas por pruebas unitarias. No se afirma que el servicio de mapa, RLS ni las reseñas funcionen contra la base remota sin aplicar y verificar la migración.

## Comandos reproducibles

```powershell
npm run typecheck
npm run build
$testFiles = Get-ChildItem -Path src -Recurse -Filter '*.test.mjs' | ForEach-Object { $_.FullName }
node --experimental-strip-types --test $testFiles
git diff --check
npm run check:supabase
```

El último comando requiere `.env.local` con configuración pública válida. No se incluyó ni mostró ningún valor de entorno en este informe.
