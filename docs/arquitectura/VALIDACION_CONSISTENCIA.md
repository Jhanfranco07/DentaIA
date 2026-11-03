# Validación de consistencia final

Este documento conserva el cierre estático de la **Fase 1**. La ejecución posterior de SQL/RLS se registra por separado en [VALIDACION_SQL_RLS.md](VALIDACION_SQL_RLS.md): 118 comprobaciones SQL y 29 revisiones de catálogo aprobadas. Los límites «SQL no ejecutado» de la tabla siguiente describen únicamente aquella primera fase.

Fecha: 03/11/2026. Rama `docs/auditoria-arquitectura-integral`, base c992a142.

| Comprobación ejecutada | Resultado | Alcance |
|---|---|---|
| Verificador documental | 360/360 aprobadas | PK/FK/tipos/NULL/defaults/DDL, enlaces, contratos, fuentes y preservación |
| Modelo auditado | 29 tablas, 219 columnas | 214 originales y cinco incorporaciones justificadas; no nuevas tablas |
| Diagramas | 17/17 renderizados | Mermaid CLI 12.2.0; fuentes y SVG; inspección visual de general y clínico |
| Borradores SQL | 7 analizados | Gramática SQL y PL/pgSQL normalizado; **ninguno ejecutado** |
| Suite del repositorio | 231/231 aprobadas | Node.js test runner; cero fallos/omitidas/canceladas; no prueba las migraciones nuevas |
| Git diff --check | Sin errores | Sin modificaciones funcionales ni staging; nuevos documentos sin commit |
| Fuente original | 38 archivos preservados | Comparación SHA-256 contra inventario previo a la auditoría |

Se consultaron exclusivamente metadatos de Supabase y requisitos de Jira. El catálogo principal tiene cinco tablas públicas de negocio y no acredita el despliegue de las tres administrativas. El modelo propuesto conserva 5 existentes + 3 administrativas + 11 clínicas + 10 de IA.

La ausencia de errores de parser no prueba que PostgreSQL resuelva funciones, extensiones y triggers ni que RLS soporte los escenarios concurrentes. Docker no tenía daemon disponible: no se utilizó Dental-IA como sustituto. No se probaron dos JWT reales, descargas clínicas, inferencia ni expiración de sesión en esta auditoría. No se declara aptitud para producción ni uso clínico.

Consultar [resultados mecánicos](validacion/RESULTADOS.json), [pruebas y límites](PRUEBAS_Y_LIMITACIONES.md), [reproducción](herramientas/README.md) y [matriz por tabla](MATRIZ_AUDITORIA_TABLAS.md). El manifiesto SHA-256 excluye su propio archivo.
