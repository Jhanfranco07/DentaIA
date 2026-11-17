import test from "node:test";
import assert from "node:assert/strict";
import { marcarActividadRutina } from "./datos.ts";

function clienteMock({ id = "paciente-a", roles = ["paciente"], error = null } = {}) {
  const llamadas = [];
  let operacion = "";
  const builder = {
    upsert: (datos, opciones) => { operacion = "upsert"; llamadas.push({ operacion, datos, opciones }); return Promise.resolve({ error }); },
    delete: () => { operacion = "delete"; llamadas.push({ operacion }); return builder; },
    eq: (...argumentos) => { llamadas.push({ filtro: argumentos }); return builder; },
    then: (resolve, reject) => Promise.resolve({ error }).then(resolve, reject),
  };
  return {
    llamadas,
    auth: { getUser: async () => ({ data: { user: id ? { id, app_metadata: { dentaia: { version: 1, estado: "activo", roles } } } : null }, error: null }) },
    from: tabla => { llamadas.push({ tabla }); return builder; },
  };
}

test("rechaza sesiones ausentes, distintas y roles no autorizados antes de escribir", async () => {
  for (const [cliente, id] of [[clienteMock({ id: null }), "paciente-a"], [clienteMock({ id: "paciente-b" }), "paciente-a"], [clienteMock({ roles: ["odontologo"] }), "paciente-a"]]) {
    await assert.rejects(() => marcarActividadRutina(cliente, id, "plan", "actividad", true));
    assert.equal(cliente.llamadas.length, 0);
  }
});

test("marcar utiliza upsert idempotente con la clave natural de paciente/actividad/día", async () => {
  const cliente = clienteMock();
  await marcarActividadRutina(cliente, "paciente-a", "plan-v1", "actividad-1", true);
  const llamada = cliente.llamadas.find(item => item.operacion === "upsert");
  assert.equal("patient_id" in llamada.datos, false, "el paciente se deriva de auth.uid() en PostgreSQL");
  assert.equal(llamada.datos.plan_id, "plan-v1");
  assert.equal(llamada.opciones.onConflict, "patient_id,activity_id,completion_date");
  assert.equal(llamada.opciones.ignoreDuplicates, true);
});

test("desmarcar borra solo el paciente, plan, actividad y día propios", async () => {
  const cliente = clienteMock();
  await marcarActividadRutina(cliente, "paciente-a", "plan-v1", "actividad-1", false);
  assert.ok(cliente.llamadas.some(item => item.operacion === "delete"));
  for (const campo of ["patient_id", "plan_id", "activity_id", "completion_date"]) {
    assert.ok(cliente.llamadas.some(item => item.filtro?.[0] === campo), `falta filtro ${campo}`);
  }
});

test("propaga error de persistencia para permitir recuperación en la vista", async () => {
  const cliente = clienteMock({ error: new Error("offline") });
  await assert.rejects(() => marcarActividadRutina(cliente, "paciente-a", "plan-v1", "actividad-1", true), /offline/);
});

test("dos cuentas sintéticas producen escrituras sin identificadores de paciente manipulables", async () => {
  const cuentaA = clienteMock({ id: "sintetico-a" });
  const cuentaB = clienteMock({ id: "sintetico-b" });
  await marcarActividadRutina(cuentaA, "sintetico-a", "plan-v1", "actividad-1", true);
  await marcarActividadRutina(cuentaB, "sintetico-b", "plan-v1", "actividad-1", true);
  assert.deepEqual(cuentaA.llamadas.find(item => item.operacion === "upsert").datos, cuentaB.llamadas.find(item => item.operacion === "upsert").datos);
  await assert.rejects(() => marcarActividadRutina(cuentaA, "sintetico-b", "plan-v1", "actividad-1", true));
});
