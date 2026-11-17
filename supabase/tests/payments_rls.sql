begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'payments-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'payments-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.payments (user_id, stripe_session_id, stripe_event_id, plan, amount_total, currency, status)
values
  ('33333333-3333-4333-8333-333333333333', 'cs_test_rls_a', 'evt_test_rls_a', 'premium-demo', 2000, 'usd', 'paid'),
  ('44444444-4444-4444-8444-444444444444', 'cs_test_rls_b', 'evt_test_rls_b', 'premium-demo', 2000, 'usd', 'failed');

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.payments), 1, 'paciente solo consulta sus pagos');
select is((select count(*)::integer from public.payments where user_id = '44444444-4444-4444-8444-444444444444'), 0, 'paciente no consulta pagos de otra cuenta');
select is((select count(*)::integer from public.premium_subscriptions), 0, 'un pago de demostracion no crea acceso Premium');
select throws_ok(
  $$insert into public.payments (user_id, stripe_session_id, stripe_event_id, plan, amount_total, currency, status) values ('33333333-3333-4333-8333-333333333333', 'cs_test_browser', 'evt_test_browser', 'premium-demo', 2000, 'usd', 'paid')$$,
  '42501', 'permission denied for table payments', 'cliente no puede insertar pagos'
);
select throws_ok(
  $$update public.payments set status = 'paid' where user_id = '33333333-3333-4333-8333-333333333333'$$,
  '42501', 'permission denied for table payments', 'cliente no puede modificar pagos'
);
select throws_ok(
  $$delete from public.payments where user_id = '33333333-3333-4333-8333-333333333333'$$,
  '42501', 'permission denied for table payments', 'cliente no puede eliminar pagos'
);
select throws_ok(
  $$select * from public.stripe_webhook_events$$,
  '42501', 'permission denied for table stripe_webhook_events', 'cliente no puede consultar eventos internos de Stripe'
);
reset role;
select is((select count(*)::integer from public.payments where status = 'failed'), 1, 'la migracion permite el estado failed');
select * from finish();
rollback;
