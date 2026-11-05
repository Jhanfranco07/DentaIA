import test from "node:test";
import assert from "node:assert/strict";
import { adjuntarUbicaciones, normalizarResenas } from "./compatibilidad-esquema.ts";

test("el directorio conserva odontólogos cuando aún no existe la tabla pública de ubicaciones", () => {
  const base = [{ id: "dentista-a", name: "Perfil académico" }];
  const resultado = adjuntarUbicaciones(base, { data: null, error: { code: "PGRST205" } });
  assert.equal(resultado.disponibles, false);
  assert.deepEqual(resultado.dentistas, [{ ...base[0], ubicaciones: [] }]);
});

test("el directorio también soporta tablas habilitadas sin filas publicadas", () => {
  const resultado = adjuntarUbicaciones([{ id: "dentista-a" }], { data: [], error: null });
  assert.equal(resultado.disponibles, true);
  assert.deepEqual(resultado.dentistas[0].ubicaciones, []);
});

test("las reseñas ausentes se presentan vacías y no bloquean los perfiles", () => {
  assert.deepEqual(normalizarResenas({ data: null, error: { code: "PGRST205" } }), { disponibles: false, resenas: [] });
  assert.deepEqual(normalizarResenas({ data: [], error: null }), { disponibles: true, resenas: [] });
});
