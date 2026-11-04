-- SOLO base QA local. Identidades SQL sintéticas; no JWT ni MFA realmente emitidos.
DO $$ BEGIN IF current_database()<>'dentaia_arch_qa_fase2' THEN RAISE EXCEPTION 'QA_ONLY'; END IF; END $$;
CREATE SCHEMA qa;
REVOKE ALL ON SCHEMA qa FROM PUBLIC;
CREATE FUNCTION qa.id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
GRANT USAGE ON SCHEMA qa TO authenticated,anon;
CREATE FUNCTION qa.identity(n integer, app_role text DEFAULT 'paciente') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM set_config('request.jwt.claim.sub',qa.id(n)::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',qa.id(n),'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('dentaia',jsonb_build_object('version',1,'estado','activo','roles',jsonb_build_array(app_role))))::text,true);
END $$;
GRANT EXECUTE ON FUNCTION qa.id(integer),qa.identity(integer,text) TO authenticated,anon;
-- IDs 1/2: pacientes; 3/4: profesionales; 5: profesional sin autorización; 6/7: revisores admin.
INSERT INTO auth.users(id,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT qa.id(n),'authenticated','authenticated',now(),jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'dentaia',jsonb_build_object('version',1,'estado','activo','roles',jsonb_build_array(CASE WHEN n<=2 THEN 'paciente' WHEN n<=5 THEN 'odontologo' ELSE 'superusuario' END))),'{}',now(),now()
FROM generate_series(1,7) n;
INSERT INTO public.profiles(id,full_name) VALUES(qa.id(1),'Paciente QA uno'),(qa.id(2),'Paciente QA dos');
INSERT INTO clinical.clinics(id,name) VALUES(qa.id(11),'Clinica QA uno'),(qa.id(12),'Clinica QA dos');
INSERT INTO clinical.professional_accounts(id,user_id) VALUES(qa.id(23),qa.id(3)),(qa.id(24),qa.id(4)),(qa.id(25),qa.id(5));
INSERT INTO clinical.professional_verifications(id,professional_id,reviewed_by,decision,reference,reason)
SELECT qa.id(300+n),qa.id(20+n),qa.id(6),'approved','QA-SINTETICO','Verificacion de prueba no profesional real' FROM generate_series(3,5)n;
UPDATE clinical.professional_accounts SET status='verified';
INSERT INTO clinical.clinic_memberships(id,clinic_id,professional_id,valid_from) VALUES
 (qa.id(33),qa.id(11),qa.id(23),now()-interval '30 days'),
 (qa.id(34),qa.id(12),qa.id(24),now()-interval '30 days'),
 (qa.id(35),qa.id(11),qa.id(25),now()-interval '30 days');
INSERT INTO clinical.patient_records(id,user_id) VALUES(qa.id(41),qa.id(1)),(qa.id(42),qa.id(2));
INSERT INTO clinical.clinical_encounters(id,patient_id,membership_id,attended_at) VALUES
 (qa.id(51),qa.id(41),qa.id(33),now()-interval '1 day'),
 (qa.id(52),qa.id(41),qa.id(34),now()-interval '1 day'),
 (qa.id(53),qa.id(42),qa.id(34),now()-interval '1 day');
INSERT INTO clinical.clinical_entries(id,encounter_id,kind,information_state,description) VALUES
 (qa.id(61),qa.id(51),'background','recorded','Contenido completamente sintetico QA'),
 (qa.id(62),qa.id(53),'diagnosis','unknown',NULL);
INSERT INTO clinical.clinical_documents(id,encounter_id,kind,title,availability) VALUES(qa.id(65),qa.id(51),'exam','Examen ficticio sin archivo','unavailable');
INSERT INTO clinical.clinical_access_grants(id,patient_id,membership_id,purpose,policy_version,granted_at,expires_at,revoked_at) VALUES
 (qa.id(71),qa.id(41),qa.id(34),'qa_test','qa-v1',now()-interval '1 day',now()+interval '1 day',NULL),
 (qa.id(72),qa.id(42),qa.id(33),'qa_test','qa-v1',now()-interval '2 days',now()-interval '1 day',NULL),
 (qa.id(73),qa.id(41),qa.id(33),'qa_test','qa-v1',now()-interval '2 days',now()+interval '1 day',now()-interval '1 day');
INSERT INTO clinical.clinical_grant_resources(grant_id,encounter_id) VALUES(qa.id(71),qa.id(51)),(qa.id(72),qa.id(53)),(qa.id(73),qa.id(52));
INSERT INTO ml.dataset_versions(id,name,version,source_uri,license,permission_reference,manifest_sha256)
 VALUES(qa.id(81),'QA','1','qa://synthetic','QA-only','QA-only',repeat('a',64));
INSERT INTO ml.dataset_items(id,dataset_id,subject_key,object_reference,image_sha256,label,split)
 VALUES(qa.id(82),qa.id(81),'qa-subject','qa://synthetic',repeat('b',64),'qa-label','test');
INSERT INTO ml.model_versions(id,dataset_id,name,version,artifact_uri,artifact_sha256,preprocessing_version,code_commit)
 VALUES(qa.id(83),qa.id(81),'QA-only','1','qa://model',repeat('c',64),'1',repeat('d',40));
INSERT INTO ml.evaluation_runs(id,model_id,dataset_id,sample_size,config,artifact_reference)
 VALUES(qa.id(84),qa.id(83),qa.id(81),2,'{"labels":["qa-a","qa-b"]}','qa://evaluation');
INSERT INTO public.patient_consents(id,user_id,policy_version,consent_text)
 VALUES(qa.id(91),qa.id(1),'qa-v1','Consentimiento completamente sintetico para pruebas QA');
INSERT INTO public.dental_photos(id,user_id,consent_id,object_path,original_filename,mime_type,size_bytes)
 VALUES(qa.id(92),qa.id(1),qa.id(91),qa.id(1)||'/'||qa.id(91)||'/qa.png','qa.png','image/png',100);
INSERT INTO ml.analysis_authorizations(id,owner_user_id,photo_id,policy_version,consent_text,expires_at)
 VALUES(qa.id(93),qa.id(1),qa.id(92),'qa-v1','Autorizacion completamente sintetica de analisis QA',now()+interval '1 day');
INSERT INTO ml.analysis_jobs(id,photo_id,model_id,owner_user_id,authorization_id,idempotency_key)
 VALUES(qa.id(94),qa.id(92),qa.id(83),qa.id(1),qa.id(93),qa.id(95));
