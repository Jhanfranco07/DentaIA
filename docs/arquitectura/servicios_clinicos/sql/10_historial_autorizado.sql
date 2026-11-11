-- FASE 3. Solo QA local. Consulta auditada; no carga clínica, descargas ni IA.
BEGIN;
DO $$ BEGIN IF current_database() NOT LIKE 'dentaia_arch_qa_%' OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED'; END IF; END $$;

CREATE FUNCTION clinical_service.read_history(p_patient_id uuid,p_membership_id uuid,p_limit integer,p_before_at timestamptz,p_before_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_request uuid:=gen_random_uuid(); v_identity jsonb; v_config jsonb:=clinical_service.configuration();
 v_actor uuid; v_owner uuid; v_own boolean:=false; v_ctx jsonb; v_member uuid; v_grants uuid[]:=ARRAY[]::uuid[];
 v_ids uuid[]; v_more boolean:=false; v_payload jsonb; v_next jsonb:=NULL; v_g uuid; v_used uuid[]; v_cursor record;
BEGIN
 v_identity:=clinical_service.identity_context();
 IF NOT coalesce((v_identity->>'ok')::boolean,false) THEN RETURN clinical_service.reject_request(v_request,NULL,NULL,'read_history','SESSION_INVALID',401); END IF;
 v_actor:=(v_identity->>'userId')::uuid;
 IF NOT coalesce((v_config->>'enabled')::boolean,false) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'read_history','SERVICE_DISABLED',503); END IF;
 IF p_patient_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND (v_config->>'maxPage')::integer
  OR (p_before_at IS NULL)<>(p_before_id IS NULL) OR (p_before_at IS NOT NULL AND NOT isfinite(p_before_at)) THEN
  RETURN clinical_service.reject_request(v_request,v_actor,NULL,'read_history','INVALID_INPUT',400);
 END IF;
 SELECT user_id INTO v_owner FROM clinical.patient_records WHERE id=p_patient_id AND status='active' FOR SHARE;
 v_own:=v_owner=v_actor AND v_identity->'roles' @> '["paciente"]'::jsonb;
 IF coalesce(v_own,false) THEN
  IF p_membership_id IS NOT NULL THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'read_history','UNEXPECTED_CONTEXT',400); END IF;
 ELSE
  IF NOT(v_identity->'roles' @> '["odontologo"]'::jsonb) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'read_history','ROLE_REQUIRED'); END IF;
  v_ctx:=clinical_service.lock_context(p_membership_id,v_actor);
  IF NOT coalesce((v_ctx->>'ok')::boolean,false) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'read_history','CONTEXT_UNAVAILABLE'); END IF;
  v_member:=p_membership_id;
  IF v_owner IS NULL THEN RETURN clinical_service.reject_request(v_request,v_actor,v_member,'read_history','NO_AUTHORIZED_SCOPE'); END IF;
  -- Bloquear TODAS las concesiones relevantes y unir sus recursos; no LIMIT 1.
  FOR v_g IN SELECT id FROM clinical.clinical_access_grants
   WHERE patient_id=p_patient_id AND membership_id=v_member AND revoked_at IS NULL AND granted_at<=clock_timestamp() AND expires_at>clock_timestamp()
   ORDER BY id FOR SHARE LOOP v_grants:=array_append(v_grants,v_g); END LOOP;
  IF cardinality(v_grants)=0 OR NOT EXISTS(SELECT 1 FROM clinical.clinical_grant_resources WHERE grant_id=ANY(v_grants)) THEN
   RETURN clinical_service.reject_request(v_request,v_actor,v_member,'read_history','NO_AUTHORIZED_SCOPE');
  END IF;
 END IF;
 SELECT array_agg(e.id ORDER BY e.attended_at DESC,e.id DESC) INTO v_ids FROM (
  SELECT x.id,x.attended_at FROM clinical.clinical_encounters x
  WHERE x.patient_id=p_patient_id AND (coalesce(v_own,false) OR EXISTS(
    SELECT 1 FROM clinical.clinical_grant_resources r WHERE r.encounter_id=x.id AND r.grant_id=ANY(v_grants)))
   AND (p_before_at IS NULL OR (x.attended_at,x.id)<(p_before_at,p_before_id))
  ORDER BY x.attended_at DESC,x.id DESC LIMIT p_limit+1
 ) e;
 v_ids:=coalesce(v_ids,ARRAY[]::uuid[]); v_more:=cardinality(v_ids)>p_limit; v_ids:=v_ids[1:p_limit];
 IF EXISTS(SELECT 1 FROM clinical.clinical_encounters e WHERE e.id=ANY(v_ids) AND (
  (SELECT count(*) FROM clinical.clinical_entries a WHERE a.encounter_id=e.id)>(v_config->>'maxNested')::integer
  OR (SELECT count(*) FROM clinical.clinical_documents d WHERE d.encounter_id=e.id)>(v_config->>'maxNested')::integer)) THEN
  RETURN clinical_service.reject_request(v_request,v_actor,v_member,'read_history','PAYLOAD_LIMIT',503);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'encounterId',e.id,'attendedAt',e.attended_at,'recordedAt',e.recorded_at,'status',e.status,
  'replacesId',e.replaces_id,'correctionReason',e.correction_reason,
  'origin',jsonb_build_object('clinicId',c.id,'clinicName',c.name,'professionalId',p.id,'professionalName',pr.full_name),
  'background',coalesce((SELECT jsonb_build_object('state',a.information_state,'value',a.description,'entryId',a.id)
    FROM clinical.clinical_entries a WHERE a.encounter_id=e.id AND a.kind='background' AND NOT EXISTS(SELECT 1 FROM clinical.clinical_entries z WHERE z.replaces_id=a.id)
    ORDER BY a.recorded_at DESC,a.id DESC LIMIT 1),'{"state":"not_recorded","value":null}'::jsonb),
  'clinicalEntries',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'state',a.information_state,'value',a.description,'codeSystem',a.code_system,'code',a.code,'recordedAt',a.recorded_at,'replacesId',a.replaces_id,'correctionReason',a.correction_reason) ORDER BY a.recorded_at,a.id) FROM clinical.clinical_entries a WHERE a.encounter_id=e.id),'[]'::jsonb),
  'diagnoses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'state',a.information_state,'value',a.description,'codeSystem',a.code_system,'code',a.code) ORDER BY a.recorded_at,a.id) FROM clinical.clinical_entries a WHERE a.encounter_id=e.id AND a.kind='diagnosis' AND NOT EXISTS(SELECT 1 FROM clinical.clinical_entries z WHERE z.replaces_id=a.id)),'[]'::jsonb),
  'treatments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'state',a.information_state,'value',a.description,'codeSystem',a.code_system,'code',a.code) ORDER BY a.recorded_at,a.id) FROM clinical.clinical_entries a WHERE a.encounter_id=e.id AND a.kind='treatment' AND NOT EXISTS(SELECT 1 FROM clinical.clinical_entries z WHERE z.replaces_id=a.id)),'[]'::jsonb),
  'exams',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'kind',d.kind,'title',d.title,'examDate',d.exam_date,'availability',d.availability) ORDER BY d.id) FROM clinical.clinical_documents d WHERE d.encounter_id=e.id),'[]'::jsonb)
 ) ORDER BY e.attended_at DESC,e.id DESC),'[]'::jsonb) INTO v_payload
 FROM clinical.clinical_encounters e JOIN clinical.clinic_memberships m ON m.id=e.membership_id
 JOIN clinical.clinics c ON c.id=m.clinic_id JOIN clinical.professional_accounts p ON p.id=m.professional_id
 LEFT JOIN public.profiles pr ON pr.id=p.user_id WHERE e.id=ANY(v_ids);
 IF NOT clinical_service.session_current(v_identity) THEN RETURN clinical_service.reject_request(v_request,v_actor,v_member,'read_history','SESSION_EXPIRED',401); END IF;
 IF NOT coalesce(v_own,false) THEN
  IF NOT EXISTS(SELECT 1 FROM clinical.clinic_memberships WHERE id=v_member AND status='active' AND valid_from<=clock_timestamp() AND (valid_until IS NULL OR valid_until>clock_timestamp()))
    OR EXISTS(SELECT 1 FROM clinical.clinical_access_grants WHERE id=ANY(v_grants) AND (revoked_at IS NOT NULL OR expires_at<=clock_timestamp())) THEN
   RETURN clinical_service.reject_request(v_request,v_actor,v_member,'read_history','SCOPE_EXPIRED');
  END IF;
  SELECT array_agg(DISTINCT grant_id ORDER BY grant_id) INTO v_used FROM clinical.clinical_grant_resources WHERE grant_id=ANY(v_grants) AND encounter_id=ANY(v_ids);
 END IF;
 IF v_used IS NULL OR cardinality(v_used)=0 THEN
  PERFORM clinical_service.audit_event(v_request,v_actor,p_patient_id,v_member,NULL,'read_history','allowed','AUTHORIZED');
 ELSE
  FOREACH v_g IN ARRAY v_used LOOP PERFORM clinical_service.audit_event(v_request,v_actor,p_patient_id,v_member,v_g,'read_history','allowed','AUTHORIZED'); END LOOP;
 END IF;
 IF v_more THEN
  SELECT attended_at,id INTO v_cursor FROM clinical.clinical_encounters WHERE id=v_ids[cardinality(v_ids)];
  v_next:=jsonb_build_object('beforeAt',v_cursor.attended_at,'beforeId',v_cursor.id);
 END IF;
 RETURN jsonb_build_object('ok',true,'status',200,'apiVersion','clinical.v1','origen','supabase','environment','qa_local',
  'estado',CASE WHEN jsonb_array_length(v_payload)=0 THEN 'sin_datos' ELSE 'listo' END,
  'caso',jsonb_build_object('patientId',p_patient_id,'professionalContext',v_ctx->'professionalId','clinicContext',v_ctx->'clinicId'),
  'entries',v_payload,'nextCursor',v_next,'requestId',v_request);
END $$;
ALTER FUNCTION clinical_service.read_history(uuid,uuid,integer,timestamptz,uuid) OWNER TO dentaia_clinical_executor;

CREATE FUNCTION public.get_authorized_clinical_history(p_patient_id uuid,p_membership_id uuid DEFAULT NULL,p_limit integer DEFAULT 20,p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN RETURN clinical_service.read_history(p_patient_id,p_membership_id,p_limit,p_before_at,p_before_id);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLINICAL_OPERATION_UNAVAILABLE' USING ERRCODE='P0001'; END $$;
REVOKE ALL ON FUNCTION clinical_service.read_history(uuid,uuid,integer,timestamptz,uuid),public.get_authorized_clinical_history(uuid,uuid,integer,timestamptz,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION clinical_service.read_history(uuid,uuid,integer,timestamptz,uuid),public.get_authorized_clinical_history(uuid,uuid,integer,timestamptz,uuid) TO authenticated;
REVOKE CREATE ON SCHEMA clinical_service FROM dentaia_clinical_executor;
COMMIT;
