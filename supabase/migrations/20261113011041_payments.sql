begin;

-- Stripe Sandbox. Aplicar únicamente la versión completa tras revisión.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null,
  stripe_event_id text not null,
  plan text not null,
  created_at timestamptz not null default now()
);

-- Neutralizar grants por defecto: ningún acceso público ni escritura de clientes.
revoke all on table public.payments from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.payments to service_role;

commit;
