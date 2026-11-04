# Arquitectura integral de DentaIA

Fecha de corte: 03/11/2026, America/Lima. Documento de análisis y diseño, sin despliegue ni aprobación implícita del equipo.

## Resumen

Monolito modular Next.js con Supabase como identidad, persistencia y archivos. Evolución por contratos comunes para administración, paciente, profesional, clínica e IA exploratoria. La demo educativa actual se mantiene separada de historia clínica e inferencia futura. El componente clínico es compartido dentro de DentaIA, sin prometer conexiones con clínicas externas.

## Inventario de módulos

| Módulo | Referencia Jira | Estado comprobado | Implementación / alcance | Brecha |
|---|---|---|---|---|
| Público / landing | [DI-147](https://jhanfranco.atlassian.net/browse/DI-147) | main y rama landing | Inicio educativo, llamadas a demo/cuenta y privacidad; contenido React sin backend comercial propio | No atribuir compra, pagos o contacto real no definidos |
| Cuenta y perfil | [DI-144](https://jhanfranco.atlassian.net/browse/DI-144) | main | Registro/login/logout y edición de nombre propio con Auth y RLS | Roles administrativos en rama, no en profiles |
| Directorio | [DI-41](https://jhanfranco.atlassian.net/browse/DI-41) | main | Ficha, especialidad/distrito, filtros y precios ilustrativos; dentists.is_demo=true | No agenda real ni identidad profesional autenticada por defecto |
| Solicitudes | [DI-146](https://jhanfranco.atlassian.net/browse/DI-146) | main | Crear, consultar y cancelar solicitudes propias académicas | No cita confirmada ni notificación real |
| Fotos y consentimiento | [DI-37](https://jhanfranco.atlassian.net/browse/DI-37) | main + catálogo real | Carga privada, vista previa, consentimiento académico y eliminación reintentable | No autoriza IA/entrenamiento ni acceso entre clínicas |
| Demo orientativa y PDF | [DI-42](https://jhanfranco.atlassian.net/browse/DI-42) | main | Tres casos fijos reconocidos, observaciones preparadas y PDF local | No modelo entrenado ni inferencia de cualquier foto |
| Panel paciente | [DI-146](https://jhanfranco.atlassian.net/browse/DI-146) | feature/vista-paciente | /panel y componentes que reutilizan perfil, fotos, solicitudes y reporte de sesión | No está en main; shell público con resumen condicionado a sesión, no guard SSR del panel completo |
| Portal profesional | [DI-145](https://jhanfranco.atlassian.net/browse/DI-145) | main y rama profesional | main contiene pantalla sintética /profesional; rama DI-156 contiene contrato y consulta de historial sintético | No servicio clínico real, permisos/auditoría persistidos ni interoperabilidad |
| Historial y permisos clínicos | [DI-145](https://jhanfranco.atlassian.net/browse/DI-145) | Diseño propuesto; demo sintética | Modelo paciente–clínica–profesional, concesiones, procedencia y auditoría | Tablas/RPC ausentes remotamente; verificar DI-157 Listo contra alcance real |
| Administración y AAL2 | [DI-144](https://jhanfranco.atlassian.net/browse/DI-144) | feature/superusuario-admin | Guard, lectura sintética/real, cliente, MFA local y cambios de roles condicionados | No integrado en main; migración dentaia_admin ausente en Dental-IA inspeccionado |
| IA, datasets y evaluación | [DI-38](https://jhanfranco.atlassian.net/browse/DI-38) | Diseño / backlog | Licencias, particiones por paciente, modelo versionado, trabajos, calidad y métricas | No se encontró modelo entrenado/servicio de inferencia actual |
| Pruebas y operación | [DI-43](https://jhanfranco.atlassian.net/browse/DI-43) | Workflows + backlog | CI, Tests Node y Security existentes; revisión académica, SUS y revisión odontológica previstas | No confundir mocks, npm audit o build con prueba clínica o RLS real |
| Investigación y negocio | [DI-13](https://jhanfranco.atlassian.net/browse/DI-13) | Jira y documentación académica | Problema/ODS, empatía, CJM, Canvas, TAM/SAM/SOM, BMC y viabilidad | Artefactos académicos; no requieren nuevas tablas runtime solo por estar en el backlog |


## Requisitos no funcionales y criterios de diseño

Seguridad por propietario y contexto, denegación por defecto, no autoelevación, MFA administrativo, secretos solo servidor, datos sintéticos en demostración, acceso mínimo, auditoría de consultas clínicas y de roles, trazabilidad de versiones y manejo de fallos sin éxito ficticio. Usabilidad: estados carga/vacío/error/denegado, teclado y diseño responsive. Calidad: pruebas aisladas más integración real identificada, build y CI. Privacidad: finalidad explícita, procedencia, retención pendiente de revisión y no diagnóstico clínico autónomo.

No existen SLO/SLA, volúmenes, disponibilidad ni presupuestos aprobados en las fuentes revisadas. Para diseñar se proponen límites iniciales de paginación y cuerpos que deben medirse en QA; no se publican como rendimiento conseguido. No se añade infraestructura o licencia de pago sin decisión del equipo.

## Modelo objetivo y alcance incremental

29 tablas de negocio: 5 existentes, 3 administrativas de una migración publicada no aplicada y 21 nuevas de diseño (11 clínicas y 10 de IA). Auth/Storage gestionados se inventarían aparte. No se propone sustituir el esquema existente de una vez. Primero acordar identidad/rol/membresía/permiso y desplegar en QA aislado; luego adaptar proveedores sintéticos, sin mezclar fixtures con pacientes reales. Investigación/negocio/feedback/SUS se conservan como artefactos versionados y Jira, sin introducir una base adicional de encuestas que nadie pidió.

## Fuentes y lectura del estado

Jira describe intención y estado administrativo; GitHub demuestra código en un SHA; el catálogo Supabase demuestra estructura remota en el momento de consulta. Ninguna de estas fuentes por sí sola acredita pruebas completas en producción. Las declaraciones manuales se conservan como tales, sin inventar resultados remotos. Las consultas de catálogo no leen filas de pacientes, Auth, consentimientos, imágenes o diagnósticos.

Ver [fuentes](FUENTES_Y_EVIDENCIAS.md), [requisitos completos](REQUISITOS_JIRA.md), [brechas](BRECHAS_Y_PLAN_IMPLEMENTACION.md) y [decisiones](DECISIONES_ARQUITECTURA.md).
## Actualización de auditoría integral

Esta revisión conserva el monolito modular y el inventario de módulos. El modelo revisado añade solo cinco columnas justificadas, no tablas: 29 tablas y 219 columnas. La referencia de cuenta/perfil es transversal (base ya integrada y contrato de roles DI-144), no una afirmación de que DI-144 haya creado por sí sola el login.

La consulta profesional propia requiere un servicio nuevo por destinatario vinculado; la demo actual no es esa autorización. El historial compartido sigue como MVP sintético y diseño de servicios, sin escritura asistencial real o interoperabilidad. La identidad estable es por cuenta Auth, no deduplicación de personas entre sistemas.

Leer primero AUDITORIA_INTEGRAL.md y FUENTES_Y_EVIDENCIAS.md para estados actualizados, fuentes y riesgos. Los estados de Jira se conservaron sin modificarlos.
