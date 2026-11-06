import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

import { crearServicioHistorialAutorizado } from "./historial-autorizado.ts";

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

const { crearProveedorHistorialSintetico } = await import(
  "./proveedor-historial-sintetico.ts",
);

const casos = [
  {
    patientId: "paciente-demo-a",
    patientAlias: "Paciente de demostración A",
    professionalContext: "Contexto original no expuesto",
    clinicContext: "Clínica original no expuesta",
    entries: [
      {
        encounterId: "atencion-demo-a-1",
        attendedAt: "2026-06-11",
        recordedAt: "2026-06-12",
        originClinic: "Clínica ficticia Centro",
      },
      {
        encounterId: "atencion-demo-a-2",
        attendedAt: "2026-09-18",
        recordedAt: "2026-09-20",
        originClinic: "Clínica ficticia Costa",
      },
    ],
  },
  {
    patientId: "paciente-demo-b",
    patientAlias: "Paciente de demostración B",
    professionalContext: "Contexto original no expuesto",
    clinicContext: "Clínica original no expuesta",
    entries: [
      {
        encounterId: "atencion-demo-b-1",
        attendedAt: "2026-08-03",
        recordedAt: "2026-08-03",
        originClinic: "Clínica ficticia Este",
      },
      {
        encounterId: "atencion-demo-b-2",
        attendedAt: "2026-10-09",
        recordedAt: "2026-10-10",
        originClinic: "Clínica ficticia Sur",
      },
    ],
  },
];

const contextos = [
  {
    id: "contexto-demo-norte",
    professionalId: "profesional-demo-a",
    professionalName: "Profesional ficticio A",
    clinicId: "clinica-demo-norte",
    clinicName: "Clínica de contexto ficticia Norte",
  },
  {
    id: "contexto-demo-sur",
    professionalId: "profesional-demo-c",
    professionalName: "Profesional ficticio C",
    clinicId: "clinica-demo-sur",
    clinicName: "Clínica de contexto ficticia Sur",
  },
];

const concesiones = [
  {
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    encounterIds: ["atencion-demo-a-1", "atencion-demo-a-2"],
  },
  {
    patientId: "paciente-demo-b",
    contextId: "contexto-demo-sur",
    encounterIds: ["atencion-demo-b-2"],
  },
];

function obtenerConcesionDePrueba(patientId, contextId) {
  return concesiones.find(
    (concesion) =>
      concesion.patientId === patientId && concesion.contextId === contextId,
  );
}

function crearProveedorPrueba({
  obtenerCaso = (patientId) =>
    casos.find((caso) => caso.patientId === patientId),
  obtenerContexto = (contextId) =>
    contextos.find((contexto) => contexto.id === contextId),
  obtenerConcesion = obtenerConcesionDePrueba,
  auditor,
  politicaAuditoria,
} = {}) {
  return crearServicioHistorialAutorizado({
    obtenerCaso,
    obtenerContexto,
    obtenerConcesion,
  }, auditor, politicaAuditoria);
}

function sinDatosClinicos(vista) {
  assert.equal(vista.caso, null);
  assert.deepEqual(vista.entries, []);
}

test("el permiso simulado concedido conserva la procedencia de dos clínicas", async () => {
  const proveedor = crearProveedorPrueba();
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "listo");
  assert.equal(vista.permisoSimulado, "concedido");
  assert.equal(vista.caso?.patientId, "paciente-demo-a");
  assert.deepEqual(
    vista.entries.map((atencion) => atencion.encounterId),
    ["atencion-demo-a-2", "atencion-demo-a-1"],
  );
  assert.deepEqual(
    vista.entries.map((atencion) => atencion.originClinic),
    ["Clínica ficticia Costa", "Clínica ficticia Centro"],
  );
});

test("el permiso simulado concede únicamente los registros incluidos en su alcance", async () => {
  const proveedor = crearProveedorPrueba();
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-b",
    contextId: "contexto-demo-sur",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "listo");
  assert.equal("entries" in vista.caso, false);
  assert.deepEqual(
    vista.entries.map((atencion) => atencion.encounterId),
    ["atencion-demo-b-2"],
  );
});

test("la misma consulta con clínica de contexto distinta no entrega datos", async () => {
  const proveedor = crearProveedorPrueba();
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-sur",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "denegado");
  assert.equal(vista.permisoSimulado, "denegado");
  sinDatosClinicos(vista);
});

test("los permisos denegado, expirado y revocado no revelan datos clínicos", async () => {
  const proveedor = crearProveedorPrueba();

  for (const escenario of ["denegado", "expirado", "revocado"]) {
    const vista = await proveedor.consultar({
      patientId: "paciente-demo-a",
      contextId: "contexto-demo-norte",
      escenario,
    });

    assert.equal(vista.estado, "denegado");
    assert.equal(vista.permisoSimulado, escenario);
    sinDatosClinicos(vista);
  }
});

test("un paciente inexistente, el vacío y el error no conservan datos de otra consulta", async () => {
  const proveedor = crearProveedorPrueba();
  const solicitudes = [
    {
      patientId: "paciente-inexistente",
      contextId: "contexto-demo-norte",
      escenario: "concedido",
      estado: "denegado",
    },
    {
      patientId: "paciente-demo-a",
      contextId: "contexto-demo-norte",
      escenario: "vacio",
      estado: "vacio",
    },
    {
      patientId: "paciente-demo-a",
      contextId: "contexto-demo-norte",
      escenario: "error",
      estado: "error",
    },
  ];

  for (const solicitud of solicitudes) {
    const vista = await proveedor.consultar(solicitud);

    assert.equal(vista.estado, solicitud.estado);
    sinDatosClinicos(vista);
  }
});

test("DI-159: identificadores desconocidos o contextos ajenos fallan cerrados", async () => {
  const proveedor = crearProveedorPrueba();

  for (const solicitud of [
    { patientId: "", contextId: "contexto-demo-norte" },
    { patientId: "paciente-demo-a", contextId: "" },
    { patientId: "paciente-inexistente", contextId: "contexto-demo-norte" },
    { patientId: "paciente-demo-a", contextId: "contexto-inexistente" },
  ]) {
    const vista = await proveedor.consultar({
      ...solicitud,
      escenario: "concedido",
    });

    assert.equal(vista.estado, "denegado");
    sinDatosClinicos(vista);
  }
});

test("DI-159: el alcance repetido no duplica atenciones ni altera la cronología", async () => {
  const proveedor = crearProveedorPrueba({
    obtenerConcesion: (patientId, contextId) =>
      patientId === "paciente-demo-a" && contextId === "contexto-demo-norte"
        ? {
            patientId,
            contextId,
            encounterIds: [
              "atencion-demo-a-1",
              "atencion-demo-a-1",
              "atencion-demo-a-2",
            ],
          }
        : undefined,
  });
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "listo");
  assert.equal(vista.entries.length, 2);
  assert.equal(
    new Set(vista.entries.map((atencion) => atencion.encounterId)).size,
    vista.entries.length,
  );
  assert.deepEqual(
    vista.entries.map((atencion) => atencion.encounterId),
    ["atencion-demo-a-2", "atencion-demo-a-1"],
  );
});

test("DI-159: una revocación sintética se reevalúa y elimina el historial de una nueva lectura", async () => {
  let concesionVigente = true;
  const proveedor = crearProveedorPrueba({
    obtenerConcesion: (patientId, contextId) =>
      concesionVigente
        ? obtenerConcesionDePrueba(patientId, contextId)
        : undefined,
  });
  const solicitud = {
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  };

  const vistaPermitida = await proveedor.consultar(solicitud);
  assert.equal(vistaPermitida.estado, "listo");
  assert.ok(vistaPermitida.entries.length > 0);

  concesionVigente = false;
  const vistaRevocada = await proveedor.consultar(solicitud);
  assert.equal(vistaRevocada.estado, "denegado");
  sinDatosClinicos(vistaRevocada);
});

test("DI-159: la auditoría sintética registra resultado sin transportar entradas", async () => {
  const eventos = [];
  const proveedor = crearProveedorPrueba({
    auditor: { registrar: (evento) => eventos.push(evento) },
  });

  await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });
  await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-sur",
    escenario: "concedido",
  });

  assert.deepEqual(eventos.map((evento) => evento.resultado), [
    "permitido",
    "denegado",
  ]);
  for (const evento of eventos) {
    assert.deepEqual(Object.keys(evento).sort(), [
      "contextId",
      "operacion",
      "patientId",
      "resultado",
    ]);
    assert.equal("entries" in evento, false);
  }
});

test("DI-159: una política requerida sin auditor falla cerrada", async () => {
  const proveedor = crearProveedorPrueba({ politicaAuditoria: "requerida" });
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "error");
  sinDatosClinicos(vista);
});

test("DI-159: el proveedor de demostración aplica su política requerida", async () => {
  // JavaScript puede recibir una dependencia inválida; el proveedor no debe
  // convertir ese caso en una lectura permitida.
  const proveedor = crearProveedorHistorialSintetico(null);
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "error");
  sinDatosClinicos(vista);
});

test("DI-159: el proveedor de demostración exige y espera su auditor", async () => {
  const eventos = [];
  const orden = [];
  const proveedor = crearProveedorHistorialSintetico({
    async registrar(evento) {
      orden.push("auditoria-inicio");
      await Promise.resolve();
      eventos.push(evento);
      orden.push("auditoria-fin");
    },
  });

  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });
  orden.push("respuesta");

  assert.equal(vista.estado, "listo");
  assert.deepEqual(orden, ["auditoria-inicio", "auditoria-fin", "respuesta"]);
  assert.deepEqual(Object.keys(eventos[0]).sort(), [
    "contextId",
    "operacion",
    "patientId",
    "resultado",
  ]);
  assert.equal("entries" in eventos[0], false);
});

test("DI-159: un fallo de auditoría sintética impide entregar el historial", async () => {
  const proveedor = crearProveedorPrueba({
    auditor: {
      registrar: () => {
        throw new Error("fallo sintético de auditoría");
      },
    },
  });
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "error");
  sinDatosClinicos(vista);
});

test("DI-159: un rechazo asíncrono de auditoría impide entregar el historial", async () => {
  const proveedor = crearProveedorPrueba({
    auditor: { registrar: async () => Promise.reject(new Error("fallo")) },
  });
  const vista = await proveedor.consultar({
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    escenario: "concedido",
  });

  assert.equal(vista.estado, "error");
  sinDatosClinicos(vista);
});

test("DI-159: excepciones de fuente devuelven error sin contenido", async () => {
  for (const dependencia of [
    "obtenerCaso",
    "obtenerContexto",
    "obtenerConcesion",
  ]) {
    const proveedor = crearProveedorPrueba({
      [dependencia]: () => {
        throw new Error("fallo sintético de fuente");
      },
    });
    const vista = await proveedor.consultar({
      patientId: "paciente-demo-a",
      contextId: "contexto-demo-norte",
      escenario: "concedido",
    });

    assert.equal(vista.estado, "error");
    sinDatosClinicos(vista);
  }
});
