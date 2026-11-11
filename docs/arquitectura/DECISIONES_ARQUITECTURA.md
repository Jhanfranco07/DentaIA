# Decisiones de arquitectura

Son propuestas para revisión conjunta salvo que se indiquen como continuidad de código observado. No se atribuye aprobación del equipo.

| ID | Decisión y motivo | Alternativa / consecuencia |
|---|---|---|
| ADR-01 | Continuar monolito modular Next.js y Supabase: reduce duplicación y conserva contratos | Microservicios para CRUD añaden despliegue y autenticación sin necesidad medida; reconsiderar por carga/independencia real |
| ADR-02 | Auth es la identidad común; profiles no almacena roles editables | Segundo login o role en user_metadata permitiría divergencia/autoasignación |
| ADR-03 | Conservar app_metadata.dentaia como autoridad administrativa actual | Tabla canónica/outbox requiere migración del guard; no operar ambas como autoridades contradictorias |
| ADR-04 | Migración DI-151 de actualización SQL acotada de Auth requiere revisión antes de aplicar | Auth Admin HTTP + INSERT auditoría no es atómico; outbox es alternativa si no se aprueba escribir tabla gestionada |
| ADR-05 | Paciente estable entre clínicas, profesional vinculado a dentists y membresías separadas | Duplicar paciente por clínica rompe continuidad; duplicar odontólogo del directorio sin vínculo rompe identidad |
| ADR-06 | Compartir solo atenciones seleccionadas por paciente y membresía | Permiso global por clínica o por ID permite acceso excesivo; futuras atenciones no se comparten implícitamente |
| ADR-07 | Permiso clínico, almacenamiento y análisis son autorizaciones distintas | Reutilizar patient_consents actual ignora su finalidad fija y no habilita IA ni entrenamiento |
| ADR-08 | Lectura clínica y auditoría en operación controlada; fallar cerrado | Logs asíncronos sin entrega garantizada no cumplen DI-145; excepción que revierta denegado perdería auditoría |
| ADR-09 | Versiones y procedencia en clínica; examen no tiene validez automática | Sobrescritura borra origen; repetir/no repetir examen es decisión profesional |
| ADR-10 | Separar demo, resultado IA y diagnóstico profesional | Presentar casos fijos o scores como diagnóstico es incorrecto |
| ADR-11 | Bucket clínico privado y proxy por consulta | URL pública prohibida; URL firmada con TTL no permite revocación instantánea |
| ADR-12 | Vision como servicio futuro, tecnología/hosting por decidir tras experimento | No introducir FastAPI/Render/Docker como hechos actuales; escalar Next no ejecuta automáticamente entrenamiento |
| ADR-13 | Conservar Bearer admin actual; SSR privado es cambio posterior explícito | Mezclar cookies/Bearer sin contrato aumenta riesgo CSRF y duplicación de sesión |
| ADR-14 | Investigación y negocio se documentan en archivos/Jira | Tablas runtime para Canvas/feedback no requeridas; si surge necesidad operativa, diseñar retención y acceso aparte |

## Decisiones abiertas

Verificación profesional y responsable que aprueba, membresía clínica y ámbito de gestión, aprobación de la migración Auth privilegiada, escritor único, políticas de conservación, autorización de análisis, origen/licencia de datasets, revisión odontológica de recomendaciones, servicio/recursos de visión, RPO/RTO y monitoreo. No existe acuerdo implícito por incluirlas en este paquete.
## Actualización de auditoría integral

| ID | Decisión revisada | Alternativa descartada / pendiente |
|---|---|---|
| ADR-15 | Modelar 219 columnas y no más tablas: motivos de corrección y lease son datos indispensables del contrato original | Omitirlos mantiene promesas de auditoría/recuperación sin representación |
| ADR-16 | Ficha publicada opcional; Auth y paciente únicos por cuenta | No emparejar cuentas por nombre/email ni exigir publicación demo para ser profesional |
| ADR-17 | Episodios de membresía y exclusión de solapamiento | Sobrescribir origen pierde trazabilidad; btree_gist necesita revisión/instalación QA |
| ADR-18 | IA personal CASCADE desde foto/propietario; investigación RESTRICT separada | RESTRICT genérico rompería borrado actual; reutilizar imágenes para dataset no está autorizado |
| ADR-19 | Acceso clínico por operación auditada y cero GRANT de contenido directo | Un SELECT con RLS que omita auditoría incumple el criterio DI-145 |
| ADR-20 | Backend Next.js existente y adaptadores de DTO; sin segundo backend CRUD | Servicio de visión sigue independiente/futuro solo cuando el experimento lo justifique |

Estas son propuestas técnicas, no acuerdos atribuidos al equipo. Quedan abiertas: vocabulario final, propósito/texto de permiso, contexto de solicitudes por sede, verificador/registro de evidencia profesional, revisión de recomendaciones, baja de Auth con historia, conservación, ejecución SQL real y operación del worker. No declarar cierre productivo de esos puntos.
