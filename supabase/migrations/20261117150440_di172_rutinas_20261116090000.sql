begin;

create table public.oral_care_routine_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null,
  version integer not null check (version > 0),
  title text not null,
  description text not null,
  valid_from date not null,
  valid_until date,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint oral_care_routine_plans_key_version_unique unique (plan_key, version),
  constraint oral_care_routine_plans_dates_valid check (valid_until is null or valid_until >= valid_from)
);

create table public.oral_care_routine_activities (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.oral_care_routine_plans(id) on delete restrict,
  activity_key text not null,
  title text not null,
  description text not null,
  time_of_day text not null check (time_of_day in ('morning', 'daytime', 'evening')),
  sort_order smallint not null check (sort_order > 0),
  constraint oral_care_routine_activities_plan_key_unique unique (plan_id, activity_key),
  constraint oral_care_routine_activities_plan_id_unique unique (plan_id, id)
);

create table public.patient_routine_completions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid not null,
  activity_id uuid not null,
  completion_date date not null,
  completed_at timestamptz not null default now(),
  constraint patient_routine_completions_activity_fk
    foreign key (plan_id, activity_id)
    references public.oral_care_routine_activities(plan_id, id) on delete restrict,
  constraint patient_routine_completions_once_per_day
    unique (patient_id, activity_id, completion_date)
);

create index oral_care_routine_plans_vigency_idx
  on public.oral_care_routine_plans (valid_from, valid_until) where published;
create index oral_care_routine_activities_plan_order_idx
  on public.oral_care_routine_activities (plan_id, time_of_day, sort_order);
create index patient_routine_completions_history_idx
  on public.patient_routine_completions (patient_id, completion_date desc);

alter table public.oral_care_routine_plans enable row level security;
alter table public.oral_care_routine_activities enable row level security;
alter table public.patient_routine_completions enable row level security;
revoke all on table public.oral_care_routine_plans, public.oral_care_routine_activities,
  public.patient_routine_completions from public, anon, authenticated, service_role;

grant select on table public.oral_care_routine_plans, public.oral_care_routine_activities to authenticated;
grant select, delete on table public.patient_routine_completions to authenticated;
grant insert (plan_id, activity_id, completion_date)
  on table public.patient_routine_completions to authenticated;

create policy oral_care_routine_plans_patient_read
  on public.oral_care_routine_plans for select to authenticated
  using (
    published
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado', '') = 'activo'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'paciente'
  );

create policy oral_care_routine_activities_patient_read
  on public.oral_care_routine_activities for select to authenticated
  using (
    exists (
      select 1 from public.oral_care_routine_plans plan
      where plan.id = plan_id and plan.published
    )
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado', '') = 'activo'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'paciente'
  );

create policy patient_routine_completions_select_own
  on public.patient_routine_completions for select to authenticated
  using (
    patient_id = (select auth.uid())
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado', '') = 'activo'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'paciente'
  );

create policy patient_routine_completions_insert_own_today
  on public.patient_routine_completions for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and completion_date = (now() at time zone 'America/Lima')::date
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado', '') = 'activo'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'paciente'
    and exists (
      select 1 from public.oral_care_routine_plans plan
      join public.oral_care_routine_activities activity on activity.plan_id = plan.id
      where plan.id = patient_routine_completions.plan_id
        and activity.id = patient_routine_completions.activity_id and plan.published
        and plan.valid_from <= patient_routine_completions.completion_date
        and (plan.valid_until is null or plan.valid_until >= patient_routine_completions.completion_date)
        and not exists (
          select 1 from public.oral_care_routine_plans newer
          where newer.plan_key = plan.plan_key and newer.published
            and newer.version > plan.version and newer.valid_from <= patient_routine_completions.completion_date
            and (newer.valid_until is null or newer.valid_until >= patient_routine_completions.completion_date)
        )
    )
  );

create policy patient_routine_completions_delete_own_today
  on public.patient_routine_completions for delete to authenticated
  using (
    patient_id = (select auth.uid())
    and completion_date = (now() at time zone 'America/Lima')::date
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado', '') = 'activo'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles', '[]'::jsonb) ? 'paciente'
  );

insert into public.oral_care_routine_plans (plan_key, version, title, description, valid_from)
values ('general-preventive', 1, 'Rutina general preventiva',
  'Hábitos generales para organizar el cuidado bucal diario.', date '2026-01-01');

insert into public.oral_care_routine_activities (plan_id, activity_key, title, description, time_of_day, sort_order)
select plan.id, activity.activity_key, activity.title, activity.description, activity.time_of_day, activity.sort_order
from public.oral_care_routine_plans plan
cross join (values
  ('cepillado-manana', 'Cepillado de la mañana', 'Cepilla suavemente tus dientes con pasta fluorada como parte de tu rutina diaria.', 'morning', 1),
  ('limpieza-interdental', 'Limpieza interdental', 'Limpia con cuidado entre los dientes usando hilo dental u otra herramienta interdental adecuada.', 'daytime', 2),
  ('cepillado-noche', 'Cepillado de la noche', 'Incluye un cepillado suave con pasta fluorada antes de terminar el día.', 'evening', 3)
) as activity(activity_key, title, description, time_of_day, sort_order)
where plan.plan_key = 'general-preventive' and plan.version = 1;

comment on table public.patient_routine_completions is
  'Marcas diarias propias del paciente. La unicidad y el FK al plan preservan consistencia e interpretación histórica.';
comment on table public.oral_care_routine_plans is
  'Catálogo administrado por migraciones autorizadas. Publicar una nueva versión con fecha de vigencia; no reescribir versiones históricas.';

commit;
