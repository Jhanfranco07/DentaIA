import assert from "node:assert/strict";
import test from "node:test";

const { crearControlConsultasClinicas, finalizarPaginacionRestringida } = await import(
  "./control-consultas-clinicas.ts"
);

test("restringir el contexto finaliza una paginación sin borrar su perfil", () => {
  const perfil = {
    estado: "listo",
    cargandoMas: true,
    contexts: ["membership-visible"],
  };

  const actualizado = finalizarPaginacionRestringida(perfil);

  assert.notEqual(actualizado, perfil);
  assert.equal(actualizado.cargandoMas, false);
  assert.deepEqual(actualizado.contexts, ["membership-visible"]);
  assert.equal(perfil.cargandoMas, true);
});

test("una restricción no recrea un estado de paginación ya finalizado", () => {
  const perfil = { estado: "listo", cargandoMas: false };

  assert.equal(finalizarPaginacionRestringida(perfil), perfil);
});

test("cambiar contexto aborta toda consulta pendiente y descarta sus resultados", () => {
  const control = crearControlConsultasClinicas();
  const perfil = control.iniciar("perfil");
  const historial = control.iniciar("historial");

  control.invalidarTodo();

  assert.equal(perfil.signal.aborted, true);
  assert.equal(historial.signal.aborted, true);
  assert.equal(perfil.vigente(), false);
  assert.equal(historial.vigente(), false);
});

test("una nueva consulta del mismo recurso cancela la anterior", () => {
  const control = crearControlConsultasClinicas();
  const primera = control.iniciar("pacientes");
  const segunda = control.iniciar("pacientes");

  assert.equal(primera.signal.aborted, true);
  assert.equal(primera.vigente(), false);
  assert.equal(segunda.signal.aborted, false);
  assert.equal(segunda.vigente(), true);

  segunda.finalizar();
  assert.equal(segunda.vigente(), false);
});

test("una respuesta atrasada no puede restaurar datos tras cambiar de contexto", async () => {
  const control = crearControlConsultasClinicas();
  const consultaAnterior = control.iniciar("historial");
  let historialVisible = "sin datos";

  const respuestaAtrasada = Promise.resolve().then(() => {
    if (consultaAnterior.vigente()) historialVisible = "historial anterior";
  });

  control.invalidarTodo();
  control.iniciar("historial");
  await respuestaAtrasada;

  assert.equal(consultaAnterior.signal.aborted, true);
  assert.equal(historialVisible, "sin datos");
});

test("cambiar de paciente cancela solo el historial en curso", () => {
  const control = crearControlConsultasClinicas();
  const pacientes = control.iniciar("pacientes");
  const historial = control.iniciar("historial");

  control.cancelar("historial");

  assert.equal(historial.signal.aborted, true);
  assert.equal(historial.vigente(), false);
  assert.equal(pacientes.signal.aborted, false);
  assert.equal(pacientes.vigente(), true);
});
