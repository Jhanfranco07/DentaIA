-- directorio-demo-2026-11-v1; ejecutar SOLO en PostgreSQL local o de pruebas autorizado.
-- No crea profesionales, cuentas, clínicas ni membresías.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.directory_demo_locations WHERE slug IN ('odontologo-demo-s6-01', 'odontologo-demo-s6-02', 'odontologo-demo-s6-03', 'odontologo-demo-s6-04', 'odontologo-demo-s6-05', 'odontologo-demo-s6-06', 'odontologo-demo-s6-07', 'odontologo-demo-s6-08', 'odontologo-demo-s6-09', 'odontologo-demo-s6-10', 'odontologo-demo-s6-11', 'odontologo-demo-s6-12', 'odontologo-demo-s6-13', 'odontologo-demo-s6-14', 'odontologo-demo-s6-15', 'odontologo-demo-s6-16', 'odontologo-demo-s6-17', 'odontologo-demo-s6-18', 'odontologo-demo-s6-19', 'odontologo-demo-s6-20') AND (is_demo IS NOT TRUE OR requests_enabled IS NOT FALSE)) THEN
    RAISE EXCEPTION 'Colisión con registro no demo; seed cancelado';
  END IF;
END $$;
INSERT INTO public.directory_demo_locations (slug, name, district, city, country, latitude, longitude, is_demo, is_published, requests_enabled, public_label) VALUES
  ('odontologo-demo-s6-01', 'Punto académico DEMO 01', 'Miraflores', 'Lima', 'Perú', -12.119, -77.03, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-02', 'Punto académico DEMO 02', 'San Isidro', 'Lima', 'Perú', -12.097, -77.036, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-03', 'Punto académico DEMO 03', 'Surco', 'Lima', 'Perú', -12.145, -76.991, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-04', 'Punto académico DEMO 04', 'La Molina', 'Lima', 'Perú', -12.078, -76.911, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-05', 'Punto académico DEMO 05', 'San Borja', 'Lima', 'Perú', -12.108, -77.001, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-06', 'Punto académico DEMO 06', 'Barranco', 'Lima', 'Perú', -12.149, -77.021, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-07', 'Punto académico DEMO 07', 'Jesús María', 'Lima', 'Perú', -12.073, -77.049, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-08', 'Punto académico DEMO 08', 'Pueblo Libre', 'Lima', 'Perú', -12.077, -77.063, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-09', 'Punto académico DEMO 09', 'Magdalena del Mar', 'Lima', 'Perú', -12.091, -77.07, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-10', 'Punto académico DEMO 10', 'Lince', 'Lima', 'Perú', -12.084, -77.035, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-11', 'Punto académico DEMO 11', 'Surquillo', 'Lima', 'Perú', -12.111, -77.018, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-12', 'Punto académico DEMO 12', 'San Miguel', 'Lima', 'Perú', -12.077, -77.085, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-13', 'Punto académico DEMO 13', 'Chorrillos', 'Lima', 'Perú', -12.174, -77.021, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-14', 'Punto académico DEMO 14', 'Breña', 'Lima', 'Perú', -12.06, -77.052, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-15', 'Punto académico DEMO 15', 'Rímac', 'Lima', 'Perú', -12.031, -77.034, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-16', 'Punto académico DEMO 16', 'Los Olivos', 'Lima', 'Perú', -11.991, -77.07, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-17', 'Punto académico DEMO 17', 'Comas', 'Lima', 'Perú', -11.954, -77.058, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-18', 'Punto académico DEMO 18', 'Ate', 'Lima', 'Perú', -12.027, -76.925, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-19', 'Punto académico DEMO 19', 'Villa El Salvador', 'Lima', 'Perú', -12.216, -76.943, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-20', 'Punto académico DEMO 20', 'Lima', 'Lima', 'Perú', -12.046, -77.043, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real')
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, district=EXCLUDED.district, city=EXCLUDED.city, country=EXCLUDED.country, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, is_published=true, public_label=EXCLUDED.public_label
WHERE public.directory_demo_locations.is_demo IS TRUE AND public.directory_demo_locations.requests_enabled IS FALSE;
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM public.directory_demo_locations WHERE slug IN ('odontologo-demo-s6-01', 'odontologo-demo-s6-02', 'odontologo-demo-s6-03', 'odontologo-demo-s6-04', 'odontologo-demo-s6-05', 'odontologo-demo-s6-06', 'odontologo-demo-s6-07', 'odontologo-demo-s6-08', 'odontologo-demo-s6-09', 'odontologo-demo-s6-10', 'odontologo-demo-s6-11', 'odontologo-demo-s6-12', 'odontologo-demo-s6-13', 'odontologo-demo-s6-14', 'odontologo-demo-s6-15', 'odontologo-demo-s6-16', 'odontologo-demo-s6-17', 'odontologo-demo-s6-18', 'odontologo-demo-s6-19', 'odontologo-demo-s6-20') AND is_demo IS TRUE AND is_published IS TRUE AND requests_enabled IS FALSE;
  IF total <> 20 THEN RAISE EXCEPTION 'Seed incompleto: % de 20 puntos', total; END IF;
  RAISE NOTICE 'Dataset directorio-demo-2026-11-v1: % puntos demo presentes', total;
END $$;
COMMIT;
