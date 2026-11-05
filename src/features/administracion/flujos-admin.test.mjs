import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { flujosAdministrativosHabilitados } from "./ambiente-flujos.ts";

const raiz = fileURLToPath(new URL("../../../", import.meta.url));
test("el nuevo flujo no habilita escrituras sin opt-in Preview/local", () => {
  assert.equal(flujosAdministrativosHabilitados({ NODE_ENV: "development" }), false);
  assert.equal(flujosAdministrativosHabilitados({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", DENTAIA_ADMIN_WORKFLOWS_ENABLED: "true" }), false);
  assert.equal(flujosAdministrativosHabilitados({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "develop", DENTAIA_ADMIN_WORKFLOWS_ENABLED: "true" }), true);
});

test("la nueva migración usa RPC autenticados, auditoría inmutable y bloquea membresías no verificadas", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261105213500_admin_workflows_clinics_and_reviews.sql", import.meta.url), "utf8");
  assert.match(sql, /aal' is distinct from 'aal2'/i);
  assert.match(sql, /authentication_method = 'totp'[\s\S]*updated_at > clock_timestamp\(\) - interval '5 minutes'/i);
  assert.match(sql, /professional\.status <> 'verified'[\s\S]*dentist\.is_demo is not false[\s\S]*clinic\.status <> 'active'/i);
  assert.match(sql, /membership_change','allowed'/i);
  assert.match(sql, /publication_status = 'hidden'/i);
  assert.match(sql, /audit_events_immutable/i);
  assert.match(sql, /grant execute on function public\.dentaia_manage_clinic_membership_v1[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)[\s\S]{0,180}clinic_memberships/i);
  assert.doesNotMatch(sql, /set\s+role\s+service_role|service_role\s+as\s+actor/i);
});

test("el historial local de migraciones usa la versión registrada remotamente", () => {
  const files = readFileSync(new URL("../../../supabase/migrations/20261105210643_add_dentist_locations_and_reviews.sql", import.meta.url), "utf8");
  assert.match(files, /DentaIA migration 20261105160341_add_dentist_locations_and_reviews/);
  assert.doesNotMatch(files, /^begin;[\s\S]*?update\s+supabase_migrations/i);
});

test("los rollback están fuera del directorio que lee supabase db push y protegen su auditoría", () => {
  const rollback = readFileSync(new URL("../../../supabase/rollbacks/20261105213500_admin_workflows_clinics_and_reviews.sql", import.meta.url), "utf8");
  assert.match(rollback, /ROLLBACK_BLOQUEADO: existe auditoría administrativa/i);
  assert.doesNotMatch(rollback, /delete\s+from\s+clinical\.|truncate\s+table/i);
});
