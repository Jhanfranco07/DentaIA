# Directorio odontológico — Sprint 6

## Alcance

Se conserva el directorio y el mapa MapLibre existentes. La búsqueda usa `name` y `specialty`; los filtros usan `district` y `specialty` del modelo actual. Los perfiles con ubicación pública válida ofrecen «Ver en mapa», que selecciona el marcador y muestra su ficha emergente. El enlace del marcador abre la ficha profesional. En móvil, la acción cambia a la vista Mapa; la lista sigue disponible como alternativa accesible. Los errores de teselas muestran un aviso y conservan la lista.

La jerarquía visual amplía texto, controles y estados de foco del directorio y la ficha. Los perfiles con `is_demo` conservan su etiqueta de ejemplo. Las ubicaciones de demostración se muestran separadas y se explican como coordenadas representativas.

## Evidencia y límites

`evidencias/antes` y `evidencias/despues` contienen capturas a 320, 390, 768, 1024 y 1440 px, generadas con `scripts/qa-directorio-mapa.py` y datos sintéticos interceptados en Playwright. No representan la base real. La ejecución de después pasó 13/13 casos: cinco anchuras sin desbordamiento, búsqueda, distrito, marcadores/ficha/atribución, lista→mapa, teclado móvil, error de teselas, vacío y error de carga. No se usaron credenciales de producción ni se insertaron datos.

Los servicios externos y la geolocalización real requieren una validación adicional en un entorno conectado. El mapa usa teselas OSM y conserva la atribución visible. Una falla de teselas se informa sin ocultar los resultados en lista. La falla del proveedor de teselas se simuló mediante bloqueo de red; la geolocalización real sigue pendiente.

## Carga futura de 20 perfiles ficticios

El modelo `dentists` ya contiene `name`, `slug`, `specialty`, `district`, `description`, `avatar_color`, `initials`, `consultation_price`, `currency`, `is_active` e `is_demo`. `dentist_public_locations` contiene `dentist_id`, nombre/dirección de práctica y latitud/longitud, además de estado de publicación y verificación. La ficha pública y el marcador requieren solo campos públicos; no se debe crear una cuenta autenticada para cada ficha ficticia. Revisar el seed existente en `supabase/demo-data/` y preparar uno nuevo con identificadores estables, `is_demo=true`, etiquetas visibles y coordenadas representativas claramente marcadas. No inventar colegiaturas ni direcciones de consultorios reales. Antes de importar, revisar políticas de publicación, evitar asociaciones con usuarios reales y probar en una base aislada. Esta etapa no altera Supabase.

## Validación local

- `npm run typecheck`: pasó.
- `node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'`: 454/454.
- `python scripts/qa-directorio-mapa.py --fase despues --output docs/ux-directorio/evidencias --browser <Chrome>`: 13/13.
- `npm run build`: ver resultado en el PR.

Los jobs DevSecOps de GitHub Actions son la verificación final de integración del PR.

