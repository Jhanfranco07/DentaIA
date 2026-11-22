-- Contacto externo optativo: solo profesionales verificados con ficha real.
-- El profesional autoriza explícitamente la publicación de su teléfono.
begin;
create table public.dentist_contact_channels (
  dentist_id uuid primary key references public.dentists(id) on delete cascade,
  whatsapp_e164 text not null check (whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  whatsapp_publicado boolean not null default false,
  consentimiento_publicacion_en timestamptz,
  actualizado_en timestamptz not null default now(),
  constraint contacto_consistente check (
    not whatsapp_publicado or consentimiento_publicacion_en is not null
  )
);
alter table public.dentist_contact_channels enable row level security;
revoke all on public.dentist_contact_channels from public, anon, authenticated;
grant select on public.dentist_contact_channels to anon, authenticated;
grant insert (dentist_id, whatsapp_e164, whatsapp_publicado, consentimiento_publicacion_en)
  on public.dentist_contact_channels to authenticated;
grant update (whatsapp_e164, whatsapp_publicado, consentimiento_publicacion_en)
  on public.dentist_contact_channels to authenticated;
grant all on public.dentist_contact_channels to service_role;

create policy "Contacto publicado de profesional real"
on public.dentist_contact_channels for select to anon, authenticated
using (
  whatsapp_publicado and consentimiento_publicacion_en is not null
  and exists (
    select 1 from public.dentists d
    join clinical.professional_accounts pa on pa.dentist_id=d.id
    join clinical.clinic_memberships cm on cm.professional_id=pa.id
    where d.id=dentist_id and d.is_active and not d.is_demo
      and pa.status='verified'
      and cm.status='active' and cm.valid_from<=now()
      and (cm.valid_until is null or cm.valid_until>now())
  )
);
create policy "Profesional consulta su contacto"
on public.dentist_contact_channels for select to authenticated
using (exists (
  select 1 from public.dentists d
  join clinical.professional_accounts pa on pa.dentist_id=d.id
  where d.id=dentist_id and d.is_active and not d.is_demo
    and pa.user_id=(select auth.uid()) and pa.status='verified'
));
create policy "Profesional registra contacto autorizado"
on public.dentist_contact_channels for insert to authenticated
with check (exists (
  select 1 from public.dentists d
  join clinical.professional_accounts pa on pa.dentist_id=d.id
  join clinical.clinic_memberships cm on cm.professional_id=pa.id
  where d.id=dentist_id and d.is_active and not d.is_demo
    and pa.user_id=(select auth.uid()) and pa.status='verified'
    and cm.status='active' and cm.valid_from<=now()
    and (cm.valid_until is null or cm.valid_until>now())
));
create policy "Profesional actualiza solo su contacto"
on public.dentist_contact_channels for update to authenticated
using (exists (
  select 1 from public.dentists d
  join clinical.professional_accounts pa on pa.dentist_id=d.id
  where d.id=dentist_id and d.is_active and not d.is_demo
    and pa.user_id=(select auth.uid()) and pa.status='verified'
))
with check (exists (
  select 1 from public.dentists d
  join clinical.professional_accounts pa on pa.dentist_id=d.id
  join clinical.clinic_memberships cm on cm.professional_id=pa.id
  where d.id=dentist_id and d.is_active and not d.is_demo
    and pa.user_id=(select auth.uid()) and pa.status='verified'
    and cm.status='active' and cm.valid_from<=now()
    and (cm.valid_until is null or cm.valid_until>now())
));
comment on table public.dentist_contact_channels is
  'Canal opcional declarado por odontólogo verificado. Sin citas automáticas ni transferencia de datos de pacientes.';
commit;