begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

do $setup$
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('e1710000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'smile-patient@example.test', '', now(), '{}', '{}', now(), now()),
    ('e1710000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'smile-professional@example.test', '', now(), '{}', '{}', now(), now()),
    ('e1710000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'smile-reviewer@example.test', '', now(), '{}', '{}', now(), now());
  insert into public.dentists (id, slug, name, specialty, district, consultation_price, initials, avatar_color, description)
  values ('f1710000-0000-4000-8000-000000000001', 'smile-professional', 'Smile Professional', 'General', 'QA', 0, 'SP', '#000000', 'Synthetic');
  insert into clinical.professional_accounts (id, user_id, dentist_id, status)
  values ('a1710000-0000-4000-8000-000000000001', 'e1710000-0000-4000-8000-000000000002', 'f1710000-0000-4000-8000-000000000001', 'pending');
  insert into clinical.professional_verifications (professional_id, reviewed_by, decision, reference, reason)
  values ('a1710000-0000-4000-8000-000000000001', 'e1710000-0000-4000-8000-000000000003', 'approved', 'SMILE-QA', 'Synthetic approval');
  update clinical.professional_accounts set status = 'verified' where id = 'a1710000-0000-4000-8000-000000000001';
  insert into public.smile_analysis_consents (id, patient_id, consent_version)
  values ('b1710000-0000-4000-8000-000000000001', 'e1710000-0000-4000-8000-000000000001', 'v1');
  insert into public.smile_analyses (id, patient_id, consent_id, engine_version, status, technical_result)
  values ('c1710000-0000-4000-8000-000000000001', 'e1710000-0000-4000-8000-000000000001', 'b1710000-0000-4000-8000-000000000001', '17', 'completed', '{"status":"evaluable"}');
end
$setup$;

select ok((select relrowsecurity from pg_class where oid = 'public.smile_analyses'::regclass), 'RLS habilitado en historial Smile');
select ok(exists (select 1 from storage.buckets where id = 'smile-analysis-private' and not public), 'bucket Smile es privado');

select set_config('request.jwt.claim.sub', 'e1710000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"e1710000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.smile_analyses), 1, 'paciente propietario consulta su analisis');
select lives_ok(
  $$select public.grant_smile_analysis_access('c1710000-0000-4000-8000-000000000001', 'a1710000-0000-4000-8000-000000000001', now() + interval '1 day')$$,
  'paciente concede acceso a profesional verificado'
);

reset role;
select set_config('request.jwt.claim.sub', 'e1710000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"e1710000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.smile_analyses), 1, 'profesional autorizado consulta analisis concedido');

reset role;
select set_config('request.jwt.claim.sub', 'e1710000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"e1710000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.revoke_smile_analysis_access((select id from public.smile_analysis_access_grants where analysis_id = 'c1710000-0000-4000-8000-000000000001'))$$,
  'paciente revoca acceso'
);

reset role;
select set_config('request.jwt.claim.sub', 'e1710000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"e1710000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.smile_analyses), 0, 'profesional no consulta analisis revocado');

reset role;
select * from finish();
rollback;
