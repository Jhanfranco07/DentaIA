-- FASE 3. BORRADOR SOLO QA LOCAL. No modifica Auth, DI-151 ni esquemas de IA.
BEGIN;
DO $$ BEGIN
 IF current_database() NOT LIKE 'dentaia_arch_qa_%' OR current_setting('dentaia.architecture_draft',true) IS DISTINCT FROM 'qa_only' THEN RAISE EXCEPTION 'DRAFT_TARGET_NOT_ISOLATED'; END IF;
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
COMMIT;
