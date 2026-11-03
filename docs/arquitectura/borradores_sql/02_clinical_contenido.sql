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

COMMIT;
