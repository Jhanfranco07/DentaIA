-- FASE 3. Solo QA local, después de 01–04 y 08. No modifica filas de Auth.
BEGIN;
DO $$ BEGIN IF current_database() NOT LIKE 'dentaia_arch_qa_%' OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED'; END IF; END $$;

CREATE FUNCTION clinical_service.grant_access(p_id uuid,p_membership_id uuid,p_encounter_ids uuid[],p_expires_at timestamptz,p_policy_version text,p_accepted boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_request uuid:=gen_random_uuid(); v_identity jsonb; v_config jsonb:=clinical_service.configuration();
 v_actor uuid; v_other uuid; v_patient uuid; v_ctx jsonb; v_existing clinical.clinical_access_grants;
 v_resources uuid[]; v_stored uuid[]; v_count integer; v_granted timestamptz; v_exists boolean;
BEGIN
 SELECT p.user_id INTO v_other FROM clinical.clinic_memberships m JOIN clinical.professional_accounts p ON p.id=m.professional_id WHERE m.id=p_membership_id;
 v_identity:=clinical_service.identity_context(v_other);
 IF NOT coalesce((v_identity->>'ok')::boolean,false) THEN RETURN clinical_service.reject_request(v_request,NULL,NULL,'grant_access','SESSION_INVALID',401); END IF;
 v_actor:=(v_identity->>'userId')::uuid;
 IF NOT coalesce((v_config->>'enabled')::boolean,false) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','SERVICE_DISABLED',503); END IF;
 IF NOT(v_identity->'roles' @> '["paciente"]'::jsonb) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','ROLE_REQUIRED'); END IF;
 IF p_id IS NULL OR p_membership_id IS NULL OR p_encounter_ids IS NULL OR cardinality(p_encounter_ids) NOT BETWEEN 1 AND (v_config->>'maxResources')::integer
  OR array_position(p_encounter_ids,NULL) IS NOT NULL OR p_accepted IS DISTINCT FROM true OR p_expires_at IS NULL OR NOT isfinite(p_expires_at) THEN
  RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','INVALID_INPUT',400);
 END IF;
 SELECT array_agg(DISTINCT x ORDER BY x) INTO v_resources FROM unnest(p_encounter_ids) x;
 IF cardinality(v_resources)<>cardinality(p_encounter_ids) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','DUPLICATE_RESOURCE',400); END IF;
 IF nullif(v_config->>'policyVersion','') IS NULL OR nullif(v_config->>'purpose','') IS NULL OR p_policy_version IS DISTINCT FROM v_config->>'policyVersion' THEN
  RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','POLICY_NOT_APPROVED');
 END IF;
 -- Serializa la misma clave incluso cuando la reclaman pacientes distintos.
 PERFORM pg_advisory_xact_lock(hashtextextended('dentaia.clinical.grant:'||p_id::text,0));
 SELECT id INTO v_patient FROM clinical.patient_records WHERE user_id=v_actor AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','PATIENT_UNAVAILABLE'); END IF;
 v_ctx:=clinical_service.lock_context(p_membership_id,v_other);
 IF NOT coalesce((v_identity->>'recipientEligible')::boolean,false) OR NOT coalesce((v_ctx->>'ok')::boolean,false) THEN
  RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','RECIPIENT_UNAVAILABLE');
 END IF;
 -- No se bloquean recursos de otro paciente ni se revela su existencia.
 PERFORM id FROM clinical.clinical_encounters WHERE id=ANY(v_resources) AND patient_id=v_patient ORDER BY id FOR SHARE;
 SELECT count(*) INTO v_count FROM clinical.clinical_encounters WHERE id=ANY(v_resources) AND patient_id=v_patient;
 IF v_count<>cardinality(v_resources) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','RESOURCE_NOT_OWNED'); END IF;
 SELECT * INTO v_existing FROM clinical.clinical_access_grants WHERE id=p_id FOR UPDATE;
 v_exists:=FOUND;
 IF NOT clinical_service.session_current(v_identity) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','SESSION_EXPIRED',401); END IF;
 IF NOT EXISTS(SELECT 1 FROM clinical.clinic_memberships WHERE id=p_membership_id AND status='active' AND valid_from<=clock_timestamp() AND (valid_until IS NULL OR valid_until>clock_timestamp())) THEN
  RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','RECIPIENT_EXPIRED');
 END IF;
 IF v_exists THEN
  SELECT array_agg(encounter_id ORDER BY encounter_id) INTO v_stored FROM clinical.clinical_grant_resources WHERE grant_id=p_id;
  IF v_existing.patient_id<>v_patient OR v_existing.membership_id<>p_membership_id OR v_existing.expires_at<>p_expires_at
   OR v_existing.policy_version<>p_policy_version OR v_existing.purpose<>v_config->>'purpose' OR v_stored IS DISTINCT FROM v_resources THEN
   RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','KEY_CONFLICT',409);
  END IF;
  PERFORM clinical_service.audit_event(v_request,v_actor,v_patient,p_membership_id,p_id,'grant_access','allowed','IDEMPOTENT_REPLAY');
  RETURN jsonb_build_object('ok',true,'status',200,'id',p_id,'estado',CASE WHEN v_existing.revoked_at IS NOT NULL THEN 'revocado' WHEN v_existing.expires_at<=clock_timestamp() THEN 'vencido' ELSE 'vigente' END,
    'expiresAt',v_existing.expires_at,'revokedAt',v_existing.revoked_at,'requestId',v_request,'replayed',true);
 END IF;
 IF p_expires_at<=clock_timestamp() OR ((v_config->>'maxGrantSeconds') IS NOT NULL AND p_expires_at>clock_timestamp()+make_interval(secs=>(v_config->>'maxGrantSeconds')::integer)) THEN
  RETURN clinical_service.reject_request(v_request,v_actor,NULL,'grant_access','INVALID_EXPIRY',400);
 END IF;
 INSERT INTO clinical.clinical_access_grants(id,patient_id,membership_id,purpose,policy_version,expires_at)
 VALUES(p_id,v_patient,p_membership_id,v_config->>'purpose',p_policy_version,p_expires_at) RETURNING granted_at INTO v_granted;
 INSERT INTO clinical.clinical_grant_resources(grant_id,encounter_id) SELECT p_id,x FROM unnest(v_resources) x;
 PERFORM clinical_service.audit_event(v_request,v_actor,v_patient,p_membership_id,p_id,'grant_access','allowed','GRANTED');
 RETURN jsonb_build_object('ok',true,'status',201,'id',p_id,'estado','vigente','expiresAt',p_expires_at,'revokedAt',NULL,'requestId',v_request,'replayed',false);
END $$;
ALTER FUNCTION clinical_service.grant_access(uuid,uuid,uuid[],timestamptz,text,boolean) OWNER TO dentaia_clinical_executor;

CREATE FUNCTION clinical_service.revoke_access(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_request uuid:=gen_random_uuid(); v_identity jsonb; v_actor uuid; v_patient uuid; v_grant clinical.clinical_access_grants;
BEGIN
 v_identity:=clinical_service.identity_context();
 IF NOT coalesce((v_identity->>'ok')::boolean,false) THEN RETURN clinical_service.reject_request(v_request,NULL,NULL,'revoke_access','SESSION_INVALID',401); END IF;
 v_actor:=(v_identity->>'userId')::uuid;
 IF p_id IS NULL THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'revoke_access','INVALID_INPUT',400); END IF;
 -- Una cuenta vigente conserva la capacidad de revocar su propio permiso aunque
 -- cambie su rol o se desactiven nuevas concesiones; nunca revoca por otro paciente.
 SELECT id INTO v_patient FROM clinical.patient_records WHERE user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'revoke_access','NOT_OWNER'); END IF;
 SELECT * INTO v_grant FROM clinical.clinical_access_grants WHERE id=p_id AND patient_id=v_patient FOR UPDATE;
 IF NOT FOUND THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'revoke_access','NOT_OWNER'); END IF;
 IF NOT clinical_service.session_current(v_identity) THEN RETURN clinical_service.reject_request(v_request,v_actor,NULL,'revoke_access','SESSION_EXPIRED',401); END IF;
 IF v_grant.revoked_at IS NULL THEN
  UPDATE clinical.clinical_access_grants SET revoked_at=clock_timestamp() WHERE id=p_id RETURNING revoked_at INTO v_grant.revoked_at;
 END IF;
 PERFORM clinical_service.audit_event(v_request,v_actor,v_patient,v_grant.membership_id,p_id,'revoke_access','allowed','REVOKED');
 RETURN jsonb_build_object('ok',true,'status',200,'id',p_id,'revokedAt',v_grant.revoked_at,'requestId',v_request);
END $$;
ALTER FUNCTION clinical_service.revoke_access(uuid) OWNER TO dentaia_clinical_executor;

CREATE FUNCTION public.grant_clinical_access(p_id uuid,p_membership_id uuid,p_encounter_ids uuid[],p_expires_at timestamptz,p_policy_version text,p_accepted boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN RETURN clinical_service.grant_access(p_id,p_membership_id,p_encounter_ids,p_expires_at,p_policy_version,p_accepted);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLINICAL_OPERATION_UNAVAILABLE' USING ERRCODE='P0001'; END $$;
CREATE FUNCTION public.revoke_clinical_access(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN RETURN clinical_service.revoke_access(p_id);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLINICAL_OPERATION_UNAVAILABLE' USING ERRCODE='P0001'; END $$;

REVOKE ALL ON FUNCTION clinical_service.grant_access(uuid,uuid,uuid[],timestamptz,text,boolean),clinical_service.revoke_access(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.grant_clinical_access(uuid,uuid,uuid[],timestamptz,text,boolean),public.revoke_clinical_access(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA clinical_service TO authenticated;
GRANT EXECUTE ON FUNCTION clinical_service.grant_access(uuid,uuid,uuid[],timestamptz,text,boolean),clinical_service.revoke_access(uuid),
 public.grant_clinical_access(uuid,uuid,uuid[],timestamptz,text,boolean),public.revoke_clinical_access(uuid) TO authenticated;
COMMIT;
