import test from "node:test";
import assert from "node:assert/strict";
import { esInteraccionElegible, ordenarResenas, resumirResenas } from "./resenas.ts";

test("no asigna calificación por defecto cuando no hay reseñas publicadas", () => {
  assert.deepEqual(resumirResenas([]), { total: 0, promedio: null, distribucion: [0, 0, 0, 0, 0] });
});

test("promedia solo calificaciones enteras entre uno y cinco", () => {
  assert.deepEqual(resumirResenas([{ rating: 5 }, { rating: 3 }, { rating: 5 }, { rating: 6 }, { rating: 2.5 }]), {
    total: 3, promedio: 13 / 3, distribucion: [0, 0, 1, 0, 2],
  });
});

test("ordena por fecha o por calificación y conserva orden estable secundario", () => {
  const rows = [
    { id: "a", dentist_id: "d", rating: 5, comment: "A", created_at: "2026-01-01" },
    { id: "b", dentist_id: "d", rating: 4, comment: "B", created_at: "2026-02-01" },
    { id: "c", dentist_id: "d", rating: 5, comment: "C", created_at: "2026-02-01" },
  ];
  assert.deepEqual(ordenarResenas(rows, "recientes").map(r => r.id), ["c", "b", "a"]);
  assert.deepEqual(ordenarResenas(rows, "mejor-calificadas").map(r => r.id), ["c", "a", "b"]);
});

test("solo una interacción real completada es elegible, nunca una solicitud demo", () => {
  assert.equal(esInteraccionElegible({ is_demo: false, status: "completed" }), true);
  assert.equal(esInteraccionElegible({ is_demo: true, status: "completed" }), false);
  assert.equal(esInteraccionElegible({ is_demo: false, status: "requested" }), false);
});
