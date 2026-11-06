-- Comprobación adicional del invariante: un único administrador no puede retirarse.
-- Exclusivamente banco local sintético; todo se revierte al terminar.
BEGIN;
DO $$ BEGIN IF current_database()<>'dentaia_arch_qa_fase2' THEN RAISE EXCEPTION 'QA_ONLY'; END IF; END $$;
SET LOCAL plpgsql.check_asserts=on;
UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data-'dentaia' WHERE id<>public.qa_id(1);
UPDATE auth.mfa_amr_claims SET updated_at=clock_timestamp() WHERE session_id=public.qa_id(11);
DO $$ DECLARE r jsonb; BEGIN
 ASSERT (SELECT count(*)=1 FROM auth.users WHERE raw_app_meta_data->'dentaia'->'roles' @> '["superusuario"]'::jsonb);
 r:=public.dentaia_cambiar_roles_v1(public.qa_contexto(),public.qa_peticion(1,999,0,'{"version":1,"estado":"activo","roles":["superusuario"]}')||'{"operacion":"revocar","rol":"superusuario"}',public.qa_id(399));
 ASSERT r->>'codigo'='CAMBIO_PROPIO_PROHIBIDO';
 ASSERT (SELECT raw_app_meta_data->'dentaia'->'roles'='["superusuario"]'::jsonb FROM auth.users WHERE id=public.qa_id(1));
END $$;
ROLLBACK;
