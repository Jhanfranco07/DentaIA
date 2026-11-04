-- Solo base postgres del stack CLI local marcado como QA; IDs Auth vienen del SDK local.
DO $$ BEGIN IF current_database()<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='dentaia_http_qa' AND obj_description(oid,'pg_namespace')='DENTAIA_PHASE4_SYNTHETIC_ONLY') THEN RAISE EXCEPTION 'HTTP_QA_ONLY'; END IF; END $$;
BEGIN;
CREATE OR REPLACE FUNCTION dentaia_http_qa.id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; $$;
INSERT INTO public.profiles(id,full_name) VALUES('{{patient1}}','Paciente HTTP QA uno'),('{{patient2}}','Paciente HTTP QA dos'),('{{dentist1}}','Profesional HTTP QA uno') ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name;
INSERT INTO clinical.clinics(id,name) VALUES(dentaia_http_qa.id(11),'Clinica HTTP QA uno'),(dentaia_http_qa.id(12),'Clinica HTTP QA dos') ON CONFLICT DO NOTHING;
INSERT INTO clinical.professional_accounts(id,user_id) VALUES(dentaia_http_qa.id(23),'{{dentist1}}'),(dentaia_http_qa.id(24),'{{dentist2}}') ON CONFLICT DO NOTHING;
INSERT INTO clinical.professional_verifications(professional_id,reviewed_by,decision,reference,reason)
 SELECT p.id,'{{superuser}}','approved','HTTP-QA-NO-ACREDITACION','Verificacion exclusivamente sintetica' FROM clinical.professional_accounts p
 WHERE NOT EXISTS(SELECT 1 FROM clinical.professional_verifications v WHERE v.professional_id=p.id);
UPDATE clinical.professional_accounts SET status='verified';
INSERT INTO clinical.clinic_memberships(id,clinic_id,professional_id,valid_from) VALUES
 (dentaia_http_qa.id(33),dentaia_http_qa.id(12),dentaia_http_qa.id(23),'2026-01-01T00:00:00Z'),
 (dentaia_http_qa.id(34),dentaia_http_qa.id(11),dentaia_http_qa.id(24),'2026-01-01T00:00:00Z'),
 (dentaia_http_qa.id(35),dentaia_http_qa.id(11),dentaia_http_qa.id(23),'2026-01-01T00:00:00Z') ON CONFLICT DO NOTHING;
UPDATE clinical.clinic_memberships SET status='active';
UPDATE clinical.clinics SET status='active';
INSERT INTO clinical.patient_records(id,user_id) VALUES(dentaia_http_qa.id(41),'{{patient1}}'),(dentaia_http_qa.id(42),'{{patient2}}') ON CONFLICT DO NOTHING;
INSERT INTO clinical.clinical_encounters(id,patient_id,membership_id,attended_at) VALUES
 (dentaia_http_qa.id(51),dentaia_http_qa.id(41),dentaia_http_qa.id(34),'2026-10-01T10:00:00.123456Z'),
 (dentaia_http_qa.id(52),dentaia_http_qa.id(41),dentaia_http_qa.id(33),'2026-10-02T10:00:00.654321Z'),
 (dentaia_http_qa.id(53),dentaia_http_qa.id(42),dentaia_http_qa.id(33),'2026-10-02T10:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO clinical.clinical_entries(id,encounter_id,kind,information_state,description) VALUES
 (dentaia_http_qa.id(61),dentaia_http_qa.id(51),'background','recorded','Antecedente HTTP ficticio'),
 (dentaia_http_qa.id(62),dentaia_http_qa.id(52),'diagnosis','unknown',NULL),
 (dentaia_http_qa.id(63),dentaia_http_qa.id(53),'treatment','recorded','Contenido HTTP ficticio ajeno') ON CONFLICT DO NOTHING;
INSERT INTO clinical.clinical_documents(id,encounter_id,kind,title,availability) VALUES(dentaia_http_qa.id(65),dentaia_http_qa.id(51),'exam','Examen HTTP ficticio sin archivo','unavailable') ON CONFLICT DO NOTHING;
UPDATE clinical.clinical_access_grants SET revoked_at=clock_timestamp() WHERE revoked_at IS NULL;
CREATE OR REPLACE FUNCTION clinical_service.configuration() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT '{"enabled":true,"policyVersion":"QA-NO-CLINICO-v1","purpose":"academic_shared_history_qa","maxGrantSeconds":86400,"maxResources":100,"maxPage":50,"maxNested":100}'::jsonb; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
