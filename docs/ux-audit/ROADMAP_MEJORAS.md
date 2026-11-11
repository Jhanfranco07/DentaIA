# Hoja de ruta UI/UX — Sprint 6

No inicia implementación. Cada entrega debe preservar contratos, roles, MFA/AAL2, backend clínico y estado de datos. Abrir PRs pequeños con revisión visual y funcional.

| Orden | Entrega | Alcance | Evidencia de aceptación |
| --- | --- | --- | --- |
| 1 | Línea base del paciente | Recorridos landing → cuenta → panel → directorio → solicitud, con fixtures y estados vacíos/error. | Capturas por breakpoint, teclado y lista de problemas reproducibles. Coordinar PR #32 antes de editar landing. |
| 2 | Legibilidad y navegación paciente | Escala tipográfica, accesos principales, foco, menú móvil y mensajes de estado. | Sin texto crítico de 10–11 px; tareas completables a 320/390 px y zoom 200 %. |
| 3 | Directorio y mapa | Relación lista/marcador/detalle, filtros y geolocalización denegada; mantener MapLibre. | Equivalencia sin mapa, atribución, navegación por teclado y estados sin red. |
| 4 | Fotografías y perfil | Secuencia de consentimiento, selección, vista previa, errores y eliminación; perfil editable/lectura. | Pruebas con PNG sintético, sin modificar texto/versionado del consentimiento ni almacenamiento. |
| 5 | Profesional | Jerarquía de solicitudes, pacientes e historial autorizado; estados de permiso. | Fixtures por rol, pruebas de regresión y ausencia de datos fuera de autorización. |
| 6 | Administración | Lectura de tablas, búsqueda y confirmaciones; mantener cierre de entorno y MFA. | Casos de acceso permitido/denegado, 320/390 px, teclado y QA de seguridad existente. |
| 7 | Consolidación | Tokens y componentes compartidos, limpieza de CSS duplicado y guía de contenido. | Revisión transversal, TypeScript, pruebas, build, auditoría y DevSecOps verde. |

**Después, con decisión de producto y datos:** evaluar 20 perfiles odontológicos de demostración con fuente autorizada, rotulado inequívoco y criterios de publicación. El mapa interactivo ya existe; no cargar datos ni cambiar base de datos en esta fase.

Dependencias: confirmar destino de PR #32 y demás ramas que tocan landing; definir alcance visual con producto; acordar datos de prueba y validadores de accesibilidad. Ninguna etapa presupone un servicio clínico real o una inferencia de IA disponible.

