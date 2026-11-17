begin;

create table public.premium_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  checkout_session_id text unique,
  plan text not null default 'premium' check (plan = 'premium'),
  status text not null check (status in ('trialing', 'active', 'past_due', 'unpaid', 'paused', 'canceled', 'incomplete', 'incomplete_expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  stripe_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint premium_subscriptions_period check (current_period_start is null or current_period_end is null or current_period_end > current_period_start),
  constraint premium_subscriptions_cancellation check (canceled_at is null or canceled_at >= created_at),
  constraint premium_subscriptions_customer_subscription_unique unique (stripe_customer_id, stripe_subscription_id)
);

create index premium_subscriptions_user_status_idx on public.premium_subscriptions (user_id, status, current_period_end desc);
create index premium_subscriptions_customer_idx on public.premium_subscriptions (stripe_customer_id);

create table public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  payload jsonb not null,
  constraint stripe_webhook_events_type check (length(btrim(event_type)) between 1 and 120),
  constraint stripe_webhook_events_payload check (jsonb_typeof(payload) = 'object')
);

create index stripe_webhook_events_unprocessed_idx on public.stripe_webhook_events (received_at) where processed_at is null;

alter table public.premium_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.premium_subscriptions, public.stripe_webhook_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.premium_subscriptions, public.stripe_webhook_events to service_role;
grant select on table public.premium_subscriptions to authenticated;

create policy premium_subscriptions_select_own on public.premium_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

comment on table public.premium_subscriptions is
  'Estado Premium derivado exclusivamente de webhooks Stripe verificados. El navegador no puede escribirlo.';
comment on table public.stripe_webhook_events is
  'Ledger idempotente de eventos Stripe Sandbox o Live. La verificacion de firma corresponde al backend antes de insertar.';

commit;
