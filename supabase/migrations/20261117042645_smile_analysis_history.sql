begin;

create table public.smile_analysis_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  consent_version text not null,
  purpose text not null default 'smile_analysis_storage',
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  audit_metadata jsonb not null default '{}'::jsonb,
  constraint smile_analysis_consents_version check (length(btrim(consent_version)) between 1 and 80),
  constraint smile_analysis_consents_purpose check (purpose = 'smile_analysis_storage'),
  constraint smile_analysis_consents_revocation check (revoked_at is null or revoked_at >= accepted_at),
  constraint smile_analysis_consents_audit_metadata check (jsonb_typeof(audit_metadata) = 'object')
);

create unique index smile_analysis_consents_active_one_per_patient_idx
  on public.smile_analysis_consents (patient_id)
  where revoked_at is null;

create table public.smile_analyses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null references public.smile_analysis_consents(id) on delete restrict,
  analyzed_at timestamptz not null default now(),
  engine text not null default 'Smile V17',
  engine_version text not null,
  status text not null check (status in ('completed', 'not_evaluable', 'failed', 'deleted')),
  technical_result jsonb not null,
  educational_explanation jsonb,
  explanation_source text check (explanation_source in ('openai', 'template', 'mock')),
  original_object_path text,
  overlay_object_path text,
  original_mime_type text,
  original_size_bytes bigint,
  deleted_at timestamptz,
  deletion_reason text,
  constraint smile_analyses_engine check (engine = 'Smile V17'),
  constraint smile_analyses_engine_version check (length(btrim(engine_version)) between 1 and 120),
  constraint smile_analyses_result_object check (jsonb_typeof(technical_result) = 'object'),
  constraint smile_analyses_explanation_object check (educational_explanation is null or jsonb_typeof(educational_explanation) = 'object'),
  constraint smile_analyses_explanation_source check ((educational_explanation is null) = (explanation_source is null)),
  constraint smile_analyses_original_path check (original_object_path is null or (original_object_path like patient_id::text || '/%' and original_object_path !~ '(^|/)\\.\\.?(/|$)')),
  constraint smile_analyses_overlay_path check (overlay_object_path is null or (overlay_object_path like patient_id::text || '/%' and overlay_object_path !~ '(^|/)\\.\\.?(/|$)')),
  constraint smile_analyses_original_mime check (original_mime_type is null or original_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint smile_analyses_original_size check (original_size_bytes is null or original_size_bytes between 1 and 8388608),
  constraint smile_analyses_deletion check ((deleted_at is null and deletion_reason is null) or (deleted_at is not null and length(btrim(deletion_reason)) between 1 and 200))
);

create index smile_analyses_patient_history_idx on public.smile_analyses (patient_id, analyzed_at desc);
create index smile_analyses_consent_idx on public.smile_analyses (consent_id);

create table public.smile_analysis_access_grants (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.smile_analyses(id) on delete restrict,
  patient_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references clinical.professional_accounts(id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint smile_analysis_access_grants_expiry check (expires_at > granted_at),
  constraint smile_analysis_access_grants_revocation check (revoked_at is null or revoked_at >= granted_at),
  constraint smile_analysis_access_grants_unique unique (analysis_id, professional_id)
);

create index smile_analysis_access_grants_patient_idx on public.smile_analysis_access_grants (patient_id, expires_at) where revoked_at is null;
create index smile_analysis_access_grants_professional_idx on public.smile_analysis_access_grants (professional_id, expires_at) where revoked_at is null;

alter table public.smile_analysis_consents enable row level security;
alter table public.smile_analyses enable row level security;
alter table public.smile_analysis_access_grants enable row level security;
revoke all on table public.smile_analysis_consents, public.smile_analyses, public.smile_analysis_access_grants from public, anon, authenticated, service_role;

grant select, insert on public.smile_analysis_consents to authenticated;
grant select on public.smile_analyses, public.smile_analysis_access_grants to authenticated;
grant select, insert, update, delete on public.smile_analysis_consents, public.smile_analyses, public.smile_analysis_access_grants to service_role;

create policy smile_analysis_consents_patient_read on public.smile_analysis_consents
  for select to authenticated using (patient_id = (select auth.uid()));
create policy smile_analysis_consents_patient_insert on public.smile_analysis_consents
  for insert to authenticated with check (patient_id = (select auth.uid()) and revoked_at is null);
create policy smile_analyses_patient_read on public.smile_analyses
  for select to authenticated using (patient_id = (select auth.uid()));
create policy smile_analysis_access_grants_patient_read on public.smile_analysis_access_grants
  for select to authenticated using (patient_id = (select auth.uid()));

create function clinical_service.current_user_has_active_smile_analysis_grant(p_analysis_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.smile_analysis_access_grants grant_row
    join clinical.professional_accounts professional on professional.id = grant_row.professional_id
    join public.smile_analyses analysis on analysis.id = grant_row.analysis_id
    join public.smile_analysis_consents consent on consent.id = analysis.consent_id
    where grant_row.analysis_id = p_analysis_id
      and professional.user_id = (select auth.uid())
      and professional.status = 'verified'
      and grant_row.revoked_at is null
      and grant_row.expires_at > now()
      and consent.revoked_at is null
      and analysis.deleted_at is null
  );
$$;

revoke all on function clinical_service.current_user_has_active_smile_analysis_grant(uuid) from public, anon, authenticated, service_role;
grant usage on schema clinical_service to authenticated;
grant execute on function clinical_service.current_user_has_active_smile_analysis_grant(uuid) to authenticated;

create policy smile_analyses_professional_granted_read on public.smile_analyses
  for select to authenticated using (clinical_service.current_user_has_active_smile_analysis_grant(id));

create function public.revoke_smile_analysis_consent(p_consent_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.smile_analysis_consents
  set revoked_at = coalesce(revoked_at, now())
  where id = p_consent_id and patient_id = (select auth.uid());
  if not found then raise exception 'SMILE_CONSENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501'; end if;
end;
$$;

create function public.grant_smile_analysis_access(p_analysis_id uuid, p_professional_id uuid, p_expires_at timestamptz)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare result_id uuid;
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '90 days' then
    raise exception 'SMILE_GRANT_EXPIRY_INVALID' using errcode = '22007';
  end if;
  insert into public.smile_analysis_access_grants (analysis_id, patient_id, professional_id, expires_at)
  select analysis.id, analysis.patient_id, p_professional_id, p_expires_at
  from public.smile_analyses analysis
  join public.smile_analysis_consents consent on consent.id = analysis.consent_id
  join clinical.professional_accounts professional on professional.id = p_professional_id
  where analysis.id = p_analysis_id
    and analysis.patient_id = (select auth.uid())
    and analysis.deleted_at is null
    and consent.revoked_at is null
    and professional.status = 'verified'
  on conflict (analysis_id, professional_id) do update
    set expires_at = excluded.expires_at, granted_at = now(), revoked_at = null
  returning id into result_id;
  if result_id is null then raise exception 'SMILE_GRANT_FORBIDDEN' using errcode = '42501'; end if;
  return result_id;
end;
$$;

create function public.revoke_smile_analysis_access(p_grant_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.smile_analysis_access_grants
  set revoked_at = coalesce(revoked_at, now())
  where id = p_grant_id and patient_id = (select auth.uid());
  if not found then raise exception 'SMILE_GRANT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501'; end if;
end;
$$;

revoke all on function public.revoke_smile_analysis_consent(uuid), public.grant_smile_analysis_access(uuid, uuid, timestamptz), public.revoke_smile_analysis_access(uuid) from public, anon, authenticated, service_role;
grant execute on function public.revoke_smile_analysis_consent(uuid), public.grant_smile_analysis_access(uuid, uuid, timestamptz), public.revoke_smile_analysis_access(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('smile-analysis-private', 'smile-analysis-private', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']);

create policy smile_storage_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'smile-analysis-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy smile_storage_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'smile-analysis-private'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and exists (select 1 from public.smile_analysis_consents consent where consent.patient_id = (select auth.uid()) and consent.revoked_at is null)
  );
create policy smile_storage_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'smile-analysis-private' and (storage.foldername(name))[1] = (select auth.uid()::text));

commit;
