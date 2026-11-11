# DentaIA — Arquitectura integral

Propuesta técnica para revisión del equipo. Corte: 03/11/2026, America/Lima. Documentación local sin publicación, commits, PR, merge ni modificaciones de Jira o Supabase. La carpeta está preparada para copiarse a docs/arquitectura del repositorio; no es un cambio en una rama funcional ni una integración a main.

## Índice de lectura

1. [Arquitectura general y módulos](ARQUITECTURA_GENERAL.md)
2. [Arquitectura lógica](ARQUITECTURA_LOGICA.md)
3. [Arquitectura física](ARQUITECTURA_FISICA.md)
4. [Modelo conceptual](MODELO_CONCEPTUAL.md)
5. [Modelo lógico](MODELO_LOGICO.md)
6. [Modelo físico](MODELO_FISICO.md)
7. [Diccionario de datos](DICCIONARIO_DATOS.md)
8. [Seguridad y roles](SEGURIDAD_Y_ROLES.md)
9. [APIs y contratos](CONTRATOS_API.md)
10. [Diagramas Mermaid y fuentes editables](DIAGRAMAS.md)
11. [Brechas, fases y coordinación del equipo](BRECHAS_Y_PLAN_IMPLEMENTACION.md)
12. [Decisiones y alternativas](DECISIONES_ARQUITECTURA.md)
13. [Fuentes y SHAs](FUENTES_Y_EVIDENCIAS.md)
14. [Requisitos de las 171 incidencias](REQUISITOS_JIRA.md)
15. [Catálogo de Auth y Storage gestionados](CATALOGO_GESTIONADO.md)
16. [Comprobación de consistencia](VALIDACION_CONSISTENCIA.md)
17. [Políticas actuales y propuestas por tabla](POLITICAS_POR_TABLA.md)

Archivos estructurados: [modelo único](MODELO_DATOS.json) e [inventario Supabase sin filas](INVENTARIO_SUPABASE.json). Los diagramas .mmd se pueden abrir en un editor Mermaid; el Markdown conserva también el código.

## Cómo interpretar los estados

Existente en Supabase significa estructura remota observada. Integrado en main significa código en el SHA indicado. En rama significa código publicado separado, sin asumir despliegue. Sintético significa simulación explícita. Propuesto significa diseño nuevo pendiente de revisión e implementación. Listo en Jira no reemplaza ninguna de esas verificaciones.

El modelo objetivo incluye 29 tablas de negocio: 5 existentes, 3 de la migración administrativa no aplicada y 21 nuevas propuestas. No incluye como tablas de negocio las internas de Auth/Storage. Las once tablas clínicas permiten continuidad entre clínicas dentro de DentaIA; las diez de IA son futuras y exploratorias. No hay diagnóstico clínico validado ni interoperabilidad externa acreditada.
