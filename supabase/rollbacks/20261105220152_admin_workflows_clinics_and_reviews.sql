-- Rollback conservador: si hay auditoría, conservarla bloquea el borrado del flujo.
begin;
do $guard$
begin
  if exists (select 1 from dentaia_admin_workflows.audit_events) then
    raise exception 'ROLLBACK_BLOQUEADO: existe auditoría administrativa que debe conservarse';
  end if;
end
$guard$;
drop function if exists public.dentaia_manage_clinic_membership_v1(uuid,text,uuid,uuid,uuid);
drop function if exists public.dentaia_moderate_reviews_v1(uuid,text,uuid,uuid,text);
drop schema dentaia_admin_workflows cascade;
commit;
