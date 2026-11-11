# Modelo lógico revisado

29 tablas, 219 columnas. Fuente verificable: [MODELO_DATOS.json](MODELO_DATOS.json); detalles de cada campo y restricción en [DICCIONARIO_DATOS.md](DICCIONARIO_DATOS.md).

## Normalización y claves

Auth permanece como única identidad. profiles conserva el nombre personal; dentists representa la publicación del directorio. professional_accounts vincula una cuenta única con cero o una ficha pública única; no duplica nombre/especialidad ni usa el correo para emparejar personas. Las membresías resuelven N:M entre profesional y clínica con episodios no solapados. patient_records es único por cuenta dentro de DentaIA, no un índice de personas externas.

Las relaciones de concesión-atención y resultado-recomendación son tablas puente con PK compuesta. Los JSON administrativos son snapshots mínimos para auditoría/idempotencia, no una segunda autoridad de roles. config y matrix son artefactos científicos con forma explícita, no registros clínicos encubiertos.

## Integridad referencial

Las FK existentes mantienen CASCADE o NO ACTION según catálogo. Las tres tablas administrativas mantienen deliberadamente identificadores lógicos sin FK. En clínica las FK son RESTRICT y el contenido histórico no admite UPDATE/DELETE ordinarios. Revisar la baja/anonimización de Auth antes de usar pacientes reales.

Los reemplazos de atenciones conservan patient_id y membership_id mediante FK compuesta; los de entradas conservan encounter_id y kind. UNIQUE(replaces_id) impide bifurcación y triggers diferidos detectan ciclos, incluso en inserciones múltiples. Las dos razones de corrección justifican cambios sin sobrescritura.

Una concesión solo incluye atenciones del mismo paciente, comprobado con bloqueo y trigger. No modifica propiedad ni permite editar clínica. Los recursos se crean atómicamente con su concesión y no se amplían por UPDATE desde cliente. Una nueva corrección de atención no se comparte automáticamente por estar relacionada con otra: el alcance es el conjunto seleccionado.

Autorizaciones de análisis enlazan foto y propietario mediante FK compuesta; jobs enlazan la misma autorización, foto y propietario. La clave candidata propuesta (id,user_id) de dental_photos solo se añade al llegar a IA. CASCADE del subárbol privado de análisis permite conservar el borrado de fotografías. Datasets nunca tienen FK a Auth o fotografías personales.

## Estados, índices y datos opcionales

CHECK define estados cerrados, fechas coherentes y combinaciones de datos. Un campo desconocido permanece NULL; en entradas information_state distingue recorded, unknown y not_recorded. Un documento unavailable no fabrica objeto, MIME ni tamaño. Un resultado not_evaluable tiene label/score NULL. El score no es una probabilidad clínica validada.

PK/UNIQUE/exclusión generan índices; no duplicarlos. Los índices adicionales siguen FK y filtros reales (paciente-fecha-id, contexto-vigencia, estado de cola). Medir EXPLAIN en QA antes de añadir más; no se afirma rendimiento. btree_gist es una dependencia propuesta, disponible pero no instalada en el catálogo observado.

## Ampliación incremental y límites

No cambiar roles en profiles, no reconstruir Auth ni crear un segundo backend. Directorio y solicitudes conservan is_demo=true y requested/cancelled. appointment_requests no contiene clínica destino; una consulta profesional puede comprobar el destinatario dentist_id vinculado, pero no inventar clínica o permiso clínico.

Los nombres de entidades clínicas y estados son propuestas para revisión, no acuerdos atribuidos al equipo. La edición asistencial completa, las importaciones reales, la interoperabilidad externa y el entrenamiento no forman parte del MVP sintético de DI-145.
