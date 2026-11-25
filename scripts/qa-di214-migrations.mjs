
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const docker = process.env.DI214_DOCKER ?? "docker";
const container = process.env.DI214_DB_CONTAINER ?? "supabase_db_dentaia_di214_qa";
const compat = process.argv.includes("--with-di213");
assert.ok([
  "supabase_db_dentaia_di214_qa",
  "supabase_db_dentaia_di214_clean",
].includes(container), "Expected an isolated DI-214 container.");

function sql(source) {
  const result = spawnSync(docker,["exec","-i",container,"psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-qAt"],{
    input:source,encoding:"utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  return result.stdout.trim();
}
assert.equal(sql("SELECT to_regclass('public.profiles') IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users);"),"t",
  "Expected a clean disposable Supabase database.");
const root="supabase/migrations/";
const phase="docs/arquitectura/integracion_fase8/migraciones/";
const read=path=>readFileSync(path,"utf8");
for (const migration of readdirSync(root).filter(file=>file.endsWith(".sql")).sort()) {
  if (migration.startsWith("20261103")) {
    console.log(migration);
    sql(read(root+migration));
    for (const prerequisite of readdirSync(phase).filter(file=>/_0[234]_/.test(file)).sort()) {
      const source=read(phase+prerequisite), boundary="END $fase8$;";
      const guard=source.indexOf(boundary);
      assert.ok(guard>=0,"Missing reviewed Fase 8 guard.");
      console.log(prerequisite+" (QA local)");
      sql("BEGIN;\n"+source.slice(guard+boundary.length));
    }
    continue;
  }
  if (compat && migration.includes("di214_premium_evaluation_history")) {
    const di213=spawnSync("git",["show","5cbfe3368d2995010db211f428eb77a390645709:supabase/migrations/20261125061658_di213_odontograma.sql"],{
      encoding:"utf8",
    });
    assert.equal(di213.status,0);
    console.log("20261125061658_di213_odontograma.sql (PR #118, solo QA)");
    sql(di213.stdout);
  }
  console.log(migration);
  sql(read(root+migration));
}
assert.equal(sql("SELECT to_regclass('clinical.premium_evaluations') IS NOT NULL;"),"t");
if(compat) assert.equal(sql("SELECT to_regclass('clinical.odontogram_events') IS NOT NULL;"),"t");
console.log("PostgreSQL "+sql("SHOW server_version")+" · migraciones verificadas");
