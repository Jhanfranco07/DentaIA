# Fotografías clínicas públicas de demostración

Se incorporaron **tres fotografías intraorales auténticas y diferentes**, almacenadas localmente, sin datos identificativos visibles y sin dependencia externa para mostrarlas. No proceden de pacientes de DentaIA. Las fotografías ilustran contenido educativo fijo; DentaIA no realiza inferencia, detección clínica ni diagnóstico a partir de ellas.

## Fuentes y licencias por archivo

Se obtuvieron de una copia pública redistribuida en [Dental Vision Benchmark](https://github.com/Tuminha/dental-vision-benchmark), un benchmark odontológico de Francisco Teixeira Barbosa y Daniel Robles Cantero. **La licencia MIT de su código no se aplica a estas imágenes**. El proyecto conserva las licencias individuales de Wikimedia Commons, explicitadas para cada archivo en sus registros de atribución.

La revisión usó el commit inmutable **`19a7a39df441275f216435dda04ef87a5ef34bb8`** y su correspondencia exacta entre `data/items.json`, `CREDITS.md` y `data/images/`. El archivo de atribuciones declara expresamente que todos los archivos de `data/images/` son obras de terceros usadas bajo las licencias individuales indicadas y que mantienen esas licencias.

**Alcance de verificación:** se leyeron las licencias, autores y fuentes específicas publicados por el redistribuidor GitHub, además de inspeccionar visualmente los tres archivos y comprobar hashes. No se pudo consultar directamente la página original de Commons porque la red actual devuelve CONNECT 403 para ese dominio. La evidencia conservada permite revisar la atribución y la redistribución por archivo sin inventar una visita a la fuente primaria.

| Caso y archivo local | Obra original | Autor/atribución conservada | Licencia |
| --- | --- | --- | --- |
| Cuidado bucal habitual — `public/demo/cuidado-habitual.jpg` | [Detailed view of the inside of the human mouth](https://commons.wikimedia.org/wiki/File:Detailed_view_of_the_inside_of_the_human_mouth.jpg) | El registro espejo no indica autor; CC0 no exige atribución. Se conserva título y fuente. | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Atención preventiva dental — `public/demo/atencion-preventiva.jpg` | [Dental Caries Cavity 2 (cropped)](https://commons.wikimedia.org/wiki/File%3ADental_Caries_Cavity_2_%28cropped%29.JPG) | Suyash.dwivedi | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Cuidado de encías — `public/demo/cuidado-encias.jpg` | [MandibularAnteriorCalculus](https://commons.wikimedia.org/wiki/File%3AMandibularAnteriorCalculus.JPG) | DRosenbach at English Wikipedia | Dominio público, según el registro individual; [referencia a dominio público](https://creativecommons.org/publicdomain/mark/1.0/) |

La atribución, enlace a la fuente y enlace a la licencia se muestran en el recorrido y se incorporan a los PDF. La atribución de la fotografía del inicio aparece junto a ella. No se sugiere que los autores avalen DentaIA.

## Evidencia reproducible

- [Inventario de fuentes y hashes](evidencias/fotografias/fuentes.json): commit espejo, enlaces inmutables al archivo exacto y al original, licencia por archivo, SHA-256 del original obtenido del espejo y del optimizado local, dimensiones, tamaños y transformaciones.
- [Registros individuales originales](evidencias/fotografias/items-fuente.json): copia de las tres entradas pertinentes de `data/items.json`, incluidas sus fuentes y licencias.
- [Créditos originales del redistribuidor](evidencias/fotografias/CREDITS-fuente.md): copia sin editar de su archivo de atribuciones. Las demás obras listadas en ese documento **no se incorporan a DentaIA**.
- [Registro original versionado](https://github.com/Tuminha/dental-vision-benchmark/blob/19a7a39df441275f216435dda04ef87a5ef34bb8/data/items.json) y [créditos originales versionados](https://github.com/Tuminha/dental-vision-benchmark/blob/19a7a39df441275f216435dda04ef87a5ef34bb8/CREDITS.md).

## Transformaciones y reutilización

Los originales de la copia versionada se recomprimieron a JPEG progresivo, calidad 88, para reducir tamaño. Se eliminaron EXIF y otros metadatos. **No se recortaron, estiraron, retocaron ni generaron zonas anatómicas nuevas.** Se conservaron sus dimensiones naturales: 1280×1707, 1280×960 y 1280×636, respectivamente. Los JPEG de prueba se reducen a 280 píxeles de ancho conservando su proporción.

La adaptación local de **Dental Caries Cavity 2 (cropped)** se distribuye bajo **CC BY-SA 4.0**, la misma licencia del original. Cualquier reutilización de esa fotografía debe conservar la atribución, enlace de licencia, indicación de cambios y condiciones de compartir igual. Esta condición corresponde a la fotografía y sus adaptaciones; no se declara que sea la licencia del código de DentaIA ni de las demás fotografías. CC0 y dominio público mantienen sus condiciones respectivas.

Las marcas de los casos 2 y 3 son anotaciones vectoriales educativas superpuestas, preparadas manualmente. No alteran el JPEG descargable de la muestra ni son una salida de IA. En el PDF, las anotaciones acompañan la fotografía con el mismo carácter ilustrativo. La foto 1 no recibe marcas; la ausencia de regiones no certifica salud. El título de cada caso describe el tema educativo, no una evaluación del estado clínico de la persona fotografiada.

## Verificación y mantenimiento

```bash
node --experimental-strip-types scripts/generar-muestras-demo.mjs
node --experimental-strip-types --test --experimental-test-isolation=none --test-reporter=tap src/features/analisis/casos.test.mjs
```

El script verifica los hashes del catálogo y el inventario, las dimensiones y la fuente de cada fotografía. Regenera únicamente los JPEG pequeños de prueba; **no sobrescribe fotografías públicas, no produce imágenes sintéticas y no cambia hashes para ocultar discrepancias**. Las imágenes ajenas, los archivos recomprimidos por terceros o los recursos antiguos no reciben resultados predefinidos.

Al reemplazar una foto, verificar primero la autorización de redistribución del archivo concreto, ausencia de información identificable y compatibilidad de licencia. Actualizar evidencia, atribución, dimensiones, hash y regiones manuales; ejecutar pruebas responsive, descargas y renderizar/revisar visualmente los tres PDF. No utilizar imágenes privadas de usuarios como muestras ni enviarlas a un modelo.

## Registro de búsqueda anterior

Los intentos iniciales de acceso directo a Commons quedaron bloqueados por política de red; se guardaron los dominios `commons.wikimedia.org` y `upload.wikimedia.org` en el borrador del entorno. El guardado no aplicó la política a esta máquina. Se descartaron Gingivitis_Classification (sin licencia específica), SegmentAnyTooth (licencia de código no suficiente para fotos) y MetaDent (licencias distintas según componente, sin procedencia suficiente por archivo). Ninguna de sus imágenes fue incorporada. Las tarjetas editoriales temporales y las ilustraciones antiguas se reemplazaron por estas tres fotografías con atribuciones individuales verificadas en el espejo.

Pendiente opcional de trazabilidad: cuando se aplique el permiso de red, contrastar las páginas primarias de Commons con la copia preservada. La falta de esa consulta directa se mantiene explícita; no se presenta como ejecutada.
