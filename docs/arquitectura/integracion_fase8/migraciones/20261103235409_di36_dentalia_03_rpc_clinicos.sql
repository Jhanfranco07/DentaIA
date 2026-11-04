-- FASE 8: PROPUESTA. Requiere respaldo verificado y aprobación final externa.
-- No aplicar por db push. GUC de aprobación es una guarda operativa, NO prueba criptográfica del proyecto.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
DO $fase8$ DECLARE signature text; BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'TRUSTED_MIGRATION_OPERATOR_REQUIRED'; END IF;
 IF current_database()='postgres' THEN
  IF current_setting('dentaia.integration_target',true) IS DISTINCT FROM 'vwmdknzjyvmsdqpepykz'
   OR current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_final_approved' THEN
   RAISE EXCEPTION 'EXPLICIT_TARGET_AND_FINAL_APPROVAL_REQUIRED'; END IF;
 ELSIF current_database()='dentaia_arch_qa_fase8' THEN
  IF current_setting('dentaia.integration_approval',true) IS DISTINCT FROM 'fase8_local_simulation'
   OR (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'DENTAIA_PHASE8_SYNTHETIC_ONLY'
  THEN RAISE EXCEPTION 'LOCAL_SIMULATION_MARKER_REQUIRED'; END IF;
 ELSE RAISE EXCEPTION 'TARGET_DATABASE_NOT_APPROVED'; END IF;
 SELECT f.fingerprint INTO signature FROM (SELECT md5(jsonb_build_object(
'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'ordinal',ordinal_position,'type',data_type,'nullable',is_nullable,'default',column_default) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid,true)) ORDER BY c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
'indexes',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
'formatted',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
'acl',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'acl',c.relacl) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
'columnAcl',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'acl',a.attacl) ORDER BY c.relname,a.attname) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
'policies',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) ORDER BY tablename,policyname) FROM pg_policies WHERE schemaname='public')
)::text) AS fingerprint) f;
 IF signature IS DISTINCT FROM '2aea91388f533f07548047d93acf2ebf' THEN RAISE EXCEPTION 'PUBLIC_SCHEMA_DRIFT_ABORT'; END IF;
END $fase8$;
DO $$ BEGIN IF to_regnamespace('clinical_service') IS NOT NULL THEN RAISE EXCEPTION 'CLINICAL_SERVICE_ALREADY_EXISTS'; END IF; END $$;
-- FASE 3. BORRADOR SOLO QA LOCAL. No modifica Auth, DI-151 ni esquemas de IA.

DO $$ BEGIN
 -- Atestación de destino y huella en la guarda Fase 8 exterior.
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dentaia_clinical_executor') THEN
  CREATE ROLE dentaia_clinical_executor NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dentaia_clinical_executor' AND (rolcanlogin OR rolsuper OR rolbypassrls))
  OR pg_has_role('anon','dentaia_clinical_executor','MEMBER') OR pg_has_role('authenticated','dentaia_clinical_executor','MEMBER') OR pg_has_role('service_role','dentaia_clinical_executor','MEMBER') OR pg_has_role('authenticator','dentaia_clinical_executor','MEMBER') THEN
  RAISE EXCEPTION 'UNSAFE_EXECUTOR_ROLE';
 END IF;
END $$;
GRANT dentaia_clinical_executor TO postgres;
CREATE SCHEMA clinical_service;
REVOKE ALL ON SCHEMA clinical_service FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE,CREATE ON SCHEMA clinical_service TO dentaia_clinical_executor;
GRANT USAGE ON SCHEMA clinical TO dentaia_clinical_executor;

-- Sin tabla nueva ni secretos/configuración controlados por el cliente.
-- El operador debe aprobar/reemplazar esta función; por defecto no hay lectura ni concesión.
CREATE FUNCTION clinical_service.configuration() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT '{"enabled":false,"policyVersion":null,"purpose":null,"maxGrantSeconds":null,"maxResources":100,"maxPage":50,"maxNested":100}'::jsonb;
$$;

CREATE FUNCTION clinical_service.valid_assignment(assignment jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF jsonb_typeof(assignment) IS DISTINCT FROM 'object' OR assignment->'version' IS DISTINCT FROM '1'::jsonb
  OR assignment->>'estado' IS DISTINCT FROM 'activo' OR jsonb_typeof(assignment->'roles') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(assignment->'roles') NOT BETWEEN 1 AND 3 THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(assignment->'roles') r(v) WHERE jsonb_typeof(v)<>'string' OR v#>>'{}' NOT IN ('paciente','odontologo','superusuario'))
  AND (SELECT count(*)=count(DISTINCT v) FROM jsonb_array_elements(assignment->'roles') r(v));
END $$;

-- Única frontera elevada de identidad: lectura/locks de Auth, sin escrituras ni credenciales.
-- Permanece propiedad de postgres, privada y no ejecutable por clientes.
CREATE FUNCTION clinical_service.identity_context(other_user uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; sid uuid; claims jsonb:=auth.jwt(); u record; actor_data record; actor_found boolean:=false; recipient_ok boolean:=false; expires numeric; session_ok boolean;
BEGIN
 BEGIN
  actor:=auth.uid(); sid:=(claims->>'session_id')::uuid; expires:=(claims->>'exp')::numeric;
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN '{"ok":false}'::jsonb; END;
 IF actor IS NULL OR sid IS NULL OR expires IS NULL OR expires<=extract(epoch FROM clock_timestamp())
  OR claims->>'role' IS DISTINCT FROM 'authenticated' THEN RETURN '{"ok":false}'::jsonb; END IF;
 -- Auth UUID ordenado antes de sesión y datos clínicos; compatible con el orden de DI-151.
 FOR u IN SELECT id,aud,is_anonymous,confirmed_at,deleted_at,banned_until,raw_app_meta_data
  FROM auth.users WHERE id=actor OR id=other_user ORDER BY id FOR SHARE LOOP
  IF u.id=actor THEN actor_data:=u; actor_found:=true; END IF;
  IF u.id=other_user THEN
   recipient_ok:=u.aud='authenticated' AND NOT u.is_anonymous AND u.confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
    AND clinical_service.valid_assignment(u.raw_app_meta_data->'dentaia')
    AND u.raw_app_meta_data->'dentaia'->'roles' @> '["odontologo"]'::jsonb;
  END IF;
 END LOOP;
 IF NOT actor_found THEN RETURN '{"ok":false}'::jsonb; END IF;
 IF actor_data.aud IS DISTINCT FROM 'authenticated' OR actor_data.is_anonymous IS DISTINCT FROM false
  OR actor_data.confirmed_at IS NULL OR actor_data.deleted_at IS NOT NULL OR actor_data.banned_until>clock_timestamp()
  OR NOT clinical_service.valid_assignment(actor_data.raw_app_meta_data->'dentaia') THEN RETURN '{"ok":false}'::jsonb; END IF;
 SELECT true INTO session_ok FROM auth.sessions WHERE id=sid AND user_id=actor
  AND (not_after IS NULL OR not_after>clock_timestamp()) FOR SHARE;
 IF session_ok IS DISTINCT FROM true THEN RETURN '{"ok":false}'::jsonb; END IF;
 RETURN jsonb_build_object('ok',true,'userId',actor,'sessionId',sid,'exp',expires,
  'roles',actor_data.raw_app_meta_data->'dentaia'->'roles','recipientEligible',coalesce(recipient_ok,false));
END $$;

CREATE FUNCTION clinical_service.session_current(identity jsonb) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((identity->>'ok')::boolean,false)
  AND (identity->>'exp')::numeric>extract(epoch FROM clock_timestamp())
  AND auth.uid()=(identity->>'userId')::uuid
  AND EXISTS(SELECT 1 FROM auth.sessions WHERE id=(identity->>'sessionId')::uuid AND user_id=(identity->>'userId')::uuid AND (not_after IS NULL OR not_after>clock_timestamp()));
$$;

GRANT SELECT ON clinical.clinics,clinical.professional_accounts,clinical.clinic_memberships,
 clinical.patient_records,clinical.clinical_encounters,clinical.clinical_entries,
 clinical.clinical_access_grants,clinical.clinical_grant_resources TO dentaia_clinical_executor;
GRANT SELECT(id,professional_id,decision,reviewed_at) ON clinical.professional_verifications TO dentaia_clinical_executor;
GRANT SELECT(id,encounter_id,kind,title,exam_date,availability) ON clinical.clinical_documents TO dentaia_clinical_executor;
GRANT SELECT(id,full_name) ON public.profiles TO dentaia_clinical_executor;
-- PostgreSQL exige UPDATE de al menos una columna para SELECT FOR SHARE/UPDATE.
-- No hay RPC para editar estas identidades; no se conceden privilegios al usuario.
GRANT UPDATE(id) ON clinical.clinics,clinical.professional_accounts,clinical.clinic_memberships,
 clinical.patient_records,clinical.clinical_encounters TO dentaia_clinical_executor;
GRANT INSERT ON clinical.clinical_access_grants,clinical.clinical_grant_resources,clinical.clinical_access_audit TO dentaia_clinical_executor;
GRANT UPDATE(revoked_at) ON clinical.clinical_access_grants TO dentaia_clinical_executor;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['clinics','professional_accounts','professional_verifications','clinic_memberships','patient_records','clinical_encounters','clinical_entries','clinical_documents','clinical_access_grants','clinical_grant_resources'] LOOP
  EXECUTE format('CREATE POLICY clinical_executor_select ON clinical.%I FOR SELECT TO dentaia_clinical_executor USING (true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['clinics','professional_accounts','clinic_memberships','patient_records','clinical_encounters','clinical_access_grants'] LOOP
  EXECUTE format('CREATE POLICY clinical_executor_lock ON clinical.%I FOR UPDATE TO dentaia_clinical_executor USING (true) WITH CHECK (true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['clinical_access_grants','clinical_grant_resources','clinical_access_audit'] LOOP
  EXECUTE format('CREATE POLICY clinical_executor_insert ON clinical.%I FOR INSERT TO dentaia_clinical_executor WITH CHECK (true)',t);
 END LOOP;
END $$;
CREATE POLICY clinical_executor_provenance ON public.profiles FOR SELECT TO dentaia_clinical_executor USING(true);

CREATE FUNCTION clinical_service.audit_event(request_id uuid,actor_id uuid,patient_id uuid,context_id uuid,grant_id uuid,operation text,outcome text,reason text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 BEGIN
  INSERT INTO clinical.clinical_access_audit(request_id,actor_user_id,patient_id,membership_id,grant_id,operation,outcome,reason_code)
  VALUES(request_id,actor_id,patient_id,context_id,grant_id,operation,outcome,reason);
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLINICAL_AUDIT_UNAVAILABLE' USING ERRCODE='P0001'; END;
END $$;
ALTER FUNCTION clinical_service.audit_event(uuid,uuid,uuid,uuid,uuid,text,text,text) OWNER TO dentaia_clinical_executor;

CREATE FUNCTION clinical_service.reject_request(request_id uuid,actor_id uuid,context_id uuid,operation text,reason text,status integer DEFAULT 403) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM clinical_service.audit_event(request_id,actor_id,NULL,context_id,NULL,operation,'denied',reason);
 RETURN jsonb_build_object('ok',false,'status',status,'code',CASE status WHEN 400 THEN 'INVALID_REQUEST' WHEN 401 THEN 'AUTHENTICATION_REQUIRED' WHEN 409 THEN 'IDEMPOTENCY_CONFLICT' WHEN 503 THEN 'SERVICE_UNAVAILABLE' ELSE 'ACCESS_DENIED' END,'requestId',request_id);
END $$;
ALTER FUNCTION clinical_service.reject_request(uuid,uuid,uuid,text,text,integer) OWNER TO dentaia_clinical_executor;

CREATE FUNCTION clinical_service.lock_context(member_id uuid,expected_user uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE m record; decision text;
BEGIN
 -- Primero profesional/clínica, después membresía; todas son consultas propias internas.
 FOR m IN SELECT p.id AS professional_id,c.id AS clinic_id,p.status AS professional_status,c.status AS clinic_status,p.user_id
  FROM clinical.clinic_memberships x JOIN clinical.professional_accounts p ON p.id=x.professional_id JOIN clinical.clinics c ON c.id=x.clinic_id
  WHERE x.id=member_id ORDER BY p.id,c.id FOR SHARE OF p,c LOOP
  IF m.user_id<>expected_user OR m.professional_status<>'verified' OR m.clinic_status<>'active' THEN RETURN '{"ok":false}'::jsonb; END IF;
  SELECT v.decision INTO decision FROM clinical.professional_verifications v WHERE v.professional_id=m.professional_id ORDER BY v.reviewed_at DESC,v.id DESC LIMIT 1;
  IF decision IS DISTINCT FROM 'approved' THEN RETURN '{"ok":false}'::jsonb; END IF;
  PERFORM 1 FROM clinical.clinic_memberships WHERE id=member_id AND status='active' AND valid_from<=clock_timestamp() AND (valid_until IS NULL OR valid_until>clock_timestamp()) FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false}'::jsonb; END IF;
  RETURN jsonb_build_object('ok',true,'membershipId',member_id,'professionalId',m.professional_id,'clinicId',m.clinic_id);
 END LOOP;
 RETURN '{"ok":false}'::jsonb;
END $$;
ALTER FUNCTION clinical_service.lock_context(uuid,uuid) OWNER TO dentaia_clinical_executor;

-- Una verificación nueva debe excluir las lecturas que validaron la anterior.
-- Complementa 04 sin reescribirlo. No concede capacidad de verificar profesionales.
CREATE FUNCTION clinical_service.verification_parent_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN PERFORM id FROM clinical.professional_accounts WHERE id=NEW.professional_id FOR UPDATE; RETURN NEW; END $$;
CREATE TRIGGER verification_context_lock BEFORE INSERT ON clinical.professional_verifications FOR EACH ROW EXECUTE FUNCTION clinical_service.verification_parent_lock();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA clinical_service FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION clinical_service.configuration(),clinical_service.identity_context(uuid),clinical_service.session_current(jsonb),clinical_service.verification_parent_lock() TO dentaia_clinical_executor;
GRANT EXECUTE ON FUNCTION clinical.resource_patient_check(),clinical.identity_immutable() TO dentaia_clinical_executor;

-- FASE 3. Solo QA local, después de 01–04 y 08. No modifica filas de Auth.



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

-- FASE 3. Solo QA local. Consulta auditada; no carga clínica, descargas ni IA.



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
