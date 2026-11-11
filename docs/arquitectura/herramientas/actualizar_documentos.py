"""Documentación de auditoría; no ejecuta SQL, Git ni APIs remotas."""
import json
from pathlib import Path
from datetime import date

R=Path(__file__).resolve().parents[1]
M=json.loads((R/'MODELO_DATOS.json').read_text(encoding='utf8'))

FINDINGS=[
('H01','Media','Corregido','Ubicación del paquete','La documentación estaba en docs/evidencias/arquitectura, no en la ruta indicada. Se conserva intacta y se crea esta copia auditada.','README.md'),
('H02','Alta','Corregido en diseño','FK reales omitidas del JSON','Los 43 campos existentes tenían fk nulo aunque el catálogo incluye seis FK, una compuesta. Se modelan explícitamente sin inventar relaciones administrativas.','MODELO_DATOS.json'),
('H03','Media','Corregido','Diccionario semántico insuficiente','Las descripciones repetían el nombre del campo. Se explican identidad, contexto, procedencia, disponibilidad, valores nulos y autorización.','DICCIONARIO_DATOS.md'),
('H04','Alta','Corregido','DER general incompleto','El general omitía parte de administración, datasets y evaluación. Ahora representa 29 entidades de negocio y Auth como entidad externa.','diagramas/04-der-general.mmd'),
('H05','Media','Corregido','Cardinalidades divergentes','UNIQUE(job_id) implica como máximo un resultado; UNIQUE(replaces_id) implica cadena sin bifurcación. Se incluyen opcionalidades y FK/PK combinadas.','DIAGRAMAS.md'),
('H06','Alta','Propuesta corregida','Publicación obligatoria del profesional','dentist_id NOT NULL forzaba una ficha pública antes de verificar. Se propone nullable y UNIQUE; no se cambia CHECK is_demo existente ni se crea un segundo perfil con nombre duplicado.','MODELO_LOGICO.md'),
('H07','Alta','Propuesta corregida','Episodios de membresía','UNIQUE(clinic_id,professional_id) impedía terminar y crear otra pertenencia a la misma clínica. Se propone UNIQUE con valid_from y exclusión de solapamiento activo.','borradores_sql/01_clinical_identidad.sql'),
('H08','Crítica de diseño','Borrador preparado','Concesión con atención de otro paciente','Dos FK simples no garantizan el mismo paciente. Un trigger bloquea y compara ambos padres; los RPC siguen pendientes y cerrados.','borradores_sql/04_clinical_integridad.sql'),
('H09','Alta','Propuesta corregida','Correcciones sin motivo ni origen invariante','Se añaden dos correction_reason, FK compuestas de origen, UNIQUE(replaces_id), detección de ciclos y registros append-only.','borradores_sql/02_clinical_contenido.sql'),
('H10','Media','Corregido','Retención genérica falsa','No todas las tablas usan RESTRICT: se documentan CASCADE/NO ACTION reales y la ausencia deliberada de FK en dentaia_admin.','DICCIONARIO_DATOS.md'),
('H11','Alta','Pendiente de trazabilidad','Administración y despliegue','La validación manual declarada se acepta como tal; el catálogo actual no contiene dentaia_admin y solo registra dos migraciones de octubre. No atribuir esa validación a un despliegue aquí no observado.','FUENTES_Y_EVIDENCIAS.md'),
('H12','Alta','Pendiente de integración','Verificación y rol profesional','status=verified no concede Auth odontologo. La concesión está bloqueada en DI-151 y requiere una ampliación revisada del protocolo, no un trigger que otorgue roles.','BRECHAS_Y_PLAN_IMPLEMENTACION.md'),
('H13','Alta','Contrato propuesto','Solicitudes del profesional','La RLS actual solo permite al paciente sus solicitudes. Se propone lectura controlada por professional_accounts.user_id y dentist_id; no se modifica la política actual. No hay clínica destino.','CONTRATOS_API.md'),
('H14','Alta','Borrador preparado','Documentos y rutas privadas','Se valida la ruta contra paciente clínico y atención; la descarga debe reautorizar y auditar por ID. No guardar URL pública/firmada ni aceptar rutas libres.','borradores_sql/04_clinical_integridad.sql'),
('H15','Alta','Contrato propuesto','Idempotencia clínica sin almacenamiento definido','La clave UUID se mapea al id de la concesión y se vincula al paciente derivado; comparar todos los parámetros y recursos. No se reactiva un permiso por reintento.','PROTOCOLO_RPC_Y_CONCURRENCIA.md'),
('H16','Crítica de diseño','Protocolo propuesto','Revocación concurrente ambigua','Se define orden de bloqueos, linealización y revalidación por página/descarga. Una lectura ya autorizada puede acabar; no se promete retirar bytes ya vistos.','PROTOCOLO_RPC_Y_CONCURRENCIA.md'),
('H17','Crítica de diseño','Cerrado por defecto','Bypass de auditoría por SELECT','Los borradores activan RLS y revocan acceso directo incluso a service_role. No se conceden RPC clínicos o de IA hasta implementar y validar el servicio auditado.','POLITICAS_POR_TABLA.md'),
('H18','Alta','Propuesta corregida','IA impediría borrar fotografías existentes','FK RESTRICT hacia foto bloquearía el algoritmo actual. Se propone CASCADE solo del subárbol privado de análisis; datasets no se vinculan a fotos personales.','borradores_sql/06_ia_analisis.sql'),
('H19','Alta','Propuesta corregida','Lease descrito sin columnas','Se añaden lease_id, lease_expires_at y attempt_count. Se validan transiciones; el trabajador y su RPC mínimo siguen futuros.','MODELO_DATOS.json'),
('H20','Alta','Propuesta corregida','Resultado no evaluable exigía clase','label pasa a nullable y un CHECK exige label/score nulos cuando no es evaluable. No se fabrica un diagnóstico.','borradores_sql/06_ia_analisis.sql'),
('H21','Alta','Propuesta corregida','Fuga de sujetos entre splits','Una comprobación de manifiesto no impide una carrera de inserciones. EXCLUDE con btree_gist impide distinto split por dataset/sujeto. No demuestra independencia entre datasets distintos.','borradores_sql/05_ia_investigacion.sql'),
('H22','Alta','Borrador preparado','Matriz de confusión sin estructura','Se especifica matriz cuadrada, conteos enteros no negativos, suma sample_size y etiquetas en config.labels. Los valores científicos no se inventan.','borradores_sql/07_ia_integridad.sql'),
('H23','Alta','Borrador preparado','Modelo evaluated sin evaluación','El borrador exige precision, recall, f1 y matriz en una ejecución test; dataset/artefactos se congelan. Esto no demuestra validez clínica ni entrenamiento existente.','borradores_sql/07_ia_integridad.sql'),
('H24','Media','Corregido en contrato','Errores y recencia del GET de roles','La misma función SQL exige TOTP reciente también para consultar revisión y puede devolver 409. Se añaden esos límites y errores comunes 500/503.','CONTRATOS_API.md'),
('H25','Media','Corregido y renderizado','Sintaxis Mermaid','El motor reprodujo error en la secuencia 10 por punto y coma. Se corrigen separadores en cinco secuencias y se renderizan los 17 diagramas.','DIAGRAMAS.md'),
('H26','Media','Actualizado','Ref de panel paciente desactualizada','La rama remota avanzó a ac545b5d; se revisó su shell cliente. No se presume guard SSR ni integración en main.','FUENTES_Y_EVIDENCIAS.md'),
('H27','Alta','Decisión pendiente','Estados y límites nuevos','Los CHECK y límites textuales propuestos no son acuerdos del equipo. Se requiere aceptación del vocabulario, finalidad y conservación antes de producción.','DECISIONES_ARQUITECTURA.md'),
('H28','Alta','Decisión pendiente','Identidad estable no significa persona deduplicada','UNIQUE(user_id) estabiliza la cuenta, no resuelve una misma persona con dos cuentas ni interoperabilidad externa. No inferir identidad por correo/DNI no aprobados.','MODELO_CONCEPTUAL.md'),
('H29','Alta','Decisión pendiente','Retención y baja de Auth clínica','Las FK RESTRICT clínicas bloquearían borrados de identidad con historia. Hace falta política de conservación/anonimización y soporte, sin inventar plazos legales.','SEGURIDAD_Y_ROLES.md'),
('H30','Alta','No ejecutado','Falta ensayo SQL efectivo','Docker no tiene daemon disponible. El AST y el render no prueban integridad en ejecución, RLS efectiva, RPC ni carreras de PostgreSQL.','PRUEBAS_Y_LIMITACIONES.md'),
('H31','Media','Contrato propuesto','Frontera entre DTO real y sintético','El proveedor de Anelis usa caso/entries/origen y escenario sintético; no debe recibir un JSON real con otros nombres sin adaptador ni aceptar escenario como autorización. Se versiona clinical.v1.','CONTRATOS_API.md'),
]

def write(name,text):
 (R/name).write_text(text.strip()+'\n',encoding='utf8')

write('AUDITORIA_INTEGRAL.md', '# Auditoría integral de arquitectura — 03/11/2026\n\n'
 'Rama local `docs/auditoria-arquitectura-integral`, base c992a142. Sin commits, push, PR, merge, cambios funcionales o escrituras en Supabase/Jira. Se preserva el insumo original y DI-151.\n\n'
 '**Dictamen:** modelo físico definitivo propuesto para revisión y QA sintético, **no aprobado para producción**. Se revisan las 29 tablas y 214 columnas originales; el modelo corregido tiene 29 tablas y 219 columnas. No se agrega ninguna entidad de negocio.\n\n'
 '| ID | Severidad | Estado de la corrección | Hallazgo | Evidencia y decisión |\n|---|---|---|---|---|\n'+
 '\n'.join('| '+id+' | '+severity+' | '+state+' | '+title+' | '+detail+' ['+ref+']('+ref+') |' for id,severity,state,title,detail,ref in FINDINGS)+
 '\n\nUna severidad crítica aquí identifica una garantía ausente del **diseño propuesto**, no una explotación acreditada de la aplicación actual. Ningún hallazgo se resuelve desactivando seguridad. Un borrador preparado no equivale a una migración probada.\n\n'
 '## Resultado por dominio\n\n| Dominio | Tablas | Columnas originales → revisadas | Dictamen |\n|---|---:|---:|---|\n'
 '| Existente public | 5 | 43 → 43 | Reutilizar, sin recrear ni alterar las políticas actuales. |\n'
 '| Administración DI-151 | 3 | 22 → 22 | Conservar SQL y autoría; falta conciliar entorno de validación declarada y rollout observado. |\n'
 '| Clínica | 11 | 75 → 77 | QA sintético condicionado a decisiones de verificación, contexto, permisos y retención. |\n'
 '| IA | 10 | 74 → 77 | Diseño futuro; no hay modelo entrenado, inferencia o validación clínica acreditados. |\n\n'
 '## Cómo revisar cada tabla\n\nEl diccionario enumera todos sus campos, PK, FK, UNIQUE, CHECK, defaults, índices, fase y conservación. MODELO_DATOS.json es la fuente común. Los siete borradores SQL traducen las 21 tablas nuevas y sus invariantes; las tablas existentes se inventarían, no se recrean en migraciones de negocio. La migración administrativa se referencia sin copiarla ni cambiarla.\n\n'
 'Los criterios funcionales se contrastaron con los 171 registros Jira (incluidas descripciones), las referencias Git y catálogo remoto sin filas. La lista de pruebas reales/estáticas y limitaciones está en [PRUEBAS_Y_LIMITACIONES.md](PRUEBAS_Y_LIMITACIONES.md).')

write('CAMBIOS_MODELO.md', '''# Diferencias del modelo revisado

Fuente original conservada: `../evidencias/arquitectura/`. No se sobrescribió ninguna evidencia original.

| Cambio | Antes | Propuesta revisada | Justificación |
|---|---|---|---|
| Tablas | 29 | 29 | No se crean entidades innecesarias. |
| Columnas | 214 | 219 | Cinco campos derivados de reglas ya exigidas en el original. |
| clinical_encounters.correction_reason | Ausente | text NULL | Motivo obligatorio si replaces_id está presente. |
| clinical_entries.correction_reason | Ausente | text NULL | Misma justificación para correcciones de entradas. |
| analysis_jobs.lease_id | Ausente | uuid NULL | Identificar la reserva privada vigente del trabajador. |
| analysis_jobs.lease_expires_at | Ausente | timestamptz NULL | Recuperar un trabajo abandonado sin aceptar un resultado de una reserva vencida. |
| analysis_jobs.attempt_count | Ausente | integer NOT NULL DEFAULT 0 | Contabilizar adquisiciones/reintentos sin inventar ejecución. |
| professional_accounts.dentist_id | NOT NULL | NULL permitido + UNIQUE | La publicación del directorio no debe ser requisito para verificar identidad profesional. |
| analysis_results.label | NOT NULL | NULL permitido según calidad | Un resultado no evaluable no tiene clase ni score inventados. |
| Membresía | UNIQUE(clínica,profesional) | UNIQUE(clínica,profesional,inicio) + exclusión | Representar episodios sucesivos sin sobrescribir procedencia. |
| Reemplazos | FK simple | FK compuesta de origen + UNIQUE + anti-ciclo | No cambiar de paciente/contexto ni crear versiones bifurcadas. |
| FKs existentes | Solo texto, fk=null | Seis relaciones estructuradas, incluida la compuesta | Mantener concordancia con catálogo y DER. |
| Datos personales IA | RESTRICT genérico | CASCADE de autorización/job/resultado desde foto/propietario | Evitar una regresión del borrado personal existente. |
| Clave candidata de dental_photos | No existe | UNIQUE(id,user_id) solo en fase IA | Permite FK compuesta foto-propietario; no se atribuye al catálogo actual. |
| Métricas y dataset | Reglas en prosa | CHECK, exclusión y triggers preparados | Concurrencia/estructura comprobables cuando exista QA SQL. |

El JSON mantiene campos de descripción originales como antecedente, pero `primary_key`, `unique`, `candidate_keys_proposed`, `foreign_keys`, `checks`, `indexes_sql` y `phase` son las definiciones revisadas. Una clave candidata propuesta no es una restricción existente. Cada FK indica acción ON DELETE y tipos compatibles.

Los estados, límites de texto, nombres de bucket clínico y tipos de documento propuestos necesitan acuerdo del equipo. No se sustituyen los CHECK is_demo ni el consentimiento académico actuales.
''')

write('MODELO_LOGICO.md', '''# Modelo lógico revisado

29 tablas, 219 columnas. Fuente verificable: [MODELO_DATOS.json](MODELO_DATOS.json); detalles de cada campo y restricción en [DICCIONARIO_DATOS.md](DICCIONARIO_DATOS.md).

## Normalización y claves

Auth permanece como única identidad. profiles conserva el nombre personal; dentists representa la publicación del directorio. professional_accounts vincula una cuenta única con cero o una ficha pública única; no duplica nombre/especialidad ni usa el correo para emparejar personas. Las membresías resuelven N:M entre profesional y clínica con episodios no solapados. patient_records es único por cuenta dentro de DentaIA, no un índice de personas externas.

Las relaciones de concesión-atención y resultado-recomendación son tablas puente con PK compuesta. Los JSON administrativos son snapshots mínimos para auditoría/idempotencia, no una segunda autoridad de roles. config y matrix son artefactos científicos con forma explícita, no registros clínicos encubiertos.

## Integridad referencial

Las FK existentes mantienen CASCADE o NO ACTION según catálogo. Las tres tablas administrativas mantienen deliberadamente identificadores lógicos sin FK. En clínica las FK son RESTRICT y el contenido histórico no admite UPDATE/DELETE ordinarios. Revisar la baja/anominización de Auth antes de usar pacientes reales.

Los reemplazos de atenciones conservan patient_id y membership_id mediante FK compuesta; los de entradas conservan encounter_id y kind. UNIQUE(replaces_id) impide bifurcación y triggers diferidos detectan ciclos, incluso en inserciones múltiples. Las dos razones de corrección justifican cambios sin sobrescritura.

Una concesión solo incluye atenciones del mismo paciente, comprobado con bloqueo y trigger. No modifica propiedad ni permite editar clínica. Los recursos se crean atómicamente con su concesión y no se amplían por UPDATE desde cliente. Una nueva corrección de atención no se comparte automáticamente por estar relacionada con otra: el alcance es el conjunto seleccionado.

Autorizaciones de análisis enlazan foto y propietario mediante FK compuesta; jobs enlazan la misma autorización, foto y propietario. La clave candidata propuesta (id,user_id) de dental_photos solo se añade al llegar a IA. CASCADE del subárbol privado de análisis permite conservar el borrado de fotografías. Datasets nunca tienen FK a Auth o fotografías personales.

## Estados, índices y datos opcionales

CHECK define estados cerrados, fechas coherentes y combinaciones de datos. Un campo desconocido permanece NULL; en entradas information_state distingue recorded, unknown y not_recorded. Un documento unavailable no fabrica objeto, MIME ni tamaño. Un resultado not_evaluable tiene label/score NULL. El score no es una probabilidad clínica validada.

PK/UNIQUE/exclusión generan índices; no duplicarlos. Los índices adicionales siguen FK y filtros reales (paciente-fecha-id, contexto-vigencia, estado de cola). Medir EXPLAIN en QA antes de añadir más; no se afirma rendimiento. btree_gist es una dependencia propuesta, disponible pero no instalada en el catálogo observado.

## Ampliación incremental y límites

No cambiar roles en profiles, no reconstruir Auth ni crear un segundo backend. Directorio y solicitudes conservan is_demo=true y requested/cancelled. appointment_requests no contiene clínica destino; una consulta profesional puede comprobar el destinatario dentist_id vinculado, pero no inventar clínica o permiso clínico.

Los nombres de entidades clínicas y estados son propuestas para revisión, no acuerdos atribuidos al equipo. La edición asistencial completa, las importaciones reales, la interoperabilidad externa y el entrenamiento no forman parte del MVP sintético de DI-145.
'''.replace('anominización','anonimización'))

write('MODELO_FISICO.md', '''# Modelo físico definitivo propuesto

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

Conservación clínica, anonimización, backups, RPO/RTO, región, costos, escáner de archivos y operación de IA continúan por acordar. No se fijan plazos legales ni se infieren garantías productivas. Las pruebas SQL locales están NO EJECUTADAS por falta de daemon Docker; no se sustituye esa ejecución por AST o fixtures Node.
''')

write('MODELO_CONCEPTUAL.md', '''# Modelo conceptual revisado

La cuenta Auth es la identidad común dentro de DentaIA. Puede tener perfil personal, una ficha de paciente y una cuenta profesional verificable, sin nuevas credenciales. Paciente estable significa estable por cuenta; la deduplicación de personas con varias cuentas y la interoperabilidad externa no están resueltas ni se inventan por email.

El profesional autenticado se vincula opcional y unívocamente a una ficha publicada dentists. Su verificación es una resolución independiente, no una concesión automática de rol. Las pertenencias a clínicas son episodios N:M con vigencia; una misma identidad puede ejercer en varias, sin reasignar una membresía a otra persona. El directorio público académico conserva su carácter de demostración.

Un paciente tiene atenciones de distintas clínicas dentro de DentaIA. Cada atención referencia la membresía de origen y separa fecha asistencial de fecha de registro. Antecedentes, diagnósticos y tratamientos son entradas profesionales, no salidas de IA. Documentos/exámenes conservan fecha y disponibilidad; su vigencia clínica la determina el profesional, no un booleano calculado por el sistema.

Las correcciones son versiones con motivo y origen estable. Conceder acceso a una atención seleccionada no comparte automáticamente futuras atenciones o correcciones. El paciente autoriza lectura a una membresía concreta con propósito y vencimiento. La tabla puente define los recursos; una concesión vacía no permite contenido. Revocación, expiración y suspensión del destinatario se comprueban en cada página o descarga. La clínica de origen puede ser distinta de la clínica del lector autorizado.

La auditoría registra accesos permitidos/denegados antes de entregar. No guarda el texto clínico; identificadores no comprobados de solicitudes rechazadas se registran como NULL, no como FK inventadas. Administrar roles no concede permiso clínico.

Una solicitud académica no es una cita confirmada ni una atención. La fotografía personal tiene consentimiento de almacenamiento; no equivale a documento clínico ni autorización para inferencia o entrenamiento. Las autorizaciones de análisis son por foto y propietario y tienen finalidad separada.

Dataset, versión de modelo y evaluación son investigación futura. Sus sujetos no se enlazan a Auth; las fotos personales no se reutilizan para entrenar. Un trabajo autorizado produce cero o un resultado orientativo y recomendaciones educativas explicadas. Cuando no puede evaluarse no se inventa clase. No hay entrenamiento ni validación clínica acreditados.

Ver el [DER completo](diagramas/04-der-general.mmd), los cuatro DER por dominio y el [diccionario](DICCIONARIO_DATOS.md). Identificadores administrativos sin FK se presentan como referencias lógicas, no relaciones físicas inventadas.
''')

write('PROTOCOLO_RPC_Y_CONCURRENCIA.md', '''# Contratos de transacción, permisos y concurrencia

Diseño de servicios futuros, no funciones instaladas. No habilitar wrappers clínicos/IA antes de implementar y ensayar estas reglas. Los borradores actuales cierran acceso directo para evitar un despliegue parcialmente abierto.

## Identidad y contexto común

Next.js verifica sesión con el SDK de servidor y usa parámetros cerrados. PostgreSQL vuelve a comprobar cuenta habilitada y rol actual de app_metadata.dentaia, no user_metadata ni claims antiguos de rol. El contexto clínico (membership_id) es una selección que debe pertenecer a professional_accounts.user_id del actor, estar vigente y apuntar a clínica activa. También se exige última verificación aprobada y estado profesional verified. No reutilizar el guard exclusivo de superusuario como si autorizara odontólogos.

Para paciente se deriva patient_records por auth.users.id confirmado. Las funciones privadas no aceptan actor/paciente de terceros como autoridad. Si se usa JWT propio hacia Data API, auth.uid()/auth.jwt() proceden de verificación de PostgREST; si un futuro BFF usa una identidad de servicio, debe diseñar un contexto firmado/acotado y su verificación, no pasar libremente actorId desde JSON. No activar ambas vías sin contrato.

## Lectura de historial

1. Validar UUID, limit 1..50 propuesto y cursor firmado ligado a actor/paciente/membresía/filtros. El cursor no concede permisos.
2. Transacción corta: bloquear identidad vigente; paciente; cuenta profesional/clínica/membresía del lector; concesiones candidatas ordenadas por UUID. Compartir bloqueos con otros lectores y hacerlos incompatibles con revocar/suspender/reasignar.
3. Revalidar después de esperar los locks. El paciente propietario no necesita un permiso autoemitido; el profesional necesita rol, verificación, membresía y al menos un recurso seleccionado de concesión vigente.
4. La autorización depende del contexto receptor, no de que la membresía histórica de origen siga activa. No ocultar datos históricos legítimos porque el profesional de origen se retiró. El origen no se puede reasignar.
5. Seleccionar únicamente atenciones permitidas del paciente. Orden estable `(attended_at DESC,id DESC)`, no OFFSET inestable. Entradas/documentos se filtran por esas atenciones. Retornar las fechas, estados de ausencia y procedencia; no exponer rutas privadas de objetos.
6. Insertar auditoría mínima, preparar la proyección y confirmar la transacción. Next.js no emite/streaming de contenido antes del commit.
7. Denegación: insertar evento con paciente/recursos NULL cuando no estén autorizados y devolver resultado controlado. No lanzar una excepción que revierta el evento que se necesita conservar. Un fallo de auditoría sí falla cerrado y no retorna contenido; se registra error técnico saneado fuera del contenido, si ese canal está disponible.

Orden común propuesto: identidades UUID; paciente; profesional/clínica/membresía; concesiones UUID; recursos. Validar el mismo orden en escrituras. Timeouts/deadlocks se tratan como indisponibilidad/reintento seguro, no como permiso concedido.

## Concesión y revocación

Creación solo por paciente autenticado. Para no inventar otra tabla de idempotencia, el UUID Idempotency-Key de la creación se utiliza como `clinical_access_grants.id`. Bajo bloqueo exclusivo del paciente, una clave ya existente solo devuelve la concesión del mismo paciente y parámetros/recursos exactamente iguales; otro contenido o propietario produce 409 genérico. No se devuelve información de otra cuenta por colisión de claves.

Validar destinatario habilitado, propósito/versión aprobados, fecha de vencimiento y el conjunto no vacío de atenciones del mismo paciente. Bloquear recursos en orden, crear concesión, recursos y auditoría en una transacción. Las políticas/textos válidos deben configurarse por el equipo; una cadena cualquiera del cliente no acredita aprobación del consentimiento. No hay RPC operativo que acepte textos inventados.

Revocar deriva el propietario, bloquea paciente y concesión en modo exclusivo y marca revoked_at una sola vez con el reloj del servidor. Registrar resultado y commit antes de confirmar. No cambiar destinatario, fechas originales o scope ni borrar evidencia. Repetir la revocación devuelve el mismo estado sin reactivar. Una ampliación de recursos o nueva corrección requiere otra concesión explícita.

**Punto de linealización:** si la lectura obtiene el bloqueo válido y se confirma antes que la revocación, puede completar su respuesta. Si la revocación se confirma primero, nuevas lecturas no obtienen contenido. No se promete cortar una respuesta/descarga ya autorizada ni retirar bytes vistos. Cada página y nueva descarga revalida; no hay caché compartida. Una URL firmada funciona hasta expirar, por eso no satisface revocación instantánea.

## Descarga clínica

Resolver documento por ID bajo los mismos permisos; no aceptar bucket/path libres. Verificar pertenencia, disponibilidad, MIME/tamaño y almacenar auditoría antes de abrir el stream. Proxy Next.js con no-store; no persistir ni devolver URL pública. El blob puede faltar aunque haya metadatos: devolver estado explícito sin otro archivo de fallback. La seguridad del objeto requiere política de bucket privada propia; una FK no configura Storage.

## Solicitudes propias del profesional

Nuevo servicio propuesto valida profesional Auth, verificación y ficha dentists vinculada. Solo consulta `appointment_requests.dentist_id = professional_accounts.dentist_id`; no por user_id del paciente ni IDs suministrados para elegir otro profesional. La RLS actual del paciente se conserva. El servicio auditado proyecta datos mínimos de la solicitud; no concede historial. Como no existe clínica destino, no filtra inventando clinic_id. Si el equipo necesita reparto por sede, debe decidir una ampliación explícita antes de ofrecer esa función.

## IA y trabajo reservado

El propietario concede análisis para su foto: se comprueba el triple autorización/foto/usuario mediante FK compuesta y vigencia por servicio. Crear job con Idempotency-Key compara también modelo/autorización/foto; no devuelve un job de otro propietario. Reclamar usa lock de fila y SKIP LOCKED si se adopta cola PostgreSQL, fija lease_id privado, vencimiento y attempt_count. Un nuevo lease solo reemplaza otro vencido; una renovación no incrementa intentos.

El trabajador no recibe acceso administrativo general. Antes de leer bytes y antes de publicar resultado revalida foto, autorización y lease vigente. Completa mediante compare-and-set del lease_id esperado bajo lock, inserta como máximo un resultado y cambia estado a succeeded en una transacción. Los triggers diferidos exigen consistencia resultado/estado. Revocar impide nuevas entregas y cancela trabajos pendientes; no garantiza deshacer computación ya realizada. Un propietario que borra su foto provoca CASCADE del análisis privado, sin bloquear el flujo actual ni afectar datasets.

Los RPC de trabajador, identidad mínima, cancelación, reconciliación y validación de binarios siguen por implementar y probar antes de otorgar EXECUTE. El SQL no simula un servicio ya existente ni produce métricas.
''')

write('PRUEBAS_Y_LIMITACIONES.md', '''# Pruebas y límites de esta auditoría

Fecha: 03/11/2026. No confundir consistencia documental con integración real.

## Ejecutado

- Lectura de las 38 piezas originales, incluido JSON/modelo de 29 tablas y 214 columnas, catálogo, políticas y diagramas; copia preservada para contraste SHA-256.
- Consulta JQL paginada 100+71: 171 incidencias con descripción, estado y responsable; contraste específico de DI-34/36/144/145/146 y criterios relacionados. Sin cambios en Jira.
- Git fetch e inspección de main, administración y ramas profesional/paciente relevantes, con SHAs y rutas. Sin cambiar sus refs locales ni publicar nada.
- SELECT de catálogo Supabase: 43 columnas de negocio, 32 restricciones, 13 índices, 16 políticas, bucket privado; metadatos Auth y privilegios complementarios. Cero filas clínicas/Auth consultadas. Solo dos migraciones de octubre observadas.
- Generación de modelo/diccionario/DER desde una fuente; comprobación de PK, tipos, objetivos de FK y claves candidatas. Las candidatas propuestas se distinguen de las observadas.
- Sintaxis SQL mediante pglast, instalado en herramienta temporal fuera de dependencias del proyecto. Para PL/pgSQL se normalizan esquemas/tipos compuestos a record por limitación del parser; no es compilación sobre catálogo real.
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
''')

# Actualizar automáticamente la representación Markdown a las fuentes Mermaid corregidas.
parts=['# Diagramas revisados y renderizados','', '17 fuentes editables y 17 SVG. DER generado del mismo modelo de 29 tablas/219 columnas; Auth y otras entidades externas referenciadas no se cuentan como nuevas tablas de negocio. Las tres tablas administrativas sin FK se muestran sin relaciones físicas inventadas.','', 'Los SVG permiten zoom. Renderizar no prueba SQL, RLS ni semántica de producción. La auditoría explica los cambios de cardinalidad y el error sintáctico reproducido.','']
for p in sorted((R/'diagramas').glob('*.mmd')):
 parts+=['## '+p.stem,'','[Fuente]('+p.relative_to(R).as_posix()+') · [SVG](renderizados/'+p.stem+'.svg)','', '```mermaid',p.read_text(encoding='utf8').rstrip(),'```','']
write('DIAGRAMAS.md','\n'.join(parts))

finding_json=[dict(id=a,severidad=b,estado=c,hallazgo=d,detalle=e,evidencia=f) for a,b,c,d,e,f in FINDINGS]
(R/'HALLAZGOS.json').write_text(json.dumps(finding_json,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Documentos de auditoría actualizados; hallazgos:',len(FINDINGS))
