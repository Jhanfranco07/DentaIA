# Sistema de diseño propuesto

Propuesta para revisión, sin cambios de aplicación. Parte de la identidad actual de DentaIA: orientación clínica serena, información comprensible y límites explícitos del prototipo. Las Skills `frontend-design` y `ui-ux-pro-max` aportan criterios de jerarquía, legibilidad y accesibilidad; sus paletas automáticas no sustituyen la identidad existente.

## Dirección

Una interfaz de acompañamiento odontológico: la tarea principal aparece primero, los datos y advertencias se leen sin esfuerzo, y cada estado explica el siguiente paso. La fotografía puede dar carácter a la landing; los portales usan superficies discretas y densidad adecuada a la tarea. Evitar tarjetas idénticas para todo el contenido.

| Token propuesto | Valor inicial | Uso |
| --- | --- | --- |
| Texto principal | `#102A43` | Títulos, cuerpo y controles clave; conserva `--ink`. |
| Fondo | `#F4F8FC` | Canvas existente. |
| Superficie | `#FFFFFF` | Formularios y paneles. |
| Acción | `#087F8C` | CTA y estados activos; validar contraste en cada combinación. |
| Acción oscura | `#06636E` | Hover o texto sobre superficie clara. |
| Borde | `#DCE6EC` | Separación funcional. |
| Error | `#A52E37` | Error con texto/icono, nunca sólo color. |

Mantener una familia sans de alta legibilidad en los portales; evaluar una tipografía de título con personalidad sólo en la landing después de comprobar licencia, carga y métricas. Base de cuerpo sugerida: 16 px con escala 16/20/24/32/44; textos auxiliares no deberían caer a 10–11 px. Espaciado base 4/8/12/16/24/32/48. Radios según función: 8 en campos, 12 en tarjetas de acción y 20 sólo en secciones destacadas.

## Componentes y estados

- **Navegación:** una taxonomía coherente para público, paciente y profesional; título de página y estado activo inequívocos.
- **Acciones:** primaria, secundaria, peligrosa y enlace; etiqueta describe el efecto real. Carga, deshabilitado, éxito y error tienen texto.
- **Formularios:** etiqueta persistente, ayuda junto al campo, error asociado y resumen cuando varios campos fallan.
- **Tarjetas y tablas:** escoger por tipo de información; tablas administrativas con encabezados y alternativa móvil revisada por tarea.
- **Estados:** vacío, carga, error, permiso denegado y datos demo son diseños explícitos. Ningún estado demo se confunde con un paciente real.
- **Mapa:** lista como equivalente funcional, leyenda de demo y atribución visible.
- **Fotografía:** pasos cortos, explicación de almacenamiento y eliminación, previsualización y confirmación comprensibles.

## Guardarraíles

Foco visible, objetivos táctiles de al menos 44 px cuando proceda, contraste WCAG AA comprobado, orden de tabulación lógico, zoom 200 % sin pérdida de contenido y movimiento reducido. Usar `next/image` para activos adecuados y reservar dimensiones. Medir antes/después; esta propuesta no afirma cumplimiento WCAG ni resultados de rendimiento.

