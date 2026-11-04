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
CREATE SCHEMA ml;
REVOKE ALL ON SCHEMA ml FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE ml.dataset_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL,
  source_uri text NOT NULL,
  license text NOT NULL,
  permission_reference text NOT NULL,
  manifest_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (name, version),
  CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CHECK (length(btrim(version)) BETWEEN 1 AND 80),
  CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (length(btrim(source_uri)) > 0),
  CHECK (length(btrim(license)) > 0),
  CHECK (length(btrim(permission_reference)) > 0)
);
ALTER TABLE ml.dataset_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.dataset_versions FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE ml.dataset_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL,
  subject_key text NOT NULL,
  object_reference text NOT NULL,
  image_sha256 text NOT NULL,
  label text NOT NULL,
  split text NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (dataset_id, image_sha256),
  CHECK (split IN ('train','validation','test')),
  CHECK (image_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (length(btrim(subject_key)) BETWEEN 1 AND 128),
  CHECK (length(btrim(label)) BETWEEN 1 AND 120),
  CHECK (length(btrim(object_reference)) > 0),
  FOREIGN KEY (dataset_id) REFERENCES ml.dataset_versions (id) ON DELETE RESTRICT,
  EXCLUDE USING gist (dataset_id WITH =, subject_key WITH =, split WITH <>)
);
ALTER TABLE ml.dataset_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.dataset_items FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX dataset_items_q1 ON ml.dataset_items (dataset_id, subject_key, split);

CREATE TABLE ml.model_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  artifact_uri text NOT NULL,
  artifact_sha256 text NOT NULL,
  preprocessing_version text NOT NULL,
  code_commit text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (name, version),
  CHECK (status IN ('draft','evaluated','retired')),
  CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (code_commit ~ '^[0-9a-f]{40}([0-9a-f]{24})?$'),
  CHECK (length(btrim(name)) > 0),
  CHECK (length(btrim(version)) > 0),
  CHECK (length(btrim(preprocessing_version)) > 0),
  CHECK (length(btrim(artifact_uri)) > 0),
  FOREIGN KEY (dataset_id) REFERENCES ml.dataset_versions (id) ON DELETE RESTRICT
);
ALTER TABLE ml.model_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.model_versions FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX model_versions_q1 ON ml.model_versions (dataset_id);

CREATE TABLE ml.educational_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version text NOT NULL,
  text text NOT NULL,
  source_reference text NOT NULL,
  review_status text NOT NULL DEFAULT 'draft',
  PRIMARY KEY (id),
  UNIQUE (code, version),
  CHECK (review_status IN ('draft','reviewed','retired')),
  CHECK (length(btrim(code)) > 0),
  CHECK (length(btrim(version)) > 0),
  CHECK (length(btrim(text)) > 0),
  CHECK (length(btrim(source_reference)) > 0)
);
ALTER TABLE ml.educational_recommendations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.educational_recommendations FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE ml.evaluation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL,
  dataset_id uuid NOT NULL,
  split text NOT NULL DEFAULT 'test',
  sample_size integer NOT NULL,
  config jsonb NOT NULL,
  artifact_reference text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CHECK (split IN ('train','validation','test')),
  CHECK (sample_size > 0),
  CHECK (jsonb_typeof(config) = 'object'),
  CHECK (length(btrim(artifact_reference)) > 0),
  FOREIGN KEY (model_id) REFERENCES ml.model_versions (id) ON DELETE RESTRICT,
  FOREIGN KEY (dataset_id) REFERENCES ml.dataset_versions (id) ON DELETE RESTRICT
);
ALTER TABLE ml.evaluation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.evaluation_runs FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX evaluation_runs_q1 ON ml.evaluation_runs (model_id, executed_at DESC);
CREATE INDEX evaluation_runs_q2 ON ml.evaluation_runs (dataset_id);

CREATE TABLE ml.evaluation_metrics (
  run_id uuid NOT NULL,
  name text NOT NULL,
  label text NOT NULL DEFAULT 'aggregate',
  value numeric,
  matrix jsonb,
  PRIMARY KEY (run_id, name, label),
  CHECK (name IN ('accuracy','precision','recall','f1','auc','confusion_matrix')),
  CHECK ((name = 'confusion_matrix' AND value IS NULL AND matrix IS NOT NULL) OR (name <> 'confusion_matrix' AND value IS NOT NULL AND value BETWEEN 0 AND 1 AND matrix IS NULL)),
  CHECK (length(btrim(label)) > 0),
  FOREIGN KEY (run_id) REFERENCES ml.evaluation_runs (id) ON DELETE RESTRICT
);
ALTER TABLE ml.evaluation_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ml.evaluation_metrics FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
