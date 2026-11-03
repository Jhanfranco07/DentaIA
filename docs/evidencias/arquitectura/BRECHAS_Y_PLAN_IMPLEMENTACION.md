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
