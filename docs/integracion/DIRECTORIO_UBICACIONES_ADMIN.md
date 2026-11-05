# Preparación de ubicaciones verificadas del directorio

Fecha de validación: 2026-11-05. Rama local: `develop`. Esta documentación describe código y pruebas locales; **la migración aún no se ha aplicado en Supabase Dental-IA**.

## Estado de datos y elegibilidad

La inspección remota de metadatos confirmó PostgreSQL 17.11, las tablas base y sus campos usados por la migración. La migración `20261105160341` no aparece en el historial remoto. PostGIS está disponible como extensión, pero no instalado en la base (`pg_extension` no contiene `postgis`). La migración lo solicita en el esquema `extensions` que ya usa el proyecto.

El esquema actual fija `dentists.is_demo = true` y `appointment_requests.is_demo = true`, con estados académicos de solicitud que no representan una atención completada. Por tanto, hoy no hay profesionales ni solicitudes publicables/elegibles para reseñas. Los perfiles académicos y consultorios ficticios no deben convertirse en ubicaciones públicas.

La verificación de registros conocida encontró cuatro perfiles públicos académicos activos sin asociación profesional verificada. También encontró dos cuentas profesionales verificadas con membresías activas, pero con perfiles públicos inactivos. **Ninguno es candidato actual para publicar una ubicación.** No se asocian por coincidencia de nombre.

## Asociación profesional y clínica

1. Un administrador autorizado valida la identidad del odontólogo fuera de la interfaz pública y el vínculo del perfil público mediante identificadores internos revisados. No usar coincidencias por nombre o correo como prueba suficiente.
2. Verificar que `clinical.professional_accounts.status = 'verified'`, que su `dentist_id` identifique ese perfil, y que haya exactamente una `clinical.clinic_memberships` activa para la clínica existente, con `valid_from <= now()`, `valid_until is null or > now()` y `clinical.clinics.status = 'active'`.
3. Confirmar que el perfil público está activo y no es de demostración. El estado `is_demo` no se cambia como parte de esta asociación.
4. No insertar ni cambiar asociaciones durante esta preparación. Si no hay evidencia autorizada o el perfil sigue marcado demo/inactivo, dejarlo pendiente y solicitar una decisión del responsable de datos.

El código actual no tiene una API administrativa para crear o cambiar `clinic_memberships`; esta entrega solo valida una membresía ya existente. Si una cuenta carece de membresía, primero debe aprobarse e implementarse un flujo de vinculación con identidad verificada, autorización administrativa, validación de clínica y auditoría. No sustituirlo con SQL ad hoc ni reasignar `professional_accounts.dentist_id` por similitud nominal.

## Registro, verificación y publicación

Tras aplicar la migración, una cuenta `superusuario` con sesión AAL2 administra las sedes en `POST /api/administracion/ubicaciones`. La API vuelve a verificar identidad y claims con Auth; exige origen del mismo sitio, contenido JSON limitado e idempotency key. La escritura está cerrada por defecto y solo puede habilitarse explícitamente en desarrollo local o Preview `develop` con `DENTAIA_LOCATION_WRITES_ENABLED=true`. La función Postgres usa la sesión JWT del usuario y la clave publicable; no usa `service_role`.

- `guardar`: registra nombre, dirección real verificada y latitud/longitud dentro de rangos WGS84. Una única fila por par odontólogo-clínica; cambios reinician la verificación y dejan el registro `pending`.
- `publicar`: requiere una referencia de evidencia administrativa (por ejemplo, ficha de sede revisada, sin incluir documento personal) y revalida perfil, membresía y clínica. Solo después aparece en el directorio.
- `ocultar`: quita temporalmente la sede de la consulta pública.
- `retirar`: marca la sede retirada. El panel no inventa ni geocodifica domicilios.

La consulta pública filtra por RLS una sede publicada, perfil activo/no-demo y membresía verificada vigente. Cuando la asociación vence o se desactiva, la sede deja de ser visible inmediatamente por RLS aunque se mantenga el estado histórico `published`; un administrador debe marcarla `retired` para dejar constancia de limpieza. Esta actualización de estado no es automática y requiere habilitar la ruta; no hay un trigger nuevo conectado a los flujos de membresía existentes.

El paciente no obtiene permisos de escritura sobre la tabla. La ruta y la RPC rechazan roles distintos de superusuario, sesiones que no sean AAL2 y perfiles demo/sin asociación. La tabla de auditoría es privada, append-only y registra cada operación aceptada con su solicitud idempotente.

## Integración del directorio

El cliente consulta `dentists`, `dentist_public_locations` y `dentist_reviews` por Supabase. No hay arreglo estático de marcadores ni de reseñas. La lista y el perfil toleran ausencia de tabla/datos; sin ubicaciones publicadas, el mapa no presenta marcadores. Los filtros por cercanía usan distancia Haversine en el navegador sobre coordenadas públicas y no almacenan la ubicación del paciente. El marcador enlaza con el perfil; el perfil permite continuar a solicitud. Reseñas requieren interacción real completada, propia, no demo y asociada al mismo odontólogo; la revisión de esquema actual hace que ese flujo siga deshabilitado hasta que el producto disponga de interacciones reales elegibles.

## Migración, respaldo y ejecución controlada

SQL definitivo: `supabase/migrations/20261105160341_add_dentist_locations_and_reviews.sql`. No se ejecutó en remoto. Antes de aplicarla:

1. Confirmar ventana de cambio y versión actual de migraciones/PostgreSQL/PostGIS.
2. Tomar respaldo de Supabase con recuperación point-in-time disponible y exportar metadatos de esquema, extensiones, privilegios, RLS y migraciones.
3. Restaurar una copia en un proyecto/branch Supabase aislado y ejecutar allí la migración y la suite SQL con roles `anon`/`authenticated`.
4. Verificar `extensions.postgis` instalado y revisar las políticas y grants en la instancia restaurada.
5. Aplicar en el proyecto objetivo mediante migración aprobada; revisar logs/advisories y una consulta anónima de solo lectura.
6. Registrar ubicaciones solo después de verificar identidad, membresía vigente y evidencia de dirección/coordenadas. Publicar una sede de prueba autorizada y confirmar lectura pública; luego ocultarla/retirarla conforme al plan aprobado.

Rollback: `supabase/migrations/20261105160341_add_dentist_locations_and_reviews.rollback.sql` (copia informativa en `docs/integracion/rollback_geolocalizacion_resenas.sql`). El rollback verifica comentarios de propiedad y se detiene si cualquiera de las tablas propias contiene filas. No elimina la extensión PostGIS ni toca tablas preexistentes. Si hay ubicaciones/reseñas/auditoría reales, no revertir automáticamente: exportar, revisar retención/consentimiento y definir recuperación antes de intervención manual.

## Evidencia local de esta revisión

- PostgreSQL aislado 17.11 / PostGIS 3.6.4: migración aplicada con éxito a base desechable.
- Pruebas SQL sintéticas: permisos de lectura pública, escrituras denegadas, relación solicitud-odontólogo, solicitud demo no elegible, sesión administrativa no superusuario, asociación profesional-clínica, coordenadas guardadas, publicación, visibilidad pública, pérdida de visibilidad al vencer membresía, ocultamiento y auditoría append-only.
- El rollback se ejecutó en otra base desechable: quitó los objetos de esta migración, preservó una fila preexistente, las tablas base y PostGIS.
- Estas son pruebas aisladas con fixtures, no un despliegue ni E2E sobre Supabase Dental-IA. No confirman que el mapa tenga marcadores: aún no existen ubicaciones públicas verificadas.
