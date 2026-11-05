-- Rollback controlado para entornos desechables o después de respaldo verificado.
-- Se niega a borrar datos creados por la aplicación. No elimina PostGIS ni datos previos.
begin;

do $guard$
declare
  nombre text;
  oid_objeto oid;
  comentario text;
begin
  comentario := obj_description(to_regnamespace('dentaia_locations_admin'), 'pg_namespace');
  if to_regnamespace('dentaia_locations_admin') is not null and
     (comentario is null or position('DentaIA migration 20261105160341_add_dentist_locations_and_reviews' in comentario) = 0) then
    raise exception 'ROLLBACK_BLOQUEADO: el esquema administrativo no pertenece a esta migración';
  end if;
  foreach nombre in array array['public.dentist_public_locations','public.dentist_reviews','public.dentist_review_reports','dentaia_locations_admin.auditoria_ubicaciones'] loop
    oid_objeto := to_regclass(nombre);
    if oid_objeto is not null then
      comentario := obj_description(oid_objeto, 'pg_class');
      if comentario is null or position('DentaIA migration 20261105160341_add_dentist_locations_and_reviews' in comentario) = 0 then
        raise exception 'ROLLBACK_BLOQUEADO: % no pertenece a esta migración', nombre;
      end if;
    end if;
  end loop;
  if to_regclass('public.dentist_public_locations') is not null
     and exists (select 1 from public.dentist_public_locations) then
    raise exception 'ROLLBACK_BLOQUEADO: dentist_public_locations contiene datos';
  end if;
  if to_regclass('public.dentist_reviews') is not null
     and exists (select 1 from public.dentist_reviews) then
    raise exception 'ROLLBACK_BLOQUEADO: dentist_reviews contiene datos';
  end if;
  if to_regclass('public.dentist_review_reports') is not null
     and exists (select 1 from public.dentist_review_reports) then
    raise exception 'ROLLBACK_BLOQUEADO: dentist_review_reports contiene datos';
  end if;
  if to_regclass('dentaia_locations_admin.auditoria_ubicaciones') is not null
     and exists (select 1 from dentaia_locations_admin.auditoria_ubicaciones) then
    raise exception 'ROLLBACK_BLOQUEADO: auditoría contiene datos';
  end if;
end
$guard$;

drop policy if exists dentist_public_locations_read_published on public.dentist_public_locations;
drop policy if exists dentist_reviews_read_published on public.dentist_reviews;
drop policy if exists dentist_reviews_create_after_completed_visit on public.dentist_reviews;
drop policy if exists dentist_review_reports_create_for_published_review on public.dentist_review_reports;
drop trigger if exists dentist_reviews_prevent_self_review on public.dentist_reviews;
drop function if exists public.dentaia_gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text);
drop function if exists dentaia_locations_admin.gestionar_ubicacion_v1(uuid,text,uuid,uuid,uuid,text,text,double precision,double precision,text);
drop function if exists dentaia_locations_admin.ubicacion_publicable(uuid);
drop function if exists dentaia_locations_admin.membresia_vigente(uuid,uuid);
drop function if exists public.prevent_professional_self_review();
drop table if exists public.dentist_review_reports;
drop table if exists public.dentist_reviews;
drop table if exists public.dentist_public_locations;
drop table if exists dentaia_locations_admin.auditoria_ubicaciones;
drop function if exists dentaia_locations_admin.impedir_edicion_auditoria_ubicaciones();
drop schema if exists dentaia_locations_admin;
-- La extensión PostGIS puede ser previa a esta migración; se conserva deliberadamente.

commit;
