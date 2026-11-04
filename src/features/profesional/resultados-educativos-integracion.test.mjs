import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Permite que Node 22 resuelva los imports internos TypeScript que Next maneja.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith(".") &&
      context.parentURL?.includes("/profesional/") &&
      !/\.[a-z]+$/i.test(specifier)
    ) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    }

    return nextResolve(specifier, context);
  },
});

const {
  iniciarVistaResultadosEducativos,
  resolverVistaResultadosEducativos,
} = await import("./resultados-educativos-interfaz.ts");
const { crearProveedorResultadosEducativosSintetico } = await import(
  "./proveedor-resultados-educativos-sintetico.ts",
);

const solicitud = {
  patientId: "paciente-demo-a",
  contextId: "contexto-demo-norte",
};

test("la interfaz educativa inicia sin contenido anterior", () => {
  assert.deepEqual(iniciarVistaResultadosEducativos(), {
    estado: "cargando",
    resultado: null,
  });
});

test("la interfaz consume el proveedor sintético mediante el contrato validado", async () => {
  const respuesta = await crearProveedorResultadosEducativosSintetico(
    "disponible",
  ).consultar(solicitud);
  const vista = resolverVistaResultadosEducativos(respuesta);

  assert.equal(vista.estado, "contenido");
  assert.ok(vista.resultado);
  assert.deepEqual(Object.keys(vista.resultado).sort(), [
    "aviso",
    "fuente",
    "id",
    "observaciones",
    "recomendaciones",
    "titulo",
  ]);
  for (const propiedad of [
    "patientId",
    "encounterIds",
    "diagnosticos",
    "tratamientos",
  ]) {
    assert.equal(propiedad in vista.resultado, false);
  }
});

test("la interfaz muestra vacío sin transportar contenido", async () => {
  const respuesta = await crearProveedorResultadosEducativosSintetico(
    "vacio",
  ).consultar(solicitud);
  const vista = resolverVistaResultadosEducativos(respuesta);

  assert.deepEqual(vista, { estado: "vacio", resultado: null });
});

test("una fuente educativa no disponible se presenta como error seguro", async () => {
  const respuesta = await crearProveedorResultadosEducativosSintetico(
    "error",
  ).consultar(solicitud);
  const vista = resolverVistaResultadosEducativos(respuesta);

  assert.deepEqual(vista, { estado: "error", resultado: null });
});
