# Fase 6 — versionado y preparación de integración GitHub

Rama: `docs/auditoria-arquitectura-integral`. Responsable técnico: Jhan Franco. DI-34/DI-36, con dependencia de DI-144 y contratos para DI-145/DI-146. DI-36 sigue en Sprint 6; no se modifica Jira ni se declara terminada.

## Estado inicial y alcance

HEAD inicial `c992a14229d1bc838166dae200559b9aa7f7428c`; cero modificaciones de archivos seguidos, staging vacío y **223 archivos nuevos** (7.1 MB de texto). Proceden de las fases 1–5: arquitectura, 38 fuentes históricas, 17 Mermaid y sus SVG, SQL/protocolos/bancos, ocho métodos HTTP y evidencias. No hay archivos ajenos entre los nuevos, binarios, fotos privadas, dumps, cachés, node_modules, .env o logs que deban publicarse.

El inventario exacto, grupos y escaneo están en [AUDITORIA.json](versionado_fase6/AUDITORIA.json). Todo archivo inicial se conserva; las fuentes históricas permanecen byte a byte. Única corrección de contenido del grupo documental: tres espacios finales de la copia actual REQUISITOS_JIRA.md, sin cambiar requisitos. La transcripción histórica de docs/evidencias no se modifica.

Se añadió .gitattributes para conservar CRLF/LF exactos de documentos/evidencias y sus hashes. `whitespace=cr-at-eol` reconoce CRLF. Solo la transcripción histórica de requisitos Jira admite espacios finales Markdown, mediante una regla explícita por archivo; no se ocultan errores de código, no se cambia la configuración global de Git ni se desactiva CI. Los SVG son renderizados técnicos de los 17 diagramas solicitados, no binarios innecesarios.

## Commits temáticos

| Grupo | Commit / identificación | Archivos y responsabilidad |
|---|---|---|
| Arquitectura | `30deceaaa692e2be67e45f1cb714f56717fd746d` | 110 archivos: modelos, decisiones, auditoría, fuentes históricas y diagramas; incluye propuestas IA documentales, sin despliegue |
| Base de datos | `3cdce8077cf7c018ecf6acb2cd128014060b0ba6` | 24 archivos: 01–04, pruebas SQL/constraints/RLS y explicación de borradores |
| Servicios clínicos | `5738b938fb689843019ebfe3cb0b1ce494108bfc` | 17 archivos: 08–10, RPC, pruebas/carreras y el incremental MVP de workspace |
| Backend HTTP | `edaad20e516ba883eb6cb648f451338d1b6527d3` | 31 archivos: Route Handlers, DTO, autenticación, cursor, pruebas aisladas y banco JWT |
| Evidencias y contratos finales | Localizable por mensaje `DI-36 test(docs): documentar validaciones e integracion del backend` | Informes F1–5, contratos definitivos, paquete QA/harness y preparación F6 |

Este documento no inventa el SHA del commit que lo contiene. El cierre posterior identifica los commits ya existentes en un inventario verificable; el SHA final se entrega por Git/PR y no obliga a reescribir historia. Identidad Git comprobada de Jhan antes de crear commits; se mantienen los commits anteriores y la autoría de los demás integrantes.

## Dependencia con main y riesgo de integración

`main` remoto observado: `1bcb84956e755b4089494af43f983fd0d2e5bfad`. La base inicial difiere 8/8 commits: esta rama hereda **ocho commits administrativos DI-148–151** ya publicados en feature/superusuario-admin. No son cambios nuevos de Fase 6 ni se excluyen reescribiendo historia. La importación del lector de roles DI-150 depende de esa base, ausente de main.

Un `git merge-tree --write-tree --name-only origin/main HEAD` tras los primeros cuatro commits calculó la combinación sin conflictos, sin modificar ramas o archivos de trabajo. Se volverá a consultar después del cierre. Esto no integra a los compañeros ni garantiza aceptación funcional de sus interfaces. El PR debe ser **Draft**, con dependencia administrativa visible y revisión explícita antes de integrar a main.

No se actualizan ni fusionan ramas funcionales. Se diferencian el diff de merge-base y la comparación de extremos: archivos nuevos de landing/profesional en main no deben copiarse desde esta base antigua ni presentarse como borrados de Fase 6.

## Validación y publicación

Las evidencias F5 fueron revisadas: modelo local de 19 tablas/142 columnas, 269 pruebas aisladas, 78 SQL, 59 HTTP, 45 escenarios MVP con último resultado favorable, límites Storage y cierre de ocho rutas. Se conservan como antecedentes, con sus intentos fallidos y límites.

Antes del push se repiten suite, SQL pertinente, HTTP/JWT, TypeScript/build, audit, diff-check, escaneo y validador documental. Tres bancos admiten `--fase6` para guardar resultados nuevos en versionado_fase6 y conservar F5. No se repite implementación funcional ni se cambia autorización. La preparación SQL solo recrea la base QA local propia si se pide expresamente y verifica su marcador; no toca datos remotos, las bases F2/F3 ni otros volúmenes.

Los resultados nuevos y comandos quedan en [VALIDACIONES.json](versionado_fase6/VALIDACIONES.json). Hasta completar esa ejecución, los datos históricos no se etiquetan como nueva validación. La publicación será exclusivamente a origin/docs/auditoria-arquitectura-integral, sin force ni auto-merge; primero se comprueba si el ref remoto existe y su relación con el local.

El PR se prepara hacia main con el título `DI-34 / DI-36 — Arquitectura integral y backend seguro del MVP`. Antes de abrirlo se busca un PR existente. Su URL y los resultados efectivamente observados de Actions se registrarán en el cierre posterior, sin asumir números de PR futuros.

## Preview, seguridad y revisión

Push a esta rama no es push a main ni despliegue productivo. GitHub está integrado con Vercel y puede generar Preview; no se cambian ajustes de Vercel. Las ocho rutas clínicas/profesionales tienen bloqueo duro de NODE_ENV=production, además de flag opt-in y URL loopback; incluso flag=true devuelve 404 en build. Las páginas administrativas de desarrollo también usan notFound fuera de development; APIs administrativas conservan DI-150/MFA y flags privados. No se versionan claves ni configuración de producción y no se aplican migraciones desde los workflows.

CI y Tests solo corren en pushes main/feature/** o PR a main; Security en main, PR o ejecución manual. Por tanto, el push docs/** por sí solo puede no generar Actions; se consultan ejecuciones del PR. Permisos contents:read y checkout sin persistir credenciales se conservan. SQL/JWT reales son bancos locales separados: Tests de Actions no dispone ni necesita credenciales Supabase.

La revisión debe distinguir documentación (29 tablas/219 columnas integrales, incluida IA futura) de implementación local del MVP (19/142, sin IA), revisar los cinco commits nuevos y los ocho administrativos heredados y comprobar cierres/privilegios. No se afirma aprobación de integración mientras haya checks pendientes o fallidos.

## Límites y Fase 7

Pendientes: revisión de DI-144/150/151 con main; integración acordada con las vistas de Anelis/Angie, selección segura de destinatarios, verificación profesional, consentimiento clínico, retención/bajas, descarga clínica auditada, observabilidad y paquete desplegable QA con guardas de destino. El adaptador actual no acepta un proyecto alojado ni production; no se debilita para obtener un Preview positivo.

Fase 7 propuesta: acordar y autorizar un proyecto Supabase QA separado, revisar baseline/migraciones/owners, ensayar desde vacío y recuperación y ejecutar JWT/RLS/UI integrados allí. No copiar datos de Dental-IA, no activar servicios clínicos productivos ni considerar estas pruebas validación clínica. No se modifica Jira, Supabase remoto, Vercel, fechas, responsables o sprints.
