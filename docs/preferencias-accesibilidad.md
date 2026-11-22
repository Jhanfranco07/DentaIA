# Preferencias de accesibilidad de DentaIA

Panel propio en español disponible en todas las rutas, con colores de DentaIA.
El indicador de desarrollo de Next.js se oculta mediante `devIndicators: false`.
No se han desactivado compilación, comprobaciones de tipos ni reportes de error.

## Opciones

- Perfiles de reducción de estímulos, baja visión y concentración.
- Escala de página de 100 %, 125 % y 150 % (incluye contenido y controles).
- Espaciado, alto contraste, fuente sencilla y enlaces resaltados.
- Detener movimiento: desactiva la entrada y estela, pausa la rotación automática
  del carrusel y cancela las animaciones de entrada implementadas con JavaScript.
- Reducción de color de medios y ocultación de decoración identificada como tal.
  Las fotografías con texto alternativo informativo se conservan.
- Guía y máscara de lectura con el puntero y controles para subir/bajar la guía.
- Cursor ampliado, restablecimiento y persistencia local entre páginas y sesiones.

La preferencia se aplica desde el head antes de la animación inicial. Los datos
se normalizan y no se insertan como HTML. Si localStorage falla, el panel sigue
funcionando durante la sesión. El diálogo nativo permite Escape y gestión de foco.
El panel permanece fuera de la escala y del filtro de contraste del contenido.
Con una escala ampliada, la estela decorativa se desactiva para evitar desajustes
entre coordenadas de puntero y canvas.

## Validación

- Compilación de Next.js correcta.
- 512 pruebas Node y 116 Vitest correctas, incluidas 10 de accesibilidad nueva.
- Las pruebas nuevas verifican valores admitidos, almacenamiento inválido o
  bloqueado, perfiles, preservación de opciones y consistencia del inicio previo
  a la hidratación con la normalización de preferencias.

Queda pendiente la revisión visual y funcional en un navegador real: apertura
por teclado, Escape/foco, ampliación en escritorio/móvil, contraste y ausencia de
recorte en formularios, guías de lectura y pausa de las animaciones. Este panel
no acredita por sí mismo conformidad WCAG ni sustituye una auditoría.
