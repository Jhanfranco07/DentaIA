# Eliminación reintentable de fotografías — aporte de Jhan

La implementación original de fotografías y consentimiento pertenece a Stephan
([PR #9](https://github.com/Jhanfranco07/DentaIA/pull/9)). Esta corrección parte de
su merge `591c60d836a45a89bd67bbb8c8b940b0c53e05cd` y conserva sus tres commits.

## Problema y solución

El procedimiento anterior descargaba la imagen, la eliminaba de Storage y después
borraba `dental_photos`. Si fallaba PostgreSQL intentaba volver a subir la imagen.
Con consentimiento revocado, RLS rechaza ese INSERT. Además, volver a descargar
un archivo ya eliminado impedía reintentar la limpieza.

`eliminarFotografia()` en `eliminar.ts` realiza una limpieza progresiva:

1. Valida el usuario con `auth.getUser()` y consulta sus metadatos mediante ID y
   propietario. Una fila ausente/invisible devuelve `no_disponible`: no ejecuta
   mutaciones ni afirma haber eliminado una fotografía ajena.
2. Usa exclusivamente bucket, consentimiento y ruta del registro recuperado;
   comprueba que corresponden al propietario y al formato generado por el módulo.
3. Solicita eliminar ese único objeto. No descarga, restaura ni vuelve a subirlo.
4. Comprueba su ausencia listando la carpeta autorizada con búsqueda del nombre
   exacto. Un HTTP 200 de `remove()` no demuestra por sí solo que se haya borrado
   nada. Un error, respuesta incompleta u objeto aún presente conserva los metadatos.
5. Elimina el registro filtrando ID, propietario y ruta y solicita su representación.
   Si no devuelve una fila, comprueba si sigue presente antes de confirmar éxito.
6. Si falla PostgreSQL después de Storage, conserva la fila para el próximo intento
   e informa que el archivo ya está ausente. En ese intento, Storage puede devolver
   cero objetos eliminados; la comprobación permite continuar con los metadatos.

La sesión se vuelve a validar entre servicios y antes de confirmar éxito. Se
distinguen errores de sesión, permisos, Storage y base de datos sin mostrar detalles
del proveedor. La pantalla conserva el elemento para reintentar y descarta su vista
previa cuando se ha confirmado que el archivo ya no está.

No se introduce SQL, endpoint privilegiado, dependencia ni cambio de workflows o
RLS. El navegador continúa utilizando la clave pública y la sesión del usuario.

## Contrato con las políticas vigentes y límites

Se inspeccionaron en modo de lectura las políticas reales del proyecto DentaIA:

- `dentaia_photo_read` y `dentaia_photo_delete` autorizan archivos del bucket
  `dental-photos` cuyo primer directorio coincide con `auth.uid()`, sin exigir
  consentimiento vigente.
- `photos_read` y `photos_delete` autorizan `dental_photos.user_id = auth.uid()`.
- Solo la subida/creación requiere consentimiento no revocado.

La comprobación por listado depende de que SELECT permita ver todos los archivos
propios, como sucede con estas políticas. No se debe convertir un 400/404 de descarga
en prueba de ausencia: Storage también puede ocultar objetos por permisos. Si se
restringe SELECT por consentimiento u otra condición, hay que revisar este contrato.

Storage y PostgreSQL **no comparten una transacción**. Un fallo puede dejar
temporalmente metadatos pendientes de limpieza; el usuario debe reintentar cuando
se restablezca el servicio/sesión. No se garantiza reconciliación automática si
abandona el proceso. Los nombres únicos del módulo no se reutilizan ni reemplazan;
no se garantiza atomicidad frente a escrituras externas concurrentes en la misma ruta.
No se realiza limpieza masiva ni de objetos sin un registro propio autorizado.

## Verificación ejecutada

- Node.js 22: `npm run typecheck`, `npm run build` (con configuración pública de
  `.env.example` cargada en el proceso) y `npm audit`: correctos, 0 vulnerabilidades.
- Suite existente y nueva, sin red ni credenciales:
  `node --experimental-strip-types --test "src/features/**/*.test.mjs"`:
  **48 aprobadas, 0 fallidas**, incluidas **16 nuevas** de fotografías.
- Las simulaciones cubren eliminación completa, archivo inexistente, errores de
  Storage/red/PostgreSQL, reintento e idempotencia, consentimiento revocado sin
  INSERT/UPLOAD, foto/ruta ajena, sesión ausente/cambiada, JWT inválido, expiración
  entre servicios, DELETE sin filas y borrado concurrente de metadatos.
- Integración real del 27/10/2026, aplicación local de esta rama contra Supabase:
  consentimiento de QA HTTP 201, imagen sintética `qa-jhan-recuperacion.png` HTTP 200
  en Storage y 201 en metadatos, revocación HTTP 204 y eliminación posterior mediante
  el flujo normal: Storage 200, listado de comprobación 200, DELETE de metadatos 200.
  Los cuadros nativos fueron confirmados manualmente por el usuario. Una consulta
  de lectura confirmó **0 archivos y 0 metadatos** de esa imagen y consentimiento
  revocado. No se modificaron registros ajenos ni políticas.
- Los fallos parciales y la expiración fueron **simulados**, no provocados en
  producción. Las pruebas HTTP cruzadas con dos JWT y la expiración real de sesión
  siguen pendientes. Esta mejora no habilita el uso de fotografías clínicas reales.

## Referencias

- [Storage remove: resultados y permisos](https://supabase.com/docs/reference/javascript/storage-from-remove)
- [Control de acceso de Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Errores de Storage](https://supabase.com/docs/guides/storage/debugging/error-codes)
