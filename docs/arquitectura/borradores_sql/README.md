# Borradores SQL por dominio — NO APLICADOS

**Estado actualizado:** «no aplicados» se refiere al proyecto remoto. Los siete archivos se ejecutaron sin cambios en una base local desechable durante la [Fase 2](../VALIDACION_SQL_RLS.md). Su aplicación y pruebas locales no autorizan rollout ni habilitan los RPC clínicos todavía pendientes.

Estos archivos son propuestas dentro de documentación, **no migraciones instaladas en supabase/migrations**. No ejecutarlos contra Dental-IA ni producción. No cargan datos de usuarios.

Precondiciones futuras: aprobación del equipo, base PostgreSQL 17.11 compatible desechable cuyo nombre comience por dentaia_arch_qa_, cinco tablas académicas de QA vacías y roles técnicos normales. Establecer dentaia.architecture_draft='qa_only' solo en ese ambiente. El guarda reduce ejecuciones accidentales; no es un permiso para usar datos reales.

| Orden | Archivo/fase | Tablas | Dependencias y condición |
|---|---|---:|---|
| Existente | public y Auth/Storage | 5 de negocio | No recrear en migraciones de negocio ni alterar políticas actuales |
| Admin separada | [SQL DI-151 canónico](../../../supabase/migrations/20261103012414_di151_roles_auditoria_atomica.sql) | 3 | Se referencia sin copiar ni modificar; requiere revisión del Auth gestionado, QA y autorización aparte |
| 01 | [Identidad clínica](01_clinical_identidad.sql) | 5 | btree_gist propuesto; disponible pero no instalado remotamente. Roles no se conceden automáticamente |
| 02 | [Contenido](02_clinical_contenido.sql) | 3 | Paciente, membresía y FK compuestas; escritura asistencial real fuera del MVP |
| 03 | [Permisos y auditoría](03_clinical_permisos_auditoria.sql) | 3 | Ningún acceso de cliente hasta implementar y validar RPC |
| 04 | [Integridad clínica](04_clinical_integridad.sql) | 0 | Mismo paciente, origen, rutas, revisión y append-only |
| 05 | [Investigación IA](05_ia_investigacion.sql) | 6 | Clinical 01 instala extensión; si IA se implementa por separado, aprobar esa dependencia antes. Sin datasets reales |
| 06 | [Análisis personal](06_ia_analisis.sql) | 4 | Candidata UNIQUE adicional en dental_photos para FK de propietario; no cambia el algoritmo actual ni autoriza entrenamiento |
| 07 | [Integridad IA](07_ia_integridad.sql) | 0 | Matrices, versiones, estados, resultado y lease. Worker/RPC aún futuros |

Todos los CREATE TABLE nuevos activan RLS y revocan acceso directo, incluido service_role. Los triggers son SECURITY INVOKER con search_path vacío y no autorizan usuarios. No se publican funciones privilegiadas incompletas. Los futuros RPC necesitan un PR explícito con controles y pruebas del protocolo documentado.

Se analizaron los AST SQL y PL/pgSQL; no se aplicaron estos borradores por falta de un entorno PostgreSQL local en ejecución. La comprobación de gramática no valida operadores, permisos, triggers ni concurrencia reales. El catálogo principal solo registra las dos migraciones de octubre. No usar git push o un deploy para aplicar automáticamente estas propuestas.

Recuperación/rollback real requiere plan revisado y datos sintéticos; estos borradores no contienen DROP de tablas compartidas, cambios Auth ni desactivación RLS. La única ampliación de una tabla existente es la candidata UNIQUE documentada en fase IA.
