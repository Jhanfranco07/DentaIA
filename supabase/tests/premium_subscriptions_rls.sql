begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'premium-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'premium-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.premium_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end, stripe_event_created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'cus_test_a', 'sub_test_a', 'price_test', 'active', now() + interval '1 day', now()),
  ('22222222-2222-4222-8222-222222222222', 'cus_test_b', 'sub_test_b', 'price_test', 'active', now() + interval '1 day', now());
insert into public.stripe_webhook_events (stripe_event_id, event_type, stripe_created_at, payload)
values ('evt_test_once', 'customer.subscription.updated', now(), '{}');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.premium_subscriptions), 1, 'paciente solo consulta su suscripcion');
select is((select count(*)::integer from public.premium_subscriptions where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'paciente no consulta la suscripcion de otra cuenta');
select throws_ok(
  $$insert into public.premium_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, stripe_event_created_at) values ('11111111-1111-4111-8111-111111111111', 'cus_browser', 'sub_browser', 'price_browser', 'active', now())$$,
  '42501', 'permission denied for table premium_subscriptions', 'cliente no habilita Premium por escritura directa'
);
select throws_ok(
  $$update public.premium_subscriptions set status = 'active' where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', 'permission denied for table premium_subscriptions', 'cliente no puede alterar su plan'
);
select throws_ok(
  $$delete from public.premium_subscriptions where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', 'permission denied for table premium_subscriptions', 'cliente no puede borrar su suscripcion'
);
reset role;
select throws_ok(
  $$insert into public.stripe_webhook_events (stripe_event_id, event_type, stripe_created_at, payload) values ('evt_test_once', 'duplicate', now(), '{}')$$,
  '23505', 'duplicate key value violates unique constraint "stripe_webhook_events_pkey"', 'ledger Stripe rechaza evento duplicado'
);
select * from finish();
rollback;
