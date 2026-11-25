-- Requiere el paquete clínico DI-36 de Fase 8 y la migración de historial Smile.
BEGIN;
SET LOCAL lock_timeout = '3s';

CREATE TABLE clinical.odontogram_events (
  id uuid PRIMARY KEY,
  encounter_id uuid NOT NULL REFERENCES clinical.clinical_encounters(id) ON DELETE RESTRICT,
  replaces_id uuid UNIQUE,
  correction_reason text,
  note text,
  tooth integer,
  surface text,
  condition text,
  phase text,
  analysis_id uuid,
  observation_key text,
  decision text,
  source_meta jsonb,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((tooth IS NULL AND surface IS NULL AND condition IS NULL AND phase IS NULL)
    OR (tooth IS NOT NULL AND condition IS NOT NULL AND phase IS NOT NULL
        AND tooth::text ~ '^[1-4][1-8]$')),
  CHECK ((replaces_id IS NULL AND correction_reason IS NULL) OR (replaces_id IS NOT NULL AND correction_reason IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 1 AND 300)),
  CHECK ((tooth IS NULL AND note IS NULL AND replaces_id IS NULL) OR (tooth IS NOT NULL AND note IS NOT NULL AND length(note) <= 1000 AND (condition <> 'nota' OR length(btrim(note)) > 0))),
  CHECK (surface IS NULL OR (condition IN ('caries','fractura','restauracion','nota') AND (
    surface IN ('mesial','distal','vestibular')
    OR (surface = 'palatina' AND tooth < 30) OR (surface = 'lingual' AND tooth > 30)
    OR (surface = 'incisal' AND tooth % 10 <= 3) OR (surface = 'oclusal' AND tooth % 10 > 3)))),
  CHECK (condition IS NULL OR (condition IN ('caries','fractura','ausencia','nota') AND phase = 'hallazgo')
    OR (condition IN ('restauracion','endodoncia','protesis','implante','extraccion') AND phase IN ('planificado','realizado'))),
  UNIQUE (id, encounter_id),
  FOREIGN KEY (replaces_id, encounter_id) REFERENCES clinical.odontogram_events(id, encounter_id),
  CHECK ((analysis_id IS NULL) = (source_meta IS NULL)),
  CHECK ((analysis_id IS NULL AND observation_key IS NULL AND decision IS NULL AND tooth IS NOT NULL)
    OR (analysis_id IS NOT NULL AND observation_key IS NOT NULL AND observation_key ~ '^region:[1-9][0-9]{0,8}$'
      AND decision IS NOT NULL AND ((decision IN ('accepted','corrected') AND tooth IS NOT NULL)
        OR (decision = 'dismissed' AND tooth IS NULL))))
);
CREATE INDEX odontogram_encounter ON clinical.odontogram_events (encounter_id, recorded_at DESC, id DESC);
ALTER TABLE clinical.odontogram_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinical.odontogram_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON clinical.odontogram_events TO dentaia_clinical_executor;
CREATE POLICY odontogram_executor_read ON clinical.odontogram_events FOR SELECT TO dentaia_clinical_executor USING (true);
CREATE POLICY odontogram_executor_insert ON clinical.odontogram_events FOR INSERT TO dentaia_clinical_executor WITH CHECK (true);

-- Frontera interna de Smile: bloquea las filas de consentimiento y concesión durante la operación.
-- Se devuelve el mínimo necesario al BFF, nunca al cliente de datos de Supabase directamente.
CREATE FUNCTION clinical_service.odontogram_smile(p_owner uuid, p_professional uuid, p_analysis uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'date', s.analyzed_at, 'version', s.engine_version,
    'result', coalesce(s.technical_result->'result',s.technical_result) - 'overlay_url' - 'oral_analysis', 'path', s.original_object_path) ORDER BY s.analyzed_at DESC, s.id), '[]'::jsonb)
  FROM (
    SELECT a.id, a.analyzed_at, a.engine_version, a.technical_result, a.original_object_path
    FROM public.smile_analyses a
    JOIN public.smile_analysis_consents c ON c.id = a.consent_id AND c.patient_id = a.patient_id
    JOIN public.smile_analysis_access_grants g ON g.analysis_id = a.id AND g.patient_id = a.patient_id
    JOIN clinical.professional_accounts p ON p.id = g.professional_id
    WHERE a.patient_id = p_owner AND p.id = p_professional AND p.user_id = auth.uid()
      AND p.status = 'verified' AND (p_analysis IS NULL OR a.id = p_analysis)
      AND a.status = 'completed' AND a.deleted_at IS NULL
      AND c.purpose = 'smile_analysis_storage' AND c.revoked_at IS NULL AND c.accepted_at <= clock_timestamp()
      AND g.revoked_at IS NULL AND g.granted_at <= clock_timestamp() AND g.expires_at > clock_timestamp()
    ORDER BY a.analyzed_at DESC, a.id LIMIT 12 FOR SHARE OF a,c,g
  ) s;
$$;
REVOKE ALL ON FUNCTION clinical_service.odontogram_smile(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION clinical_service.odontogram_smile(uuid,uuid,uuid) TO dentaia_clinical_executor;

GRANT CREATE ON SCHEMA clinical_service TO dentaia_clinical_executor;
CREATE FUNCTION clinical_service.odontogram(p_patient uuid, p_membership uuid, p_id uuid, p_payload jsonb, p_photo uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE
  request_id uuid := gen_random_uuid();
  actor uuid;
  operation text := CASE WHEN p_id IS NOT NULL THEN 'register_clinical' WHEN p_photo IS NOT NULL THEN 'read_document' ELSE 'read_history' END;
  config jsonb := clinical_service.configuration();
  identity jsonb;
  ctx jsonb;
  owner_id uuid;
  grant_ids uuid[] := ARRAY[]::uuid[];
  encounter_ids uuid[];
  g record;
  encounter uuid;
  existing clinical.odontogram_events%ROWTYPE;
  request_hash bytea;
  rec jsonb;
  review jsonb;
  source jsonb;
  result_json jsonb;
  region_key text;
  analysis uuid;
  replaces uuid;
  model_rows jsonb := '[]'::jsonb;
  output jsonb;
BEGIN
  IF config->>'enabled' IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('ok',false,'status',503,'requestId',request_id);
  END IF;
  identity := clinical_service.identity_context();
  IF identity->>'ok' IS DISTINCT FROM 'true' THEN
    RETURN clinical_service.reject_request(request_id,actor,NULL,operation,'INVALID_SESSION',401);
  END IF;
  actor := (identity->>'userId')::uuid;
  IF NOT (identity->'roles' @> '["odontologo"]'::jsonb) THEN
    RETURN clinical_service.reject_request(request_id,actor,NULL,operation,'ROLE_REQUIRED');
  END IF;
  ctx := clinical_service.lock_context(p_membership, actor);
  IF ctx->>'ok' IS DISTINCT FROM 'true' THEN
    RETURN clinical_service.reject_request(request_id,actor,NULL,operation,'CONTEXT_UNAVAILABLE');
  END IF;
  SELECT user_id INTO owner_id FROM clinical.patient_records WHERE id = p_patient AND status = 'active' FOR SHARE;
  IF owner_id IS NULL OR owner_id = actor THEN
    RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'NO_AUTHORIZED_SCOPE');
  END IF;
  FOR g IN SELECT id FROM clinical.clinical_access_grants
    WHERE patient_id = p_patient AND membership_id = p_membership AND revoked_at IS NULL
      AND granted_at <= clock_timestamp() AND expires_at > clock_timestamp()
      AND purpose = config->>'purpose' AND policy_version = config->>'policyVersion'
    ORDER BY id FOR SHARE LOOP
    grant_ids := array_append(grant_ids,g.id);
  END LOOP;
  SELECT array_agg(DISTINCT r.encounter_id) INTO encounter_ids
    FROM clinical.clinical_grant_resources r JOIN clinical.clinical_encounters e ON e.id = r.encounter_id
    WHERE r.grant_id = ANY(grant_ids) AND e.patient_id = p_patient;
  IF encounter_ids IS NULL THEN
    RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'NO_AUTHORIZED_SCOPE');
  END IF;

  IF p_id IS NOT NULL THEN
    IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text) > 8192 THEN
      RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'INVALID_INPUT',400);
    END IF;
    request_hash := sha256(convert_to(p_payload::text,'UTF8'));
    encounter := (p_payload->>'encounterId')::uuid;
    PERFORM 1 FROM clinical.clinical_encounters e WHERE e.id = encounter AND e.id = ANY(encounter_ids)
      AND e.patient_id = p_patient AND e.membership_id = p_membership AND e.status = 'recorded'
      AND NOT EXISTS (SELECT 1 FROM clinical.clinical_encounters x WHERE x.replaces_id = e.id) FOR UPDATE;
    IF NOT FOUND THEN
      RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'NO_WRITE_SCOPE');
    END IF;
    rec := nullif(p_payload->'record', 'null'::jsonb);
    review := nullif(p_payload->'review', 'null'::jsonb);
    IF (rec IS NULL AND review IS NULL) OR (rec IS NOT NULL AND jsonb_typeof(rec) <> 'object')
      OR (review IS NOT NULL AND jsonb_typeof(review) <> 'object') THEN
      RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'INVALID_INPUT',400);
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_patient::text || ':' || p_membership::text, 213));
    SELECT * INTO existing FROM clinical.odontogram_events WHERE id = p_id;
    IF FOUND THEN
      IF existing.encounter_id <> encounter OR existing.request_hash IS DISTINCT FROM request_hash THEN
        RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'WRITE_CONFLICT',409);
      END IF;
    ELSE
      IF review IS NOT NULL THEN
        analysis := (review->>'analysisId')::uuid;
        region_key := review->>'key';
        source := clinical_service.odontogram_smile(owner_id,(ctx->>'professionalId')::uuid,analysis)->0;
        result_json := coalesce(source->'result'->'result',source->'result');
        IF analysis IS NULL OR source IS NULL OR region_key IS NULL OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(result_json->'regions') = 'array'
            THEN result_json->'regions' ELSE '[]'::jsonb END) r
          WHERE 'region:' || (r->>'region_id') = region_key AND r->'evaluable' = 'true'::jsonb
            AND r->>'level' IN ('Leve','Moderado','Intenso')
        ) THEN
          RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'NO_OBSERVATION_SCOPE');
        END IF;
        IF EXISTS (SELECT 1 FROM clinical.odontogram_events v JOIN clinical.clinical_encounters e ON e.id=v.encounter_id
          WHERE e.patient_id=p_patient AND e.membership_id=p_membership AND v.analysis_id=analysis AND v.observation_key=region_key) THEN
          RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'WRITE_CONFLICT',409);
        END IF;
      END IF;
      IF rec IS NOT NULL THEN
        replaces := (rec->>'replacesId')::uuid;
        IF replaces IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM clinical.odontogram_events v
          WHERE v.id = replaces AND v.tooth IS NOT NULL AND v.encounter_id = encounter)
          OR EXISTS (SELECT 1 FROM clinical.odontogram_events WHERE replaces_id = replaces)) THEN
          RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'WRITE_CONFLICT',409);
        END IF;
        IF jsonb_typeof(rec->'tooth') IS DISTINCT FROM 'number' OR jsonb_typeof(rec->'note') IS DISTINCT FROM 'string'
          OR length(btrim(rec->>'note')) > 1000 OR ((rec->>'condition' = 'nota' OR review IS NOT NULL) AND btrim(rec->>'note') = '')
          OR length(rec->>'correctionReason') > 300 THEN
          RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'INVALID_INPUT',400);
        END IF;
      END IF;
      INSERT INTO clinical.odontogram_events(id,encounter_id,replaces_id,correction_reason,note,tooth,surface,condition,phase,analysis_id,observation_key,decision,source_meta,request_hash)
      VALUES (p_id,encounter,replaces,rec->>'correctionReason',btrim(rec->>'note'),(rec->>'tooth')::integer,rec->>'surface',rec->>'condition',rec->>'phase',
        analysis,region_key,review->>'decision',CASE WHEN source IS NOT NULL THEN jsonb_build_object(
          'date',source->'date','engine','Smile V17','engineVersion',source->'version','model',result_json->'model',
          'limitations',(SELECT coalesce(jsonb_agg(left(value,500)),'[]'::jsonb) FROM (
            SELECT value FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(result_json->'limitations')='array'
              THEN result_json->'limitations' ELSE '[]'::jsonb END) LIMIT 12
          ) limited)) END,request_hash);
    END IF;
    output := jsonb_build_object('id',p_id);
  ELSIF p_photo IS NOT NULL THEN
    source := clinical_service.odontogram_smile(owner_id,(ctx->>'professionalId')::uuid,p_photo)->0;
    IF source->>'path' IS NULL THEN
      RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'NO_PHOTO_SCOPE');
    END IF;
    output := jsonb_build_object('path',source->>'path');
  ELSE
    model_rows := clinical_service.odontogram_smile(owner_id,(ctx->>'professionalId')::uuid);
    output := jsonb_build_object(
      'patientId',p_patient,'patientName',(SELECT full_name FROM public.profiles WHERE id=owner_id),
      'encounters',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'date',e.attended_at,
        'editable',e.membership_id=p_membership AND e.status='recorded' AND NOT EXISTS (
          SELECT 1 FROM clinical.clinical_encounters x WHERE x.replaces_id=e.id)) ORDER BY e.attended_at DESC,e.id)
        FROM clinical.clinical_encounters e WHERE e.id = ANY(encounter_ids)), '[]'::jsonb),
      'records',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'encounterId',v.encounter_id,'tooth',v.tooth,
        'surface',v.surface,'condition',v.condition,'phase',v.phase,'note',v.note,
        'replacesId',v.replaces_id,'correctionReason',v.correction_reason,'recordedAt',v.recorded_at,'author',pr.full_name,
        'active',e.status='recorded' AND NOT EXISTS(SELECT 1 FROM clinical.clinical_encounters x WHERE x.replaces_id=e.id)
          AND NOT EXISTS(SELECT 1 FROM clinical.odontogram_events x WHERE x.replaces_id=v.id))
        ORDER BY v.recorded_at DESC,v.id) FROM clinical.odontogram_events v
        JOIN clinical.clinical_encounters e ON e.id=v.encounter_id JOIN clinical.clinic_memberships m ON m.id=e.membership_id
        JOIN clinical.professional_accounts p ON p.id=m.professional_id LEFT JOIN public.profiles pr ON pr.id=p.user_id
        WHERE v.encounter_id = ANY(encounter_ids) AND v.tooth IS NOT NULL), '[]'::jsonb),
      'reviews',coalesce((SELECT jsonb_agg(jsonb_build_object('analysisId',v.analysis_id,'key',v.observation_key,
        'decision',v.decision,'entryId',CASE WHEN v.tooth IS NOT NULL THEN v.id END,'recordedAt',v.recorded_at) ORDER BY v.recorded_at DESC,v.id)
        FROM clinical.odontogram_events v JOIN clinical.clinical_encounters e ON e.id=v.encounter_id
        WHERE v.encounter_id=ANY(encounter_ids) AND e.membership_id=p_membership AND v.analysis_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(model_rows) a WHERE a->>'id'=v.analysis_id::text)), '[]'::jsonb),
      'analyses',model_rows);
  END IF;
  -- Si los permisos caducan durante la operación, se revierte cualquier escritura.
  IF NOT clinical_service.session_current(identity) OR EXISTS (
    SELECT 1 FROM clinical.clinical_access_grants WHERE id = ANY(grant_ids) AND expires_at <= clock_timestamp()
  ) OR NOT EXISTS (
    SELECT 1 FROM clinical.clinic_memberships WHERE id=p_membership AND (valid_until IS NULL OR valid_until > clock_timestamp())
  ) THEN
    RAISE EXCEPTION 'ODONTOGRAM_SCOPE_EXPIRED' USING ERRCODE='42501';
  END IF;
  PERFORM clinical_service.audit_event(request_id,actor,p_patient,p_membership,NULL,operation,'allowed','ODONTOGRAM_AUTHORIZED');
  RETURN jsonb_build_object('ok',true,'status',CASE WHEN p_id IS NULL THEN 200 ELSE 201 END,'requestId',request_id,'data',output);
EXCEPTION
  WHEN unique_violation THEN
    RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'WRITE_CONFLICT',409);
  WHEN check_violation OR not_null_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'INVALID_INPUT',400);
  WHEN insufficient_privilege THEN
    RETURN clinical_service.reject_request(request_id,actor,p_membership,operation,'NO_AUTHORIZED_SCOPE');
END;
$$;
ALTER FUNCTION clinical_service.odontogram(uuid,uuid,uuid,jsonb,uuid) OWNER TO dentaia_clinical_executor;
REVOKE CREATE ON SCHEMA clinical_service FROM dentaia_clinical_executor;
REVOKE ALL ON FUNCTION clinical_service.odontogram(uuid,uuid,uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION clinical_service.odontogram(uuid,uuid,uuid,jsonb,uuid) TO authenticated;

CREATE FUNCTION public.access_clinical_odontogram(p_patient uuid, p_membership uuid, p_id uuid DEFAULT NULL, p_payload jsonb DEFAULT NULL, p_photo uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT clinical_service.odontogram(p_patient,p_membership,p_id,p_payload,p_photo);
$$;
REVOKE ALL ON FUNCTION public.access_clinical_odontogram(uuid,uuid,uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.access_clinical_odontogram(uuid,uuid,uuid,jsonb,uuid) TO authenticated;

-- El DTO de la cronología general conserva sus clases originales. El odontograma tiene su propio DTO.
-- Las fotografías originales conservan el bucket privado y se sirven mediante descarga autenticada.
CREATE FUNCTION clinical_service.odontogram_photo_allowed(object_name text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.smile_analyses a JOIN clinical.patient_records r ON r.user_id=a.patient_id AND r.status='active'
    JOIN clinical.clinical_access_grants g ON g.patient_id=r.id
    JOIN clinical.clinical_grant_resources z ON z.grant_id=g.id
    JOIN clinical.clinical_encounters e ON e.id=z.encounter_id AND e.patient_id=r.id
    JOIN clinical.clinic_memberships m ON m.id=g.membership_id
    JOIN clinical.professional_accounts p ON p.id=m.professional_id
    WHERE a.original_object_path=object_name AND a.status='completed' AND a.deleted_at IS NULL AND p.user_id=auth.uid()
      AND object_name LIKE a.patient_id::text || '/%'
      AND g.revoked_at IS NULL AND g.granted_at <= clock_timestamp() AND g.expires_at > clock_timestamp()
      AND g.purpose=clinical_service.configuration()->>'purpose' AND g.policy_version=clinical_service.configuration()->>'policyVersion'
      AND clinical_service.configuration()->>'enabled'='true'
      AND clinical_service.identity_context()->'roles' @> '["odontologo"]'::jsonb
      AND clinical_service.lock_context(m.id,p.user_id)->>'ok'='true'
      AND jsonb_array_length(clinical_service.odontogram_smile(a.patient_id,p.id,a.id))=1
  );
$$;
REVOKE ALL ON FUNCTION clinical_service.odontogram_photo_allowed(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION clinical_service.odontogram_photo_allowed(text) TO authenticated;
CREATE POLICY odontogram_smile_photo ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='smile-analysis-private' AND storage.allow_only_operation('object.get_authenticated') AND clinical_service.odontogram_photo_allowed(name));

COMMIT;
