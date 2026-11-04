"""Genera exclusivamente documentación/borradores locales; nunca abre una conexión.
Fuente inmutable: docs/evidencias/arquitectura. Ejecutar desde cualquier directorio.
"""
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'evidencias' / 'arquitectura'
MODEL = copy.deepcopy(json.loads((SOURCE / 'MODELO_DATOS.json').read_text(encoding='utf8')))
TABLES = {t['name']: t for t in MODEL}
CATALOG = json.loads((ROOT/'INVENTARIO_SUPABASE_VERIFICADO.json').read_text(encoding='utf8'))

def field(table, name):
    return next(f for f in TABLES[table]['fields'] if f['name'] == name)

def add(table, name, datatype, nullable, default, description):
    TABLES[table]['fields'].append(dict(name=name,type=datatype,nullable=nullable,default=default,key='',fk=None,description=description))

# Cinco campos justificados por reglas que el original prometía sin representarlos.
for t in ['clinical.clinical_encounters','clinical.clinical_entries']:
    add(t,'correction_reason','text',True,None,'Justificación obligatoria de una corrección; sin contenido en un registro inicial.')
add('ml.analysis_jobs','lease_id','uuid',True,None,'Identificador privado de la reserva vigente del trabajador, no expuesto al paciente.')
add('ml.analysis_jobs','lease_expires_at','timestamptz',True,None,'Vencimiento de la reserva; se revalida antes de completar el trabajo.')
add('ml.analysis_jobs','attempt_count','integer',False,'0','Número de reservas intentadas; límite de reintentos por acordar en el trabajador.')
field('clinical.professional_accounts','dentist_id')['nullable'] = True
field('ml.analysis_results','label')['nullable'] = True

UNIQUE = {
'public.dentists':[['slug']], 'public.patient_consents':[['user_id','id']], 'public.dental_photos':[['object_path']],
'clinical.professional_accounts':[['user_id'],['dentist_id']],
'clinical.clinic_memberships':[['clinic_id','professional_id','valid_from']],
'clinical.patient_records':[['user_id']],
'clinical.clinical_encounters':[['id','patient_id','membership_id'],['replaces_id']],
'clinical.clinical_entries':[['id','encounter_id','kind'],['replaces_id']],
'clinical.clinical_documents':[['bucket_id','object_path']],
'ml.dataset_versions':[['name','version']], 'ml.dataset_items':[['dataset_id','image_sha256']],
'ml.model_versions':[['name','version']], 'ml.analysis_authorizations':[['id','photo_id','owner_user_id']],
'ml.analysis_jobs':[['owner_user_id','idempotency_key']], 'ml.analysis_results':[['job_id']],
'ml.educational_recommendations':[['code','version']],
}
CHECKS = {
'dentaia_admin.revisiones_roles':['revision >= 0'],
'dentaia_admin.aprobaciones_roles':["operacion IN ('asignar','revocar')", "rol IN ('paciente','odontologo','superusuario')",'revision_esperada >= 0','aprobado_por <> actor_id AND aprobado_por <> objetivo_id AND actor_id <> objetivo_id','vence_en > creada_en'],
'clinical.clinics':["length(btrim(name)) BETWEEN 1 AND 200", "status IN ('active','inactive')", 'location IS NULL OR length(location) <= 300'],
'clinical.professional_accounts':["status IN ('pending','verified','suspended')"],
'clinical.professional_verifications':["decision IN ('approved','rejected')", 'length(btrim(reference)) BETWEEN 1 AND 300','length(btrim(reason)) BETWEEN 1 AND 1000'],
'clinical.clinic_memberships':["status IN ('active','inactive','suspended')",'valid_until IS NULL OR valid_until > valid_from'],
'clinical.patient_records':["status IN ('active','archived')"],
'clinical.clinical_encounters':["status IN ('recorded','voided')",'replaces_id IS NULL OR replaces_id <> id',"(replaces_id IS NULL AND correction_reason IS NULL) OR (replaces_id IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 1 AND 1000 AND correction_reason IS NOT NULL)","status <> 'voided' OR replaces_id IS NOT NULL"],
'clinical.clinical_entries':["kind IN ('background','diagnosis','treatment')", "information_state IN ('recorded','unknown','not_recorded')", "(information_state = 'recorded' AND description IS NOT NULL AND length(btrim(description)) BETWEEN 1 AND 10000) OR (information_state <> 'recorded' AND description IS NULL AND code IS NULL AND code_system IS NULL)", '(code IS NULL) = (code_system IS NULL)', 'replaces_id IS NULL OR replaces_id <> id',"(replaces_id IS NULL AND correction_reason IS NULL) OR (replaces_id IS NOT NULL AND correction_reason IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 1 AND 1000)"],
'clinical.clinical_documents':["kind IN ('exam','document')",'length(btrim(title)) BETWEEN 1 AND 200',"availability IN ('available','unavailable')", "(availability = 'available' AND bucket_id = 'dentaia-clinical-documents' AND object_path IS NOT NULL AND mime_type IN ('application/pdf','image/jpeg','image/png','image/webp') AND size_bytes BETWEEN 1 AND 8388608 AND bucket_id IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL) OR (availability = 'unavailable' AND bucket_id IS NULL AND object_path IS NULL AND mime_type IS NULL AND size_bytes IS NULL)","object_path IS NULL OR (length(object_path) BETWEEN 1 AND 512 AND object_path !~ '(^|/)\\.\\.?(/|$)')"],
'clinical.clinical_access_grants':['expires_at > granted_at','revoked_at IS NULL OR revoked_at >= granted_at',"scope_mode = 'selected_encounters'",'length(btrim(purpose)) BETWEEN 1 AND 100','length(btrim(policy_version)) BETWEEN 1 AND 80'],
'clinical.clinical_access_audit':["outcome IN ('allowed','denied','error')", "operation IN ('read_history','read_document','grant_access','revoke_access','read_professional_requests','list_authorized_patients','verify_professional','membership_change','register_clinical')", "reason_code ~ '^[A-Z][A-Z0-9_]{0,79}$'"],
'ml.dataset_versions':['length(btrim(name)) BETWEEN 1 AND 120','length(btrim(version)) BETWEEN 1 AND 80',"manifest_sha256 ~ '^[0-9a-f]{64}$'",'length(btrim(source_uri)) > 0','length(btrim(license)) > 0','length(btrim(permission_reference)) > 0'],
'ml.dataset_items':["split IN ('train','validation','test')", "image_sha256 ~ '^[0-9a-f]{64}$'",'length(btrim(subject_key)) BETWEEN 1 AND 128','length(btrim(label)) BETWEEN 1 AND 120','length(btrim(object_reference)) > 0'],
'ml.model_versions':["status IN ('draft','evaluated','retired')", "artifact_sha256 ~ '^[0-9a-f]{64}$'", "code_commit ~ '^[0-9a-f]{40}([0-9a-f]{24})?$'",'length(btrim(name)) > 0','length(btrim(version)) > 0','length(btrim(preprocessing_version)) > 0','length(btrim(artifact_uri)) > 0'],
'ml.analysis_authorizations':["purpose = 'exploratory_image_analysis'",'expires_at > granted_at','revoked_at IS NULL OR revoked_at >= granted_at','length(btrim(policy_version)) BETWEEN 1 AND 80','length(btrim(consent_text)) BETWEEN 20 AND 5000'],
'ml.analysis_jobs':["status IN ('queued','running','succeeded','failed','cancelled')",'attempt_count >= 0',"(status = 'running' AND lease_id IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'running' AND lease_id IS NULL AND lease_expires_at IS NULL)","(status IN ('succeeded','failed','cancelled')) = (finished_at IS NOT NULL)",'finished_at IS NULL OR finished_at >= created_at',"status <> 'failed' OR error_code IS NOT NULL", "error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{0,79}$'"],
'ml.analysis_results':["quality_status IN ('evaluable','not_evaluable')",'score IS NULL OR score BETWEEN 0 AND 1',"(quality_status = 'not_evaluable' AND label IS NULL AND score IS NULL) OR (quality_status = 'evaluable' AND label IS NOT NULL AND length(btrim(label)) > 0)",'length(btrim(limitations)) > 0','length(btrim(disclaimer_version)) > 0'],
'ml.educational_recommendations':["review_status IN ('draft','reviewed','retired')",'length(btrim(code)) > 0','length(btrim(version)) > 0','length(btrim(text)) > 0','length(btrim(source_reference)) > 0'],
'ml.result_recommendations':['length(btrim(reason)) > 0'],
'ml.evaluation_runs':["split IN ('train','validation','test')",'sample_size > 0',"jsonb_typeof(config) = 'object'",'length(btrim(artifact_reference)) > 0'],
'ml.evaluation_metrics':["name IN ('accuracy','precision','recall','f1','auc','confusion_matrix')", "(name = 'confusion_matrix' AND value IS NULL AND matrix IS NOT NULL) OR (name <> 'confusion_matrix' AND value IS NOT NULL AND value BETWEEN 0 AND 1 AND matrix IS NULL)",'length(btrim(label)) > 0'],
}
INDEXES = {
'clinical.clinics':['(status, name)'],
'clinical.professional_verifications':['(professional_id, reviewed_at DESC, id)','(reviewed_by)'],
'clinical.clinic_memberships':['(professional_id, status)'],
'clinical.clinical_encounters':['(patient_id, attended_at DESC, id DESC)','(membership_id)'],
'clinical.clinical_entries':['(encounter_id, kind, recorded_at DESC)'],
'clinical.clinical_documents':['(encounter_id, exam_date DESC)'],
'clinical.clinical_access_grants':['(patient_id, membership_id, expires_at) WHERE revoked_at IS NULL','(membership_id)'],
'clinical.clinical_grant_resources':['(encounter_id)'],
'clinical.clinical_access_audit':['(patient_id, occurred_at DESC)','(actor_user_id, occurred_at DESC)','(request_id)','(membership_id)','(grant_id)'],
'ml.dataset_items':['(dataset_id, subject_key, split)'],
'ml.model_versions':['(dataset_id)'],
'ml.analysis_authorizations':['(owner_user_id, photo_id, expires_at)','(photo_id) WHERE revoked_at IS NULL','(photo_id, owner_user_id)'],
'ml.analysis_jobs':['(status, created_at)','(photo_id)','(model_id)','(authorization_id, photo_id, owner_user_id)'],
'ml.result_recommendations':['(recommendation_id)'],
'ml.evaluation_runs':['(model_id, executed_at DESC)','(dataset_id)'],
}

def fk(cols, target, refs=None, delete='RESTRICT'):
    return dict(columns=cols,target=target,references=refs or ['id'],on_delete=delete)

for t in MODEL:
    t['primary_key'] = [f['name'] for f in t['fields'] if 'PK' in f['key']]
    t['unique'] = UNIQUE.get(t['name'],[])
    t['checks'] = CHECKS.get(t['name'],[])
    if t['domain']=='existente':
        t['checks']=[c['definition'][7:-1] for c in CATALOG['constraints'] if c['schema_name']+'.'+c['table_name']==t['name'] and c['contype']=='c']
    t['foreign_keys'] = []
    t['indexes_sql'] = INDEXES.get(t['name'],[])
    for f in t['fields']:
        f['type'] = {'bool':'boolean','int8':'bigint'}.get(f['type'],f['type'])
        if f['fk']:
            target, col = f['fk'].rsplit('.',1)
            delete = 'CASCADE' if t['domain']=='ia' and target in ['auth.users','public.dental_photos','ml.analysis_authorizations','ml.analysis_jobs','ml.analysis_results'] else 'RESTRICT'
            t['foreign_keys'].append(fk([f['name']],target,[col],delete))
    t['phase'] = 'existente' if t['domain']=='existente' else 'administrativa_pendiente' if t['domain']=='administracion' else 'mvp_sintetico_condicionado' if t['domain']=='clinico' else 'futuro_ia'
    if t['domain']=='clinico':
        t['retention']='RESTRICT en todas las FK; sin DELETE ordinario. Conservación/anonimización y baja Auth requieren acuerdo previo. Lecturas de contenido solo mediante operación auditada.'
    if t['domain']=='ia':
        t['retention']='Dataset/modelo/evaluaciones: RESTRICT y versiones conservadas. Autorización/job/resultado personal: CASCADE desde foto/propietario para no impedir su borrado existente; no se reutilizan fotos personales en datasets. No implica borrar bytes ya procesados por un trabajador.'
    if t['domain']=='administracion':
        t['retention']='Sin FK a Auth por decisión de DI-151: la baja de una cuenta no borra la evidencia. Sin UPDATE/DELETE ordinarios de auditoría; revisión y aprobación solo por el protocolo existente. No se inventa una FK RESTRICT.'

TABLES['public.profiles']['foreign_keys']=[fk(['id'],'auth.users',delete='CASCADE')]
TABLES['public.appointment_requests']['foreign_keys']=[fk(['user_id'],'auth.users',delete='CASCADE'),fk(['dentist_id'],'public.dentists',['id'],'NO ACTION')]
TABLES['public.patient_consents']['foreign_keys']=[fk(['user_id'],'auth.users',delete='CASCADE')]
TABLES['public.dental_photos']['foreign_keys']=[fk(['user_id'],'auth.users',delete='CASCADE'),fk(['user_id','consent_id'],'public.patient_consents',['user_id','id'],'NO ACTION')]
for name,text in {
'public.profiles':'Auth ON DELETE CASCADE. Solo perfil básico propio; no conserva datos clínicos ni roles.',
'public.dentists':'Sin FK a Auth. Las solicitudes referencian la ficha con NO ACTION; desactivar evita borrar procedencia. CHECK is_demo sigue vigente.',
'public.appointment_requests':'Auth ON DELETE CASCADE; dentist_id ON DELETE NO ACTION. Solicitud académica, no atención clínica.',
'public.patient_consents':'Auth ON DELETE CASCADE; una foto impide borrar su consentimiento por FK NO ACTION mientras exista. Revocar no equivale a borrar.',
'public.dental_photos':'Auth ON DELETE CASCADE; consentimiento compuesto ON DELETE NO ACTION. Borrar metadatos no borra Storage; conservar el algoritmo reintentable actual.'}.items():TABLES[name]['retention']=text
for t in MODEL:
    if t['domain']=='existente':
        for relation in t['foreign_keys']:
            for c, rc in zip(relation['columns'],relation['references']):
                field(t['name'],c)['fk']=relation['target']+'.'+rc

# Sustituir FK simples por enlaces compuestos que conservan propietario/procedencia.
for table, cols, target, refs in [
 ('clinical.clinical_encounters',['replaces_id','patient_id','membership_id'],'clinical.clinical_encounters',['id','patient_id','membership_id']),
 ('clinical.clinical_entries',['replaces_id','encounter_id','kind'],'clinical.clinical_entries',['id','encounter_id','kind'])]:
    rel=TABLES[table]['foreign_keys'];rel[:]=[r for r in rel if r['columns']!=['replaces_id']];rel.append(fk(cols,target,refs))
TABLES['ml.analysis_authorizations']['foreign_keys']=[fk(['owner_user_id'],'auth.users',delete='CASCADE'),fk(['photo_id','owner_user_id'],'public.dental_photos',['id','user_id'],'CASCADE')]
TABLES['ml.analysis_jobs']['foreign_keys']=[fk(['owner_user_id'],'auth.users',delete='CASCADE'),fk(['photo_id'],'public.dental_photos',delete='CASCADE'),fk(['model_id'],'ml.model_versions'),fk(['authorization_id','photo_id','owner_user_id'],'ml.analysis_authorizations',['id','photo_id','owner_user_id'],'CASCADE')]

DESCRIPTIONS={
'id':'UUID estable de la entidad; no sustituye la comprobación de acceso.',
'user_id':'Identidad común de Supabase Auth; nunca un correo ni un identificador de clínica.',
'owner_user_id':'Identidad Auth del propietario; coincide con la fotografía/autorización mediante FK compuesta.',
'patient_id':'Identificador clínico único del paciente, distinto de auth.users.id.',
'professional_id':'Perfil profesional vinculado de forma única a Auth; no es un rol por sí mismo.',
'dentist_id':'Referencia a la ficha pública única; puede estar ausente antes de publicar al profesional.',
'clinic_id':'Clínica a la que pertenece esta membresía, no la clínica activa enviada libremente por la UI.',
'membership_id':'Contexto de profesional y clínica; su identidad no se reasigna a otra persona o sede.',
'encounter_id':'Atención de origen de esta información; no equivale a una solicitud de demostración.',
'grant_id':'Concesión concreta de lectura del paciente; alcance y vigencia se revalidan en cada acceso.',
'created_at':'Instante de creación persistido en UTC; no implica fecha de atención.',
'recorded_at':'Fecha de incorporación del registro al sistema, separada de la fecha asistencial.',
'attended_at':'Instante de la atención de origen; no se reemplaza por el instante de carga.',
'replaces_id':'Versión anterior del mismo origen; UNIQUE impide bifurcaciones y la relación compuesta impide cambiar de paciente.',
'granted_at':'Momento de concesión por el propietario autenticado, no proporcionado por un tercero.',
'expires_at':'Límite de vigencia; se comprueba con el reloj del servidor.',
'revoked_at':'Revocación irreversible para este registro; NULL solo significa no revocado, no vigencia garantizada.',
'valid_from':'Inicio del episodio de membresía; las pertenencias futuras no autorizan acceso actual.',
'valid_until':'Fin exclusivo del episodio; NULL representa un intervalo abierto.',
'object_path':'Clave de objeto privado, nunca URL pública ni URL firmada persistida.',
'bucket_id':'Identificador del bucket privado; no es una autorización de lectura.',
'size_bytes':'Tamaño entero positivo; se valida también contra el archivo real.',
'mime_type':'Tipo permitido verificado por contenido además de extensión/metadata.',
'status':'Estado cerrado definido por CHECK; las transiciones además requieren servicio autorizado.',
'information_state':'Distingue dato registrado, desconocido y no registrado; no inventa contenido.',
'description':'Contenido correspondiente a la entidad; los textos clínicos solo se entregan tras auditar.',
'score':'Puntuación exploratoria opcional entre cero y uno, no probabilidad clínica validada.',
'label':'Clase o etiqueta en el contexto de esta tabla; un resultado no evaluable no tiene hallazgo.',
'matrix':'Matriz cuadrada de conteos enteros no negativos; validación vinculada a sample_size.',
'value':'Métrica escalar; NULL solo para matriz de confusión.',
'revision':'Versión monotónica de asignación; no se reutiliza como rol canónico.',
'revision_esperada':'Versión aprobada/esperada para detectar conflictos; no un permiso del cliente.',
'asignacion_esperada':'Snapshot mínimo del namespace DentaIA para comparación; no credenciales ni metadata completa.',
'peticion':'Entrada mínima de la transición auditada, sin secretos ni contenido clínico.',
'anterior':'Snapshot mínimo previo del rol, no del usuario Auth completo.',
'posterior':'Snapshot mínimo confirmado después de la transición.',
'resultado':'Resultado estable del intento; una respuesta HTTP perdida no prueba rollback.',
'actor_id':'Identidad del actor validado; el cliente no la elige como autoridad.',
'aprobado_por':'Aprobador independiente de actor y objetivo; no habilita autoaprobación.',
'aprobacion_id':'Aprobación exacta y de un solo uso de la transición.',
'consumida_por':'Solicitud que consumió la aprobación; NULL antes de su uso.',
'request_id':'Correlación generada por el servidor; no contiene identificadores clínicos libres.',
'reason_code':'Código saneado de decisión/error, sin textos de salud ni secretos.',
'outcome':'Resultado allowed/denied/error; la auditoría debe persistir antes de entregar contenido.',
'subject_key':'Pseudónimo exclusivo del dataset; no referencia a una persona Auth ni permiso clínico.',
'split':'Partición del experimento; un mismo sujeto no cruza splits en la misma versión.',
'artifact_uri':'Referencia privada al artefacto, sin credenciales embebidas ni URL firmada persistida.',
'dataset_id':'Versión reproducible del dataset; no fotografías personales reutilizadas automáticamente.',
'model_id':'Versión del modelo exploratorio; la evaluación no equivale a validación clínica.',
'authorization_id':'Autorización específica para esa foto y propietario, distinta de almacenamiento o clínica.',
'policy_version':'Versión de finalidad/texto aprobada por el equipo antes de habilitar el servicio.',
'purpose':'Finalidad expresa de esta autorización; no se amplía por conveniencia de otro módulo.',
'quality_status':'Determina si existe salida evaluable; not_evaluable impide inventar clase o score.',
'job_id':'Ejecución concreta; máximo un resultado por trabajo.',
'sample_size':'Cantidad real evaluada, positiva; no una métrica inventada.',
'config':'Parámetros reproducibles del experimento; sin claves, tokens o información clínica.',
}
for t in MODEL:
    for f in t['fields']:
        if f['name'] in DESCRIPTIONS:f['description']=DESCRIPTIONS[f['name']]
        elif f['description']==f['name'].replace('_',' '):f['description']='Dato de '+t['description'].rstrip('.')+': '+f['name'].replace('_',' ')+'.'
    # Corrige la descripción especializada sin inventar FK donde la migración no las tiene.
    for f in t['fields']:
        if f['name']=='dentist_id' and t['domain']=='existente':f['description']='Ficha pública destinataria de la solicitud académica; no identifica clínica de atención.'

def dump(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

def quote(name): return name

def table_sql(t):
    cols=[]
    for f in t['fields']:
        s='  '+f['name']+' '+f['type']
        if not f['nullable']:s+=' NOT NULL'
        if f['default'] is not None:s+=' DEFAULT '+str(f['default'])
        cols.append(s)
    cols+=['  PRIMARY KEY ('+', '.join(t['primary_key'])+')']
    cols+=['  UNIQUE ('+', '.join(u)+')' for u in t['unique']]
    cols+=['  CHECK ('+c+')' for c in t['checks']]
    cols+=['  FOREIGN KEY ('+', '.join(r['columns'])+') REFERENCES '+r['target']+' ('+', '.join(r['references'])+') ON DELETE '+r['on_delete'] for r in t['foreign_keys']]
    if t['name']=='clinical.clinic_memberships':cols+=["  EXCLUDE USING gist (clinic_id WITH =, professional_id WITH =, tstzrange(valid_from, valid_until, '[)') WITH &&) WHERE (status = 'active')"]
    if t['name']=='ml.dataset_items':cols+=["  EXCLUDE USING gist (dataset_id WITH =, subject_key WITH =, split WITH <>)"]
    out='CREATE TABLE '+t['name']+' (\n'+',\n'.join(cols)+'\n);\n'
    out+='ALTER TABLE '+t['name']+' ENABLE ROW LEVEL SECURITY;\n'
    out+='REVOKE ALL ON '+t['name']+' FROM PUBLIC, anon, authenticated, service_role;\n'
    for i,expr in enumerate(t['indexes_sql'],1):out+='CREATE INDEX '+t['name'].split('.')[1]+'_q'+str(i)+' ON '+t['name']+' '+expr+';\n'
    return out

GUARD="""-- BORRADOR DE ARQUITECTURA. No aplicado, no autodesplegar, sin datos reales.
-- Solo una base desechable con nombre dentaia_arch_qa_<sufijo>.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT LIKE 'dentaia_arch_qa_%'
    OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN
    RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED';
  END IF;
END $$;
SET LOCAL search_path = pg_catalog, public, extensions;
"""
PHASES = {
'01_clinical_identidad.sql':['clinical.clinics','clinical.professional_accounts','clinical.professional_verifications','clinical.clinic_memberships','clinical.patient_records'],
'02_clinical_contenido.sql':['clinical.clinical_encounters','clinical.clinical_entries','clinical.clinical_documents'],
'03_clinical_permisos_auditoria.sql':['clinical.clinical_access_grants','clinical.clinical_grant_resources','clinical.clinical_access_audit'],
'05_ia_investigacion.sql':['ml.dataset_versions','ml.dataset_items','ml.model_versions','ml.educational_recommendations','ml.evaluation_runs','ml.evaluation_metrics'],
'06_ia_analisis.sql':['ml.analysis_authorizations','ml.analysis_jobs','ml.analysis_results','ml.result_recommendations'],
}

def generate():
    dump(ROOT/'MODELO_DATOS.json',MODEL)
    dictionary=['# Diccionario de datos revisado','',
      'Fuente única: [MODELO_DATOS.json](MODELO_DATOS.json). **29 tablas, 219 columnas**: las 214 originales revisadas y cinco adiciones justificadas (dos razones de corrección y tres campos de lease). No se aplicó ninguna modificación remota.',
      '', 'Los tipos, NULL y defaults de las cinco tablas existentes se conservan según catálogo. Los estados y límites nuevos son una propuesta explícita pendiente de acuerdo del equipo. RLS/GRANT no se deducen de una FK. La lectura de contenido clínico exige auditoría, incluso para su propietario.','']
    for t in MODEL:
        dictionary+=['## '+t['name'],'',t['description'], '', '**Estado:** '+t['status']+'; fase `'+t['phase']+'`.', '', '| Columna | Tipo | NULL | Default | Clave / referencia | Significado |','|---|---|---|---|---|---|']
        for f in t['fields']:
            links=[','.join(r['columns'])+' → '+r['target']+'('+','.join(r['references'])+')' for r in t['foreign_keys'] if f['name'] in r['columns']]
            key=f['key']+'; '+'; '.join(links)
            dictionary+=['| '+ ' | '.join([f['name'],f['type'],'sí' if f['nullable'] else 'no',str(f['default']) if f['default'] is not None else '—',key.replace('|','/'),f['description'].replace('|','/')])+' |']
        dictionary+=['','**PK:** `'+', '.join(t['primary_key'])+'`. **UNIQUE:** '+('; '.join('('+','.join(u)+')' for u in t['unique']) or 'ninguna adicional')+'.','']
        if t['domain']=='existente':dictionary+=['**Restricciones observadas:** '+t['rules'], '', '**Índices observados:** '+t['indexes'],'']
        else:dictionary+=['**CHECK:** '+('; '.join(t['checks']) or 'sin CHECK adicionales en la migración existente')+'.','', '**Índices recomendados adicionales:** '+('; '.join(t['indexes_sql']) or 'PK/UNIQUE/FK cubiertas; medir antes de añadir')+'.','']
        if t.get('candidate_keys_proposed'):dictionary+=['**Clave candidata solo propuesta para IA:** '+str(t['candidate_keys_proposed'])+'. No existe en el catálogo observado; se añade únicamente en el borrador 06 para la FK compuesta de propietario.','']
        for r in t['foreign_keys']:dictionary+=['- FK `('+','.join(r['columns'])+') → '+r['target']+'('+','.join(r['references'])+')`; ON DELETE '+r['on_delete']+'.']
        dictionary+=['','**Conservación:** '+t['retention'],'']
        if t['name']=='clinical.clinic_memberships':dictionary+=['**Exclusión:** sin solapamiento de rangos activos para el mismo profesional/clínica; btree_gist requerido. Identidad y origen no se reasignan.','']
        if t['name']=='ml.dataset_items':dictionary+=['**Exclusión:** `(dataset_id =, subject_key =, split <>)` impide fuga del mismo sujeto entre particiones de una versión, incluso en concurrencia. No demuestra independencia entre datasets distintos.','']
    (ROOT/'DICCIONARIO_DATOS.md').write_text('\n'.join(dictionary),encoding='utf8')
    drafts=ROOT/'borradores_sql';drafts.mkdir(exist_ok=True)
    for name, names in PHASES.items():
        extra=''
        if name.startswith('01_'):extra="CREATE SCHEMA IF NOT EXISTS extensions;\nCREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;\nCREATE SCHEMA clinical;\nREVOKE ALL ON SCHEMA clinical FROM PUBLIC, anon, authenticated, service_role;\n"
        if name.startswith('05_'):extra="CREATE SCHEMA ml;\nREVOKE ALL ON SCHEMA ml FROM PUBLIC, anon, authenticated, service_role;\n"
        if name.startswith('06_'):extra="-- Índice redundante respecto de id, necesario como clave candidata de la FK compuesta de propietario.\nALTER TABLE public.dental_photos ADD CONSTRAINT dental_photos_id_owner_key UNIQUE (id,user_id);\n"
        (drafts/name).write_text(GUARD+extra+'\n'.join(table_sql(TABLES[n]) for n in names)+'\nCOMMIT;\n',encoding='utf8')
    def entity(t, full=True):
        out=['  '+t['name'].replace('.','_')+' {']
        for f in t['fields']:
            if not full and f['name'] not in t['primary_key']:continue
            keys=[]
            if f['name'] in t['primary_key']:keys.append('PK')
            if any(f['name'] in r['columns'] for r in t['foreign_keys']):keys.append('FK')
            out+=['    '+f['type']+' '+f['name']+(' '+','.join(keys) if keys else '')]
        return out+['  }']
    def diagram(tables,full):
        out=['erDiagram'];names={t['name'] for t in tables};external=set()
        for t in tables:out+=entity(t,full)
        for t in tables:
            for r in t['foreign_keys']:
                if r['target'] not in names and r['target'] not in external:
                    out+=entity(TABLES[r['target']],False) if r['target'] in TABLES else ['  auth_users {','    uuid id PK','  }']
                    external.add(r['target'])
                optional=any(field(t['name'],c)['nullable'] for c in r['columns'])
                unique=any(set(u).issubset(r['columns']) for u in [t['primary_key']]+t['unique'])
                out+=['  '+r['target'].replace('.','_')+' '+('o|' if optional else '||')+'--'+('o|' if unique else 'o{')+' '+t['name'].replace('.','_')+' : "'+','.join(r['columns'])+'"']
        return '\n'.join(out)+'\n'
    for name,ts,full in [
      ('04-der-general',MODEL,False),('05-der-administracion',[t for t in MODEL if t['domain']=='administracion'],True),
      ('06-der-paciente',[t for t in MODEL if t['domain']=='existente'],True),
      ('07-der-clinico',[t for t in MODEL if t['domain']=='clinico'],True),
      ('08-der-ia',[t for t in MODEL if t['domain']=='ia'],True)]:
        (ROOT/'diagramas'/f'{name}.mmd').write_text(diagram(ts,full),encoding='utf8')
    # Conteos y estructura sin atribuir ejecución de PostgreSQL a esta generación.
    checks=[]
    for t in MODEL:
        cols={f['name'] for f in t['fields']}
        assert len(cols)==len(t['fields']),t['name']
        assert t['primary_key'] and all(c in cols and not field(t['name'],c)['nullable'] for c in t['primary_key']),t['name']
        for r in t['foreign_keys']:
            assert set(r['columns'])<=cols and len(r['columns'])==len(r['references']),r
            if r['target']=='auth.users':assert r['references']==['id'];continue
            target=TABLES[r['target']];tc={f['name'] for f in target['fields']}
            assert set(r['references'])<=tc,r
            assert any(u==r['references'] for u in [target['primary_key']]+target['unique']+target.get('candidate_keys_proposed',[])),r
            assert all(field(t['name'],c)['type']==field(target['name'],rc)['type'] for c,rc in zip(r['columns'],r['references'])),r
        checks.append(dict(table=t['name'],columns=len(t['fields']),pk=t['primary_key'],foreignKeys=len(t['foreign_keys']),phase=t['phase']))
    # La candidata id,owner existe solo en el borrador IA; no se presenta como esquema observado.
    dump(ROOT/'validacion'/'estructura.json',dict(originalTables=29,originalColumns=214,revisedTables=len(MODEL),revisedColumns=sum(len(t['fields']) for t in MODEL),tables=checks,sqlExecuted=False))
    print('Modelo generado:',len(MODEL),'tablas;',sum(len(t['fields']) for t in MODEL),'columnas')

# Clave candidata propuesta para la FK IA: no está desplegada ni debe recrear dental_photos.
TABLES['public.dental_photos']['candidate_keys_proposed']=[['id','user_id']]
if __name__=='__main__':generate()
