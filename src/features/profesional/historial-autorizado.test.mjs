import test from "node:test";
import assert from "node:assert/strict";

import { crearServicioHistorialAutorizado } from "./historial-autorizado.ts";

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

function crearProveedorPrueba() {
  return crearServicioHistorialAutorizado({
    obtenerCaso: (patientId) =>
      casos.find((caso) => caso.patientId === patientId),
    obtenerContexto: (contextId) =>
      contextos.find((contexto) => contexto.id === contextId),
    obtenerConcesion: (patientId, contextId) =>
      concesiones.find(
        (concesion) =>
          concesion.patientId === patientId && concesion.contextId === contextId,
      ),
  });
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
