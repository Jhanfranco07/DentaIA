# Modelo físico definitivo propuesto

**Propuesta revisable, no lista para producción ni aplicada.** El catálogo confirma cinco tablas public/43 columnas, 13 índices y 16 políticas (13 public, 3 Storage). dentaia_admin, clinical y ml no aparecen en el inventario vivo de esta auditoría. No se infiere despliegue por estado Jira o validación manual.

## Separación física

| Esquema | Tablas | Estado y límite |
|---|---:|---|
| public | 5 | Existente; conservar columnas y políticas. Solo IA propone una candidata UNIQUE adicional no destructiva. |
| dentaia_admin | 3 | Migración DI-151 de rama, conservada sin cambios; no aplicada en este proyecto según catálogo. |
| clinical | 11 | Propuesto para QA sintético y etapas clínicas posteriores. RLS y cero acceso directo por defecto. |
| ml | 10 | Investigación/inferencia futuras; no se habilitan operadores ni clientes mediante el rol superusuario. |
| auth/storage | Gestionadas | Solo inventario e integración mediante contratos existentes; no reconstruir sus tablas. |

## Borradores por dependencia

[borradores_sql/README.md](borradores_sql/README.md) contiene orden, precondiciones y límites. Los siete archivos crean las 21 tablas propuestas con tipos, PK/FK, NOT NULL, UNIQUE, CHECK e índices. Activan RLS y REVOKE; no conceden contenido sin auditoría. Los guardas exigen una base desechable dentaia_arch_qa_* y una opción qa_only. No son migraciones publicadas en supabase/migrations ni se autodespliegan.

01: identidad profesional/clínica; 02: contenido; 03: concesiones/auditoría; 04: invariantes de paciente/origen/correcciones; 05: investigación IA; 06: análisis privado; 07: métricas, congelación y transiciones. Administración es una fase separada que referencia su SQL canónico, no una copia de nuevas tablas de roles.

## Concurrencia y auditoría

EXCLUDE evita solapamiento activo de membresías y particiones distintas por sujeto/dataset, también en concurrencia. Las FK compuestas eliminan dependencias de un CHECK que intente consultar otra tabla. Triggers complementan igualdad de paciente, ciclos, inmutabilidad, rutas, matrices y estados. El parser no prueba que esos triggers se ejecuten correctamente.

Los RPC clínicos son contratos pendientes: necesitan identidad vigente, permisos por recurso, bloqueos compartidos de lectura/exclusivos de revocación, INSERT de auditoría y commit antes de entregar. No se incluye una función privilegiada incompleta con GRANT público. El algoritmo exacto, orden de bloqueos, idempotencia y limitación de streams están en [PROTOCOLO_RPC_Y_CONCURRENCIA.md](PROTOCOLO_RPC_Y_CONCURRENCIA.md).

## Archivos y eliminación

dental-photos permanece privado (8 MiB, JPEG/PNG/WebP). El bucket propuesto dentaia-clinical-documents no existe ni se crea aquí; requiere validación, cuotas y proxy auditado. No hay transacción conjunta entre un blob Storage y PostgreSQL. El borrado actual es progresivo y reintentable; la futura relación IA no debe bloquearlo. Las referencias de documento se validan contra paciente/atención, pero un CHECK no inspecciona bytes ni demuestra la existencia física del objeto.

## Riesgo de Auth y operación

El SQL administrativo actual escribe un namespace de raw_app_meta_data y su auditoría en la misma base. Es distinto de una llamada Auth Admin más otra transacción. Requiere revisar propietario SECURITY DEFINER, search_path vacío, GRANT y compatibilidad gestionada; un escritor externo puede eludir el protocolo. Alternativa: autoridad propia/outbox, que requeriría adaptar DI-150; no operar dos autoridades a la vez.

Conservación clínica, anonimización, backups, RPO/RTO, región, costos, escáner de archivos y operación de IA continúan por acordar. No se fijan plazos legales ni se infieren garantías productivas. En la Fase 1 no se pudieron ejecutar pruebas SQL por falta de daemon Docker. La [Fase 2](VALIDACION_SQL_RLS.md) ya ejecutó los siete borradores y comprobó las 29 tablas en PostgreSQL 17.11 local; no valida por ello JWT HTTP, RPC futuros ni uso clínico real.
