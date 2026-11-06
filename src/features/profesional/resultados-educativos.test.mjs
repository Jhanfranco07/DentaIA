import test from "node:test";
import assert from "node:assert/strict";

import {
  crearServicioResultadosEducativos,
  iniciarConsultaResultadoEducativo,
} from "./resultados-educativos.ts";

const solicitud = {
  patientId: "paciente-demo-a",
  contextId: "contexto-demo-norte",
};

const resultadoBase = {
  id: "resultado-demo-a",
  titulo: "Ejemplo educativo de cuidado bucal",
  observaciones: ["Observación educativa preparada para demostración."],
  recomendaciones: ["Recomendación general preparada para demostración."],
  aviso: "Contenido educativo de demostración; no es un diagnóstico.",
  fuente: {
    id: "catalogo-demo-a",
    nombre: "Catálogo educativo de demostración",
    tipo: "catalogo_educativo",
    disponible: true,
    atribucion: "Fuente sintética de prueba",
  },
};

function crearFuente({ respuesta, error = false } = {}) {
  const llamadas = { consulta: 0, solicitud: undefined };

  return {
    llamadas,
    fuente: {
      async consultarResultadoAutorizado(solicitudRecibida) {
        llamadas.consulta++;
        llamadas.solicitud = solicitudRecibida;
        if (error) throw new Error("detalle interno que no debe exponerse");
        return respuesta;
      },
    },
  };
}

function sinContenido(respuesta) {
  assert.equal(respuesta.resultado, null);
  assert.deepEqual(Object.keys(respuesta).sort(), [
    "estado",
    "modalidadAutorizacion",
    "resultado",
  ]);
}

test("inicia en carga simulada y sin contenido educativo", () => {
  const respuesta = iniciarConsultaResultadoEducativo();

  assert.equal(respuesta.estado, "cargando");
  assert.equal(respuesta.modalidadAutorizacion, "simulada");
  sinContenido(respuesta);
});

test("devuelve solo contenido educativo validado cuando el proveedor lo permite", async () => {
  const resultadoConCamposAjenos = {
    ...resultadoBase,
    patientId: "paciente-que-no-debe-salir",
    encounterIds: ["atencion-que-no-debe-salir"],
    diagnosticos: ["campo clínico ajeno"],
    tratamientos: ["campo clínico ajeno"],
    fuente: {
      ...resultadoBase.fuente,
      auditTrail: "campo ajeno",
    },
  };
  const { fuente, llamadas } = crearFuente({
    respuesta: {
      estado: "permitido",
      resultado: resultadoConCamposAjenos,
      modalidadAutorizacion: "servidor",
    },
  });

  const respuesta = await crearServicioResultadosEducativos(fuente).consultar({
    patientId: " paciente-demo-a ",
    contextId: " contexto-demo-norte ",
  });

  assert.equal(respuesta.estado, "permitido");
  assert.equal(respuesta.modalidadAutorizacion, "simulada");
  assert.deepEqual(respuesta.resultado, resultadoBase);
  assert.notEqual(respuesta.resultado, resultadoBase);
  assert.deepEqual(llamadas.solicitud, solicitud);
  for (const propiedad of [
    "patientId",
    "encounterIds",
    "diagnosticos",
    "tratamientos",
  ]) {
    assert.equal(propiedad in respuesta.resultado, false);
  }
  assert.equal("auditTrail" in respuesta.resultado.fuente, false);
});

test("preserva cada estado no permitido sin contenido", async () => {
  for (const estado of [
    "no_autorizado",
    "expirado",
    "revocado",
    "sin_datos",
    "fuente_no_disponible",
    "error",
  ]) {
    const { fuente, llamadas } = crearFuente({ respuesta: { estado } });
    const respuesta = await crearServicioResultadosEducativos(fuente).consultar(
      solicitud,
    );

    assert.equal(respuesta.estado, estado);
    assert.equal(respuesta.modalidadAutorizacion, "simulada");
    sinContenido(respuesta);
    assert.equal(llamadas.consulta, 1);
  }
});

test("rechaza solicitudes malformadas sin consultar el proveedor", async () => {
  const { fuente, llamadas } = crearFuente({
    respuesta: { estado: "permitido", resultado: resultadoBase },
  });
  const servicio = crearServicioResultadosEducativos(fuente);

  for (const solicitudInvalida of [
    null,
    undefined,
    17,
    "solicitud",
    [],
    {},
    { patientId: "paciente-demo-a" },
    { contextId: "contexto-demo-norte" },
    { patientId: "", contextId: "contexto-demo-norte" },
    { patientId: "paciente-demo-a", contextId: "   " },
    { patientId: 17, contextId: "contexto-demo-norte" },
  ]) {
    const respuesta = await servicio.consultar(solicitudInvalida);
    assert.equal(respuesta.estado, "error");
    sinContenido(respuesta);
  }

  assert.equal(llamadas.consulta, 0);
});

test("convierte respuestas malformadas del proveedor en errores seguros", async () => {
  const respuestasInvalidas = [
    null,
    undefined,
    [],
    {},
    { estado: "desconocido" },
    { estado: "permitido" },
    { estado: "permitido", resultado: null },
    { estado: "permitido", resultado: { ...resultadoBase, recomendaciones: [] } },
    {
      estado: "permitido",
      resultado: {
        ...resultadoBase,
        fuente: { ...resultadoBase.fuente, id: "" },
      },
    },
    {
      estado: "permitido",
      resultado: {
        ...resultadoBase,
        fuente: { ...resultadoBase.fuente, disponible: false },
      },
    },
    { estado: "no_autorizado", resultado: resultadoBase },
    { estado: "fuente_no_disponible", resultado: null },
  ];

  for (const respuestaInvalida of respuestasInvalidas) {
    const { fuente } = crearFuente({ respuesta: respuestaInvalida });
    const respuesta = await crearServicioResultadosEducativos(fuente).consultar(
      solicitud,
    );

    assert.equal(respuesta.estado, "error");
    sinContenido(respuesta);
  }
});

test("fuente no disponible no requiere ni transporta contenido educativo", async () => {
  const respuestaProveedor = { estado: "fuente_no_disponible" };
  const { fuente } = crearFuente({ respuesta: respuestaProveedor });
  const respuesta = await crearServicioResultadosEducativos(fuente).consultar(
    solicitud,
  );

  assert.deepEqual(respuestaProveedor, { estado: "fuente_no_disponible" });
  assert.equal(respuesta.estado, "fuente_no_disponible");
  sinContenido(respuesta);
});

test("oculta excepciones del proveedor como errores seguros", async () => {
  const { fuente } = crearFuente({ error: true });
  const respuesta = await crearServicioResultadosEducativos(fuente).consultar(
    solicitud,
  );

  assert.equal(respuesta.estado, "error");
  assert.equal(respuesta.modalidadAutorizacion, "simulada");
  sinContenido(respuesta);
  assert.equal("message" in respuesta, false);
  assert.equal("stack" in respuesta, false);
});
