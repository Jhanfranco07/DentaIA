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
 IF signature IS DISTINCT FROM '1114dc34dc06e771d05fa4f507e7d6a5' THEN RAISE EXCEPTION 'PUBLIC_SCHEMA_DRIFT_ABORT'; END IF;
END $fase8$;
DO $$ BEGIN IF to_regprocedure('public.get_clinical_workspace(text,uuid,uuid,integer,text)') IS NOT NULL THEN RAISE EXCEPTION 'WORKSPACE_ALREADY_EXISTS'; END IF; END $$;
-- DI-36. Incremental QA local; creado con Supabase CLI migration new.
-- Depende de baseline público, DI-151 y clinical 01-04/08-10. No autodesplegar.



-- Amplía vocabulario de auditoría; no cambia contenido ni permite editar eventos.
ALTER TABLE clinical.clinical_access_audit DROP CONSTRAINT clinical_access_audit_operation_check;
ALTER TABLE clinical.clinical_access_audit ADD CONSTRAINT clinical_access_audit_operation_check CHECK
 (operation IN ('read_history','read_document','grant_access','revoke_access','read_professional_requests','list_authorized_patients','verify_professional','membership_change','register_clinical','read_context','list_own_grants'));
CREATE INDEX IF NOT EXISTS appointment_requests_professional_page ON public.appointment_requests(dentist_id,status,id) WHERE is_demo;
GRANT SELECT(id,dentist_id,status,created_at,preferred_date,preferred_time,is_demo) ON public.appointment_requests TO dentaia_clinical_executor;
CREATE POLICY clinical_executor_requests ON public.appointment_requests FOR SELECT TO dentaia_clinical_executor USING(true);
GRANT USAGE,CREATE ON SCHEMA clinical_service TO dentaia_clinical_executor;

CREATE FUNCTION clinical_service.workspace(p_kind text,p_membership_id uuid,p_after_id uuid,p_limit integer,p_status text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE ident jsonb; actor uuid; patient uuid; professional uuid; dentist uuid; ctx jsonb;
 cfg jsonb:=clinical_service.configuration(); request uuid:=gen_random_uuid(); operation text;
 rows jsonb:='[]'::jsonb; payload jsonb; ids uuid[]:=ARRAY[]::uuid[]; row_id uuid; more boolean:=false; next_id uuid;
BEGIN
 operation:=CASE p_kind WHEN 'grants' THEN 'list_own_grants' WHEN 'patients' THEN 'list_authorized_patients' WHEN 'requests' THEN 'read_professional_requests' ELSE 'read_context' END;
 ident:=clinical_service.identity_context();
 IF NOT coalesce((ident->>'ok')::boolean,false) THEN RETURN clinical_service.reject_request(request,NULL,NULL,operation,'SESSION_INVALID',401); END IF;
 actor:=(ident->>'userId')::uuid;
 IF NOT coalesce((cfg->>'enabled')::boolean,false) THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'SERVICE_DISABLED',503); END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('patient','professional','grants','patients','requests') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
 OR (p_status IS NOT NULL AND (p_kind<>'requests' OR p_status NOT IN ('requested','cancelled')))
 OR (p_kind IN ('patient','grants','professional') AND p_membership_id IS NOT NULL)
 OR (p_kind='patient' AND p_after_id IS NOT NULL) THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'INVALID_INPUT',400); END IF;

 IF p_kind IN ('patient','grants') THEN
  IF NOT(ident->'roles' @> '["paciente"]'::jsonb) THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'ROLE_REQUIRED'); END IF;
  SELECT id INTO patient FROM clinical.patient_records WHERE user_id=actor AND status='active' FOR SHARE;
  IF patient IS NULL THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'PATIENT_UNAVAILABLE'); END IF;
  IF p_kind='patient' THEN
   payload:=jsonb_build_object('patientId',patient);
  ELSE
   FOR row_id IN SELECT id FROM clinical.clinical_access_grants WHERE patient_id=patient AND (p_after_id IS NULL OR id>p_after_id) ORDER BY id LIMIT p_limit+1 FOR SHARE LOOP ids:=array_append(ids,row_id); END LOOP;
   more:=cardinality(ids)>p_limit;ids:=ids[1:p_limit];
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'membershipId',g.membership_id,'expiresAt',g.expires_at,'revokedAt',g.revoked_at,
    'estado',CASE WHEN g.revoked_at IS NOT NULL THEN 'revocado' WHEN g.expires_at<=clock_timestamp() THEN 'vencido' ELSE 'vigente' END,
    'policyVersion',g.policy_version,'encounterIds',coalesce((SELECT jsonb_agg(r.encounter_id ORDER BY r.encounter_id) FROM clinical.clinical_grant_resources r WHERE r.grant_id=g.id),'[]'::jsonb)) ORDER BY g.id),'[]'::jsonb)
    INTO rows FROM clinical.clinical_access_grants g WHERE g.id=ANY(ids);
   payload:=jsonb_build_object('patientId',patient,'items',rows);
  END IF;
 ELSE
  IF NOT(ident->'roles' @> '["odontologo"]'::jsonb) THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'ROLE_REQUIRED'); END IF;
  IF p_kind='professional' THEN
   SELECT id,dentist_id INTO professional,dentist FROM clinical.professional_accounts WHERE user_id=actor AND status='verified' FOR SHARE;
   IF professional IS NULL THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'PROFESSIONAL_UNAVAILABLE'); END IF;
   IF (SELECT decision FROM clinical.professional_verifications WHERE professional_id=professional ORDER BY reviewed_at DESC,id DESC LIMIT 1) IS DISTINCT FROM 'approved' THEN
    RETURN clinical_service.reject_request(request,actor,NULL,operation,'VERIFICATION_REQUIRED'); END IF;
   IF (SELECT count(*) FROM clinical.clinic_memberships WHERE professional_id=professional)>500 THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'CONTEXT_LIMIT',503); END IF;
   FOR row_id IN SELECT id FROM clinical.clinic_memberships WHERE professional_id=professional AND (p_after_id IS NULL OR id>p_after_id) ORDER BY id LOOP
    ctx:=clinical_service.lock_context(row_id,actor);
    IF coalesce((ctx->>'ok')::boolean,false) THEN ids:=array_append(ids,row_id); END IF;
    EXIT WHEN cardinality(ids)>p_limit;
   END LOOP;
   more:=cardinality(ids)>p_limit;ids:=ids[1:p_limit];
   IF cardinality(ids)=0 AND p_after_id IS NULL THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'CONTEXT_UNAVAILABLE'); END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object('membershipId',m.id,'clinicId',c.id,'clinicName',c.name,'validFrom',m.valid_from,'validUntil',m.valid_until) ORDER BY m.id),'[]'::jsonb)
    INTO rows FROM clinical.clinic_memberships m JOIN clinical.clinics c ON c.id=m.clinic_id WHERE m.id=ANY(ids);
   payload:=jsonb_build_object('professionalId',professional,'dentistId',dentist,'contexts',rows);
  ELSE
   ctx:=clinical_service.lock_context(p_membership_id,actor);
   IF NOT coalesce((ctx->>'ok')::boolean,false) THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'CONTEXT_UNAVAILABLE'); END IF;
   professional:=(ctx->>'professionalId')::uuid;
   IF p_kind='requests' THEN
    SELECT dentist_id INTO dentist FROM clinical.professional_accounts WHERE id=professional;
    IF dentist IS NULL THEN RETURN clinical_service.reject_request(request,actor,p_membership_id,operation,'DIRECTORY_LINK_REQUIRED'); END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'createdAt',a.created_at,'preferredDate',a.preferred_date,'preferredTime',a.preferred_time,'isDemo',a.is_demo) ORDER BY a.id),'[]'::jsonb)
    INTO rows FROM (SELECT id,status,created_at,preferred_date,preferred_time,is_demo FROM public.appointment_requests WHERE dentist_id=dentist AND is_demo AND (p_status IS NULL OR status=p_status) AND (p_after_id IS NULL OR id>p_after_id) ORDER BY id LIMIT p_limit+1) a;
    more:=jsonb_array_length(rows)>p_limit;
    SELECT coalesce(jsonb_agg(v ORDER BY ord),'[]'::jsonb) INTO rows FROM jsonb_array_elements(rows) WITH ORDINALITY a(v,ord) WHERE ord<=p_limit;
    IF more THEN next_id:=(rows->(jsonb_array_length(rows)-1)->>'id')::uuid; END IF;
    payload:=jsonb_build_object('professionalId',professional,'membershipId',p_membership_id,'items',rows);
   ELSE
    -- Limitar el trabajo de locks y fallar cerrado ante volúmenes que requieren otro plan.
    IF (SELECT count(*) FROM clinical.clinical_access_grants WHERE membership_id=p_membership_id AND revoked_at IS NULL AND expires_at>clock_timestamp())>500 THEN
     RETURN clinical_service.reject_request(request,actor,p_membership_id,operation,'SCOPE_LIMIT',503); END IF;
    PERFORM id FROM clinical.clinical_access_grants WHERE membership_id=p_membership_id AND revoked_at IS NULL AND expires_at>clock_timestamp() ORDER BY id FOR SHARE;
    SELECT coalesce(jsonb_agg(jsonb_build_object('patientId',q.id) ORDER BY q.id),'[]'::jsonb) INTO rows FROM (
     SELECT p.id FROM clinical.patient_records p WHERE p.status='active' AND (p_after_id IS NULL OR p.id>p_after_id)
      AND EXISTS(SELECT 1 FROM clinical.clinical_access_grants g JOIN clinical.clinical_grant_resources r ON r.grant_id=g.id
       WHERE g.patient_id=p.id AND g.membership_id=p_membership_id AND g.revoked_at IS NULL AND g.granted_at<=clock_timestamp() AND g.expires_at>clock_timestamp())
     ORDER BY p.id LIMIT p_limit+1) q;
    more:=jsonb_array_length(rows)>p_limit;
    SELECT coalesce(jsonb_agg(v ORDER BY ord),'[]'::jsonb) INTO rows FROM jsonb_array_elements(rows) WITH ORDINALITY a(v,ord) WHERE ord<=p_limit;
    IF more THEN next_id:=(rows->(jsonb_array_length(rows)-1)->>'patientId')::uuid; END IF;
    payload:=jsonb_build_object('membershipId',p_membership_id,'items',rows);
   END IF;
  END IF;
 END IF;
 IF more AND p_kind IN ('grants','professional') THEN next_id:=ids[cardinality(ids)]; END IF;
 IF NOT clinical_service.session_current(ident) THEN RETURN clinical_service.reject_request(request,actor,NULL,operation,'SESSION_EXPIRED',401); END IF;
 IF p_membership_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM clinical.clinic_memberships WHERE id=p_membership_id AND status='active' AND valid_from<=clock_timestamp() AND (valid_until IS NULL OR valid_until>clock_timestamp())) THEN
  RETURN clinical_service.reject_request(request,actor,NULL,operation,'CONTEXT_EXPIRED'); END IF;
 IF p_kind='professional' AND EXISTS(SELECT 1 FROM clinical.clinic_memberships WHERE id=ANY(ids) AND (status<>'active' OR valid_until<=clock_timestamp())) THEN
  RETURN clinical_service.reject_request(request,actor,NULL,operation,'CONTEXT_EXPIRED'); END IF;
 IF p_kind='patients' AND EXISTS(SELECT 1 FROM jsonb_array_elements(rows) r WHERE NOT EXISTS(
  SELECT 1 FROM clinical.clinical_access_grants g JOIN clinical.clinical_grant_resources x ON x.grant_id=g.id WHERE g.patient_id=(r->>'patientId')::uuid
  AND g.membership_id=p_membership_id AND g.revoked_at IS NULL AND g.expires_at>clock_timestamp())) THEN
  RETURN clinical_service.reject_request(request,actor,NULL,operation,'SCOPE_EXPIRED'); END IF;
 PERFORM clinical_service.audit_event(request,actor,patient,p_membership_id,NULL,operation,'allowed','WORKSPACE_AUTHORIZED');
 RETURN jsonb_build_object('ok',true,'status',200,'apiVersion','clinical.workspace.v1','environment','qa_local','kind',p_kind,'data',payload,'nextAfterId',next_id,'requestId',request);
END $$;
ALTER FUNCTION clinical_service.workspace(text,uuid,uuid,integer,text) OWNER TO dentaia_clinical_executor;
REVOKE ALL ON FUNCTION clinical_service.workspace(text,uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION clinical_service.workspace(text,uuid,uuid,integer,text) TO authenticated;

CREATE FUNCTION public.get_clinical_workspace(p_kind text,p_membership_id uuid DEFAULT NULL,p_after_id uuid DEFAULT NULL,p_limit integer DEFAULT 20,p_status text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN RETURN clinical_service.workspace(p_kind,p_membership_id,p_after_id,p_limit,p_status);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLINICAL_OPERATION_UNAVAILABLE' USING ERRCODE='P0001'; END $$;
REVOKE ALL ON FUNCTION public.get_clinical_workspace(text,uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_clinical_workspace(text,uuid,uuid,integer,text) TO authenticated;
REVOKE CREATE ON SCHEMA clinical_service FROM dentaia_clinical_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
