begin;

create table public.dentist_services (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.dentists(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes smallint,
  price_amount numeric(10,2),
  currency_code text not null default 'PEN',
  is_active boolean not null default true,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dentist_services_name_length check (length(btrim(name)) between 1 and 160),
  constraint dentist_services_description_length check (description is null or length(btrim(description)) between 1 and 2000),
  constraint dentist_services_duration check (duration_minutes is null or duration_minutes between 5 and 480),
  constraint dentist_services_price check (price_amount is null or price_amount >= 0),
  constraint dentist_services_currency check (currency_code ~ '^[A-Z]{3}$'),
  constraint dentist_services_sort_order check (sort_order between 1 and 32767),
  constraint dentist_services_dentist_name_unique unique (dentist_id, name)
);

create index dentist_services_public_listing_idx
  on public.dentist_services (dentist_id, sort_order, name)
  where is_active;

alter table public.dentist_services enable row level security;
revoke all on table public.dentist_services from public, anon, authenticated, service_role;
grant select on table public.dentist_services to anon, authenticated;
grant insert, update, delete on table public.dentist_services to authenticated;

-- The clinical schema stays private. This narrow SECURITY DEFINER predicate is
-- the only relationship exposed to public RLS: a verified professional can
-- administer services belonging to its linked dentist record.
create function clinical_service.current_user_owns_verified_dentist(p_dentist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from clinical.professional_accounts professional
    where professional.dentist_id = p_dentist_id
      and professional.user_id = (select auth.uid())
      and professional.status = 'verified'
  );
$$;

revoke all on function clinical_service.current_user_owns_verified_dentist(uuid)
  from public, anon, authenticated, service_role;
grant usage on schema clinical_service to authenticated;
grant execute on function clinical_service.current_user_owns_verified_dentist(uuid)
  to authenticated;

create policy dentist_services_public_read_active
  on public.dentist_services
  for select
  to anon
  using (is_active);

create policy dentist_services_authenticated_read
  on public.dentist_services
  for select
  to authenticated
  using (
    is_active
    or clinical_service.current_user_owns_verified_dentist(dentist_id)
  );

create policy dentist_services_owner_insert
  on public.dentist_services
  for insert
  to authenticated
  with check (clinical_service.current_user_owns_verified_dentist(dentist_id));

create policy dentist_services_owner_update
  on public.dentist_services
  for update
  to authenticated
  using (clinical_service.current_user_owns_verified_dentist(dentist_id))
  with check (clinical_service.current_user_owns_verified_dentist(dentist_id));

create policy dentist_services_owner_delete
  on public.dentist_services
  for delete
  to authenticated
  using (clinical_service.current_user_owns_verified_dentist(dentist_id));

comment on table public.dentist_services is
  'Catalogo publico de servicios. Solo el profesional verificado vinculado a dentist_id puede administrar sus filas.';

commit;
