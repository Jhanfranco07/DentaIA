import assert from "node:assert/strict";
import test from "node:test";

const {
  crearControlRevalidacionHistorial,
  estadoRevalidacionHistorial,
} = await import("./control-revalidacion-historial.ts");

test("coalesce foco y visibilidad cercanos sin omitir una revalidación posterior", () => {
  const control = crearControlRevalidacionHistorial();
  const primera = control.solicitar();

  assert.equal(primera, 1);
  assert.equal(control.activa(primera), true);
  assert.equal(control.solicitar(), null);
  assert.equal(control.solicitar(), null);

  const posterior = control.finalizar(primera);
  assert.equal(posterior, 2);
  assert.equal(control.activa(posterior), true);
  assert.equal(control.finalizar(posterior), null);

  const trasRecuperarVisibilidad = control.solicitar();
  assert.equal(trasRecuperarVisibilidad, 3);
  assert.equal(control.activa(trasRecuperarVisibilidad), true);
});

test("invalidar una revalidación cancelada descarta la petición pendiente", () => {
  const control = crearControlRevalidacionHistorial();
  const activa = control.solicitar();
  control.solicitar();

  control.invalidar();

  assert.equal(control.finalizar(activa), null);
  assert.equal(control.solicitar(), 2);
});

test("reiniciar la cronología elimina páginas y cursor antes de releer el historial", () => {
  const estado = estadoRevalidacionHistorial();

  assert.deepEqual(estado, {
    vista: { estado: "cargando", historial: null },
    cargandoMas: false,
  });
  assert.equal("nextCursor" in estado.vista, false);
  assert.equal("entries" in estado.vista, false);
});
