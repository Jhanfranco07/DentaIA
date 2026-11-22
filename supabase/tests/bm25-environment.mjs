import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const usuarios = ["001", "002", "003", "004"].map(n => "aa000000-0000-4000-8000-000000000" + n);
export const odontologos = ["001", "002", "003"].map(n => "bb000000-0000-4000-8000-000000000" + n);
export const solicitudes = ["001", "002", "003"].map(n => "cc000000-0000-4000-8000-000000000" + n);
const migracion = "../migrations/20261122153246_bm25_search.sql";

export async function abrirBaseBm25() {
  const paquete = process.env.DENTAIA_PGLITE_MODULE;
  const { PGlite } = await (paquete ? import(pathToFileURL(paquete).href) : import("@electric-sql/pglite"));
  const db = new PGlite();
  await db.exec(readFileSync(new URL("./fixtures/bm25-search.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL(migracion, import.meta.url), "utf8"));
  return db;
}

export function consultar(db, role, user, sql, args = []) {
  return db.transaction(async tx => {
    await tx.exec("set local role " + role);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? ""]);
    const { rows } = await tx.query(sql, args);
    return rows[0]?.resultado;
  });
}

export const directorio = (db, { q = "", distrito = "", especialidad = "", orden = "nombre",
  pagina = 1, tamano = 24, lat = null, lon = null, radio = null } = {}) =>
  consultar(db, "anon", null, "select public.dentaia_buscar_directorio($1,$2,$3,$4,$5,$6,$7,$8,$9) resultado",
    [q, distrito, especialidad, orden, pagina, tamano, lat, lon, radio]);

export const historial = (db, user, { q = "", estado = "todas", pagina = 1, tamano = 12 } = {}) =>
  consultar(db, "authenticated", user, "select public.dentaia_buscar_solicitudes($1,$2,$3,$4) resultado", [q, estado, pagina, tamano]);

export const administracion = (db, { q, rol = "todos", estado = "todos", pagina = 1, tamano = 5 }) =>
  consultar(db, "service_role", null, "select public.dentaia_buscar_usuarios($1,$2,$3,$4,$5) resultado", [q, rol, estado, pagina, tamano]);
