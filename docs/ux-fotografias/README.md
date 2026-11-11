# Fotografías dentales — Sprint 6

## Diagnóstico inicial

La ruta `/fotografias` ya implementaba consentimiento explícito, selección o captura mediante el selector nativo, vista previa local, validación de formato y tamaño, subida al bucket privado, consulta, eliminación y revocación. Las operaciones requieren sesión de paciente y los controles del servidor existentes. La línea base mostraba consentimiento, selección, cámara, subida y galería simultáneamente; a 390 px algunos botones y textos importantes se renderizaban a 11–12 px. Las capturas `evidencias/antes/` reproducen esa vista con sesión sintética sin consentimiento.

## Cambios

La pantalla presenta cinco etapas: consentimiento, preparación, elección, revisión y confirmación. El usuario no ve los controles de subida antes de seleccionar y revisar la imagen. Se conservó el texto y la versión del consentimiento, la carga explícita, la revocación y las operaciones originales. Una selección descartada revoca su URL local y no se sube. El paso final solo aparece tras la respuesta de almacenamiento y metadatos. La galería sigue disponible durante el flujo. El error de carga ofrece reintento. La escala tipográfica, el foco y los objetivos táctiles se ampliaron.

La captura usa el `input[type=file]` con `capture="environment"` existente. En un navegador de escritorio abre el selector de archivos; en un móvil compatible el navegador puede ofrecer la cámara. No se pide permiso de cámara mediante `getUserMedia` ni se afirma que se comprobó hardware físico.

## Evidencia y pruebas

`evidencias/antes/` y `evidencias/despues/` contienen capturas a 320, 390, 768, 1024 y 1440 px. Playwright usa sesión, API y PNG sintéticos; bloquea tráfico externo. Los PNG de las pruebas no se guardan en el repositorio. El resultado de después cubre 18 casos: cinco anchuras sin desbordamiento, consentimiento no premarcado y registro, selector de cámara del navegador, ausencia de carga automática, archivo inválido, vista previa, cancelación local, guardado, eliminación, error y reintento, teclado y revocación. Es una simulación del contrato HTTP, no una prueba de las políticas remotas.

Comandos: `npm run typecheck`, `npm run build`, `node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'` y `python scripts/qa-ux-fotografias.py --fase despues --output docs/ux-fotografias/evidencias --browser <Chrome>`.

## Privacidad, límites y evolución

Las vistas previas usan URLs locales y se retiran al descartar, al subir y al ocultar una fotografía descargada. Los registros de QA no contienen fotografías privadas ni credenciales reales. No se modificaron Auth, RLS, políticas de Storage, contratos clínicos, backend, MFA ni versión del consentimiento. Quedan pendientes pruebas con dispositivo físico de cámara denegada o ausente, lector de pantalla, zoom al 200 % y verificación de extremo a extremo con un entorno Supabase autorizado. La futura integración de visión artificial requiere consentimiento y contratos propios, validación clínica y comunicación explícita de límites; esta interfaz no muestra diagnósticos ni simula inferencias.
