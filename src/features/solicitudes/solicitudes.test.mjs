
import test from "node:test";
import assert from "node:assert/strict";
import {
  obtenerMisSolicitudes,
  cancelarSolicitudDemo,
} from "./solicitudes.ts";

function crearCliente({
  usuarioId = "usuario-1",
  solicitudes = [],
  errorConsulta = null,
  errorCancelacion = null,
  filasCanceladas = [{ id: "solicitud-1" }],
} = {}) {
  const llamadas = [];
  let operacion = "lectura";

  const consulta = {
    select(...args) {
      llamadas.push(["select", ...args]);
      return this;
    },
    eq(...args) {
      llamadas.push(["eq", ...args]);
      return this;
    },
    order(...args) {
      llamadas.push(["order", ...args]);
      return Promise.resolve({
        data: solicitudes,
        error: errorConsulta,
      });
    },
    update(datos) {
      operacion = "cancelacion";
      llamadas.push(["update", datos]);
      return this;
    },
    then(resolve, reject) {
      const resultado =
        operacion === "cancelacion"
          ? {
              data: filasCanceladas,
              error: errorCancelacion,
            }
          : {
              data: solicitudes,
              error: errorConsulta,
            };

      return Promise.resolve(resultado).then(resolve, reject);
    },
  };

  return {
    llamadas,
    auth: {
      getUser: async () => ({
        data: {
          user: usuarioId ? { id: usuarioId } : null,
        },
        error: null,
      }),
    },
    from(tabla) {
      llamadas.push(["from", tabla]);
      return consulta;
    },
  };
}

test("sin sesión no permite consultar solicitudes", async () => {
  const cliente = crearCliente({ usuarioId: null });

  await assert.rejects(() =>
    obtenerMisSolicitudes(cliente, "usuario-1"),
  );

  assert.deepEqual(cliente.llamadas, []);
});

test("no permite consultar solicitudes de otro usuario", async () => {
  const cliente = crearCliente({ usuarioId: "usuario-2" });

  await assert.rejects(() =>
    obtenerMisSolicitudes(cliente, "usuario-1"),
  );

  assert.deepEqual(cliente.llamadas, []);
});

test("la consulta filtra por usuario y solicitudes demo", async () => {
  const cliente = crearCliente({
    solicitudes: [{ id: "solicitud-1" }],
  });

  const resultado = await obtenerMisSolicitudes(
    cliente,
    "usuario-1",
  );

  assert.equal(resultado.length, 1);
  assert.ok(
    cliente.llamadas.some(
      (llamada) =>
        llamada[0] === "eq" &&
        llamada[1] === "user_id" &&
        llamada[2] === "usuario-1",
    ),
  );
  assert.ok(
    cliente.llamadas.some(
      (llamada) =>
        llamada[0] === "eq" &&
        llamada[1] === "is_demo" &&
        llamada[2] === true,
    ),
  );
});

test("sin solicitudes devuelve una lista vacía", async () => {
  const cliente = crearCliente();

  const resultado = await obtenerMisSolicitudes(
    cliente,
    "usuario-1",
  );

  assert.deepEqual(resultado, []);
});

test("la cancelación exige una sesión válida", async () => {
  const cliente = crearCliente({ usuarioId: "usuario-2" });

  await assert.rejects(() =>
    cancelarSolicitudDemo(
      cliente,
      "usuario-1",
      "solicitud-1",
    ),
  );

  assert.deepEqual(cliente.llamadas, []);
});

test("solo cancela solicitudes propias, demo y solicitadas", async () => {
  const cliente = crearCliente();

  await cancelarSolicitudDemo(
    cliente,
    "usuario-1",
    "solicitud-1",
  );

  assert.ok(
    cliente.llamadas.some(
      (llamada) =>
        llamada[0] === "update" &&
        llamada[1].status === "cancelled",
    ),
  );

  for (const [campo, valor] of [
    ["id", "solicitud-1"],
    ["user_id", "usuario-1"],
    ["is_demo", true],
    ["status", "requested"],
  ]) {
    assert.ok(
      cliente.llamadas.some(
        (llamada) =>
          llamada[0] === "eq" &&
          llamada[1] === campo &&
          llamada[2] === valor,
      ),
    );
  }
});

test("no informa éxito cuando ninguna fila fue cancelada", async () => {
  const cliente = crearCliente({ filasCanceladas: [] });

  await assert.rejects(() =>
    cancelarSolicitudDemo(
      cliente,
      "usuario-1",
      "solicitud-1",
    ),
  );
});

test("propaga los errores de consulta y cancelación", async () => {
  const clienteLectura = crearCliente({
    errorConsulta: { code: "42501" },
  });

  await assert.rejects(() =>
    obtenerMisSolicitudes(clienteLectura, "usuario-1"),
  );

  const clienteCancelacion = crearCliente({
    errorCancelacion: { code: "42501" },
  });

  await assert.rejects(() =>
    cancelarSolicitudDemo(
      clienteCancelacion,
      "usuario-1",
      "solicitud-1",
    ),
  );
});
