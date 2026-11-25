CREATE OR REPLACE FUNCTION clinical_service.configuration() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT '{"enabled":true,"purpose":"qa-di213","policyVersion":"qa-v1","maxPage":50,"maxNested":100}'::jsonb
$$;

-- Datos sintéticos. Ejecutar sobre una base local vacía preparada por el arnés DI-213.
CREATE FUNCTION public.di213_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;

CREATE FUNCTION public.di213_actor(n integer) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',jsonb_build_object('sub',public.di213_id(n),'session_id',public.di213_id(n+100),
    'role','authenticated','exp',extract(epoch FROM clock_timestamp())+3600)::text,false)
$$;

CREATE FUNCTION public.di213_assert(actual jsonb, expected integer) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF (actual->>'status')::integer IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'DI213: expected %, received %',expected,actual;
  END IF;
END
$$;

INSERT INTO auth.users (id,aud,is_anonymous,confirmed_at,raw_app_meta_data)
SELECT public.di213_id(n),'authenticated',false,now(),jsonb_build_object('dentaia',jsonb_build_object('version',1,'estado','activo','roles',jsonb_build_array(rol)))
FROM (VALUES (1,'paciente'),(2,'paciente'),(3,'odontologo'),(4,'odontologo'),(5,'superusuario')) fixture(n,rol);
INSERT INTO auth.sessions (id,user_id) SELECT public.di213_id(n+100),public.di213_id(n) FROM generate_series(1,5) n;

INSERT INTO public.profiles VALUES (public.di213_id(1),'Paciente sintético'),(public.di213_id(3),'Profesional sintético');
INSERT INTO clinical.clinics (id,name) VALUES (public.di213_id(10),'Clínica sintética');
INSERT INTO clinical.professional_accounts (id,user_id) VALUES (public.di213_id(13),public.di213_id(3)),(public.di213_id(14),public.di213_id(4));
INSERT INTO clinical.professional_verifications (professional_id,reviewed_by,decision,reference,reason)
SELECT id,public.di213_id(5),'approved','QA-DI213','Solo pruebas' FROM clinical.professional_accounts;
UPDATE clinical.professional_accounts SET status='verified';
INSERT INTO clinical.clinic_memberships (id,clinic_id,professional_id,valid_from,status)
VALUES (public.di213_id(23),public.di213_id(10),public.di213_id(13),now()-interval '2 days','active'),
  (public.di213_id(24),public.di213_id(10),public.di213_id(14),now()-interval '2 days','active');
INSERT INTO clinical.patient_records (id,user_id) VALUES (public.di213_id(31),public.di213_id(1)),(public.di213_id(32),public.di213_id(2));
INSERT INTO clinical.clinical_encounters (id,patient_id,membership_id,attended_at)
VALUES (public.di213_id(41),public.di213_id(31),public.di213_id(23),now()-interval '1 day'),
  (public.di213_id(42),public.di213_id(31),public.di213_id(24),now()-interval '1 day'),
  (public.di213_id(43),public.di213_id(32),public.di213_id(23),now()-interval '1 day');
INSERT INTO clinical.clinical_access_grants (id,patient_id,membership_id,purpose,policy_version,expires_at)
VALUES (public.di213_id(51),public.di213_id(31),public.di213_id(23),'qa-di213','qa-v1',now()+interval '1 hour');
INSERT INTO clinical.clinical_grant_resources (grant_id,encounter_id)
VALUES (public.di213_id(51),public.di213_id(41)),(public.di213_id(51),public.di213_id(42));

INSERT INTO public.smile_analysis_consents(id,patient_id,consent_version) VALUES(public.di213_id(61),public.di213_id(1),'qa-v1');
INSERT INTO public.smile_analyses(id,patient_id,consent_id,engine_version,status,technical_result,original_object_path)
VALUES(public.di213_id(62),public.di213_id(1),public.di213_id(61),'qa','completed',
  '{"regions":[{"region_id":7,"level":"Leve","evaluable":true}]}',public.di213_id(1)::text || '/test.png');
INSERT INTO public.smile_analysis_access_grants(id,analysis_id,patient_id,professional_id,expires_at)
VALUES(public.di213_id(63),public.di213_id(62),public.di213_id(1),public.di213_id(13),now()+interval '1 hour');
INSERT INTO storage.objects(bucket_id,name) VALUES ('smile-analysis-private',public.di213_id(1)::text || '/test.png');

CREATE FUNCTION public.di213_call(n integer, encounter integer, tooth integer, surface text,
  previous integer DEFAULT NULL, review jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23),public.di213_id(n),
    jsonb_build_object('encounterId',public.di213_id(encounter),'record',
      jsonb_build_object('tooth',tooth,'surface',surface,'condition','caries','phase','hallazgo','note','Nota sintética',
        'replacesId',public.di213_id(previous),'correctionReason',CASE WHEN previous IS NOT NULL THEN 'Corrección sintética' END),'review',review));
$$;

SET ROLE authenticated;
SELECT public.di213_actor(3);
SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23)),200);
SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(32),public.di213_id(23)),403);
SELECT public.di213_assert(public.di213_call(71,42,11,'vestibular'),403);
SELECT public.di213_assert(public.di213_call(71,43,11,'vestibular'),403);
SELECT public.di213_assert(public.di213_call(71,41,11,'oclusal'),400);
SELECT public.di213_assert(public.di213_call(71,41,11,'vestibular'),201);
SELECT public.di213_assert(public.di213_call(71,41,11,'vestibular'),201);
SELECT public.di213_assert(public.di213_call(71,41,11,'mesial'),409);
SELECT public.di213_assert(public.di213_call(72,41,11,'mesial',71),201);
SELECT public.di213_assert(public.di213_call(73,41,11,'mesial',71),409);
SELECT public.di213_assert(public.di213_call(73,41,11,'incisal',NULL,
  jsonb_build_object('analysisId',public.di213_id(62),'key','region:8','decision','accepted')),403);
SELECT public.di213_assert(public.di213_call(73,41,11,'incisal',NULL,
  jsonb_build_object('analysisId',public.di213_id(62),'key','region:7','decision','accepted')),201);
SELECT public.di213_assert(public.di213_call(74,41,11,'incisal',NULL,
  jsonb_build_object('analysisId',public.di213_id(62),'key','region:7','decision','accepted')),409);
DO $$ DECLARE chart jsonb := public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23))->'data';
BEGIN
  IF jsonb_array_length(chart->'records') <> 3 OR jsonb_array_length(chart->'reviews') <> 1
    OR (SELECT count(*) FROM jsonb_array_elements(chart->'records') AS v WHERE v->>'active' = 'true') <> 2
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(chart->'records') AS v WHERE v->>'replacesId' = public.di213_id(71)::text)
    THEN RAISE EXCEPTION 'La persistencia o la trazabilidad no coincide'; END IF;
  BEGIN
    PERFORM 1 FROM clinical.odontogram_events;
    RAISE EXCEPTION 'Lectura clínica directa no autorizada';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23),NULL,NULL,public.di213_id(62)),200);
SELECT set_config('storage.operation','object.sign',false);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='smile-analysis-private') THEN RAISE EXCEPTION 'Firma indebida'; END IF;
END $$;
SELECT set_config('storage.operation','object.get_authenticated',false);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='smile-analysis-private') THEN RAISE EXCEPTION 'Descarga autorizada ausente'; END IF;
END $$;

SELECT public.di213_actor(1);
SELECT public.di213_assert(public.di213_call(74,41,11,'mesial'),403);
SELECT public.revoke_smile_analysis_consent(public.di213_id(61));
SELECT public.di213_actor(3);
SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23),NULL,NULL,public.di213_id(62)),403);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='smile-analysis-private') THEN RAISE EXCEPTION 'Fotografía accesible tras revocar'; END IF;
END $$;

SELECT public.di213_actor(4);
SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23)),403);
SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(31),public.di213_id(24)),403);
RESET ROLE;

UPDATE clinical.clinical_access_grants SET revoked_at=now() WHERE id=public.di213_id(51);
SET ROLE authenticated;
SELECT public.di213_actor(3);
SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23)),403);
RESET ROLE;

INSERT INTO clinical.clinical_access_grants (id,patient_id,membership_id,purpose,policy_version,granted_at,expires_at)
VALUES (public.di213_id(52),public.di213_id(31),public.di213_id(23),'qa-di213','qa-v1',now()-interval '2 hours',now()-interval '1 hour');
INSERT INTO clinical.clinical_grant_resources (grant_id,encounter_id) VALUES (public.di213_id(52),public.di213_id(41));
SET ROLE authenticated;
SELECT public.di213_assert(public.access_clinical_odontogram(public.di213_id(31),public.di213_id(23)),403);
RESET ROLE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM clinical.clinical_access_audit WHERE operation='register_clinical' AND outcome='allowed')
    OR NOT EXISTS (SELECT 1 FROM clinical.clinical_access_audit WHERE operation='read_history' AND outcome='denied')
    THEN RAISE EXCEPTION 'Auditoría incompleta'; END IF;
END $$;
