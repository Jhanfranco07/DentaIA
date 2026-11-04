-- FASE 8: PROPUESTA. Requiere respaldo verificado y aprobación final externa.
-- No aplicar por db push. GUC de aprobación es una guarda operativa, NO prueba criptográfica del proyecto.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $fase8$ DECLARE signature text; BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'TRUSTED_MIGRATION_OPERATOR_REQUIRED'; END IF;
 IF current_database()='postgres' THEN
  IF current_setting('dentaia.integration_target',true) IS DISTINCT FROM 'vwmdknzjyvmsdqpepykz'
   OR current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_final_approved' THEN
   RAISE EXCEPTION 'EXPLICIT_TARGET_AND_FINAL_APPROVAL_REQUIRED'; END IF;
 ELSIF current_database()='dentaia_arch_qa_fase8' THEN
  IF current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_local_simulation'
   OR (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'DENTAIA_PHASE8_SYNTHETIC_ONLY'
  THEN RAISE EXCEPTION 'LOCAL_SIMULATION_MARKER_REQUIRED'; END IF;
 ELSE RAISE EXCEPTION 'TARGET_DATABASE_NOT_APPROVED'; END IF;
 SELECT f.fingerprint INTO signature FROM (SELECT md5(jsonb_build_object(
'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'ordinal',ordinal_position,'type',data_type,'nullable',is_nullable,'default',column_default) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid,true)) ORDER BY c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
'indexes',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
'formatted',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
'acl',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'acl',c.relacl) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
'columnAcl',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'acl',a.attacl) ORDER BY c.relname,a.attname) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
'policies',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) ORDER BY tablename,policyname) FROM pg_policies WHERE schemaname='public')
)::text) AS fingerprint) f;
 IF signature IS DISTINCT FROM '2aea91388f533f07548047d93acf2ebf' THEN RAISE EXCEPTION 'PUBLIC_SCHEMA_DRIFT_ABORT'; END IF;
END $fase8$;
DO $$ BEGIN IF to_regnamespace('clinical') IS NOT NULL THEN RAISE EXCEPTION 'CLINICAL_SCHEMA_ALREADY_EXISTS'; END IF; END $$;
-- BORRADOR DE ARQUITECTURA. No aplicado, no autodesplegar, sin datos reales.
-- Solo una base desechable con nombre dentaia_arch_qa_<sufijo>.


SET LOCAL search_path = pg_catalog, public, extensions;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE SCHEMA clinical;
REVOKE ALL ON SCHEMA clinical FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE clinical.clinics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  CHECK (status IN ('active','inactive')),
  CHECK (location IS NULL OR length(location) <= 300)
);
ALTER TABLE clinical.clinics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinics FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinics_q1 ON clinical.clinics (status, name);

CREATE TABLE clinical.professional_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dentist_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (user_id),
  UNIQUE (dentist_id),
  CHECK (status IN ('pending','verified','suspended')),
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE RESTRICT,
  FOREIGN KEY (dentist_id) REFERENCES public.dentists (id) ON DELETE RESTRICT
);
ALTER TABLE clinical.professional_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.professional_accounts FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE clinical.professional_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL,
  reviewed_by uuid NOT NULL,
  decision text NOT NULL,
  reference text NOT NULL,
  reason text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CHECK (decision IN ('approved','rejected')),
  CHECK (length(btrim(reference)) BETWEEN 1 AND 300),
  CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  FOREIGN KEY (professional_id) REFERENCES clinical.professional_accounts (id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by) REFERENCES auth.users (id) ON DELETE RESTRICT
);
ALTER TABLE clinical.professional_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.professional_verifications FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX professional_verifications_q1 ON clinical.professional_verifications (professional_id, reviewed_at DESC, id);
CREATE INDEX professional_verifications_q2 ON clinical.professional_verifications (reviewed_by);

CREATE TABLE clinical.clinic_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  PRIMARY KEY (id),
  UNIQUE (clinic_id, professional_id, valid_from),
  CHECK (status IN ('active','inactive','suspended')),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  FOREIGN KEY (clinic_id) REFERENCES clinical.clinics (id) ON DELETE RESTRICT,
  FOREIGN KEY (professional_id) REFERENCES clinical.professional_accounts (id) ON DELETE RESTRICT,
  EXCLUDE USING gist (clinic_id WITH =, professional_id WITH =, tstzrange(valid_from, valid_until, '[)') WITH &&) WHERE (status = 'active')
);
ALTER TABLE clinical.clinic_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinic_memberships FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinic_memberships_q1 ON clinical.clinic_memberships (professional_id, status);

CREATE TABLE clinical.patient_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (user_id),
  CHECK (status IN ('active','archived')),
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE RESTRICT
);
ALTER TABLE clinical.patient_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.patient_records FROM PUBLIC, anon, authenticated, service_role;

-- BORRADOR DE ARQUITECTURA. No aplicado, no autodesplegar, sin datos reales.
-- Solo una base desechable con nombre dentaia_arch_qa_<sufijo>.


SET LOCAL search_path = pg_catalog, public, extensions;
CREATE TABLE clinical.clinical_encounters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  attended_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'recorded',
  replaces_id uuid,
  correction_reason text,
  PRIMARY KEY (id),
  UNIQUE (id, patient_id, membership_id),
  UNIQUE (replaces_id),
  CHECK (status IN ('recorded','voided')),
  CHECK (replaces_id IS NULL OR replaces_id <> id),
  CHECK ((replaces_id IS NULL AND correction_reason IS NULL) OR (replaces_id IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 1 AND 1000 AND correction_reason IS NOT NULL)),
  CHECK (status <> 'voided' OR replaces_id IS NOT NULL),
  FOREIGN KEY (patient_id) REFERENCES clinical.patient_records (id) ON DELETE RESTRICT,
  FOREIGN KEY (membership_id) REFERENCES clinical.clinic_memberships (id) ON DELETE RESTRICT,
  FOREIGN KEY (replaces_id, patient_id, membership_id) REFERENCES clinical.clinical_encounters (id, patient_id, membership_id) ON DELETE RESTRICT
);
ALTER TABLE clinical.clinical_encounters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinical_encounters FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinical_encounters_q1 ON clinical.clinical_encounters (patient_id, attended_at DESC, id DESC);
CREATE INDEX clinical_encounters_q2 ON clinical.clinical_encounters (membership_id);

CREATE TABLE clinical.clinical_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL,
  kind text NOT NULL,
  information_state text NOT NULL,
  description text,
  code_system text,
  code text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  replaces_id uuid,
  correction_reason text,
  PRIMARY KEY (id),
  UNIQUE (id, encounter_id, kind),
  UNIQUE (replaces_id),
  CHECK (kind IN ('background','diagnosis','treatment')),
  CHECK (information_state IN ('recorded','unknown','not_recorded')),
  CHECK ((information_state = 'recorded' AND description IS NOT NULL AND length(btrim(description)) BETWEEN 1 AND 10000) OR (information_state <> 'recorded' AND description IS NULL AND code IS NULL AND code_system IS NULL)),
  CHECK ((code IS NULL) = (code_system IS NULL)),
  CHECK (replaces_id IS NULL OR replaces_id <> id),
  CHECK ((replaces_id IS NULL AND correction_reason IS NULL) OR (replaces_id IS NOT NULL AND correction_reason IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 1 AND 1000)),
  FOREIGN KEY (encounter_id) REFERENCES clinical.clinical_encounters (id) ON DELETE RESTRICT,
  FOREIGN KEY (replaces_id, encounter_id, kind) REFERENCES clinical.clinical_entries (id, encounter_id, kind) ON DELETE RESTRICT
);
ALTER TABLE clinical.clinical_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinical_entries FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinical_entries_q1 ON clinical.clinical_entries (encounter_id, kind, recorded_at DESC);

CREATE TABLE clinical.clinical_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  exam_date date,
  availability text NOT NULL,
  bucket_id text,
  object_path text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (bucket_id, object_path),
  CHECK (kind IN ('exam','document')),
  CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  CHECK (availability IN ('available','unavailable')),
  CHECK ((availability = 'available' AND bucket_id = 'dentaia-clinical-documents' AND object_path IS NOT NULL AND mime_type IN ('application/pdf','image/jpeg','image/png','image/webp') AND size_bytes BETWEEN 1 AND 8388608 AND bucket_id IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL) OR (availability = 'unavailable' AND bucket_id IS NULL AND object_path IS NULL AND mime_type IS NULL AND size_bytes IS NULL)),
  CHECK (object_path IS NULL OR (length(object_path) BETWEEN 1 AND 512 AND object_path !~ '(^|/)\.\.?(/|$)')),
  FOREIGN KEY (encounter_id) REFERENCES clinical.clinical_encounters (id) ON DELETE RESTRICT
);
ALTER TABLE clinical.clinical_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinical_documents FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinical_documents_q1 ON clinical.clinical_documents (encounter_id, exam_date DESC);

-- BORRADOR DE ARQUITECTURA. No aplicado, no autodesplegar, sin datos reales.
-- Solo una base desechable con nombre dentaia_arch_qa_<sufijo>.


SET LOCAL search_path = pg_catalog, public, extensions;
CREATE TABLE clinical.clinical_access_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  purpose text NOT NULL,
  policy_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  scope_mode text NOT NULL DEFAULT 'selected_encounters',
  PRIMARY KEY (id),
  CHECK (expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at),
  CHECK (scope_mode = 'selected_encounters'),
  CHECK (length(btrim(purpose)) BETWEEN 1 AND 100),
  CHECK (length(btrim(policy_version)) BETWEEN 1 AND 80),
  FOREIGN KEY (patient_id) REFERENCES clinical.patient_records (id) ON DELETE RESTRICT,
  FOREIGN KEY (membership_id) REFERENCES clinical.clinic_memberships (id) ON DELETE RESTRICT
);
ALTER TABLE clinical.clinical_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinical_access_grants FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinical_access_grants_q1 ON clinical.clinical_access_grants (patient_id, membership_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX clinical_access_grants_q2 ON clinical.clinical_access_grants (membership_id);

CREATE TABLE clinical.clinical_grant_resources (
  grant_id uuid NOT NULL,
  encounter_id uuid NOT NULL,
  PRIMARY KEY (grant_id, encounter_id),
  FOREIGN KEY (grant_id) REFERENCES clinical.clinical_access_grants (id) ON DELETE RESTRICT,
  FOREIGN KEY (encounter_id) REFERENCES clinical.clinical_encounters (id) ON DELETE RESTRICT
);
ALTER TABLE clinical.clinical_grant_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinical_grant_resources FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinical_grant_resources_q1 ON clinical.clinical_grant_resources (encounter_id);

CREATE TABLE clinical.clinical_access_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  actor_user_id uuid,
  patient_id uuid,
  membership_id uuid,
  grant_id uuid,
  operation text NOT NULL,
  outcome text NOT NULL,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CHECK (outcome IN ('allowed','denied','error')),
  CHECK (operation IN ('read_history','read_document','grant_access','revoke_access','read_professional_requests','list_authorized_patients','verify_professional','membership_change','register_clinical')),
  CHECK (reason_code ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  FOREIGN KEY (actor_user_id) REFERENCES auth.users (id) ON DELETE RESTRICT,
  FOREIGN KEY (patient_id) REFERENCES clinical.patient_records (id) ON DELETE RESTRICT,
  FOREIGN KEY (membership_id) REFERENCES clinical.clinic_memberships (id) ON DELETE RESTRICT,
  FOREIGN KEY (grant_id) REFERENCES clinical.clinical_access_grants (id) ON DELETE RESTRICT
);
ALTER TABLE clinical.clinical_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.clinical_access_audit FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX clinical_access_audit_q1 ON clinical.clinical_access_audit (patient_id, occurred_at DESC);
CREATE INDEX clinical_access_audit_q2 ON clinical.clinical_access_audit (actor_user_id, occurred_at DESC);
CREATE INDEX clinical_access_audit_q3 ON clinical.clinical_access_audit (request_id);
CREATE INDEX clinical_access_audit_q4 ON clinical.clinical_access_audit (membership_id);
CREATE INDEX clinical_access_audit_q5 ON clinical.clinical_access_audit (grant_id);

-- BORRADOR; ejecutar solo tras revisión en una base desechable dentaia_arch_qa_*.



-- Estas funciones son INVOKER: no conceden identidad ni acceso clínico.
CREATE FUNCTION clinical.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'APPEND_ONLY_RECORD' USING ERRCODE='42501'; END $$;

CREATE FUNCTION clinical.identity_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_TABLE_NAME = 'clinic_memberships' THEN
   IF ROW(NEW.clinic_id,NEW.professional_id,NEW.valid_from) IS DISTINCT FROM ROW(OLD.clinic_id,OLD.professional_id,OLD.valid_from) THEN
     RAISE EXCEPTION 'MEMBERSHIP_REBIND_FORBIDDEN' USING ERRCODE='23514';
   END IF;
   IF OLD.valid_until IS NOT NULL AND NEW.valid_until IS DISTINCT FROM OLD.valid_until THEN
     RAISE EXCEPTION 'MEMBERSHIP_PERIOD_IMMUTABLE' USING ERRCODE='23514';
   END IF;
   IF NEW.valid_until IS NOT NULL AND EXISTS (SELECT 1 FROM clinical.clinical_encounters WHERE membership_id=NEW.id AND attended_at>=NEW.valid_until) THEN
     RAISE EXCEPTION 'MEMBERSHIP_TRUNCATES_HISTORY' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME = 'professional_accounts' THEN
   IF NEW.user_id IS DISTINCT FROM OLD.user_id OR (OLD.dentist_id IS NOT NULL AND NEW.dentist_id IS DISTINCT FROM OLD.dentist_id) THEN
     RAISE EXCEPTION 'PROFESSIONAL_REBIND_FORBIDDEN' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME = 'patient_records' THEN
   IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
     RAISE EXCEPTION 'PATIENT_REBIND_FORBIDDEN' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME = 'clinical_access_grants' THEN
   IF ROW(NEW.id,NEW.patient_id,NEW.membership_id,NEW.purpose,NEW.policy_version,NEW.granted_at,NEW.expires_at,NEW.scope_mode)
      IS DISTINCT FROM ROW(OLD.id,OLD.patient_id,OLD.membership_id,OLD.purpose,OLD.policy_version,OLD.granted_at,OLD.expires_at,OLD.scope_mode)
      OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
     RAISE EXCEPTION 'GRANT_SCOPE_IMMUTABLE' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER membership_identity BEFORE UPDATE ON clinical.clinic_memberships FOR EACH ROW EXECUTE FUNCTION clinical.identity_immutable();
CREATE TRIGGER professional_identity BEFORE UPDATE ON clinical.professional_accounts FOR EACH ROW EXECUTE FUNCTION clinical.identity_immutable();
CREATE TRIGGER patient_identity BEFORE UPDATE ON clinical.patient_records FOR EACH ROW EXECUTE FUNCTION clinical.identity_immutable();
CREATE TRIGGER grant_identity BEFORE UPDATE ON clinical.clinical_access_grants FOR EACH ROW EXECUTE FUNCTION clinical.identity_immutable();

CREATE FUNCTION clinical.resource_patient_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE a uuid; b uuid;
BEGIN
 SELECT patient_id INTO a FROM clinical.clinical_access_grants WHERE id=NEW.grant_id FOR SHARE;
 SELECT patient_id INTO b FROM clinical.clinical_encounters WHERE id=NEW.encounter_id FOR SHARE;
 IF a IS NULL OR b IS NULL OR a<>b THEN RAISE EXCEPTION 'RESOURCE_PATIENT_MISMATCH' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resource_patient BEFORE INSERT ON clinical.clinical_grant_resources FOR EACH ROW EXECUTE FUNCTION clinical.resource_patient_check();
CREATE TRIGGER resource_no_edit BEFORE UPDATE OR DELETE ON clinical.clinical_grant_resources FOR EACH ROW EXECUTE FUNCTION clinical.reject_mutation();

CREATE FUNCTION clinical.verification_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE target_user uuid;
BEGIN
 SELECT user_id INTO target_user FROM clinical.professional_accounts WHERE id=NEW.professional_id FOR SHARE;
 IF target_user IS NULL OR target_user=NEW.reviewed_by THEN RAISE EXCEPTION 'SELF_VERIFICATION_FORBIDDEN' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER verification_independent BEFORE INSERT ON clinical.professional_verifications FOR EACH ROW EXECUTE FUNCTION clinical.verification_check();
CREATE TRIGGER verification_no_edit BEFORE UPDATE OR DELETE ON clinical.professional_verifications FOR EACH ROW EXECUTE FUNCTION clinical.reject_mutation();

CREATE FUNCTION clinical.professional_status_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE decision text;
BEGIN
 IF NEW.status='verified' THEN
   SELECT v.decision INTO decision FROM clinical.professional_verifications v WHERE v.professional_id=NEW.id ORDER BY v.reviewed_at DESC,v.id DESC LIMIT 1;
   IF decision IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'VERIFICATION_REQUIRED' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER professional_verified BEFORE INSERT OR UPDATE ON clinical.professional_accounts FOR EACH ROW EXECUTE FUNCTION clinical.professional_status_check();

CREATE FUNCTION clinical.encounter_origin_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE m clinical.clinic_memberships;
BEGIN
 SELECT * INTO m FROM clinical.clinic_memberships WHERE id=NEW.membership_id FOR SHARE;
 IF NOT FOUND OR NEW.attended_at<m.valid_from OR (m.valid_until IS NOT NULL AND NEW.attended_at>=m.valid_until) THEN
   RAISE EXCEPTION 'ENCOUNTER_OUTSIDE_ORIGIN_PERIOD' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER encounter_origin BEFORE INSERT ON clinical.clinical_encounters FOR EACH ROW EXECUTE FUNCTION clinical.encounter_origin_check();

CREATE FUNCTION clinical.document_path_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE patient uuid;
BEGIN
 IF NEW.availability='available' THEN
   SELECT patient_id INTO patient FROM clinical.clinical_encounters WHERE id=NEW.encounter_id FOR SHARE;
   IF patient IS NULL OR NEW.object_path NOT LIKE patient::text||'/'||NEW.encounter_id::text||'/%'
      OR array_length(string_to_array(NEW.object_path,'/'),1)<>3 OR length(split_part(NEW.object_path,'/',3))=0 THEN
     RAISE EXCEPTION 'DOCUMENT_PATH_MISMATCH' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_path BEFORE INSERT OR UPDATE ON clinical.clinical_documents FOR EACH ROW EXECUTE FUNCTION clinical.document_path_check();

CREATE FUNCTION clinical.encounter_cycles_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE bad boolean;
BEGIN
 WITH RECURSIVE chain AS (
   SELECT id,replaces_id,ARRAY[id] AS path,false AS cycle FROM clinical.clinical_encounters WHERE id=NEW.id
   UNION ALL
   SELECT p.id,p.replaces_id,c.path||p.id,p.id=ANY(c.path)
   FROM clinical.clinical_encounters p JOIN chain c ON p.id=c.replaces_id WHERE NOT c.cycle
 ) SELECT coalesce(bool_or(cycle),false) INTO bad FROM chain;
 IF bad THEN RAISE EXCEPTION 'CORRECTION_CYCLE' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION clinical.entry_cycles_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE bad boolean;
BEGIN
 WITH RECURSIVE chain AS (
   SELECT id,replaces_id,ARRAY[id] AS path,false AS cycle FROM clinical.clinical_entries WHERE id=NEW.id
   UNION ALL
   SELECT p.id,p.replaces_id,c.path||p.id,p.id=ANY(c.path)
   FROM clinical.clinical_entries p JOIN chain c ON p.id=c.replaces_id WHERE NOT c.cycle
 ) SELECT coalesce(bool_or(cycle),false) INTO bad FROM chain;
 IF bad THEN RAISE EXCEPTION 'CORRECTION_CYCLE' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER encounter_no_cycles AFTER INSERT ON clinical.clinical_encounters DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION clinical.encounter_cycles_check();
CREATE CONSTRAINT TRIGGER entry_no_cycles AFTER INSERT ON clinical.clinical_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION clinical.entry_cycles_check();
CREATE TRIGGER encounters_no_edit BEFORE UPDATE OR DELETE ON clinical.clinical_encounters FOR EACH ROW EXECUTE FUNCTION clinical.reject_mutation();
CREATE TRIGGER entries_no_edit BEFORE UPDATE OR DELETE ON clinical.clinical_entries FOR EACH ROW EXECUTE FUNCTION clinical.reject_mutation();
CREATE TRIGGER audit_no_edit BEFORE UPDATE OR DELETE ON clinical.clinical_access_audit FOR EACH ROW EXECUTE FUNCTION clinical.reject_mutation();
-- No se publican RPC ni políticas de lectura directa que omitan auditoría.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA clinical FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
