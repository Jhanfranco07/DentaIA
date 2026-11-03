# Modelo físico y estrategia Supabase

Este documento es diseño, no una migración ejecutable ni aplicada. Las cinco tablas public y sus 13 índices proceden del catálogo. Se observaron 16 políticas (13 en public, 3 en storage), RLS activo en cinco tablas; ninguna función/trigger de negocio en public/private. No existe actualmente el esquema de negocio dentaia_admin ni clinical/ml en el inventario.

## Separación física propuesta

- public: conservar las cinco tablas académicas y API actual.
- dentaia_admin: tres tablas de la migración existente en rama; acceso directo denegado a anon/authenticated/service_role, solo wrapper RPC restringido según revisión.
- clinical: once tablas propuestas, sin exposición directa del contenido a lectura global. RLS como defensa en profundidad más operaciones explícitas.
- ml: diez tablas propuestas para investigación e inferencia futura. No expuestas a usuarios públicos; trabajadores con identidad de servicio mínima.
- auth y storage: gestionados por Supabase, no reconstruir ni alterar desde estas propuestas.

## Tipos, índices y transacciones

Aplicar tipos/NULL/defaults de [diccionario](DICCIONARIO_DATOS.md), UUID y timestamptz. PK y UNIQUE generan índices; no duplicarlos. Índices compuestos siguen filtros de propietario, clínica, vigencia y orden estable por fecha/id. Antes de aplicar, medir EXPLAIN con datos sintéticos representativos; no afirmar rendimiento medido. No particionar por clínica si rompe identidad compartida; evaluar partición temporal de auditoría solo al medir volumen.

Concesión/revocación e historial usan transacción PostgreSQL. Lectura propuesta bloquea la concesión vigente en modo compartido, valida relaciones y recursos y registra auditoría antes de entregar; revocación toma bloqueo incompatible. Definir que una lectura autorizada ya iniciada puede terminar antes de confirmarse la revocación; no prometer retirar datos ya descargados. Si el INSERT de auditoría falla, no retornar contenido. Para denegados, devolver un resultado controlado después de INSERT, no lanzar una excepción que revierta la auditoría. Fallos previos de autenticación se registran en un canal saneado sin forzar FK a identidad inexistente.

Cambios de roles: conservar propuesta DI-151 con revisión, aprobación, idempotencia y lock global; es una función privilegiada que modifica raw_app_meta_data en tabla gestionada. Riesgo de compatibilidad y escritor externo: revisar propietario, search_path, grants, triggers y versión Auth. Alternativa: autoridad propia y outbox, pero exige adaptar guard y prueba de revocación; no mezclar ambas autoridades. El catálogo actual no contiene estas tablas/funciones, por lo que la validación manual del responsable y la migración en Git no prueban su despliegue en este proyecto.

Storage no comparte transacción con PostgreSQL. Carga usa objeto privado y metadatos con compensación; limpieza fallida se reconcilia, sin mensajes de éxito ficticio. Borrado es reintentable y elimina archivo antes del registro. Documentos clínicos propuestos usan un bucket privado separado y descarga por proxy que revalida permisos por solicitud; una URL firmada es bearer y sigue útil hasta expirar, por lo que no garantiza revocación inmediata.

## RPC propuestos

| RPC | Objetivo | Restricción |
|---|---|---|
| clinical.read_authorized_history | Lectura y auditoría clínica en una operación | Paciente propietario u odontólogo/membresía autorizados; límites, proyección y paginación |
| clinical.grant_history_access | Conceder atenciones seleccionadas | Solo paciente; comprobar mismo paciente y destinatario verificado |
| clinical.revoke_history_access | Revocar concesión | Solo paciente propietario; idempotente y auditado |
| clinical.authorize_document_read | Autorizar objeto privado y auditar | Revalidar concesión; no aceptar ruta de Storage del cliente |
| ml.claim_analysis_job | Reservar trabajo de análisis | Servicio mínimo, transición atómica y lease; SKIP LOCKED si se implementa cola PostgreSQL |

No son funciones existentes. Los nombres finales y permisos deben revisarse. Preferir SECURITY INVOKER; donde sea imprescindible una función privilegiada de auditoría, ubicarla en esquema no expuesto, revocar EXECUTE de PUBLIC, fijar search_path y validar actor dentro de la función. Nunca resolver un fallo RLS agregando acceso universal de superusuario.

## Conservación y recuperación

No fijar plazos clínicos legales sin revisión del equipo y asesoría correspondiente. Hasta decidirlos, conservar versiones y no permitir DELETE clínico ordinario. Respaldos, PITR, región, RPO/RTO y plan de recuperación no se comprobaron en la conexión: son decisiones pendientes. Propuesta académica inicial para discutir: RPO 24 h y RTO un día, sujetos a plan y costo, sin presentarlos como garantías actuales. Probar restauración de datos sintéticos antes de dar por aceptado el mecanismo.
