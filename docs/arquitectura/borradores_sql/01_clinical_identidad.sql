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

COMMIT;
