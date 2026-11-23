-- Mantener las solicitudes de demostración. Habilitar solicitudes reales
-- únicamente para odontólogos publicados y con membresía vigente.
begin;
alter table public.appointment_requests
  drop constraint appointment_requests_is_demo_check;
alter table public.appointment_requests
  add constraint appointment_requests_is_demo_check
  check (is_demo in (true,false));
alter table public.appointment_requests
  drop constraint appointment_requests_status_check;
alter table public.appointment_requests
  add constraint appointment_requests_status_check
  check (
    (is_demo and status in ('requested','cancelled'))
    or (not is_demo and status in ('requested','confirmed','declined','completed','cancelled'))
  );
drop policy if exists requests_create on public.appointment_requests;
create policy requests_create on public.appointment_requests
for insert to authenticated with check (
  user_id=(select auth.uid()) and status='requested'
  and preferred_date>=current_date and exists (
    select 1 from public.dentists d
    where d.id=dentist_id and d.is_active
      and d.is_demo=is_demo
      and (is_demo or public.contacto_odontologo_autorizado(dentist_id,false))
  )
);
create policy requests_professional_read_real on public.appointment_requests
for select to authenticated using (
  is_demo=false and public.contacto_odontologo_autorizado(dentist_id,true)
);

-- Solo puede gestionar citas reales el odontólogo verificado del perfil.
create function public.gestionar_cita_profesional(p_solicitud_id uuid,p_accion text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_cita public.appointment_requests%rowtype;
  v_estado text;
  v_roles jsonb;
  v_activo boolean;
begin
  if v_actor is null or p_solicitud_id is null
    or p_accion not in ('confirmar','rechazar','completar','cancelar') then
    raise exception 'SOLICITUD_INVALIDA' using errcode='22023';
  end if;
  select coalesce(u.raw_app_meta_data #> '{dentaia,roles}','[]'::jsonb),
         coalesce(u.raw_app_meta_data #>> '{dentaia,estado}','')='activo'
    into v_roles,v_activo from auth.users u where u.id=v_actor;
  if not coalesce(v_activo,false) or not (v_roles ? 'odontologo') then
    raise exception 'NO_AUTORIZADO' using errcode='42501';
  end if;
  select * into v_cita from public.appointment_requests
    where id=p_solicitud_id for update;
  if not found or v_cita.is_demo or
     not public.contacto_odontologo_autorizado(v_cita.dentist_id,true) then
    raise exception 'NO_AUTORIZADO' using errcode='42501';
  end if;
  if p_accion='confirmar' and v_cita.status='requested' then
    v_estado:='confirmed';
  elsif p_accion='rechazar' and v_cita.status='requested' then
    v_estado:='declined';
  elsif p_accion='completar' and v_cita.status='confirmed'
    and v_cita.preferred_date <= (now() at time zone 'America/Lima')::date then
    v_estado:='completed';
  elsif p_accion='cancelar' and v_cita.status='confirmed' then
    v_estado:='cancelled';
  else
    raise exception 'TRANSICION_INVALIDA' using errcode='22023';
  end if;
  update public.appointment_requests set status=v_estado where id=v_cita.id;
  return jsonb_build_object('ok',true,'estado',v_estado);
end;
$$;
revoke all on function public.gestionar_cita_profesional(uuid,text)
  from public,anon,authenticated;
grant execute on function public.gestionar_cita_profesional(uuid,text)
  to authenticated;

-- El paciente puede cancelar sus solicitudes reales antes de ser atendido.
create function public.cancelar_cita_paciente(p_solicitud_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid();
  v_cita public.appointment_requests%rowtype;
begin
  if v_actor is null or p_solicitud_id is null then
    raise exception 'NO_AUTORIZADO' using errcode='42501';
  end if;
  select * into v_cita from public.appointment_requests
    where id=p_solicitud_id for update;
  if not found or v_cita.user_id<>v_actor or v_cita.is_demo
    or v_cita.status not in ('requested','confirmed') then
    raise exception 'NO_AUTORIZADO' using errcode='42501';
  end if;
  update public.appointment_requests set status='cancelled'
    where id=v_cita.id;
  return true;
end;
$$;
revoke all on function public.cancelar_cita_paciente(uuid)
  from public,anon,authenticated;
grant execute on function public.cancelar_cita_paciente(uuid)
  to authenticated;
commit;