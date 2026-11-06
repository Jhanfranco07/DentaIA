-- BORRADOR DE ARQUITECTURA. No aplicado, no autodesplegar, sin datos reales.
-- Solo una base desechable con nombre dentaia_arch_qa_<sufijo>.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT LIKE 'dentaia_arch_qa_%'
    OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN
    RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED';
  END IF;
END $$;
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

COMMIT;
