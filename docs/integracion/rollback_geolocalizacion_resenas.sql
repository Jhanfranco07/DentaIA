-- Rollback manual de 20261105160341_add_dentist_locations_and_reviews.sql.
-- Destruye datos de ubicaciones/reseñas/reportes creados después de aplicar la migración.
-- Revisar dependencias y obtener autorización antes de ejecutar.
begin;

-- Solo revierte tablas de esta migración y únicamente cuando siguen vacías.
-- Conserva cualquier fila y rechaza tablas homónimas sin la marca de propiedad.
do $rollback$
declare
  target_table text;
  object_oid oid;
  function_oid oid;
  object_comment text;
  has_rows boolean;
  ownership_marker constant text := 'DentaIA migration 20261105160341_add_dentist_locations_and_reviews';
begin
  foreach target_table in array array[
    'public.dentist_review_reports',
    'public.dentist_reviews',
    'public.dentist_public_locations'
  ] loop
    object_oid := to_regclass(target_table);
    if object_oid is null then
      continue;
    end if;

    object_comment := obj_description(object_oid, 'pg_class');
    if object_comment is null or position(ownership_marker in object_comment) = 0 then
      raise exception 'Rollback cancelado: % no tiene la marca de propiedad de la migración.', target_table;
    end if;

    execute format('select exists (select 1 from %s)', object_oid::regclass) into has_rows;
    if has_rows then
      raise exception 'Rollback cancelado: % contiene información; exporta/revisa los datos y decide un plan manual.', target_table;
    end if;
  end loop;

  function_oid := to_regprocedure('public.prevent_professional_self_review()');
  if function_oid is not null then
    object_comment := obj_description(function_oid, 'pg_proc');
    if object_comment is null or position(ownership_marker in object_comment) = 0 then
      raise exception 'Rollback cancelado: la función de protección no tiene la marca de propiedad de la migración.';
    end if;
  end if;
end
$rollback$;

drop table if exists public.dentist_review_reports;
drop table if exists public.dentist_reviews;
drop table if exists public.dentist_public_locations;
drop function if exists public.prevent_professional_self_review();
-- PostGIS se conserva en el esquema extensions por si otras funciones lo usan.
commit;
