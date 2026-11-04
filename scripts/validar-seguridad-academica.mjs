// Solo lecturas remotas y GUC de transacción, sin DDL/DML ni sesiones simuladas como evidencia HTTP.
import{sqlRemote,saveReport,ref}from'./academic-private.mjs';
const query=`BEGIN;
DO $$ DECLARE u record; c jsonb; n integer:=0; BEGIN
 FOR u IN SELECT id FROM auth.users WHERE raw_app_meta_data->'dentaia_development'->>'dataset' IS DISTINCT FROM 'fase8-synthetic-v1' LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u.id)::text,true);
  c:=clinical_service.configuration();
  IF (c->>'enabled')::boolean THEN RAISE EXCEPTION 'ORIGINAL_ACTOR_MUST_REMAIN_CLOSED'; END IF;
  n:=n+1;
 END LOOP;
 IF n<>5 THEN RAISE EXCEPTION 'ORIGINAL_ACTOR_COUNT_CHANGED'; END IF;
END $$;
SELECT jsonb_build_object('originalActorsClosed',5,'tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','clinical','dentaia_admin') AND c.relkind='r'),'rlsTables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','clinical','dentaia_admin') AND c.relkind='r' AND c.relrowsecurity),'anonymousConfigurationExecute',has_function_privilege('anon','clinical_service.configuration()','EXECUTE'),'authenticatedConfigurationExecute',has_function_privilege('authenticated','clinical_service.configuration()','EXECUTE'),'authenticatedClinicalSelect',has_table_privilege('authenticated','clinical.clinical_encounters','SELECT'),'configurationSecurityInvoker',NOT(SELECT prosecdef FROM pg_proc WHERE oid='clinical_service.configuration()'::regprocedure),'activationVersion',(SELECT version FROM supabase_migrations.schema_migrations WHERE name='di36_activacion_sintetica_fase8'));
ROLLBACK;`;
const state=JSON.parse(sqlRemote(query));if(state.tables!==19||state.rlsTables!==19||state.anonymousConfigurationExecute||state.authenticatedConfigurationExecute||state.authenticatedClinicalSelect||!state.configurationSecurityInvoker)throw new Error('REMOTE_SECURITY_CHECK_FAILED');
saveReport('SEGURIDAD_ACADEMICA_REAL.json',{fecha:new Date().toISOString(),ref,metodo:'Catálogo y configuración SQL; claims de los cinco actores originales, no JWT ni login de esas cuentas',...state});console.log(JSON.stringify(state));
