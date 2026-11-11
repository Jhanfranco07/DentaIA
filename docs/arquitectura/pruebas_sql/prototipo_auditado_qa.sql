-- PROTOTIPO EXCLUSIVO DEL BANCO DE PRUEBAS. NO ES UN RPC DE LA APLICACIÓN.
-- No aplicar en Dental-IA. No verifica JWT HTTP: usa auth.uid() de identidades SQL sintéticas.
DO $$ BEGIN IF current_database()<>'dentaia_arch_qa_fase2' THEN RAISE EXCEPTION 'QA_ONLY'; END IF; END $$;
CREATE FUNCTION qa.history(patient uuid, membership uuid, request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); owner uuid; ok boolean:=false; selected_grant uuid; n integer:=0; role_data jsonb; reason text:='NOT_AUTHORIZED';
BEGIN
 SELECT raw_app_meta_data->'dentaia' INTO role_data FROM auth.users
 WHERE id=actor AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL
 AND (banned_until IS NULL OR banned_until<=clock_timestamp()) FOR SHARE;
 IF FOUND AND role_data->>'estado'='activo' AND role_data->>'version'='1' THEN
  SELECT user_id INTO owner FROM clinical.patient_records WHERE id=patient AND status='active' FOR SHARE;
  IF owner=actor THEN
   ok:=true;
  ELSIF (role_data->'roles') ? 'odontologo' THEN
   PERFORM 1 FROM clinical.clinic_memberships m JOIN clinical.professional_accounts p ON p.id=m.professional_id
   JOIN clinical.clinics c ON c.id=m.clinic_id
   WHERE m.id=membership AND p.user_id=actor AND p.status='verified' AND m.status='active' AND c.status='active'
    AND (SELECT v.decision FROM clinical.professional_verifications v WHERE v.professional_id=p.id ORDER BY v.reviewed_at DESC,v.id DESC LIMIT 1)='approved'
    AND m.valid_from<=clock_timestamp() AND (m.valid_until IS NULL OR m.valid_until>clock_timestamp())
   FOR SHARE OF m,p,c;
   IF FOUND THEN
    SELECT g.id INTO selected_grant FROM clinical.clinical_access_grants g
    WHERE g.patient_id=patient AND g.membership_id=membership AND g.revoked_at IS NULL
     AND g.granted_at<=clock_timestamp() AND g.expires_at>clock_timestamp()
    ORDER BY g.id LIMIT 1 FOR SHARE;
    IF FOUND THEN
     -- Revalidar vigencia usando reloj real después de cualquier espera por lock.
     ok:=EXISTS(SELECT 1 FROM clinical.clinical_access_grants WHERE id=selected_grant AND revoked_at IS NULL AND expires_at>clock_timestamp());
    END IF;
   END IF;
  END IF;
 END IF;
 IF ok THEN
  IF owner=actor THEN SELECT count(*) INTO n FROM clinical.clinical_encounters WHERE patient_id=patient;
  ELSE SELECT count(*) INTO n FROM clinical.clinical_grant_resources r JOIN clinical.clinical_encounters e ON e.id=r.encounter_id WHERE r.grant_id=selected_grant AND e.patient_id=patient; END IF;
  reason:='AUTHORIZED';
 END IF;
 IF current_setting('qa.fail_audit',true)='yes' THEN RAISE EXCEPTION 'QA_AUDIT_UNAVAILABLE' USING ERRCODE='58000'; END IF;
 INSERT INTO clinical.clinical_access_audit(request_id,actor_user_id,patient_id,membership_id,grant_id,operation,outcome,reason_code)
 VALUES(request,actor,CASE WHEN ok THEN patient END,CASE WHEN ok AND owner<>actor THEN membership END,CASE WHEN ok THEN selected_grant END,'read_history',CASE WHEN ok THEN 'allowed' ELSE 'denied' END,reason);
 RETURN jsonb_build_object('allowed',ok,'count',CASE WHEN ok THEN n ELSE 0 END,'reason',reason);
END $$;
REVOKE ALL ON FUNCTION qa.history(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qa.history(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION qa.revoke_grant(target uuid, request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE patient uuid; revoked timestamptz; owner uuid; actor uuid:=auth.uid();
BEGIN
 SELECT patient_id INTO patient FROM clinical.clinical_access_grants WHERE id=target;
 SELECT user_id INTO owner FROM clinical.patient_records WHERE id=patient FOR UPDATE;
 IF owner IS DISTINCT FROM actor THEN RAISE EXCEPTION 'QA_NOT_OWNER' USING ERRCODE='42501'; END IF;
 SELECT revoked_at INTO revoked FROM clinical.clinical_access_grants WHERE id=target FOR UPDATE;
 IF revoked IS NULL THEN
  UPDATE clinical.clinical_access_grants SET revoked_at=clock_timestamp() WHERE id=target RETURNING revoked_at INTO revoked;
 END IF;
 IF current_setting('qa.fail_audit',true)='yes' THEN RAISE EXCEPTION 'QA_AUDIT_UNAVAILABLE' USING ERRCODE='58000'; END IF;
 INSERT INTO clinical.clinical_access_audit(request_id,actor_user_id,patient_id,grant_id,operation,outcome,reason_code)
 VALUES(request,actor,patient,target,'revoke_access','allowed','REVOKED');
 RETURN jsonb_build_object('revoked',revoked);
END $$;
REVOKE ALL ON FUNCTION qa.revoke_grant(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qa.revoke_grant(uuid,uuid) TO authenticated;

CREATE FUNCTION qa.grant_access(target uuid, patient uuid, member uuid, encounter uuid, request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid; old clinical.clinical_access_grants;
BEGIN
 SELECT user_id INTO owner FROM clinical.patient_records WHERE id=patient AND status='active' FOR UPDATE;
 IF owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'QA_NOT_OWNER' USING ERRCODE='42501'; END IF;
 SELECT * INTO old FROM clinical.clinical_access_grants WHERE id=target;
 IF FOUND THEN
  IF old.patient_id<>patient OR old.membership_id<>member OR NOT EXISTS(SELECT 1 FROM clinical.clinical_grant_resources WHERE grant_id=target AND encounter_id=encounter)
   OR (SELECT count(*) FROM clinical.clinical_grant_resources WHERE grant_id=target)<>1 THEN
   RAISE EXCEPTION 'QA_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
  END IF;
  RETURN target;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM clinical.clinical_encounters WHERE id=encounter AND patient_id=patient) THEN RAISE EXCEPTION 'QA_WRONG_PATIENT' USING ERRCODE='42501'; END IF;
 INSERT INTO clinical.clinical_access_grants(id,patient_id,membership_id,purpose,policy_version,expires_at)
 VALUES(target,patient,member,'qa_test','qa-v1',clock_timestamp()+interval '1 day');
 INSERT INTO clinical.clinical_grant_resources VALUES(target,encounter);
 INSERT INTO clinical.clinical_access_audit(request_id,actor_user_id,patient_id,grant_id,operation,outcome,reason_code)
 VALUES(request,auth.uid(),patient,target,'grant_access','allowed','GRANTED');
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION qa.grant_access(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION qa.grant_access(uuid,uuid,uuid,uuid,uuid) TO authenticated;
