# Fotografías de demostración: autorización pendiente

**Estado: faltan las tres fotografías clínicas auténticas solicitadas.** No se ha obtenido una fuente con licencia y procedencia verificables que pueda incorporarse legalmente desde esta máquina. Este bloqueo impide aprobar el criterio visual de fotografía clínica, las regiones anatómicas sobre fotos y los PDF con fotografía auténtica.

Las tarjetas actuales en `public/demo/*.jpg` son **referencias editoriales originales de DentaIA**, generadas mediante formas y texto, sin anatomía dental. Su texto visible indica «Fotografía pendiente de autorización» y «No es una fotografía clínica». No son imágenes de pacientes, fotografías sintéticas, pruebas clínicas ni un sustituto del requisito pendiente. Permiten revisar la interfaz y el contenido educativo mientras se obtiene el material. Los tres PDF generados usan estas referencias y deben revisarse como documentos con material fotográfico pendiente.

| Caso | Fotografía auténtica | Regiones actuales |
| --- | --- | --- |
| Cuidado bucal habitual | Pendiente | Ninguna |
| Atención preventiva dental | Pendiente | Ninguna: no se inventa una zona dental sobre una tarjeta |
| Cuidado de encías | Pendiente | Ninguna: no se inventa una región gingival sobre una tarjeta |

## Búsqueda realizada

Se consultaron fuentes públicas durante esta implementación. Ninguna fotografía externa fue copiada al proyecto.

- `https://commons.wikimedia.org/` y `https://upload.wikimedia.org/`: la política de red devuelve **CONNECT 403** antes de poder consultar las páginas de archivo, licencias y originales. Se guardaron los dominios requeridos en el borrador de configuración del entorno; ese guardado no aplica la política a la máquina actual.
- `https://github.com/jihwan1008/Gingivitis_Classification`: contiene fotografías, pero no se encontró autorización de redistribución para los archivos. **Descartado**: un repositorio público no equivale a una licencia.
- `https://github.com/thangngoc89/SegmentAnyTooth`: el README limita MIT al código y publica los pesos bajo condiciones distintas. No se pudo establecer una licencia específica para reutilizar las imágenes de pacientes como material público de una aplicación. **Descartado**.
- `https://github.com/WenhDeng/metadent-bench`: el README distingue DS1 (CC BY-NC 4.0), DS2 (condiciones de la fuente original) y DS3 (condiciones de COYO). No se pudo verificar a qué componente corresponden tres archivos candidatos ni las condiciones originales de su publicación. **Descartado**; no se generaliza la licencia Apache del código a las fotografías.
- `https://data.mendeley.com/datasets/3253gj88rr/1` y `https://data.mendeley.com/datasets/g8yhdvgjy2/3`: candidatos señalados por un catálogo público, con CC BY 4.0 declarada en ese catálogo. **No verificados**: la referencia secundaria no autoriza copiar imágenes sin revisar el registro original, archivos y condiciones de los participantes.

No se solicitó acceso a imágenes privadas ni se utilizaron datos de pacientes de DentaIA. No se infieren diagnósticos a partir de ninguna referencia.

## Reanudar la incorporación

1. Aplicar el acceso a `commons.wikimedia.org` y `upload.wikimedia.org` mediante configuración de red del entorno. Para explorar artículos o datasets alternativos, revisar los destinos específicos `pmc.ncbi.nlm.nih.gov`, `cdn.ncbi.nlm.nih.gov` o `data.mendeley.com` antes de añadirlos; no se necesita ampliar acceso a todo Internet.
2. Elegir tres fotografías diferentes, de resolución suficiente y sin personas identificables. Verificar una licencia que permita reproducción y redistribución pública. Comprobar que no hay exclusiones de derechos para la figura o fotografía concreta y que el uso previsto es compatible; conservar la evidencia de licencia y publicación/consentimiento disponible.
3. Registrar por imagen: título, autor, página original, URL original, licencia y enlace, fecha de consulta, transformación aplicada y hash SHA-256 del archivo original y del optimizado. Guardar la licencia/atribución necesaria junto a la evidencia.
4. Optimizar a JPEG/WebP local conservando la relación de aspecto y sin recortar información clínica. Eliminar metadatos privados. Asignar `ancho`, `alto`, `tipoImagen: "fotografia-autorizada"`, `fuente`, `atribucion` y `licenciaUrl` en `CASOS`. Actualizar la UI si el formato cambia.
5. En el caso 1 no crear regiones anómalas. Para los casos 2 y 3 definir manualmente una región ilustrativa coherente con la fotografía y proporcional a sus dimensiones; nunca presentarla como detección automática o confirmación clínica.
6. Actualizar los hashes de los bytes optimizados y las imágenes de prueba. Volver a ejecutar las pruebas por contenido, navegador responsive, descarga PDF, renderizado e inspección visual de **los tres** documentos. Las imágenes desconocidas deben seguir rechazadas.

`node scripts/generar-muestras-demo.mjs` regenera únicamente las tarjetas editoriales propias y sus JPEG de prueba. Se detiene si un caso ya está marcado como fotografía autorizada: **no sobrescribe fotografías aprobadas**. Las ilustraciones PNG/SVG del PR anterior se retiraron de `public/demo/`; su historial permanece en Git. No se ofrecen como fotografías clínicas ni se reconocen como las nuevas muestras. El arnés antiguo `scripts/qa-recorrido-demo.mjs` corresponde al PR anterior y debe reemplazarse por el nuevo QA premium, que usa JPEG y selectores actuales.
