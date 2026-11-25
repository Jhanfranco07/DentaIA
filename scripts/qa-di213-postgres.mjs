import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const clinical = "docs/arquitectura/integracion_fase8/migraciones/";
const sql = [await read("supabase/tests/fixtures/di213-auth-storage.sql")];

for (const file of ["20261103235408_di36_dentalia_02_modelo_clinico.sql", "20261103235409_di36_dentalia_03_rpc_clinicos.sql"]) {
  const source = await read(clinical + file);
  // Solo QA desechable. La guarda de despliegue Fase 8 sigue intacta en el SQL original.
  const boundary = "END $fase8$;";
  const guard = source.indexOf(boundary);
  if (guard < 0) throw new Error("Guarda Fase 8 no reconocida.");
  sql.push("BEGIN;\n" + source.slice(guard + boundary.length));
}
const repoSql = [
  "supabase/migrations/20261117150501_smile_analysis_history_20261117042645.sql",
  "supabase/migrations/20261125061658_di213_odontograma.sql",
  "supabase/tests/di213_odontograma.sql",
];
sql.push(...await Promise.all(repoSql.map(read)));

const target = process.argv[2];
if (target === "--sql") {
  process.stdout.write(sql.join("\n"));
} else {
  if (!target) throw new Error("Indica --sql o la ruta local del paquete @electric-sql/pglite.");
  const dist = join(resolve(target), "dist");
  const { PGlite } = await import(pathToFileURL(join(dist, "index.js")));
  const { btree_gist } = await import(pathToFileURL(join(dist, "contrib", "btree_gist.js")));
  const db = new PGlite({ username: "postgres", extensions: { btree_gist } });
  try {
    for (const statement of sql) await db.exec(statement);
    const { rows } = await db.query("select current_setting('server_version') as version, count(*)::int as revisions from clinical.odontogram_events");
    console.log("DI-213 SQL/RLS: correcto", rows[0]);
  } catch (error) {
    console.error(error.code, error.message, error.detail ?? "", error.where ?? "");
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
