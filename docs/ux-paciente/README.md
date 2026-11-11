# Primera implementación UI/UX del paciente

Base: `main` en `244643b`. Alcance: panel del paciente, lectura de solicitudes y tipografía de su navegación. No se modifican landing, profesional, administración, Auth, API, Supabase, RLS ni datos.

## Línea base reproducible

Se ejecutó Next.js local en `127.0.0.1:3180` con URL y clave públicas de fixture. Playwright con Chrome local creó una sesión `paciente` sintética, interceptó Auth/API y bloqueó tráfico externo. Las capturas corresponden a datos vacíos, nunca a un paciente real.

| Ancho | Antes | Después |
| --- | --- | --- |
| 320 px | [captura](evidencias/antes/panel-320.png) | [captura](evidencias/despues/panel-320.png) |
| 390 px | [captura](evidencias/antes/panel-390.png) | [captura](evidencias/despues/panel-390.png) |
| 768 px | [captura](evidencias/antes/panel-768.png) | [captura](evidencias/despues/panel-768.png) |
| 1024 px | [captura](evidencias/antes/panel-1024.png) | [captura](evidencias/despues/panel-1024.png) |
| 1440 px | [captura](evidencias/antes/panel-1440.png) | [captura](evidencias/despues/panel-1440.png) |

En la línea base no hubo desbordamiento horizontal, pero el panel mostró once textos visibles de 10–11 px a 320/390 px. La jerarquía situaba el historial clínico antes de las solicitudes y las métricas aparecían como tres tarjetas separadas. El camino al directorio compartía peso con la preparación de fotografía. El menú móvil ya devolvía el foco con Escape.

## Cambios

- **Panel:** saludo y contexto más legibles; directorio como siguiente acción principal. La actividad real se presenta en una franja de tres indicadores, sin inventar resultados de salud.
- **Solicitudes:** historial reciente antes del detalle clínico, enlace al listado completo, estado vacío y errores existentes. Texto y controles de solicitudes más legibles.
- **Herramientas personales:** fotografías guardadas, preparación local y perfil se agrupan en una lista de tareas. La advertencia de que la IA no genera diagnósticos permanece junto a la preparación.
- **Navegación:** se aumentó el tamaño de las etiquetas sólo en el portal paciente. Se conservan rutas, menú, permisos, estados de foco y comportamiento de teclado.
- **Responsive:** dos columnas para actividad y herramientas en escritorio; secuencia vertical en móvil. Las capturas posteriores y `resultado.json` muestran ausencia de desbordamientos a los cinco anchos y cero textos visibles menores de 12 px en el contenido del panel.

## Validación

- `npm ci`, `npm run typecheck`, `npm run build`, 454 pruebas Node y `npm audit`.
- [Resultado de capturas antes](evidencias/antes/resultado.json) y [después](evidencias/despues/resultado.json).
- [Regresión de navegador](evidencias/regresion-browser.json): 76 comprobaciones aprobadas con fixtures, rutas paciente y otros roles, 320–1440 px, teclado, permisos y ausencia de escrituras.
- Contraste calculado para combinaciones nuevas: texto blanco sobre cabecera 11,93:1; texto auxiliar claro 8,9:1; texto gris sobre blanco 6,02:1; aviso de IA 7,01:1. Son pares concretos, no una certificación WCAG completa.

El primer recorrido completo tuvo 75/76: la primera carga de `/directorio` agotó los 12 segundos mientras Next compilaba la ruta. Con la ruta compilada, el recorrido idéntico terminó 76/76. Se conserva el resultado final; el primer intento no se presenta como aprobado.

## Límites

No se usaron cuentas ni datos reales. El navegador no validó persistencia remota, cámara física, RLS, MFA ni servicio clínico. El estado vacío se probó con fixtures; los estados de error y carga existentes se conservan, pero no se efectuó una auditoría visual completa de cada variación. La página de fotografías conserva su consentimiento y su flujo; su rediseño detallado sigue en el roadmap.

Para reproducir capturas, iniciar Next en el puerto 3180 con `NEXT_PUBLIC_SUPABASE_URL=https://ux-fixtures.supabase.co` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture`, con banderas de lectura/escritura administrativas y clínica desactivadas. Ejecutar `python scripts/qa-ux-paciente.py --output <directorio> --browser <ruta-a-chrome>`. Playwright Python se instala fuera del proyecto; no se añadió dependencia al repositorio.
