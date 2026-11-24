# DentaIA | Anexo técnico de evidencias del Avance 02

**Proyecto Final de Carrera III · USIL**  
**Corte documental:** 23 de noviembre de 2026 (hora de Lima)  
**Repositorio:** [Jhanfranco07/DentaIA](https://github.com/Jhanfranco07/DentaIA)

## 1. Finalidad y criterios académicos

Este anexo organiza las evidencias documentales que respaldan el trabajo realizado en DentaIA y su relación con los criterios de la rúbrica del segundo avance: Monitoreo y Control, Análisis de Hardware y Desarrollo de Software, incluidas las fases, la implementación, la funcionalidad y el documento de anexo. Las fuentes enlazadas permiten inspeccionar el estado del repositorio, los contratos técnicos y la ejecución de los controles automatizados.

## 2. Matriz de trazabilidad

| Criterio | Implementación documentada | Evidencia primaria |
| --- | --- | --- |
| Monitoreo y Control | Gestión iterativa con Scrum y visualización Kanban en Jira; tareas trazadas al código y a los PR. | [Proyecto DI en Jira](https://jhanfranco.atlassian.net/jira/software/projects/DI/boards/35/backlog), [PR #106](https://github.com/Jhanfranco07/DentaIA/pull/106) |
| Análisis de Hardware | Arquitectura cliente-servidor, dispositivos de acceso y distribución en Vercel, Supabase, Railway y servicios externos. | [Arquitectura física](arquitectura/ARQUITECTURA_FISICA.md), [arquitectura lógica](arquitectura/ARQUITECTURA_LOGICA.md) |
| Fases y DevOps | Análisis, diseño, programación, integración, pruebas y despliegue, con una puerta de calidad integral. | [Pipeline vigente](DEVSECOPS_PIPELINES.md), [archivo de workflow](../.github/workflows/devsecops.yml) |
| Implementación | Frontend Next.js y TypeScript, autenticación Supabase, módulos de paciente y odontólogo, administración, datos y servicios de visión. | [Código del proyecto](../src), [PR #76](https://github.com/Jhanfranco07/DentaIA/pull/76) |
| Funcionalidad | Recorridos para inicio de sesión, directorio, solicitudes, fotografías, rutinas, guías, asistente y análisis orientativo; pagos en sandbox. | [Aplicación web](https://dent-ai-five.vercel.app/), [rutas del paciente](../src/app/%28paciente%29), [servicio de visión](../services/dental-vision) |
| Documento de anexo | Consolidación de enlaces, integraciones, pruebas y correspondencia con el informe. | Este documento y las referencias incluidas |

## 3. Monitoreo y control

El equipo organizó las funcionalidades en iteraciones y registró su seguimiento en [Jira, proyecto DI](https://jhanfranco.atlassian.net/jira/software/projects/DI/boards/35/backlog). La trazabilidad técnica se apoya en solicitudes de incorporación de cambios, con verificaciones automatizadas visibles en GitHub. La [integración #76](https://github.com/Jhanfranco07/DentaIA/pull/76) reunió componentes de Supabase, rutinas, análisis Smile, Stripe y servicios. El [PR #106](https://github.com/Jhanfranco07/DentaIA/pull/106) consolidó las pruebas SQL de rutinas dentro del pipeline DevSecOps.

## 4. Arquitectura implementada

La aplicación se organiza en módulos web ejecutados en Vercel, servicios de autenticación y persistencia en Supabase, y un servicio especializado de procesamiento visual implementado con FastAPI y Smile V17. La documentación del [microservicio](../services/dental-vision/README.md) identifica la segmentación Roboflow y su contrato de uso, que se realiza desde rutas controladas de Next.js. En el sistema también se integran funciones educativas, asistente conversacional y Stripe en modo de pruebas.

Las medidas de seguridad incluyen verificación de identidad, control de acceso por rol, políticas RLS y gestión de credenciales privadas en el servidor. La implementación de seguimiento de rutinas entre pacientes y odontólogos cuenta con contratos y controles de consentimiento de activación administrada. [Documento de activación](arquitectura/DI-207-ACTIVACION-QA-SEGUIMIENTO.md).

## 5. Evidencias de implementación por módulo

| Componente | Ruta o referencia de código | Resultado funcional sustentado |
| --- | --- | --- |
| Panel del paciente | [Panel](../src/app/%28paciente%29/panel/page.tsx) | Acceso a las opciones del paciente según sesión y rol. |
| Directorio | [Directorio](../src/app/%28public%29/directorio/page.tsx) | Búsqueda y comparación de fichas de profesionales. |
| Solicitudes | [Mis solicitudes](../src/features/solicitudes/MisSolicitudes.tsx) | Consulta, filtrado, seguimiento y cancelación de solicitudes según sus reglas. |
| Fotografías | [Mis fotografías](../src/app/%28paciente%29/fotografias/page.tsx) | Consentimiento y gestión de archivos privados. |
| Análisis | [Análisis dental](../src/features/analisis/AnalisisDental.tsx) | Captura o selección, validaciones, comunicación con el servicio Smile y resultados orientativos. |
| Rutinas | [Rutinas del paciente](../src/features/rutinas/RutinasPaciente.tsx) | Actividades diarias, progreso e historial. |
| Buenas prácticas | [Guías educativas](../src/features/buenas-practicas/BuenasPracticas.tsx) | Seis guías, filtros, búsqueda y temporizador. |
| Asistente Denti | [API del asistente](../src/app/api/asistente/chat/route.ts) | Respuestas guiadas y opción de IA bajo autorización. |
| Administración | [Panel de administración](../src/app/%28administracion%29/administracion/page.tsx) | Gestión y operaciones con controles reforzados. |
| Pagos de prueba | [Documentación Stripe](PAGOS_STRIPE.md) | Checkout, webhooks, persistencia y políticas RLS, en modo sandbox. |

## 6. Pruebas, seguridad y DevSecOps

La definición vigente [DevSecOps · Pipeline integral](../.github/workflows/devsecops.yml) agrupa 35 trabajos en un solo grafo. Incluye compilación, TypeScript y lint; pruebas unitarias, de integración, de contratos y de regresión; controles de seguridad con npm audit, Semgrep, Gitleaks, actionlint, pip-audit y Bandit; verificaciones del backend Python/FastAPI; pruebas de rutinas, contactos y citas con PostgreSQL temporal y identidades sintéticas; y comprobaciones de disponibilidad de servicios externos.

La [ejecución 45326102779](https://github.com/Jhanfranco07/DentaIA/actions/runs/45326102779) de la versión principal registró **conclusión satisfactoria** el 23 de noviembre de 2026, hora de Lima. Los registros de GitHub Actions constituyen evidencia verificable de ese resultado. Los entornos SQL utilizados por el pipeline son aislados y no escriben en Supabase de producción.

La entrega continua observa disponibilidad y despliegues gestionados por proveedores externos. El resultado del pipeline acredita las comprobaciones definidas en sus jobs y no debe interpretarse como una evaluación clínica del modelo de visión artificial.

## 7. Integración y demostración del software

La solución web está publicada en [DentaIA en Vercel](https://dent-ai-five.vercel.app/). El sistema integra autentificación por perfiles, funcionalidades preventivas y recorridos de solicitudes. El procesamiento visual se describe como orientación educativa y evita emitir un diagnóstico odontológico. La integración de Stripe emplea cuentas y operaciones de prueba, sin representar cobros reales.

El documento principal de PFC3 contiene capturas de las interfaces y diagramas de arquitectura, que complementan estas referencias técnicas. La navegación entre los componentes permite exhibir la solución como un sistema integrado, no como pantallas aisladas.

## 8. Fuentes primarias

- [Repositorio principal](https://github.com/Jhanfranco07/DentaIA)
- [Jira, tablero DI](https://jhanfranco.atlassian.net/jira/software/projects/DI/boards/35/backlog)
- [GitHub Actions, pipeline integral](https://github.com/Jhanfranco07/DentaIA/actions/workflows/devsecops.yml)
- [Ejecución satisfactoria 45326102779](https://github.com/Jhanfranco07/DentaIA/actions/runs/45326102779)
- [PR #76, consolidación funcional](https://github.com/Jhanfranco07/DentaIA/pull/76)
- [PR #105, implementación de controles para seguimiento](https://github.com/Jhanfranco07/DentaIA/pull/105)
- [PR #106, integración de controles PostgreSQL en DevSecOps](https://github.com/Jhanfranco07/DentaIA/pull/106)
- [Documentación de arquitectura](arquitectura/README.md)
- [Documentación de pruebas y DevSecOps](DEVSECOPS_PIPELINES.md)
- [Documentación de pagos](PAGOS_STRIPE.md)

**Alcance:** esta matriz registra implementaciones y verificaciones con fuente identificable. La activación por configuración de algunas funcionalidades y las advertencias sobre el carácter educativo de la IA forman parte del diseño y de la seguridad del producto.
