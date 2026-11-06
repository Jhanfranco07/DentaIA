-- Ejecutar manualmente después de que la migración directory_demo_locations esté aplicada.
-- Idempotente: solo crea/actualiza el slug fijo de este registro DEMO.
-- Coordenada de mapa aproximada en La Molina; no representa consultorio, domicilio ni entrada física.
begin;

insert into public.directory_demo_locations (
  slug, name, district, city, country, latitude, longitude,
  is_demo, is_published, requests_enabled, public_label
) values (
  'clinica-demo-la-molina',
  'Clínica Dental Demo La Molina',
  'La Molina',
  'Lima',
  'Perú',
  -12.078,
  -76.911,
  true,
  true,
  false,
  'DEMO — Clínica ficticia, no ofrece atención real'
)
on conflict (slug) do update set
  name = excluded.name,
  district = excluded.district,
  city = excluded.city,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_demo = true,
  is_published = true,
  requests_enabled = false,
  public_label = excluded.public_label
where public.directory_demo_locations.is_demo is true
  and public.directory_demo_locations.requests_enabled is false
returning id, slug, name, district, is_demo, is_published, requests_enabled, public_label;

commit;
