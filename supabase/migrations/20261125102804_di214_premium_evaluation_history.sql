
BEGIN;

-- DI-36 supplies the clinical executor and its identity, relationship and audit RPCs.
-- Vault is only needed when a real, approved provider is ready to ingest.
DO $$
BEGIN
  IF to_regclass('public.premium_subscriptions') IS NULL
    OR to_regclass('public.dental_photos') IS NULL
    OR to_regprocedure('extensions.hmac(bytea,bytea,text)') IS NULL
    OR to_regprocedure('clinical_service.identity_context(uuid)') IS NULL
    OR to_regprocedure('clinical_service.lock_context(uuid,uuid)') IS NULL
    OR to_regprocedure('storage.allow_only_operation(text)') IS NULL THEN
    RAISE EXCEPTION 'DI214_PREREQUISITES_MISSING';
  END IF;
END $$;

CREATE TABLE clinical.premium_history_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('premium_history_results', 'premium_history_photo_link')),
  version text NOT NULL CHECK (version = 'di214.v1'),
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz CHECK (revoked_at >= accepted_at),
  UNIQUE (user_id, id)
);
CREATE UNIQUE INDEX premium_history_active_consent
  ON clinical.premium_history_consents (user_id, purpose) WHERE revoked_at IS NULL;

CREATE TABLE clinical.premium_evaluations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  evaluated_at timestamptz NOT NULL,
  capture_protocol text CHECK (capture_protocol = 'frontal_intraoral_v1'),
  result_consent_id uuid NOT NULL,
  photo_consent_id uuid,
  photo_id uuid REFERENCES public.dental_photos(id) ON DELETE SET NULL,
  photo_object_id uuid,
  photo_digest text CHECK (photo_digest ~ '^[a-f0-9]{64}$'),
  result jsonb,
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, result_consent_id) REFERENCES clinical.premium_history_consents(user_id,id),
  FOREIGN KEY (user_id, photo_consent_id) REFERENCES clinical.premium_history_consents(user_id,id),
  CHECK (photo_id IS NULL OR (photo_consent_id IS NOT NULL AND photo_object_id IS NOT NULL AND photo_digest IS NOT NULL)),
  CHECK ((result IS NULL) = (deleted_at IS NOT NULL)),
  CHECK (deleted_at IS NULL OR (photo_id IS NULL AND photo_consent_id IS NULL)),
  CHECK (result IS NULL OR (
    jsonb_typeof(result) = 'object' AND octet_length(result::text) <= 131072
    AND (result->>'schema_version' = 'dentaia.premium-vision-result.v1') IS TRUE
    AND (result#>>'{provider,id}' = 'rf-detr-premium') IS TRUE
    AND (result#>>'{evaluation,status}' IN ('evaluated','evaluated_no_detections','partially_evaluated',
      'not_evaluable','provider_unavailable','processing_error')) IS TRUE
  ))
);
CREATE FUNCTION clinical.clear_premium_photo_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.photo_id IS NULL THEN
    NEW.photo_object_id:=NULL;
    NEW.photo_digest:=NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION clinical.clear_premium_photo_binding() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION clinical.clear_premium_photo_binding() TO dentaia_clinical_executor;
CREATE TRIGGER premium_photo_binding BEFORE UPDATE OF photo_id ON clinical.premium_evaluations
  FOR EACH ROW EXECUTE FUNCTION clinical.clear_premium_photo_binding();

CREATE INDEX premium_evaluations_history ON clinical.premium_evaluations (user_id, evaluated_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX premium_evaluations_photo ON clinical.premium_evaluations (photo_id) WHERE photo_id IS NOT NULL;

-- Scope extension for existing grants. No independent membership, expiry or clinical grant.
CREATE TABLE clinical.premium_grant_evaluations (
  grant_id uuid NOT NULL REFERENCES clinical.clinical_access_grants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  evaluation_id uuid NOT NULL,
  share_photo boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (grant_id,user_id,evaluation_id),
  FOREIGN KEY (user_id,evaluation_id) REFERENCES clinical.premium_evaluations(user_id,id) ON DELETE CASCADE
);
CREATE INDEX premium_grant_evaluations_lookup ON clinical.premium_grant_evaluations (user_id,evaluation_id);

DO $$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['premium_history_consents','premium_evaluations','premium_grant_evaluations'] LOOP
    EXECUTE format('ALTER TABLE clinical.%I ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format('REVOKE ALL ON clinical.%I FROM PUBLIC, anon, authenticated, service_role', relation);
    EXECUTE format('GRANT SELECT, INSERT ON clinical.%I TO dentaia_clinical_executor', relation);
    EXECUTE format('CREATE POLICY premium_executor_select ON clinical.%I FOR SELECT TO dentaia_clinical_executor USING (true)', relation);
    EXECUTE format('CREATE POLICY premium_executor_insert ON clinical.%I FOR INSERT TO dentaia_clinical_executor WITH CHECK (true)', relation);
    EXECUTE format('CREATE POLICY premium_executor_update ON clinical.%I FOR UPDATE TO dentaia_clinical_executor USING (true) WITH CHECK (true)', relation);
  END LOOP;
END $$;
GRANT UPDATE (revoked_at) ON clinical.premium_history_consents TO dentaia_clinical_executor;
GRANT UPDATE (result,capture_protocol,photo_id,photo_consent_id,deleted_at) ON clinical.premium_evaluations TO dentaia_clinical_executor;
GRANT UPDATE (share_photo) ON clinical.premium_grant_evaluations TO dentaia_clinical_executor;
GRANT DELETE ON clinical.premium_grant_evaluations TO dentaia_clinical_executor;
CREATE POLICY premium_executor_delete ON clinical.premium_grant_evaluations FOR DELETE TO dentaia_clinical_executor USING (true);

GRANT SELECT (user_id,status,current_period_end) ON public.premium_subscriptions TO dentaia_clinical_executor;
CREATE POLICY premium_history_executor_plan ON public.premium_subscriptions FOR SELECT TO dentaia_clinical_executor USING (user_id=auth.uid());
GRANT SELECT (id,user_id,consent_id,object_path,mime_type,size_bytes) ON public.dental_photos TO dentaia_clinical_executor;
GRANT SELECT (id,user_id,revoked_at) ON public.patient_consents TO dentaia_clinical_executor;
CREATE POLICY premium_history_executor_photos ON public.dental_photos FOR SELECT TO dentaia_clinical_executor USING (true);
CREATE POLICY premium_history_executor_photo_consent ON public.patient_consents FOR SELECT TO dentaia_clinical_executor USING (true);

-- The verifier needs to read one Vault entry. It exposes no key and has no client grant.
CREATE FUNCTION clinical_service.premium_ingest_proof(payload text, signature text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret_value text; expected bytea;
BEGIN
  IF auth.uid() IS NULL OR payload IS NULL OR octet_length(payload)>132000
    OR signature IS NULL OR signature !~ '^[a-f0-9]{64}$'
    OR to_regclass('vault.decrypted_secrets') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1'
    INTO STRICT secret_value USING 'di214_premium_ingest_v1';
  IF secret_value IS NULL OR secret_value !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  expected := extensions.hmac(convert_to(payload,'UTF8'), decode(secret_value,'hex'), 'sha256');
  -- Compare only MAC digests. PostgreSQL bytea equality has no constant-time guarantee.
  RETURN extensions.digest(expected,'sha256') = extensions.digest(decode(signature,'hex'),'sha256');
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION clinical_service.premium_ingest_proof(text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION clinical_service.premium_ingest_proof(text,text) TO dentaia_clinical_executor;
GRANT USAGE ON SCHEMA extensions TO dentaia_clinical_executor;

GRANT CREATE ON SCHEMA clinical_service TO dentaia_clinical_executor;

CREATE FUNCTION clinical_service.premium_photo_reference(photo uuid, owner_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('path',p.object_path,'mime',p.mime_type,'size',p.size_bytes)
  FROM public.dental_photos p JOIN public.patient_consents c ON c.id=p.consent_id AND c.user_id=p.user_id
  WHERE p.id=photo AND p.user_id=owner_id AND c.revoked_at IS NULL
    AND p.object_path ~ ('^' || owner_id::text || '/' || c.id::text || '/[a-zA-Z0-9_.-]+$')
    AND split_part(p.object_path,'/',3) NOT IN ('.','..')
$$;

CREATE FUNCTION clinical_service.premium_history(
  action text, target uuid, member uuid, evaluation_id uuid, grant_id uuid, args jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
#variable_conflict use_variable
DECLARE
  identity jsonb; actor uuid; owner_id uuid; recipient uuid; patient uuid; cfg jsonb; trace uuid:=gen_random_uuid();
  patient_mode boolean:=target IS NULL; premium boolean; row_eval clinical.premium_evaluations;
  grant_row clinical.clinical_access_grants; consent_result uuid; consent_photo uuid; photo uuid; object_id uuid; digest text;
  page jsonb; data jsonb; payload jsonb; operation text; requested_purpose text; reference jsonb;
  anchor_at timestamptz; now_at timestamptz:=clock_timestamp(); valid_from timestamptz; evaluated timestamptz;
BEGIN
  identity:=clinical_service.identity_context();
  IF identity->>'ok' IS DISTINCT FROM 'true' THEN RETURN jsonb_build_object('ok',false,'status',401,'requestId',trace); END IF;
  actor:=(identity->>'userId')::uuid;
  cfg:=clinical_service.configuration();
  IF cfg->>'enabled' IS DISTINCT FROM 'true' THEN RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace); END IF;
  IF args IS NULL OR jsonb_typeof(args)<>'object' OR octet_length(args::text)>272000 THEN
    RETURN jsonb_build_object('ok',false,'status',400,'requestId',trace);
  END IF;

  IF action='photo' AND evaluation_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'status',400,'requestId',trace);
  END IF;

  IF patient_mode THEN
    IF member IS NOT NULL OR NOT (identity->'roles' @> '["paciente"]') THEN
      RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace);
    END IF;
    owner_id:=actor;
    SELECT r.id INTO patient FROM clinical.patient_records r WHERE r.user_id=actor AND r.status='active';
    SELECT EXISTS (SELECT 1 FROM public.premium_subscriptions s
      WHERE s.user_id=actor AND s.status='active' AND s.current_period_end>clock_timestamp()) INTO premium;
    -- Privacy controls remain available after subscription expiry.
    IF NOT premium AND action IN ('save','consent_accept','share') THEN
      RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace);
    END IF;
  ELSE
    operation:=CASE WHEN action='photo' THEN 'read_document' ELSE 'read_history' END;
    IF action NOT IN ('list','photo') OR grant_id IS NOT NULL OR member IS NULL
      OR NOT (identity->'roles' @> '["odontologo"]')
      OR clinical_service.lock_context(member,actor)->>'ok' IS DISTINCT FROM 'true' THEN
      RETURN clinical_service.reject_request(trace,actor,NULL,operation,'PREMIUM_CONTEXT_DENIED');
    END IF;
    patient:=target;
    SELECT r.user_id INTO owner_id FROM clinical.patient_records r WHERE r.id=patient AND r.status='active' FOR SHARE;
    PERFORM g.id FROM clinical.clinical_access_grants g
      WHERE g.patient_id=patient AND g.membership_id=member AND g.revoked_at IS NULL
        AND g.granted_at<=clock_timestamp() AND g.expires_at>clock_timestamp()
        AND g.purpose=cfg->>'purpose' AND g.policy_version=cfg->>'policyVersion'
        AND EXISTS (SELECT 1 FROM clinical.clinical_grant_resources x JOIN clinical.clinical_encounters e ON e.id=x.encounter_id
          WHERE x.grant_id=g.id AND e.patient_id=patient AND e.status='recorded')
      ORDER BY g.id FOR SHARE;
    IF owner_id IS NULL OR NOT FOUND THEN
      RETURN clinical_service.reject_request(trace,actor,member,operation,'PREMIUM_GRANT_REQUIRED');
    END IF;
  END IF;

  IF action IN ('consent_accept','consent_revoke','save','delete','share','unshare') THEN
    -- All writes for this owner, including a retry and consent withdrawal, serialize.
    PERFORM pg_advisory_xact_lock(hashtextextended('di214:'||actor::text,0));
    now_at:=clock_timestamp();
  END IF;

  IF action IN ('consent_accept','consent_revoke') THEN
    requested_purpose:=args->>'purpose';
    IF requested_purpose IS NULL OR requested_purpose NOT IN ('premium_history_results','premium_history_photo_link')
      OR (action='consent_accept' AND (args->>'version' IS DISTINCT FROM 'di214.v1' OR args->'accepted' IS DISTINCT FROM 'true'::jsonb)) THEN
      RETURN jsonb_build_object('ok',false,'status',400,'requestId',trace);
    END IF;
    IF action='consent_accept' THEN
      INSERT INTO clinical.premium_history_consents(user_id,purpose,version) VALUES(actor,requested_purpose,'di214.v1')
        ON CONFLICT (user_id,purpose) WHERE revoked_at IS NULL DO NOTHING;
    ELSE
      UPDATE clinical.premium_history_consents c SET revoked_at=now_at
        WHERE c.user_id=actor AND c.purpose=requested_purpose AND c.revoked_at IS NULL;
      IF requested_purpose='premium_history_photo_link' THEN
        UPDATE clinical.premium_evaluations e SET photo_id=NULL,photo_consent_id=NULL WHERE e.user_id=actor AND e.photo_consent_id IS NOT NULL;
      END IF;
    END IF;

  ELSIF action='save' THEN
    IF NOT clinical_service.premium_ingest_proof(args->>'payload',args->>'signature') THEN
      RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace);
    END IF;
    payload:=(args->>'payload')::jsonb;
    valid_from:=(payload->>'issuedAt')::timestamptz;
    evaluated:=(payload->>'evaluatedAt')::timestamptz;
    IF evaluated IS NULL OR evaluated>now_at+interval '5 seconds' OR evaluated<now_at-interval '1 day'
      OR payload->>'userId' IS DISTINCT FROM actor::text OR valid_from IS NULL
      OR valid_from>now_at+interval '5 seconds' OR valid_from<now_at-interval '120 seconds'
      OR payload->>'id' IS DISTINCT FROM evaluation_id::text OR evaluation_id IS NULL
      OR jsonb_typeof(payload->'result') IS DISTINCT FROM 'object' THEN
      RETURN jsonb_build_object('ok',false,'status',400,'requestId',trace);
    END IF;
    photo:=(payload->>'photoId')::uuid;
    SELECT c.id INTO consent_result FROM clinical.premium_history_consents c
      WHERE c.user_id=actor AND c.purpose='premium_history_results' AND c.revoked_at IS NULL
        AND c.id=(payload->>'resultConsentId')::uuid;
    IF photo IS NOT NULL THEN
      object_id:=(payload->>'photoObjectId')::uuid;
      digest:=payload->>'photoDigest';
      SELECT c.id INTO consent_photo FROM clinical.premium_history_consents c
        WHERE c.user_id=actor AND c.purpose='premium_history_photo_link' AND c.revoked_at IS NULL
          AND c.id=(payload->>'photoConsentId')::uuid;
    END IF;
    IF consent_result IS NULL OR (photo IS NOT NULL AND (consent_photo IS NULL OR object_id IS NULL OR digest IS NULL OR digest !~ '^[a-f0-9]{64}$'
      OR clinical_service.premium_photo_reference(photo,actor) IS NULL)) THEN
      RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace);
    END IF;
    SELECT * INTO row_eval FROM clinical.premium_evaluations e WHERE e.user_id=actor AND e.id=evaluation_id;
    IF FOUND THEN
      IF row_eval.result IS DISTINCT FROM payload->'result' OR row_eval.evaluated_at IS DISTINCT FROM evaluated
        OR row_eval.capture_protocol IS DISTINCT FROM payload->>'captureProtocol'
        OR row_eval.result_consent_id<>consent_result
        OR row_eval.photo_id IS DISTINCT FROM photo OR row_eval.photo_consent_id IS DISTINCT FROM consent_photo
        OR row_eval.photo_object_id IS DISTINCT FROM object_id OR row_eval.photo_digest IS DISTINCT FROM digest THEN
        RETURN jsonb_build_object('ok',false,'status',409,'requestId',trace);
      END IF;
    ELSE
      INSERT INTO clinical.premium_evaluations(user_id,id,evaluated_at,capture_protocol,result_consent_id,photo_consent_id,photo_id,photo_object_id,photo_digest,result)
        VALUES(actor,evaluation_id,evaluated,payload->>'captureProtocol',consent_result,consent_photo,photo,object_id,digest,payload->'result');
    END IF;
    data:=jsonb_build_object('id',evaluation_id);

  ELSIF action IN ('share','unshare','delete') THEN
    SELECT * INTO row_eval FROM clinical.premium_evaluations e WHERE e.user_id=actor AND e.id=evaluation_id AND e.deleted_at IS NULL;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace); END IF;
    IF action='delete' THEN
      DELETE FROM clinical.premium_grant_evaluations x WHERE x.user_id=actor AND x.evaluation_id=evaluation_id;
      UPDATE clinical.premium_evaluations e SET result=NULL,capture_protocol=NULL,photo_id=NULL,photo_consent_id=NULL,deleted_at=now_at
        WHERE e.user_id=actor AND e.id=evaluation_id;
    ELSE
      SELECT g.* INTO grant_row FROM clinical.clinical_access_grants g WHERE g.id=grant_id AND g.patient_id=patient FOR SHARE;
      IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace); END IF;
      IF action='unshare' THEN
        DELETE FROM clinical.premium_grant_evaluations x WHERE x.user_id=actor AND x.evaluation_id=evaluation_id AND x.grant_id=grant_id;
      ELSE
        SELECT a.user_id INTO recipient FROM clinical.clinic_memberships m
          JOIN clinical.professional_accounts a ON a.id=m.professional_id WHERE m.id=grant_row.membership_id;
        IF recipient IS NULL OR clinical_service.lock_context(grant_row.membership_id,recipient)->>'ok' IS DISTINCT FROM 'true'
          OR args->'accepted' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(args->'photo') IS DISTINCT FROM 'boolean'
          OR grant_row.revoked_at IS NOT NULL OR grant_row.granted_at>clock_timestamp() OR grant_row.expires_at<=clock_timestamp()
          OR grant_row.purpose IS DISTINCT FROM cfg->>'purpose' OR grant_row.policy_version IS DISTINCT FROM cfg->>'policyVersion'
          OR NOT EXISTS (SELECT 1 FROM clinical.premium_history_consents c WHERE c.id=row_eval.result_consent_id AND c.revoked_at IS NULL)
          OR ((args->>'photo')::boolean AND (clinical_service.premium_photo_reference(row_eval.photo_id,actor) IS NULL
            OR NOT EXISTS (SELECT 1 FROM clinical.premium_history_consents c WHERE c.id=row_eval.photo_consent_id AND c.revoked_at IS NULL))) THEN
          RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace);
        END IF;
        INSERT INTO clinical.premium_grant_evaluations(grant_id,user_id,evaluation_id,share_photo)
          VALUES(grant_id,actor,evaluation_id,(args->>'photo')::boolean)
          ON CONFLICT ON CONSTRAINT premium_grant_evaluations_pkey DO UPDATE SET share_photo=excluded.share_photo;
      END IF;
      PERFORM clinical_service.audit_event(trace,actor,patient,grant_row.membership_id,grant_id,
        CASE WHEN action='share' THEN 'grant_access' ELSE 'revoke_access' END,'allowed','PREMIUM_SCOPE_CHANGED');
    END IF;

  ELSIF action IN ('list','photo') THEN
    PERFORM pg_advisory_xact_lock_shared(hashtextextended('di214:'||owner_id::text,0));
    IF evaluation_id IS NOT NULL AND action='list' THEN
      anchor_at:=(args->>'before')::timestamptz;
      IF anchor_at IS NULL THEN RETURN jsonb_build_object('ok',false,'status',400,'requestId',trace); END IF;
    END IF;
    WITH visible AS (
      SELECT e.*,
        clinical_service.premium_photo_reference(e.photo_id,e.user_id) AS ref,
        EXISTS (SELECT 1 FROM clinical.premium_history_consents c WHERE c.id=e.photo_consent_id AND c.revoked_at IS NULL) AS photo_consent,
        EXISTS (SELECT 1 FROM clinical.premium_history_consents c WHERE c.id=e.result_consent_id AND c.revoked_at IS NULL) AS result_consent,
        shares.ids, shares.photos
      FROM clinical.premium_evaluations e
      CROSS JOIN LATERAL (
        SELECT coalesce(jsonb_agg(x.grant_id ORDER BY x.grant_id),'[]'::jsonb) AS ids, coalesce(bool_or(x.share_photo),false) AS photos
        FROM clinical.premium_grant_evaluations x JOIN clinical.clinical_access_grants g ON g.id=x.grant_id
        WHERE x.user_id=e.user_id AND x.evaluation_id=e.id AND (patient_mode OR (
          g.membership_id=member AND g.patient_id=patient AND g.revoked_at IS NULL AND g.granted_at<=clock_timestamp()
          AND g.expires_at>clock_timestamp() AND g.purpose=cfg->>'purpose' AND g.policy_version=cfg->>'policyVersion'
          AND EXISTS (SELECT 1 FROM clinical.clinical_grant_resources z JOIN clinical.clinical_encounters a ON a.id=z.encounter_id
            WHERE z.grant_id=g.id AND a.patient_id=patient AND a.status='recorded')
        ))
      ) shares
      WHERE e.user_id=owner_id AND e.deleted_at IS NULL
        AND (action<>'photo' OR e.id=evaluation_id)
        AND (anchor_at IS NULL OR (e.evaluated_at,e.id)<(anchor_at,evaluation_id))
        AND (patient_mode OR (shares.ids<>'[]'::jsonb AND EXISTS (
          SELECT 1 FROM clinical.premium_history_consents c WHERE c.id=e.result_consent_id AND c.revoked_at IS NULL)))
      ORDER BY e.evaluated_at DESC,e.id DESC LIMIT 21
    )
    SELECT jsonb_agg(jsonb_build_object('id',v.id,'date',v.evaluated_at,'result',v.result,'captureProtocol',v.capture_protocol,
             'photo',v.photo_consent AND v.ref IS NOT NULL AND (patient_mode OR v.photos),
             'shares',CASE WHEN patient_mode THEN v.ids ELSE '[]'::jsonb END,
             'shareable',patient_mode AND premium AND v.result_consent)
           ORDER BY v.evaluated_at DESC,v.id DESC),
           (array_agg(v.ref || jsonb_build_object('digest',v.photo_digest)) FILTER (WHERE v.photo_consent AND (patient_mode OR v.photos)))[1]
      INTO page,reference FROM visible v;
    IF action='photo' THEN
      IF reference IS NULL THEN RETURN jsonb_build_object('ok',false,'status',403,'requestId',trace); END IF;
      data:=reference;
    ELSE
      data:=jsonb_build_object('items',coalesce(page,'[]'::jsonb),'premium',coalesce(premium,false),
        'consents',CASE WHEN patient_mode THEN coalesce((SELECT jsonb_object_agg(c.purpose,c.id)
          FROM clinical.premium_history_consents c WHERE c.user_id=actor AND c.revoked_at IS NULL),'{}'::jsonb) ELSE '{}'::jsonb END);
    END IF;
    IF NOT patient_mode THEN
      PERFORM clinical_service.audit_event(trace,actor,patient,member,NULL,operation,'allowed','PREMIUM_HISTORY_AUTHORIZED');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok',false,'status',400,'requestId',trace);
  END IF;
  IF NOT clinical_service.session_current(identity) THEN RAISE EXCEPTION 'PREMIUM_SESSION_EXPIRED' USING ERRCODE='28000'; END IF;
  RETURN jsonb_build_object('ok',true,'status',200,'requestId',trace,'data',coalesce(data,'{}'::jsonb));
EXCEPTION
  WHEN invalid_authorization_specification THEN
    RETURN jsonb_build_object('ok',false,'status',401,'requestId',trace);
  WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
    RETURN jsonb_build_object('ok',false,'status',400,'requestId',trace);
  WHEN OTHERS THEN
    RAISE EXCEPTION 'PREMIUM_HISTORY_UNAVAILABLE' USING ERRCODE='P0001';
END $$;

-- Storage runs the same clinical authorization for a specific shared object. This
-- private definer can only answer for the requesting user's current membership.
CREATE FUNCTION clinical_service.premium_shared_photo_allowed(object_name text, object_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE candidate record; decision jsonb; actor_id uuid;
BEGIN
  actor_id:=(clinical_service.identity_context()->>'userId')::uuid;
  IF actor_id IS NULL THEN RETURN false; END IF;
  FOR candidate IN
    SELECT DISTINCT g.patient_id, g.membership_id, e.id
    FROM public.dental_photos p
    JOIN clinical.premium_evaluations e ON e.photo_id=p.id AND e.photo_object_id=object_id AND e.user_id=p.user_id AND e.deleted_at IS NULL
    JOIN clinical.premium_grant_evaluations x ON x.user_id=e.user_id AND x.evaluation_id=e.id AND x.share_photo
    JOIN clinical.clinical_access_grants g ON g.id=x.grant_id AND g.revoked_at IS NULL AND g.expires_at>clock_timestamp()
    JOIN clinical.clinic_memberships m ON m.id=g.membership_id
    JOIN clinical.professional_accounts a ON a.id=m.professional_id AND a.user_id=actor_id
    WHERE p.object_path=object_name
    ORDER BY g.patient_id,g.membership_id,e.id
  LOOP
    decision:=clinical_service.premium_history('photo',candidate.patient_id,candidate.membership_id,candidate.id,NULL,'{}');
    IF decision->>'ok'='true' AND decision#>>'{data,path}'=object_name THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;

ALTER FUNCTION clinical_service.premium_history(text,uuid,uuid,uuid,uuid,jsonb) OWNER TO dentaia_clinical_executor;
ALTER FUNCTION clinical_service.premium_photo_reference(uuid,uuid) OWNER TO dentaia_clinical_executor;
ALTER FUNCTION clinical_service.premium_shared_photo_allowed(text,uuid) OWNER TO dentaia_clinical_executor;
REVOKE CREATE ON SCHEMA clinical_service FROM dentaia_clinical_executor;

CREATE FUNCTION public.access_premium_history(
  p_action text,p_patient uuid DEFAULT NULL,p_member uuid DEFAULT NULL,p_evaluation uuid DEFAULT NULL,
  p_grant uuid DEFAULT NULL,p_args jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
  SELECT clinical_service.premium_history(p_action,p_patient,p_member,p_evaluation,p_grant,p_args)
$$;

REVOKE ALL ON FUNCTION clinical_service.premium_history(text,uuid,uuid,uuid,uuid,jsonb),
  clinical_service.premium_photo_reference(uuid,uuid),clinical_service.premium_shared_photo_allowed(text,uuid),
  public.access_premium_history(text,uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION clinical_service.premium_history(text,uuid,uuid,uuid,uuid,jsonb),
  clinical_service.premium_shared_photo_allowed(text,uuid),public.access_premium_history(text,uuid,uuid,uuid,uuid,jsonb) TO authenticated;

CREATE POLICY di214_shared_photo_download ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='dental-photos' AND storage.allow_only_operation('object.get_authenticated')
    AND clinical_service.premium_shared_photo_allowed(name,id));

COMMIT;
