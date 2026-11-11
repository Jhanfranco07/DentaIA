# Panel administrativo · Sprint 6

## Diagnóstico

El panel ya ofrece secciones para usuarios, roles, consultorios, vinculaciones y reseñas. La lectura de cuentas depende de la configuración del entorno. El acceso está sujeto a sesión, rol de superusuario y MFA/AAL2. La portada repetía avisos técnicos y mostraba pasos numerados que no correspondían a un recorrido obligatorio. Varias descripciones y etiquetas tenían tamaños reducidos.

## Cambios

- La portada prioriza Usuarios y Consultorios, con descripciones centradas en tareas existentes.
- Se simplificaron los avisos redundantes y el encabezado. Las restricciones siguen explicadas en las secciones y en los estados de acceso.
- Se ampliaron tipografía, áreas táctiles y foco visible en navegación, controles y tabla de usuarios.
- La búsqueda y los filtros existentes conservan su comportamiento. Los estados de error, carga y vacío siguen asociados a las respuestas de los servicios.

## Evidencias

La [captura anterior](evidencias/antes/panel-1440.png) procede de la auditoría UX existente. Las capturas posteriores usan una sesión y respuestas sintéticas en Chromium local.

| Ancho | Después |
| --- | --- |
| 320 px | [Captura](evidencias/despues/panel-320.png) |
| 390 px | [Captura](evidencias/despues/panel-390.png) |
| 768 px | [Captura](evidencias/despues/panel-768.png) |
| 1024 px | [Captura](evidencias/despues/panel-1024.png) |
| 1440 px | [Captura](evidencias/despues/panel-1440.png) |

## Validación y límites

TypeScript, build Next.js y 454 pruebas existentes aprobados. `npm audit` informó cero vulnerabilidades. El arnés de regresión general aprobó 76 comprobaciones en Chromium. La prueba específica del panel comprobó cinco anchos sin desbordamiento horizontal. Las comprobaciones de navegador usaron fixtures y no certifican acceso a servicios remotos ni un dispositivo real. La disponibilidad del listado real sigue determinada por la configuración existente. La edición de roles, consultorios, vinculaciones y reseñas no cambió.

Los archivos modificados son los componentes de portada, navegación y usuarios, y la hoja `administracion.module.css`. Las pruebas de acceso del repositorio cubren sesión, rol, MFA/AAL2 y funciones deshabilitadas. Una regresión posible es el desplazamiento de la tabla con texto ampliado; se conserva su contenedor con scroll horizontal y se comprobó que no desborda el documento.
