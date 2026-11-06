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
-- Índice redundante respecto de id, necesario como clave candidata de la FK compuesta de propietario.
ALTER TABLE public.dental_photos ADD CONSTRAINT dental_photos_id_owner_key UNIQUE (id,user_id);
CREATE TABLE ml.analysis_authorizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  photo_id uuid NOT NULL,
  purpose text NOT NULL DEFAULT 'exploratory_image_analysis',
  policy_version text NOT NULL,
  consent_text text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (id, photo_id, owner_user_id),
  CHECK (purpose = 'exploratory_image_analysis'),
  CHECK (expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at),
  CHECK (length(btrim(policy_version)) BETWEEN 1 AND 80),
  CHECK (length(btrim(consent_text)) BETWEEN 20 AND 5000),
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id, owner_user_id) REFERENCES public.dental_photos (id, user_id) ON DELETE CASCADE
);
ALTER TABLE ml.analysis_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.analysis_authorizations FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX analysis_authorizations_q1 ON ml.analysis_authorizations (owner_user_id, photo_id, expires_at);
CREATE INDEX analysis_authorizations_q2 ON ml.analysis_authorizations (photo_id) WHERE revoked_at IS NULL;
CREATE INDEX analysis_authorizations_q3 ON ml.analysis_authorizations (photo_id, owner_user_id);

CREATE TABLE ml.analysis_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL,
  model_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  authorization_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  lease_id uuid,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE (owner_user_id, idempotency_key),
  CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  CHECK (attempt_count >= 0),
  CHECK ((status = 'running' AND lease_id IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'running' AND lease_id IS NULL AND lease_expires_at IS NULL)),
  CHECK ((status IN ('succeeded','failed','cancelled')) = (finished_at IS NOT NULL)),
  CHECK (finished_at IS NULL OR finished_at >= created_at),
  CHECK (status <> 'failed' OR error_code IS NOT NULL),
  CHECK (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES public.dental_photos (id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES ml.model_versions (id) ON DELETE RESTRICT,
  FOREIGN KEY (authorization_id, photo_id, owner_user_id) REFERENCES ml.analysis_authorizations (id, photo_id, owner_user_id) ON DELETE CASCADE
);
ALTER TABLE ml.analysis_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.analysis_jobs FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX analysis_jobs_q1 ON ml.analysis_jobs (status, created_at);
CREATE INDEX analysis_jobs_q2 ON ml.analysis_jobs (photo_id);
CREATE INDEX analysis_jobs_q3 ON ml.analysis_jobs (model_id);
CREATE INDEX analysis_jobs_q4 ON ml.analysis_jobs (authorization_id, photo_id, owner_user_id);

CREATE TABLE ml.analysis_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  label text,
  score numeric,
  limitations text NOT NULL,
  disclaimer_version text NOT NULL,
  quality_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (job_id),
  CHECK (quality_status IN ('evaluable','not_evaluable')),
  CHECK (score IS NULL OR score BETWEEN 0 AND 1),
  CHECK ((quality_status = 'not_evaluable' AND label IS NULL AND score IS NULL) OR (quality_status = 'evaluable' AND label IS NOT NULL AND length(btrim(label)) > 0)),
  CHECK (length(btrim(limitations)) > 0),
  CHECK (length(btrim(disclaimer_version)) > 0),
  FOREIGN KEY (job_id) REFERENCES ml.analysis_jobs (id) ON DELETE CASCADE
);
ALTER TABLE ml.analysis_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.analysis_results FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE ml.result_recommendations (
  result_id uuid NOT NULL,
  recommendation_id uuid NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (result_id, recommendation_id),
  CHECK (length(btrim(reason)) > 0),
  FOREIGN KEY (result_id) REFERENCES ml.analysis_results (id) ON DELETE CASCADE,
  FOREIGN KEY (recommendation_id) REFERENCES ml.educational_recommendations (id) ON DELETE RESTRICT
);
ALTER TABLE ml.result_recommendations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.result_recommendations FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX result_recommendations_q1 ON ml.result_recommendations (recommendation_id);

COMMIT;
