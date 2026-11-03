# DentaIA — arquitectura integral auditada

**Fase 6:** [versionado e integracion GitHub](VERSIONADO_E_INTEGRACION_GITHUB.md), [PR #19 en borrador](https://github.com/Jhanfranco07/DentaIA/pull/19). Commits tematicos, evidencias F6 y dependencias administrativas explicitas; sin merge, migraciones remotas ni activacion productiva.

**Fase 5 vigente:** [consolidacion e implementacion del backend MVP](CONSOLIDACION_BACKEND_MVP.md): paquete local de 19 tablas/142 columnas sin IA, cinco lecturas HTTP nuevas, RPC comun y pruebas integrales. Produccion sigue cerrada; DI-36 conserva Sprint 6 y no se declara terminada. Los informes F1-4 siguientes son antecedentes conservados.

**Fase 4:** [HTTP y JWT reales validados localmente](VALIDACION_HTTP_JWT.md): tres Route Handlers, **60 comprobaciones HTTP** y **255 pruebas unitarias** aprobadas. Auth local emitió JWT ES256; se probó caducidad, logout, auditoría y dos órdenes de revocación concurrente. Producción y URLs no locales permanecen cerradas. [Reproducción](http_jwt/README.md).

**Estado histórico de Fase 3:** [servicios clínicos implementados en QA](IMPLEMENTACION_SERVICIOS_CLINICOS.md): tres RPC, **78/78 pruebas SQL** aprobadas, sin reutilizar el prototipo anterior como backend. Los endpoints Next se incorporaron después en Fase 4; las vistas aún no están integradas. Lectura/concesión desactivadas por defecto; política sintética habilitada únicamente en la fixture local. [Reproducción](servicios_clinicos/README.md).

**Actualización Fase 2:** se ejecutaron los siete borradores en Supabase/PostgreSQL local aislado: **118/118 comprobaciones SQL** y **29/29 revisiones de catálogo** aprobadas. Consultar [VALIDACION_SQL_RLS.md](VALIDACION_SQL_RLS.md), [evidencias SQL](pruebas_sql/RESULTADOS.json) y [reproducción](pruebas_sql/README.md). No se aplicó nada a Dental-IA. Los RPC clínicos siguen pendientes; las pruebas positivas del prototipo QA se identifican separadamente.

Fecha: **03/11/2026, America/Lima**. Rama local `docs/auditoria-arquitectura-integral`, desde c992a142 de DI-151. Sin commits, push, PR, merge, modificaciones funcionales o escrituras en Jira/Supabase.

**Dictamen:** modelo físico definitivo **propuesto para revisión del equipo y QA sintético**, no listo para producción. Se conservan las 29 tablas; las 214 columnas originales se auditan y el diseño revisado tiene 219 (cinco incorporaciones justificadas). Las 38 piezas de origen permanecen intactas en `../evidencias/arquitectura/`.

## Lectura recomendada

1. [Informe y 31 hallazgos](AUDITORIA_INTEGRAL.md) · [diferencias del modelo](CAMBIOS_MODELO.md).
2. [Arquitectura general y módulos](ARQUITECTURA_GENERAL.md), [lógica](ARQUITECTURA_LOGICA.md) y [física](ARQUITECTURA_FISICA.md).
3. [Modelo conceptual](MODELO_CONCEPTUAL.md), [lógico](MODELO_LOGICO.md), [físico](MODELO_FISICO.md) y [diccionario de las 29 tablas](DICCIONARIO_DATOS.md).
4. [Roles y seguridad](SEGURIDAD_Y_ROLES.md), [políticas por tabla](POLITICAS_POR_TABLA.md) y [protocolo de RPC/revocación/concurrencia](PROTOCOLO_RPC_Y_CONCURRENCIA.md).
5. [Contratos de API](CONTRATOS_API.md), [diagramas editables y SVG](DIAGRAMAS.md).
6. [Plan de implementación y coordinación](BRECHAS_Y_PLAN_IMPLEMENTACION.md), [decisiones](DECISIONES_ARQUITECTURA.md), [fuentes comprobadas](FUENTES_Y_EVIDENCIAS.md).
7. [Pruebas y limitaciones](PRUEBAS_Y_LIMITACIONES.md), [consistencia](VALIDACION_CONSISTENCIA.md) y [borradores SQL por fases](borradores_sql/README.md).

## Fuentes estructuradas

- [MODELO_DATOS.json](MODELO_DATOS.json): 29 tablas/219 columnas con PK, FK, CHECK, UNIQUE, índices y fases.
- [INVENTARIO_SUPABASE_VERIFICADO.json](INVENTARIO_SUPABASE_VERIFICADO.json) y [catálogo complementario](CATALOGO_COMPLEMENTARIO_VERIFICADO.json): metadatos, no filas privadas.
- [REQUISITOS_JIRA_VERIFICADOS.json](REQUISITOS_JIRA_VERIFICADOS.json): 171 incidencias leídas, con descripción y responsable de coordinación; no se modifica Jira.
- [FUENTES_VERIFICADAS.json](FUENTES_VERIFICADAS.json): refs/SHAs y archivos contrastados.
- [HALLAZGOS.json](HALLAZGOS.json) y [validación mecánica](validacion/RESULTADOS.json).
- Los anexos originales [REQUISITOS_JIRA.md](REQUISITOS_JIRA.md), [CATALOGO_GESTIONADO.md](CATALOGO_GESTIONADO.md) e [INVENTARIO_SUPABASE.json](INVENTARIO_SUPABASE.json) se conservan como instantáneas del paquete recibido; los archivos VERIFICADOS describen la consulta de esta auditoría.

## Qué se puede implementar y qué no

| Grupo | Tablas | Situación |
|---|---:|---|
| MVP académico actual | 5 existentes | Reutilizar; no recrear Auth, Storage ni módulos personales. |
| Administración DI-151 | 3 de migración publicada | Revisar/ensayar su rollout en QA autorizado; ausentes en el catálogo principal. La validación manual declarada no se presenta como nueva evidencia de despliegue aquí. |
| Clínica y permisos | 11 propuestas | Primer candidato a QA sintético tras acordar identidad/verificación/membresías/retención; no habilitar contenido antes de RPC y auditoría efectiva. |
| IA | 10 propuestas | Diseño futuro condicionado a dataset/licencia, experimento reproducible, autorización específica y servicio mínimo. |

En la Fase 1 el motor Mermaid renderizó 17 diagramas y los borradores solo se analizaron sintácticamente por falta de daemon Docker. La ejecución local posterior figura en el informe de Fase 2 enlazado arriba. Los tests del repositorio no sustituyen los ensayos SQL ni las pruebas con JWT reales, todavía pendientes. No existe autorización para aplicar estas propuestas a Dental-IA.

Consultar también la [matriz por tabla](MATRIZ_AUDITORIA_TABLAS.md) y los [comandos reproducibles](herramientas/README.md). Regresión ejecutada: **231/231 pruebas aprobadas**; no es validación de las nuevas migraciones.

## Fase 7 — QA y entrega a frontend

- [Validación local y bloqueo de QA remoto](VALIDACION_SUPABASE_QA_FASE_7.md).
- [Guía de integración para Anelis y Angie](GUIA_INTEGRACION_FRONTEND_QA.md).
- [Evidencias nuevas y plan de migraciones](qa_fase7/README.md).
