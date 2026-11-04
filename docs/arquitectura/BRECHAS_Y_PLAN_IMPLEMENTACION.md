# Brechas y plan de implementación

## Contraste de fuentes

| Hallazgo | Evidencia | Implicación |
|---|---|---|
| Administración terminada en Jira, en rama separada | DI-148–151 y c992a142 | No implica integración a main ni migración desplegada; conservar confirmación manual sin inventar despliegue |
| Migración DI-151 en Git; no existe dentaia_admin remoto | Catálogo y dos migraciones aplicadas de octubre | Rollout de tablas/RPC pendiente en este proyecto; no afirmar persistencia administrativa aquí por estado Jira |
| Historial sintético en rama; sin tablas clínicas remotas | DI-145/DI-156/DI-157 y fuente profesional | La UI demuestra estados/contrato; permisos reales y auditoría son una brecha separada |
| Profesional main es pantalla demo | /profesional en main | No conecta todavía al proveedor clínico de rama ni verifica rol real en servidor |
| Panel paciente en rama; resumen cliente condicionado a sesión | /panel, ResumenPanel.tsx | Cubre reutilización personal; revisar criterio de acceso/retorno y pruebas de aislamiento antes de integración |
| Esquema exige dentists.is_demo=true y solicitudes académicas | CHECK y comentarios del catálogo | No publicar profesionales/citas reales sin ampliar modelo y proceso de verificación |
| DI-36/DI-34 futuros, pero ya hay persistencia/código base | Jira vs cinco tablas reales y clientes | Refinar incrementalmente; no reconstruir Auth, fotos o solicitudes ya existentes |
| Reporte y directorio en main, historias futuras | DI-41/DI-42 | Comparar criterios pendientes, no implementar copias del mismo módulo |
| Consentimiento académico actual prohíbe análisis/entrenamiento | patient_consents y texto en código | No conectar inferencia ni clínica a ese consentimiento; autorización nueva propuesta |
| Estados/fechas académicas y nativas difieren | Sprints Jira y descripciones históricas | El modelo no cambia sprints ni interpreta esas fechas como ejecución real |

## Secuencia de trabajo propuesta

1. Revisar arquitectura con DI-34/DI-36: confirmar contratos de identidad, roles, nombres de UUID y autoridad del permiso; aceptar o rechazar ADR-04. No aplicar cambios remotos durante la revisión.
2. Integración de ramas en entorno aislado por el equipo: comparar SHAs y evitar sobrescribir vista profesional/main o estilos comunes. Revisión y PR posteriores quedan fuera de esta tarea.
3. QA administrativo: revisar/aplicar migración solamente con autorización futura, pruebas SQL aisladas, AAL2 real, aprobación exacta, idempotencia, auditoría, rollback y concurrencia. Confirmar flags/secrets por entorno sin exponerlos.
4. MVP clínico sintético: crear entidades y RPC propuestos en QA, permisos del paciente sobre atenciones seleccionadas, dos clínicas y profesional sin permiso. Sustituir proveedor sintético detrás del contrato, conservando estados y procedencia.
5. Paciente: integrar panel con flujos propios, diseñar concesión/revocación cuando el equipo amplíe DI-146 o backlog. La tarea actual no modifica sus criterios ni asigna nuevo alcance unilateralmente.
6. Directorio y profesional: acordar verificación/vinculación Auth–dentists; ninguna promoción a odontólogo basta para acceso clínico.
7. Evaluación de producto: escenarios integrados, accesibilidad, SUS con respuestas reales y revisión odontológica real o ausencia documentada. Revisión presencial del 05/11 no se anticipa como realizada.
8. IA: dataset licenciado, partición por sujeto, modelo reproducible y métricas reales; primero experimento offline. Después autorización específica de análisis, trabajos y resultados, con calidad/no evaluable y límites explícitos.
9. Operación: smoke posdespliegue, logs saneados, alertas, cuotas y recuperación ensayada; acordar costos/retención.

## Distribución propuesta basada en responsables reales

| Integrante | Responsabilidad actual Jira | Coordinación propuesta; no nueva asignación |
|---|---|---|
| Jhan | DI-34, DI-144, DI-40 | Arquitectura común y administración; revisar migración/seguridad con Anelis; experimento visión con Stephan |
| Anelis | DI-36, DI-145, DI-39, DI-42, DI-43 | Persistencia segura, profesional/historial, contratos y pruebas clínicas con datos sintéticos; no cargarle unilateralmente nuevas historias |
| Angie | DI-146, DI-35, DI-41, DI-44 | Panel paciente, integración de UI, directorio/documentación; definir experiencia de concesión/revocación con Anelis |
| Stephan | DI-147, DI-37, DI-38 | Landing, fotos/consentimiento y datos exploratorios; coordinar licencias/privacidad y no duplicar almacenamiento |

La coordinación propuesta debe validarse con el equipo y no cambia responsables, puntos o fechas. Dependencias clínicas pueden superar la revisión del 05/11: acotar demostración sintética antes de prometer interoperabilidad, seguridad productiva o IA entrenada.

## Riesgos y criterios de salida

No activar clínica real hasta permisos por paciente/contexto, auditoría durable, documentos privados, pruebas cruzadas y conservación acordados. No activar escritura de roles por defecto ni usar credencial administrativa general como cliente clínico. Resolver consistencia Auth/PostgreSQL y no confundir listado administrativo con fuente transaccional. La lectura actual escanea hasta 2000 cuentas: sustituir por proyección paginable si el volumen supera el MVP, mediante medición.

Las entidades de este diseño no prueban capacidad del equipo ni validación clínica. Cada fase tiene salida comprobable: contrato revisado, datos sintéticos, prueba negativa y positiva con versión/entorno, evidencia saneada y limitaciones documentadas. Los umbrales de rendimiento y disponibilidad siguen por acordar.
## Actualización de auditoría integral

## Fases revisadas y criterios de salida

| Fase | Se puede preparar ahora | Requiere decisión/validación | Salida comprobable |
|---|---|---|---|
| 0 — Contrato común | Revisar estas 29 tablas, 219 columnas y 31 hallazgos | Verificación profesional, retención, estados y política de análisis | Acuerdo del equipo y alcance MVP/futuro firmado, sin cambios automáticos de Jira |
| 1 — Base existente | Reutilizar las cinco tablas y SDK | No quitar is_demo para aparentar atención real | Regresión actual y permisos por propietario intactos |
| 2 — Administración | Revisar SQL DI-151 conservado | Conciliar entorno de validación manual con ausencia de esquema en proyecto principal | QA SQL y rollout autorizado, flags cerradas por defecto |
| 3 — Clínica sintética | 11 tablas propuestas y contratos de Anelis | Roles/verificación, contextos, RPC y auditoría | Dos clínicas, paciente común, permiso/revocación y pruebas negativas/carreras |
| 4 — Integración de vistas | Adaptadores del puerto profesional y panel paciente | Listado profesional por destinatario, retorno interno y estados reales | Sin escenario del cliente como autorización, sin duplicar módulos |
| 5 — Investigación IA | 6 tablas de dataset/modelo/evaluación/contenido | Licencias, manifiesto, particiones y revisión real | Experimento reproducible con precisión/recall/F1/matriz observados |
| 6 — Análisis privado | 4 tablas de autorización/job/resultado/asociación | Texto de autorización, worker, leases y reconciliación | Propiedad cruzada, cancelación y borrado de foto probados |
| 7 — Operación | Guía de secretos, errores y pruebas | Backups/RPO/RTO, límites/costo, monitoreo | Restauración sintética y smoke del entorno autorizado |

La historia DI-144 está En curso; DI-151 Listo es una confirmación de trabajo, no evidencia de despliegue en este proyecto. No se modifica ninguno de esos estados.

Coordinación, sin asignar tareas nuevas: Jhan (DI-34/144/40) mantiene contratos de autorización y revisión SQL; Anelis (DI-36/145/39/42/43) acuerda puertos/persistencia profesional e historial; Angie (DI-146/35/41/44) integra panel, permisos visibles y directorio; Stephan (DI-147/37/38) conserva fotos/consentimiento y coordina licencias/datos. Validar esta distribución con los responsables, no trasladarles unilateralmente alcance.

Antes de extender el backend con Anelis: acordar DTO clinical.v1, IDs Auth/patient/professional/membership, errores genéricos, paginación, ausencia de datos y proyección de procedencia. Resolver clínica destino de solicitudes antes de filtrar por sede. La app actual no tiene ese campo.

No llevar clínica ni IA a producción solo por disponer de DDL. Los criterios de QA están en PRUEBAS_Y_LIMITACIONES.md; la revisión de conservación y consentimiento sigue pendiente.
