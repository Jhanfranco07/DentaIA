-- directorio-demo-2026-11-v2: veinte centros con georreferencia documental.
-- Revisar antes de ejecutar. No crear cuentas, clínicas clínicas, profesionales verificados ni vínculos profesionales.
-- IMPORTANTE: public_label es literal de compatibilidad con CHECK legado; las clínicas de referencia son reales, pero los médicos son ficticios.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.directory_demo_locations WHERE slug IN ('odontologo-demo-s6-01', 'odontologo-demo-s6-02', 'odontologo-demo-s6-03', 'odontologo-demo-s6-04', 'odontologo-demo-s6-05', 'odontologo-demo-s6-06', 'odontologo-demo-s6-07', 'odontologo-demo-s6-08', 'odontologo-demo-s6-09', 'odontologo-demo-s6-10', 'odontologo-demo-s6-11', 'odontologo-demo-s6-12', 'odontologo-demo-s6-13', 'odontologo-demo-s6-14', 'odontologo-demo-s6-15', 'odontologo-demo-s6-16', 'odontologo-demo-s6-17', 'odontologo-demo-s6-18', 'odontologo-demo-s6-19', 'odontologo-demo-s6-20') AND (is_demo IS NOT TRUE OR requests_enabled IS NOT FALSE)) THEN
 RAISE EXCEPTION 'Conflicto: los slugs reservados pertenecen a datos no demo'; END IF;
END $$;
INSERT INTO public.directory_demo_locations (slug,name,district,city,country,latitude,longitude,is_demo,is_published,requests_enabled,public_label) VALUES
  ('odontologo-demo-s6-01', 'Cerdent San Borja', 'San Borja', 'Lima', 'Perú', -12.100849, -76.999601, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-02', 'Cerdent Jesús María', 'Jesús María', 'Lima', 'Perú', -12.089279, -77.058167, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-03', 'Cerdent La Molina', 'La Molina', 'Lima', 'Perú', -12.070348, -76.95249, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-04', 'Romandent Miraflores', 'Miraflores', 'Lima', 'Perú', -12.128138, -77.005019, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-05', 'Romandent San Isidro', 'San Isidro', 'Lima', 'Perú', -12.106403, -77.054749, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-06', 'Romandent Surco', 'Santiago de Surco', 'Lima', 'Perú', -12.105931, -76.973386, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-07', 'Dental Científica (Universidad Científica del Sur)', 'Miraflores', 'Lima', 'Perú', -12.119411, -77.026132, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-08', 'Clínica Dental Smile Perfection', 'Miraflores', 'Lima', 'Perú', -12.117637, -77.031481, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-09', 'Centro Odontológico Universidad Wiener', 'Lima', 'Lima', 'Perú', -12.069504, -77.037002, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-10', 'Vital Dent Integral', 'Jesús María', 'Lima', 'Perú', -12.07, -77.0453, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-11', 'Centro Odontológico Americano Primavera', 'San Borja', 'Lima', 'Perú', -12.110287, -76.986509, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-12', 'Dental Procare', 'Miraflores', 'Lima', 'Perú', -12.12096, -77.027807, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-13', 'Bogdent', 'Lima', 'Lima', 'Perú', -12.074412, -77.034597, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-14', 'Odontosalud Chorrillos', 'Chorrillos', 'Lima', 'Perú', -12.177811, -76.997082, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-15', 'Centro Odontológico Americano Los Olivos', 'Los Olivos', 'Lima', 'Perú', -11.995633, -77.080356, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-16', 'Multident Chorrillos', 'Chorrillos', 'Lima', 'Perú', -12.17101, -77.022508, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-17', 'Centro Especializado en Odontoestomatología', 'Pueblo Libre', 'Lima', 'Perú', -12.074555, -77.054864, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-18', 'Dental Max San Miguel', 'San Miguel', 'Lima', 'Perú', -12.071798, -77.098367, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-19', 'Centro Odontológico Americano El Campillo', 'San Miguel', 'Lima', 'Perú', -12.079831, -77.079575, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real'),
  ('odontologo-demo-s6-20', 'Mueca Lince', 'Lince', 'Lima', 'Perú', -12.086597, -77.039917, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real')
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,district=EXCLUDED.district,city=EXCLUDED.city,country=EXCLUDED.country,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,is_published=true,public_label=EXCLUDED.public_label
WHERE public.directory_demo_locations.is_demo IS TRUE AND public.directory_demo_locations.requests_enabled IS FALSE;
DO $$ DECLARE total integer;BEGIN
 SELECT count(*) INTO total FROM public.directory_demo_locations WHERE slug IN ('odontologo-demo-s6-01', 'odontologo-demo-s6-02', 'odontologo-demo-s6-03', 'odontologo-demo-s6-04', 'odontologo-demo-s6-05', 'odontologo-demo-s6-06', 'odontologo-demo-s6-07', 'odontologo-demo-s6-08', 'odontologo-demo-s6-09', 'odontologo-demo-s6-10', 'odontologo-demo-s6-11', 'odontologo-demo-s6-12', 'odontologo-demo-s6-13', 'odontologo-demo-s6-14', 'odontologo-demo-s6-15', 'odontologo-demo-s6-16', 'odontologo-demo-s6-17', 'odontologo-demo-s6-18', 'odontologo-demo-s6-19', 'odontologo-demo-s6-20') AND is_demo AND is_published AND NOT requests_enabled;
 IF total <> 20 THEN RAISE EXCEPTION '20 puntos requeridos; encontrados %',total;END IF;
 RAISE NOTICE 'Datos v2: 20 puntos publicados y sin solicitudes';
END $$;
COMMIT;
