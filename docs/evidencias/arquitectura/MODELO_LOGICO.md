# Modelo lógico

## Normalización y decisiones

El diseño usa 3FN como objetivo: profiles conserva datos personales; dentists conserva publicación del directorio; professional_accounts enlaza identidades sin duplicar nombre/especialidad. clinic_memberships resuelve N:M clínica–profesional. clinical_grant_resources resuelve N:M concesión–atención; result_recommendations resuelve N:M resultado–recomendación. No se almacenan listas de FK en JSON.

clinical_entries utiliza un discriminador de tres tipos para campos comunes; si un tratamiento requiere sesiones, dosificación o evolución fuera del MVP, se especializará en tablas hijas mediante una decisión posterior. El contenido libre es texto clínico protegido; códigos y sistemas de codificación son opcionales y no se inventa un estándar aprobado.

Los JSON de aprobación/auditoría son snapshots históricos mínimos y no sustituyen tablas de relaciones. config y confusion_matrix conservan configuración y artefactos científicos, no una base clínica sin normalizar. Las claves del modelo propuesto y su diccionario se generan de un único [modelo estructurado](MODELO_DATOS.json).

## Integridad entre dominios

Auth–profiles es 1:0..1. Auth–patient_records y Auth–professional_accounts son 1:0..1 con UNIQUE explícito. professional_accounts–dentists es 0..1:1 por vinculación única. patient_records–encounters es 1:N. Cada encuentro referencia una membresía que conserva su clínica y profesional. No mover una membresía a otra clínica: terminarla y crear otra.

Las FK simples propuestas son RESTRICT por defecto. Las relaciones de mismo paciente entre concesión y atención y mismo propietario entre foto y análisis requieren función/constraint trigger, pues un CHECK no consulta otra tabla. La eliminación del usuario no se habilitará sobre historia clínica sin una política de conservación aprobada; el CASCADE actual de tablas académicas no se extiende automáticamente al dominio clínico.

El diseño de tablas, PK, FK, UNIQUE, estados, defaults e índices está en [diccionario](DICCIONARIO_DATOS.md). Las restricciones exactas existentes, incluidas FK compuestas y acciones ON DELETE, también se incluyen allí. Las tablas dentaia_admin conservan la ausencia deliberada de FK a Auth en la migración de rama: una referencia lógica auditada no debe convertirse silenciosamente en FK.

## Ampliaciones a tablas existentes

- profiles: ninguna columna de rol; conservar escritura del nombre propio.
- dentists: mantener is_demo=true mientras no se apruebe publicación real. Para profesionales reales se debe revisar ese CHECK y separar verificación de publicación; no ejecutar esta ampliación ahora.
- appointment_requests: conservar requested/cancelled y su carácter académico. Agenda/disponibilidad/reserva real no están definidas por los requisitos actuales.
- patient_consents: conservar finalidad academic_photo_storage; no ampliar el valor para compartir clínica o entrenar IA por conveniencia.
- dental_photos: conservar FK compuesta de propietario/consentimiento y límite 8 MiB. La asociación con un encuentro se hará por un servicio futuro autorizado si se incorpora al alcance; no presumir que toda foto personal es documento clínico.

## Bloqueo de análisis real

analysis_authorizations modela una autorización específica, versionada, por propietario y foto; analysis_jobs la referencia mediante FK. Antes de activar IA debe aprobarse el texto/finalidad y probar vigencia, revocación y pertenencia; no basta la existencia de la fila ni el consentimiento de almacenamiento. El diseño de inferencia real permanece condicionado a esa revisión. Datasets licenciados y sintéticos pueden evaluarse sin reutilizar fotografías personales.
