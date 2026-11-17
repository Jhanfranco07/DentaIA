begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'payments-status@example.test', '', now(), '{}', '{}', now(), now());

select lives_ok(
  $$insert into public.payments (user_id, stripe_session_id, stripe_event_id, plan, amount_total, currency, status)
    values ('33333333-3333-4333-8333-333333333333', 'cs_failed_fixture', 'evt_failed_fixture', 'premium-demo', 2000, 'usd', 'failed')$$,
  'payments acepta el estado fallido'
);
select is((select status from public.payments where stripe_session_id = 'cs_failed_fixture'), 'failed', 'el estado fallido queda persistido');
select throws_ok(
  $$insert into public.payments (user_id, stripe_session_id, stripe_event_id, plan, amount_total, currency, status)
    values ('33333333-3333-4333-8333-333333333333', 'cs_invalid_fixture', 'evt_invalid_fixture', 'premium-demo', 2000, 'usd', 'refunded')$$,
  '23514', 'new row for relation "payments" violates check constraint "payments_status_check"', 'se rechazan estados no soportados'
);

select * from finish();
rollback;
