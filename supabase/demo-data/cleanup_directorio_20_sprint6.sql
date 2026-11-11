-- Limpieza exclusiva de directorio-demo-2026-11-v1; ejecutar SOLO en PostgreSQL local o de pruebas autorizado.
BEGIN;
DELETE FROM public.directory_demo_locations WHERE slug IN ('odontologo-demo-s6-01', 'odontologo-demo-s6-02', 'odontologo-demo-s6-03', 'odontologo-demo-s6-04', 'odontologo-demo-s6-05', 'odontologo-demo-s6-06', 'odontologo-demo-s6-07', 'odontologo-demo-s6-08', 'odontologo-demo-s6-09', 'odontologo-demo-s6-10', 'odontologo-demo-s6-11', 'odontologo-demo-s6-12', 'odontologo-demo-s6-13', 'odontologo-demo-s6-14', 'odontologo-demo-s6-15', 'odontologo-demo-s6-16', 'odontologo-demo-s6-17', 'odontologo-demo-s6-18', 'odontologo-demo-s6-19', 'odontologo-demo-s6-20') AND is_demo IS TRUE AND requests_enabled IS FALSE AND name LIKE 'Punto académico DEMO %';
DO $$ BEGIN RAISE NOTICE 'Limpieza directorio-demo-2026-11-v1: revisar filas eliminadas en salida psql'; END $$;
COMMIT;
