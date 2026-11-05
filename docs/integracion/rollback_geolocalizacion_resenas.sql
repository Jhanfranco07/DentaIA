-- Rollback manual de 20261105160341_add_dentist_locations_and_reviews.sql.
-- Destruye datos de ubicaciones/reseñas/reportes creados después de aplicar la migración.
-- Revisar dependencias y obtener autorización antes de ejecutar.
begin;
drop table if exists public.dentist_review_reports;
drop table if exists public.dentist_reviews;
drop table if exists public.dentist_public_locations;
-- PostGIS se conserva en el esquema extensions por si otras funciones lo usan.
commit;
