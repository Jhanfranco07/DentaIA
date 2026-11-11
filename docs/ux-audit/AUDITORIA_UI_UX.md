# Auditoría inicial UI/UX — Sprint 6

Base: merge `244643b`. Método: inspección de rutas, componentes, estilos y la evidencia previa en `docs/ux/OPTIMIZACION_EXPERIENCIA.md`. No se modificó el frontend ni se ejecutó una nueva prueba visual. Los hallazgos siguientes son hipótesis verificables donde se indica.

## Lo que ya funciona

- Landing con rutas reales y textos que limitan el alcance del prototipo, sin métricas clínicas inventadas.
- Navegación pública y de portales con `aria-current`, menú móvil y Escape; enlace de salto, foco visible y `prefers-reduced-motion`.
- Formularios con etiquetas y validación; solicitudes con estados y confirmación de cancelación.
- Directorio con lista y mapa MapLibre; experiencias vacías y de error; distinción de datos demo.
- Fotografía con consentimiento explícito, preparación y vista previa local, estados de carga/error y cámara trasera cuando el navegador la ofrece.
- Portal profesional y administración ya separados por roles y controles existentes. La auditoría no propone alterar permisos ni MFA.

## Oportunidades priorizadas

| Prioridad | Área | Evidencia de código | Comprobación antes de cambiar |
| --- | --- | --- | --- |
| Alta | Jerarquía de lectura móvil | Varios módulos CSS usan textos de 10–11 px, por ejemplo `solicitudes.module.css` y `tarjeta-accion.module.css`. | Capturas a 320/390 px, zoom 200 %, contraste y lectura con personas usuarias. |
| Alta | Paciente: camino principal | Landing ofrece cuenta, panel, directorio y profesional; el panel concentra varios módulos. | Trazar las tareas «crear cuenta → encontrar odontólogo → enviar solicitud» y «revisar solicitud» con rutas y estados reales. |
| Alta | Fotografías y confianza | El consentimiento y la selección de archivo están en una página extensa; el texto legal es material. | Verificar comprensión de finalidad, reversibilidad, privacidad, errores de red y estados sin cámara, sin cambiar el consentimiento almacenado. |
| Media | Directorio y mapa | `MapaDirectorio.tsx` usa teselas externas y marcadores; la lista ya existe. | Teclado, foco entre lista y mapa, mapa sin red, permiso de geolocalización denegado y ancho móvil. |
| Media | Consistencia transversal | Tokens globales conviven con valores hex y tamaños en CSS Modules. | Inventario de colores, radios, espacios y componentes antes de consolidar tokens. |
| Media | Login/registro | `Cuenta.tsx` alterna ambos modos en un formulario y reporta errores por campo. | Recorrido de teclado, lector de pantalla, autofill y errores de confirmación de correo. |
| Media | Profesional y administración | Muchos controles y tablas especializadas; algunos tamaños pequeños persisten. | Estados vacíos, tablas a 320/390 px y roles permitidos con fixtures; no habilitar rutas cerradas para probarlas. |

## Revisión por módulo

- **Landing:** mantener el mensaje claro sobre prototipo y la fotografía; evaluar si CTA principal y navegación se entienden a primera vista. PR #32 propone otra landing y tiene conflictos: revisar antes de planear cambios sobre esa área.
- **Acceso odontológico:** distinguir «entrar» de «solicitar acceso» y mostrar por qué una cuenta sin rol no puede ver datos profesionales. No inventar un flujo de alta profesional.
- **Login/registro:** conservar Auth actual; mejorar ayuda contextual y mensajes de recuperación sólo si la funcionalidad existe.
- **Dashboard paciente:** priorizar dos tareas frecuentes y actividad real; evitar métricas sin datos.
- **Directorio:** coordinar filtros, lista, detalle y mapa; ofrecer equivalente textual para cada marcador.
- **Dashboard profesional:** agrupar información por tarea y permiso, sin alterar guardas clínicas.
- **Panel administrativo:** mejorar escaneo de tablas, confirmaciones y estados; mantener condiciones de entorno y MFA/AAL2.
- **Perfil/configuración:** claridad de campos editables frente a datos sólo lectura; mantener navegación multirrol.
- **Fotografías:** secuencia visible de consentimiento, selección, revisión, almacenamiento y eliminación; estados de error recuperables.

## Criterios de la próxima validación

Usar fixtures inequívocamente sintéticos, sin datos clínicos ni cuentas productivas. Probar 320, 390, 768, 1024 y 1440 px; teclado, zoom, foco, lector de pantalla y reducción de movimiento. Registrar evidencia y fallos por ruta. La revisión previa de `docs/ux` reporta pruebas de navegador con fixtures, pero sus resultados no sustituyen una nueva línea base tras futuras modificaciones.
