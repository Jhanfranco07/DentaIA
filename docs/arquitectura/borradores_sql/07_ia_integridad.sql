-- BORRADOR; ejecutar solo tras revisión en una base desechable dentaia_arch_qa_*.
BEGIN;
DO $$ BEGIN
 IF current_database() NOT LIKE 'dentaia_arch_qa_%' OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED'; END IF;
END $$;

CREATE FUNCTION ml.valid_confusion_matrix(m jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE row_data jsonb; v jsonb; n integer;
BEGIN
 IF m IS NULL OR jsonb_typeof(m)<>'array' THEN RETURN false; END IF;
 n:=jsonb_array_length(m); IF n<1 THEN RETURN false; END IF;
 FOR row_data IN SELECT value FROM jsonb_array_elements(m) LOOP
   IF jsonb_typeof(row_data)<>'array' THEN RETURN false; END IF;
   IF jsonb_array_length(row_data)<>n THEN RETURN false; END IF;
   FOR v IN SELECT value FROM jsonb_array_elements(row_data) LOOP
     IF jsonb_typeof(v)<>'number' THEN RETURN false; END IF;
     IF (v#>>'{}')::numeric<0 OR (v#>>'{}')::numeric>2147483647 OR trunc((v#>>'{}')::numeric)<>(v#>>'{}')::numeric THEN RETURN false; END IF;
   END LOOP;
 END LOOP;
 RETURN true;
END $$;

CREATE FUNCTION ml.metric_consistency() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE run ml.evaluation_runs; total numeric; n integer;
BEGIN
 IF NEW.name='confusion_matrix' THEN
   IF NOT ml.valid_confusion_matrix(NEW.matrix) OR NEW.label<>'aggregate' THEN
     RAISE EXCEPTION 'INVALID_CONFUSION_MATRIX' USING ERRCODE='23514';
   END IF;
   SELECT * INTO run FROM ml.evaluation_runs WHERE id=NEW.run_id FOR SHARE;
   SELECT sum((b.v#>>'{}')::numeric) INTO total FROM jsonb_array_elements(NEW.matrix) a(r) CROSS JOIN LATERAL jsonb_array_elements(a.r) b(v);
   n:=jsonb_array_length(NEW.matrix);
   IF total<>run.sample_size OR run.config->'labels' IS NULL OR jsonb_typeof(run.config->'labels')<>'array' THEN
     RAISE EXCEPTION 'EVALUATION_COUNT_OR_LABEL_MISMATCH' USING ERRCODE='23514';
   END IF;
   IF jsonb_array_length(run.config->'labels')<>n
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(run.config->'labels') x(v) WHERE jsonb_typeof(x.v)<>'string' OR length(btrim(x.v#>>'{}'))=0)
     OR (SELECT count(*)<>count(DISTINCT v) FROM jsonb_array_elements(run.config->'labels') x(v)) THEN
     RAISE EXCEPTION 'EVALUATION_LABEL_MISMATCH' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER metric_shape BEFORE INSERT OR UPDATE ON ml.evaluation_metrics FOR EACH ROW EXECUTE FUNCTION ml.metric_consistency();

CREATE FUNCTION ml.freeze_dataset() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE ids uuid[]; target uuid;
BEGIN
 IF TG_TABLE_NAME='dataset_versions' THEN
   ids:=CASE TG_OP WHEN 'INSERT' THEN ARRAY[NEW.id] WHEN 'DELETE' THEN ARRAY[OLD.id] ELSE ARRAY[OLD.id,NEW.id] END;
 ELSE
   ids:=CASE TG_OP WHEN 'INSERT' THEN ARRAY[NEW.dataset_id] WHEN 'DELETE' THEN ARRAY[OLD.dataset_id] ELSE ARRAY[OLD.dataset_id,NEW.dataset_id] END;
 END IF;
 FOR target IN SELECT DISTINCT x FROM unnest(ids) a(x) WHERE x IS NOT NULL ORDER BY x LOOP
   PERFORM id FROM ml.dataset_versions WHERE id=target FOR UPDATE;
   IF EXISTS(SELECT 1 FROM ml.model_versions WHERE dataset_id=target) THEN
     RAISE EXCEPTION 'DATASET_VERSION_FROZEN' USING ERRCODE='23514';
   END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER dataset_version_frozen BEFORE UPDATE OR DELETE ON ml.dataset_versions FOR EACH ROW EXECUTE FUNCTION ml.freeze_dataset();
CREATE TRIGGER dataset_items_frozen BEFORE INSERT OR UPDATE OR DELETE ON ml.dataset_items FOR EACH ROW EXECUTE FUNCTION ml.freeze_dataset();

CREATE FUNCTION ml.model_evaluation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NEW.status='evaluated' AND NOT EXISTS (
   SELECT r.id FROM ml.evaluation_runs r JOIN ml.evaluation_metrics m ON m.run_id=r.id
   WHERE r.model_id=NEW.id AND r.split='test' AND m.name IN ('precision','recall','f1','confusion_matrix')
   GROUP BY r.id HAVING count(DISTINCT m.name)=4
 ) THEN RAISE EXCEPTION 'MODEL_METRICS_REQUIRED' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.dataset_id,NEW.name,NEW.version,NEW.artifact_uri,NEW.artifact_sha256,NEW.preprocessing_version,NEW.code_commit)
   IS DISTINCT FROM ROW(OLD.dataset_id,OLD.name,OLD.version,OLD.artifact_uri,OLD.artifact_sha256,OLD.preprocessing_version,OLD.code_commit) THEN
   RAISE EXCEPTION 'MODEL_VERSION_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER model_evaluation BEFORE INSERT OR UPDATE ON ml.model_versions FOR EACH ROW EXECUTE FUNCTION ml.model_evaluation_guard();

CREATE FUNCTION ml.job_transition_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF ROW(NEW.id,NEW.owner_user_id,NEW.photo_id,NEW.model_id,NEW.authorization_id,NEW.idempotency_key,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.owner_user_id,OLD.photo_id,OLD.model_id,OLD.authorization_id,OLD.idempotency_key,OLD.created_at) THEN
   RAISE EXCEPTION 'JOB_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 IF OLD.status IN ('succeeded','failed','cancelled') THEN RAISE EXCEPTION 'JOB_TERMINAL' USING ERRCODE='23514'; END IF;
 IF OLD.status='queued' AND NEW.status NOT IN ('running','failed','cancelled') THEN RAISE EXCEPTION 'INVALID_JOB_TRANSITION' USING ERRCODE='23514'; END IF;
 IF OLD.status='running' AND NEW.status NOT IN ('running','succeeded','failed','cancelled') THEN RAISE EXCEPTION 'INVALID_JOB_TRANSITION' USING ERRCODE='23514'; END IF;
 IF NEW.status='running' THEN
   IF NEW.lease_id IS NULL OR NEW.lease_expires_at IS NULL OR NEW.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'INVALID_LEASE' USING ERRCODE='23514'; END IF;
   IF OLD.status='queued' OR NEW.lease_id IS DISTINCT FROM OLD.lease_id THEN
     IF OLD.status='running' AND OLD.lease_expires_at>clock_timestamp() THEN RAISE EXCEPTION 'LEASE_STILL_HELD' USING ERRCODE='23514'; END IF;
     IF NEW.attempt_count<>OLD.attempt_count+1 THEN RAISE EXCEPTION 'ATTEMPT_MISMATCH' USING ERRCODE='23514'; END IF;
   ELSIF NEW.attempt_count<>OLD.attempt_count OR OLD.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'LEASE_EXPIRED' USING ERRCODE='23514';
   END IF;
 ELSIF NEW.attempt_count<>OLD.attempt_count OR (OLD.status='running' AND NEW.status<>'cancelled' AND OLD.lease_expires_at<=clock_timestamp()) THEN
   RAISE EXCEPTION 'LEASE_OR_ATTEMPT_MISMATCH' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER job_transition BEFORE UPDATE ON ml.analysis_jobs FOR EACH ROW EXECUTE FUNCTION ml.job_transition_guard();

CREATE FUNCTION ml.job_result_consistency() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE target uuid; state text; present boolean;
BEGIN
 IF TG_TABLE_NAME='analysis_jobs' THEN target:=NEW.id; ELSE target:=NEW.job_id; END IF;
 SELECT status INTO state FROM ml.analysis_jobs WHERE id=target;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT EXISTS(SELECT 1 FROM ml.analysis_results WHERE job_id=target) INTO present;
 IF (state='succeeded')<>present THEN RAISE EXCEPTION 'JOB_RESULT_MISMATCH' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER job_result AFTER INSERT OR UPDATE ON ml.analysis_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ml.job_result_consistency();
CREATE CONSTRAINT TRIGGER result_job AFTER INSERT OR UPDATE ON ml.analysis_results DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ml.job_result_consistency();
CREATE FUNCTION ml.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'SCIENTIFIC_RECORD_IMMUTABLE' USING ERRCODE='42501'; END $$;
CREATE TRIGGER evaluation_run_immutable BEFORE UPDATE OR DELETE ON ml.evaluation_runs FOR EACH ROW EXECUTE FUNCTION ml.reject_mutation();
CREATE TRIGGER evaluation_metric_immutable BEFORE UPDATE OR DELETE ON ml.evaluation_metrics FOR EACH ROW EXECUTE FUNCTION ml.reject_mutation();
-- UPDATE de un resultado no está permitido; DELETE por CASCADE de la foto sí.
CREATE TRIGGER analysis_result_immutable BEFORE UPDATE ON ml.analysis_results FOR EACH ROW EXECUTE FUNCTION ml.reject_mutation();
-- No worker ni RPC se habilita aquí. Una función futura debe comprobar lease_id,
-- propietario/autorización vigentes, modelo evaluado y commit de resultado+estado.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ml FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
