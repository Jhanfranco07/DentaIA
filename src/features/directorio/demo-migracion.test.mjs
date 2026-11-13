import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = new URL("../../../", import.meta.url);
const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, raiz)), "utf8");
const migracion = leer("supabase/migrations/20261105223000_directory_demo_locations.sql");
const semilla = leer("supabase/demo-data/seed_clinica_demo_la_molina.sql");
const limpieza = leer("supabase/demo-data/cleanup_clinica_demo_la_molina.sql");
const mapa = leer("src/features/directorio/MapaDirectorio.tsx");
const directorio = leer("src/features/directorio/DirectorioLista.tsx");

test("la DEMO tiene tabla separada, marca inmutable, coordenadas acotadas y ninguna FK clínica", () => {
  assert.match(migracion, /create table public\.directory_demo_locations/i);
  assert.match(migracion, /is_demo boolean not null default true check \(is_demo is true\)/i);
  assert.match(migracion, /requests_enabled boolean not null default false check \(requests_enabled is false\)/i);
  assert.match(migracion, /latitude double precision not null check \(latitude between -90 and 90\)/i);
  assert.match(migracion, /longitude double precision not null check \(longitude between -180 and 180\)/i);
  assert.doesNotMatch(migracion, /references\s+(public\.dentists|clinical\.clinics|clinical\.professional_accounts|clinical\.clinic_memberships|public\.appointment_requests)/i);
  assert.match(migracion, /DEMO — Clínica ficticia, no ofrece atención real/);
});

test("RLS permite solo lectura de filas demo publicadas y niega toda escritura cliente", () => {
  assert.match(migracion, /enable row level security/i);
  assert.match(migracion, /revoke all on table public\.directory_demo_locations from public, anon, authenticated, service_role/i);
  assert.match(migracion, /grant select \([^)]*\)\s+on table public\.directory_demo_locations to anon, authenticated/i);
  assert.match(migracion, /for select to anon, authenticated\s+using \(is_demo is true and is_published is true and requests_enabled is false\)/i);
  assert.doesNotMatch(migracion, /create policy[^;]+for\s+(insert|update|delete|all)/i);
  assert.doesNotMatch(migracion, /grant\s+(insert|update|delete|all)[\s\S]{0,160}directory_demo_locations/i);
});

test("seed es repetible y acotado al slug DEMO; limpieza no elimina otros registros", () => {
  assert.match(semilla, /on conflict \(slug\) do update/i);
  assert.match(semilla, /'clinica-demo-la-molina'/);
  assert.match(semilla, /'Clínica Dental Demo La Molina'/);
  assert.match(semilla, /is_published = true[\s\S]*requests_enabled = false/i);
  assert.match(limpieza, /where slug = 'clinica-demo-la-molina'[\s\S]*name = 'Clínica Dental Demo La Molina'[\s\S]*is_demo is true[\s\S]*requests_enabled is false/i);
  assert.doesNotMatch(limpieza, /delete from\s+(public\.)?dentists|delete from\s+clinical\./i);
});

test("el marcador muestra una muela SVG vertical y conserva la separación entre DEMO y atención real", () => {
  assert.match(mapa, /function crearMarcador\(tipo: "demo" \| "consultorio"/);
  assert.match(mapa, /document\.createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "svg"\)/);
  assert.match(mapa, /elemento\.append\(fondo, icono\)/);
  assert.doesNotMatch(mapa, /icono\.textContent = "🦷"/);
  assert.match(mapa, /perfilDemo/);
  assert.match(mapa, /Perfil ficticio/);
  assert.match(mapa, /No hay vinculación acreditada con este centro ni reservas mediante DentaIA/);
  assert.doesNotMatch(mapa, /elemento\.textContent = "DEMO"/);
  assert.match(directorio, /crearMarcadorDemo/);
  assert.match(directorio, /marcadoresDemo/);
  assert.match(directorio, /AVISO_PERFILES_DEMO/);
});
