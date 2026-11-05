import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = new URL("../../../", import.meta.url);
const migracion = readFileSync(fileURLToPath(new URL("supabase/migrations/20261105160341_add_dentist_locations_and_reviews.sql", raiz)), "utf8");
const rollback = readFileSync(fileURLToPath(new URL("supabase/migrations/20261105160341_add_dentist_locations_and_reviews.rollback.sql", raiz)), "utf8");

test("la migración solo crea tablas nuevas y no altera el esquema clínico existente", () => {
  for (const table of ["dentist_public_locations", "dentist_reviews", "dentist_review_reports"]) {
    assert.match(migracion, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  }
  assert.doesNotMatch(migracion, /alter\s+table\s+public\.(dentists|appointment_requests|profiles)\b/i);
  assert.doesNotMatch(migracion, /drop\s+(table|schema|extension)\b/i);
});

test("solo concede lectura pública mínima de sedes y prohíbe insertar o actualizar coordenadas", () => {
  assert.match(migracion, /revoke all on table public\.dentist_public_locations from public, anon, authenticated, service_role/i);
  assert.match(migracion, /grant select \(id, dentist_id, practice_name, practice_address, latitude, longitude, created_at\)[\s\S]*?to anon, authenticated/i);
  assert.doesNotMatch(migracion, /grant\s+(insert|update|delete|all)[\s\S]{0,150}dentist_public_locations/i);
  assert.match(migracion, /publication_status = 'published'[\s\S]*?dentist\.is_active is true/i);
  assert.doesNotMatch(migracion, /grant select \([^)]*clinic_id[^)]*\)[\s\S]*?dentist_public_locations/i);
});

test("la reseña exige identidad propia, rol paciente activo, una atención real completada y moderación", () => {
  assert.match(migracion, /unique \(appointment_request_id\)/i);
  assert.match(migracion, /author_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migracion, /'version'\) = '1'[\s\S]*?'estado'\) = 'activo'/i);
  assert.match(migracion, /roles'[^\n]*\? 'paciente'/i);
  assert.match(migracion, /roles'[^\n]*\? 'odontologo'/i);
  assert.match(migracion, /request\.user_id = \(select auth\.uid\(\)\)[\s\S]*?request\.is_demo is false[\s\S]*?request\.status = 'completed'/i);
  assert.match(migracion, /request\.dentist_id\s*=\s*dentist_reviews\.dentist_id/i);
  assert.doesNotMatch(migracion, /request\.dentist_id\s*=\s*dentist_id\b/i);
  assert.match(migracion, /moderation_status = 'pending'/i);
  assert.match(migracion, /grant insert \(dentist_id, appointment_request_id, rating, comment\)\s+on table public\.dentist_reviews to authenticated/i);
  assert.doesNotMatch(migracion, /grant\s+(update|delete|all)[\s\S]{0,150}dentist_reviews/i);
  assert.match(migracion, /esquema académico actual admite exclusivamente is_demo=true y requested\/cancelled/i);
  assert.match(migracion, /appointment_request_id uuid not null references public\.appointment_requests\(id\) on delete cascade/i);
  assert.match(migracion, /author_user_id uuid not null default auth\.uid\(\) references auth\.users\(id\) on delete cascade/i);
  assert.match(migracion, /create function public\.prevent_professional_self_review\(\)[\s\S]*?security definer[\s\S]*?set search_path = pg_catalog/i);
  assert.match(migracion, /from clinical\.professional_accounts as professional[\s\S]*?professional\.user_id = \(select auth\.uid\(\)\)[\s\S]*?professional\.dentist_id = new\.dentist_id/i);
  assert.match(migracion, /revoke all on function public\.prevent_professional_self_review\(\) from public, anon, authenticated, service_role/i);
  assert.match(migracion, /create trigger dentist_reviews_prevent_self_review\s+before insert on public\.dentist_reviews/i);
});

test("autor solo puede leer campos públicos publicados; reportes quedan privados", () => {
  assert.match(migracion, /grant select \(id, dentist_id, rating, comment, created_at\)[\s\S]*?to anon, authenticated/i);
  assert.match(migracion, /moderation_status = 'published'[\s\S]*?dentist\.is_active is true/i);
  assert.doesNotMatch(migracion, /grant select \([^)]*(author_user_id|moderation_status)[^)]*\)[\s\S]*?dentist_reviews/i);
  assert.match(migracion, /revoke all on table public\.dentist_review_reports from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(migracion, /grant select[\s\S]{0,150}dentist_review_reports/i);
  assert.match(migracion, /review_id uuid not null references public\.dentist_reviews\(id\) on delete cascade/i);
  assert.match(migracion, /reporter_user_id uuid not null default auth\.uid\(\) references auth\.users\(id\) on delete cascade/i);
});

test("el rollback verifica propiedad y se niega a borrar información", () => {
  assert.match(rollback, /ROLLBACK_BLOQUEADO: % no pertenece a esta migración/i);
  assert.match(rollback, /ROLLBACK_BLOQUEADO: dentist_public_locations contiene datos/i);
  assert.match(rollback, /ROLLBACK_BLOQUEADO: dentist_reviews contiene datos/i);
  assert.match(rollback, /drop policy if exists dentist_public_locations_read_published/i);
  assert.doesNotMatch(rollback, /drop\s+table[^;]*cascade/i);
  assert.doesNotMatch(rollback, /drop\s+extension/i);
});
