-- Limpia solo el punto académico reservado para esta demostración; no toca otros datos.
begin;

delete from public.directory_demo_locations
where slug = 'clinica-demo-la-molina'
  and name = 'Clínica Dental Demo La Molina'
  and is_demo is true
  and requests_enabled is false
returning id, slug;

commit;
