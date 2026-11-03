-- BORRADOR; ejecutar solo tras revisión en una base desechable dentaia_arch_qa_*.
BEGIN;
DO $$ BEGIN
 IF current_database() NOT LIKE 'dentaia_arch_qa_%' OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED'; END IF;
END $$;

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
