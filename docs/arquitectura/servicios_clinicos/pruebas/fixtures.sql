-- Datos exclusivamente sintéticos. Sesiones SQL AAL1; no login HTTP ni MFA simulado como real.
DO $$ BEGIN IF current_database()<>'dentaia_arch_qa_fase3' THEN RAISE EXCEPTION 'QA_ONLY'; END IF; END $$;
CREATE SCHEMA qa3;
REVOKE ALL ON SCHEMA qa3 FROM PUBLIC;
GRANT USAGE ON SCHEMA qa3 TO authenticated;
CREATE FUNCTION qa3.id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; $$;
CREATE FUNCTION qa3.as_user(n integer,seconds integer DEFAULT 3600) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$ BEGIN
 PERFORM set_config('request.jwt.claim.sub',qa3.id(n)::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',qa3.id(n),'role','authenticated','session_id',qa3.id(1000+n),'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+seconds,'aal','aal1')::text,true);
END $$;
GRANT EXECUTE ON FUNCTION qa3.id(integer),qa3.as_user(integer,integer) TO authenticated;
CREATE FUNCTION qa3.expect(r jsonb,expected_status integer,expected_count integer DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$ BEGIN
 ASSERT (r->>'status')::integer=expected_status, 'UNEXPECTED_RPC_STATUS';
 ASSERT (r->>'ok')::boolean=(expected_status BETWEEN 200 AND 299),'UNEXPECTED_RPC_RESULT';
 IF expected_status>=400 THEN ASSERT NOT(r?'entries') AND NOT(r?'caso') AND NOT(r?'patientId'),'DENIAL_LEAK'; END IF;
 IF expected_count IS NOT NULL THEN ASSERT jsonb_array_length(r->'entries')=expected_count,'UNEXPECTED_COUNT'; END IF;
 ASSERT r->>'requestId' IS NOT NULL;
END $$;
GRANT EXECUTE ON FUNCTION qa3.expect(jsonb,integer,integer) TO authenticated;
INSERT INTO auth.users(id,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT qa3.id(n),'authenticated','authenticated',now(),jsonb_build_object('provider','email','dentaia',jsonb_build_object('version',1,'estado','activo','roles',jsonb_build_array(CASE WHEN n<=2 THEN 'paciente' WHEN n<=5 THEN 'odontologo' ELSE 'superusuario' END))),'{}',now(),now() FROM generate_series(1,7)n;
INSERT INTO auth.sessions(id,user_id,aal,not_after,created_at,updated_at)
SELECT qa3.id(1000+n),qa3.id(n),'aal1',now()+interval '1 hour',now(),now() FROM generate_series(1,7)n;
INSERT INTO public.profiles(id,full_name) VALUES(qa3.id(1),'Paciente QA uno'),(qa3.id(2),'Paciente QA dos'),(qa3.id(3),'Profesional QA tres');
INSERT INTO clinical.clinics(id,name) VALUES(qa3.id(11),'Clinica QA uno'),(qa3.id(12),'Clinica QA dos');
INSERT INTO clinical.professional_accounts(id,user_id) VALUES(qa3.id(23),qa3.id(3)),(qa3.id(24),qa3.id(4)),(qa3.id(25),qa3.id(5));
INSERT INTO clinical.professional_verifications(id,professional_id,reviewed_by,decision,reference,reason)
SELECT qa3.id(300+n),qa3.id(20+n),qa3.id(6),'approved','QA-NO-CREDENCIAL','Validacion ficticia, no acreditacion profesional' FROM generate_series(3,5)n;
UPDATE clinical.professional_accounts SET status='verified';
INSERT INTO clinical.clinic_memberships(id,clinic_id,professional_id,valid_from) VALUES
 (qa3.id(33),qa3.id(11),qa3.id(23),now()-interval '30 days'),
 (qa3.id(34),qa3.id(12),qa3.id(24),now()-interval '30 days'),
 (qa3.id(35),qa3.id(11),qa3.id(25),now()-interval '30 days');
INSERT INTO clinical.patient_records(id,user_id) VALUES(qa3.id(41),qa3.id(1)),(qa3.id(42),qa3.id(2));
INSERT INTO clinical.clinical_encounters(id,patient_id,membership_id,attended_at) VALUES
 (qa3.id(51),qa3.id(41),qa3.id(33),now()-interval '2 days'),
 (qa3.id(52),qa3.id(41),qa3.id(34),now()-interval '1 day'),
 (qa3.id(53),qa3.id(42),qa3.id(34),now()-interval '1 day');
INSERT INTO clinical.clinical_entries(id,encounter_id,kind,information_state,description) VALUES
 (qa3.id(61),qa3.id(51),'background','recorded','Antecedente ficticio QA'),
 (qa3.id(62),qa3.id(52),'diagnosis','unknown',NULL),
 (qa3.id(63),qa3.id(53),'treatment','recorded','Contenido ficticio NO COMPARTIDO');
INSERT INTO clinical.clinical_documents(id,encounter_id,kind,title,availability) VALUES(qa3.id(65),qa3.id(51),'exam','Examen ficticio sin archivo','unavailable');
INSERT INTO clinical.clinical_access_grants(id,patient_id,membership_id,purpose,policy_version,granted_at,expires_at,revoked_at) VALUES
 (qa3.id(71),qa3.id(41),qa3.id(34),'academic_shared_history_qa','QA-NO-CLINICO-v1',now()-interval '1 day',now()+interval '1 day',NULL),
 (qa3.id(72),qa3.id(42),qa3.id(33),'academic_shared_history_qa','QA-NO-CLINICO-v1',now()-interval '2 days',now()-interval '1 day',NULL),
 (qa3.id(73),qa3.id(42),qa3.id(34),'academic_shared_history_qa','QA-NO-CLINICO-v1',now()-interval '2 days',now()+interval '1 day',now()-interval '1 day'),
 (qa3.id(74),qa3.id(41),qa3.id(33),'academic_shared_history_qa','QA-NO-CLINICO-v1',now()-interval '1 day',now()+interval '1 day',NULL);
INSERT INTO clinical.clinical_grant_resources VALUES(qa3.id(71),qa3.id(51)),(qa3.id(71),qa3.id(52)),(qa3.id(72),qa3.id(53)),(qa3.id(73),qa3.id(53)),(qa3.id(74),qa3.id(52));
INSERT INTO public.patient_consents(id,user_id,policy_version,consent_text) VALUES(qa3.id(91),qa3.id(2),'qa-v1','Consentimiento fotografico sintetico sin autorizacion clinica');
-- Configuración del operador SOLO en la base QA, no un parámetro del cliente.
CREATE OR REPLACE FUNCTION clinical_service.configuration() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT '{"enabled":true,"policyVersion":"QA-NO-CLINICO-v1","purpose":"academic_shared_history_qa","maxGrantSeconds":86400,"maxResources":100,"maxPage":50,"maxNested":100}'::jsonb;
$$;
