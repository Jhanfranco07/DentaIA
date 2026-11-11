import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { CATALOGO_DEMO, VERSION_CATALOGO_DEMO } from "../src/features/directorio/catalogo-demo.ts";

const modo = process.argv[2] ?? "check";
const sqlText = valor => `'${String(valor).replaceAll("'", "''")}'`;
const ids = new Set(CATALOGO_DEMO.map(p => p.id));
const slugs = new Set(CATALOGO_DEMO.map(p => p.slug));
assert.equal(CATALOGO_DEMO.length, 20);
assert.equal(ids.size, 20);
assert.equal(slugs.size, 20);
assert.ok(new Set(CATALOGO_DEMO.map(p => p.specialty)).size >= 7);
assert.ok(new Set(CATALOGO_DEMO.map(p => p.district)).size >= 10);
for (const p of CATALOGO_DEMO) {
  assert.match(p.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(p.slug, /^odontologo-demo-s6-\d{2}$/);
  assert.ok(p.name.trim() && p.specialty.trim() && p.description.trim() && p.practice_name.trim());
  assert.ok(p.latitude >= -12.3 && p.latitude <= -11.9 && p.longitude >= -77.2 && p.longitude <= -76.8);
  assert.equal(p.source, VERSION_CATALOGO_DEMO);
}
console.log(`Catálogo ${VERSION_CATALOGO_DEMO}: 20 perfiles únicos; campos y coordenadas válidos.`);
if (modo === "check") process.exit(0);
const slugsSql = CATALOGO_DEMO.map(p => sqlText(p.slug)).join(", ");
const salida = modo === "seed" ? `-- ${VERSION_CATALOGO_DEMO}; ejecutar SOLO en PostgreSQL local o de pruebas autorizado.\n-- No crea profesionales, cuentas, clínicas ni membresías.\nBEGIN;\nDO $$\nBEGIN\n  IF EXISTS (SELECT 1 FROM public.directory_demo_locations WHERE slug IN (${slugsSql}) AND (is_demo IS NOT TRUE OR requests_enabled IS NOT FALSE)) THEN\n    RAISE EXCEPTION 'Colisión con registro no demo; seed cancelado';\n  END IF;\nEND $$;\nINSERT INTO public.directory_demo_locations (slug, name, district, city, country, latitude, longitude, is_demo, is_published, requests_enabled, public_label) VALUES\n${CATALOGO_DEMO.map(p => `  (${[p.slug,p.practice_name,p.district,"Lima","Perú"].map(sqlText).join(", ")}, ${p.latitude}, ${p.longitude}, true, true, false, 'DEMO — Clínica ficticia, no ofrece atención real')`).join(",\n")}\nON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, district=EXCLUDED.district, city=EXCLUDED.city, country=EXCLUDED.country, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, is_published=true, public_label=EXCLUDED.public_label\nWHERE public.directory_demo_locations.is_demo IS TRUE AND public.directory_demo_locations.requests_enabled IS FALSE;\nDO $$\nDECLARE total integer;\nBEGIN\n  SELECT count(*) INTO total FROM public.directory_demo_locations WHERE slug IN (${slugsSql}) AND is_demo IS TRUE AND is_published IS TRUE AND requests_enabled IS FALSE;\n  IF total <> 20 THEN RAISE EXCEPTION 'Seed incompleto: % de 20 puntos', total; END IF;\n  RAISE NOTICE 'Dataset ${VERSION_CATALOGO_DEMO}: % puntos demo presentes', total;\nEND $$;\nCOMMIT;\n` : modo === "cleanup" ? `-- Limpieza exclusiva de ${VERSION_CATALOGO_DEMO}; ejecutar SOLO en PostgreSQL local o de pruebas autorizado.\nBEGIN;\nDELETE FROM public.directory_demo_locations WHERE slug IN (${slugsSql}) AND is_demo IS TRUE AND requests_enabled IS FALSE AND name LIKE 'Punto académico DEMO %';\nDO $$ BEGIN RAISE NOTICE 'Limpieza ${VERSION_CATALOGO_DEMO}: revisar filas eliminadas en salida psql'; END $$;\nCOMMIT;\n` : null;
assert.ok(salida, "Uso: node --experimental-strip-types scripts/directorio-demo.mjs [check|seed|cleanup]");
const archivo = `supabase/demo-data/${modo}_directorio_20_sprint6.sql`;
writeFileSync(archivo, salida);
console.log(`Generado ${archivo}`);
