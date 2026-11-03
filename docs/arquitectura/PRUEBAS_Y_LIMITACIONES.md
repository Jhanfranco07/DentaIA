# Pruebas y límites de esta auditoría

**Alcance histórico: Fase 1.** Para los ensayos SQL locales ya realizados en la Fase 2, consultar [VALIDACION_SQL_RLS.md](VALIDACION_SQL_RLS.md). La aplicación local de borradores y los prototipos de auditoría/concurrencia ya tienen evidencia; siguen pendientes los RPC de aplicación, JWT HTTP reales y validación clínica.

Fecha: 03/11/2026. No confundir consistencia documental con integración real.

## Ejecutado

- Lectura de las 38 piezas originales, incluido JSON/modelo de 29 tablas y 214 columnas, catálogo, políticas y diagramas; copia preservada para contraste SHA-256.
- Consulta JQL paginada 100+71: 171 incidencias con descripción, estado y responsable; contraste específico de DI-34/36/144/145/146 y criterios relacionados. Sin cambios en Jira.
- Git fetch e inspección de main, administración y ramas profesional/paciente relevantes, con SHAs y rutas. Sin cambiar sus refs locales ni publicar nada.
- SELECT de catálogo Supabase: 43 columnas de negocio, 32 restricciones, 13 índices, 16 políticas, bucket privado; metadatos Auth y privilegios complementarios. Cero filas clínicas/Auth consultadas. Solo dos migraciones de octubre observadas.
- Generación de modelo/diccionario/DER desde una fuente; comprobación de PK, tipos, objetivos de FK y claves candidatas. Las candidatas propuestas se distinguen de las observadas.
- Sintaxis SQL mediante pglast, instalado en herramienta temporal fuera de dependencias del proyecto. Para PL/pgSQL se normalizan esquemas/tipos compuestos a record por limitación del parser; no es compilación sobre catálogo real.
- Regresión automatizada del repositorio: 231 pruebas ejecutadas, 231 aprobadas, cero fallos, canceladas u omitidas. Estas pruebas no ejecutan los nuevos borradores de arquitectura.
- Render real de 17 Mermaid con CLI 12.2.0 y Chrome headless aislado; error original reproducido y corregido. Se conserva fuente editable y SVG.

El resultado mecánico final se registra en [validacion/RESULTADOS.json](validacion/RESULTADOS.json) y los comandos reproducibles están en herramientas/. No se inventan logs ni se atribuyen pruebas de esta auditoría a la confirmación manual de DI-151.

## NO EJECUTADO

- Aplicación local de los borradores: Docker no tiene daemon disponible. No se aplicó DDL remoto como alternativa.
- Resolución de todas las funciones/tipos/operadores/triggers en PostgreSQL real, restricciones bajo carga o deadlocks.
- RLS con dos JWT reales, permisos profesionales cruzados, expiración de sesión, revocación concurrente, descarga tras revocar o fallo real de auditoría.
- Despliegue de las 3 tablas administrativas, 11 clínicas o 10 IA en Dental-IA.
- Entrenamiento, inferencia, métricas, revisión odontológica, validación clínica, UX de nuevas pantallas o rendimiento.

## Pruebas obligatorias antes de habilitar cada fase

1. Base QA vacía con tablas académicas y Auth de prueba, versiones de extensiones verificadas. Probar cada fase con datos sintéticos y rollback/respaldos.
2. Profesional sin ficha pública, dos clínicas y dos episodios: rechazar solapamiento y reasignación de identidad; comprobar solicitudes por destinatario sin acceso a ajenas.
3. Paciente con dos orígenes: rechazar recurso de otro paciente, reemplazo cruzado, motivo vacío, bifurcación y ciclos; probar historial y campos desconocidos sin fallback ajeno.
4. Paciente, profesional autorizado/no autorizado, otra clínica, rol retirado, membresía vencida/suspendida y permiso revocado/expirado. Ningún SELECT alternativo evita auditoría.
5. Carrera lectura–revocación y fallo de auditoría antes de entregar. Cada página/descarga revalida; la respuesta ya autorizada tiene el límite documentado.
6. Foto/autorización/usuario cruzados; borrar foto no bloquea metadatos existentes y elimina únicamente análisis propios. Storage se ensaya por separado.
7. Lease expirado, renovación/reclamo concurrentes, intento antiguo finalizando, job duplicado, cancelación y resultado duplicado/no evaluable. No se aceptan callbacks de un worker anterior.
8. Sujeto en distintos splits, imágenes duplicadas, dataset congelado, matriz negativa/no cuadrada/suma incorrecta, métricas ausentes y artefacto/hash divergentes.
9. Regresión de DI-150/151, RLS de las cinco tablas existentes, y entrega visual actual. Mantener flags apagadas hasta aprobar pruebas de cada ambiente.

No se declara lista para producción la arquitectura. Las decisiones pendientes se detallan en auditoría, ADR y plan por etapas.
