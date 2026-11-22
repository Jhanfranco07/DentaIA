-- DI-207 / BORRADOR NO APLICADO. Requiere QA de autenticación y acceso cruzado.
-- Ejecutar mediante migración versionada tras pruebas en Supabase aislado.
begin;

create table public.routine_followup_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid not null references clinical.clinic_memberships(id) on delete restrict,
  status text not null default 'pendiente'
    check (status in ('pendiente','aprobado','rechazado','revocado','expirado')),
  purpose text not null default 'seguimiento_rutinas'
    check (purpose = 'seguimiento_rutinas'),
  policy_version text not null default 'di207-v1'
    check (length(policy_version) between 1 and 80),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  constraint routine_consent_dates check (
    expires_at > created_at
    and (approved_at is null or approved_at >= created_at)
    and (revoked_at is null or revoked_at >= created_at)
  ),
  constraint routine_consent_status_dates check (
    (status = 'pendiente' and approved_at is null and revoked_at is null)
    or (status = 'aprobado' and approved_at is not null and revoked_at is null)
    or (status = 'rechazado' and approved_at is null and revoked_at is not null)
    or (status in ('revocado','expirado') and revoked_at is not null)
  ),
  constraint routine_consent_patient_key unique(id, patient_id)
);
create unique index routine_consents_one_open
  on public.routine_followup_consents(patient_id, membership_id)
  where status in ('pendiente','aprobado');
create index routine_consents_patient on public.routine_followup_consents(patient_id, created_at desc);

create table public.routine_plan_proposals (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null,
  patient_id uuid not null,
  plan_id uuid not null references public.oral_care_routine_plans(id) on delete restrict,
  proposed_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'propuesta'
    check (status in ('propuesta','aceptada','rechazada','revocada')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  revoked_at timestamptz,
  constraint routine_proposal_consent_owner
    foreign key(consent_id, patient_id)
      references public.routine_followup_consents(id, patient_id) on delete restrict,
  constraint routine_proposal_key unique(id, plan_id),
  constraint routine_proposal_dates check (
    (status = 'propuesta' and responded_at is null and revoked_at is null)
    or (status = 'aceptada' and responded_at is not null and revoked_at is null)
    or (status = 'rechazada' and responded_at is not null and revoked_at is null)
    or (status = 'revocada' and responded_at is not null and revoked_at is not null)
  )
);
create unique index routine_proposals_one_accepted
  on public.routine_plan_proposals(patient_id)
  where status = 'aceptada';
create index routine_proposals_patient on public.routine_plan_proposals(patient_id, created_at desc);

create table public.routine_proposal_activities (
  proposal_id uuid not null,
  plan_id uuid not null,
  activity_id uuid not null,
  primary key(proposal_id, activity_id),
  constraint routine_proposal_activities_proposal_fk
    foreign key(proposal_id, plan_id) references public.routine_plan_proposals(id, plan_id)
    on delete cascade,
  constraint routine_proposal_activities_catalog_fk
    foreign key(plan_id, activity_id) references public.oral_care_routine_activities(plan_id, id)
    on delete restrict
);

-- Auditoría del servidor: sin acceso directo desde el navegador.
create table clinical.routine_followup_audit (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid references public.routine_followup_consents(id) on delete restrict,
  proposal_id uuid references public.routine_plan_proposals(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in (
    'solicitud', 'aprobar_seguimiento', 'rechazar_seguimiento', 'revocar_seguimiento', 'expirar',
    'proponer_plan', 'aceptar_plan', 'rechazar_plan', 'revocar_plan'
  )),
  occurred_at timestamptz not null default now(),
  constraint routine_audit_target_present check (consent_id is not null or proposal_id is not null)
);

alter table public.routine_followup_consents enable row level security;
alter table public.routine_plan_proposals enable row level security;
alter table public.routine_proposal_activities enable row level security;
alter table clinical.routine_followup_audit enable row level security;

revoke all on public.routine_followup_consents, public.routine_plan_proposals,
  public.routine_proposal_activities from public, anon, authenticated;
revoke all on clinical.routine_followup_audit from public, anon, authenticated;
grant select on public.routine_followup_consents,
  public.routine_plan_proposals, public.routine_proposal_activities to authenticated;
grant all on public.routine_followup_consents,
  public.routine_plan_proposals, public.routine_proposal_activities to service_role;
grant all on clinical.routine_followup_audit to service_role;

create policy routine_consents_select_owner
on public.routine_followup_consents for select to authenticated
using (patient_id = (select auth.uid())
  and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado', '') = 'activo'
  and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles','[]'::jsonb) ? 'paciente');

create policy routine_proposals_select_owner
on public.routine_plan_proposals for select to authenticated
using (patient_id = (select auth.uid())
  and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' ->> 'estado', '') = 'activo'
  and coalesce(auth.jwt() -> 'app_metadata' -> 'dentaia' -> 'roles','[]'::jsonb) ? 'paciente');

create policy routine_proposal_activities_select_owner
on public.routine_proposal_activities for select to authenticated
using (exists (
  select 1 from public.routine_plan_proposals proposal
  where proposal.id = routine_proposal_activities.proposal_id
    and proposal.patient_id = (select auth.uid())
));

-- No se concede INSERT, UPDATE ni DELETE al rol authenticated.
-- La API debe verificar actor, membership, consentimiento vigente y
-- catálogo y efectuar la transición con bloqueo transaccional antes de escribir.
-- Este script no habilita lectura o escritura profesional desde el cliente.
commit;
