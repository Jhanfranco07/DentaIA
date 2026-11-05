import assert from "node:assert/strict";
import test from "node:test";

const {
  ErrorApiClinica,
  clasificarErrorPaginacionContextos,
  coincideProfesional,
  crearClienteApiClinica,
  paginaSolicitudesCompatible,
  parsearHistorialClinico,
  parsearPerfilProfesional,
} = await import("./api-clinica.ts");

const id = (numero) =>
  `40000000-0000-4000-8000-${String(numero).padStart(12, "0")}`;
const fecha = "2026-11-04T01:00:00.123456Z";

function respuesta(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pagina(kind, data, nextAfterId = null) {
  return {
    ok: true,
    apiVersion: "clinical.workspace.v1",
    environment: "academic_remote",
    kind,
    data,
    nextAfterId,
    requestId: id(99),
  };
}

function cliente(fetchImpl, token = "cabecera.cuerpo.firma") {
  return crearClienteApiClinica({
    obtenerAccessToken: async () => token,
    fetchImpl,
  });
}

function historialNoVacioConBackground(background) {
  return {
    ok: true,
    apiVersion: "clinical.v1",
    origen: "supabase",
    environment: "academic_remote",
    estado: "listo",
    caso: {
      patientId: id(10),
      professionalContext: id(1),
      clinicContext: id(3),
    },
    entries: [
      {
        encounterId: id(11),
        attendedAt: fecha,
        recordedAt: fecha,
        status: "recorded",
        replacesId: null,
        correctionReason: null,
        origin: {
          clinicId: id(3),
          clinicName: "Clinica QA",
          professionalId: id(1),
          professionalName: null,
        },
        background,
        clinicalEntries: [],
        diagnoses: [],
        treatments: [],
        exams: [],
      },
    ],
    nextCursor: null,
    requestId: id(99),
  };
}

test("consulta el perfil profesional con Bearer, same-origin y sin persistir token", async () => {
  let llamada;
  const api = cliente(async (input, init) => {
    llamada = { input, init };
    return respuesta(
      pagina("professional", {
        professionalId: id(1),
        dentistId: null,
        contexts: [
          {
            membershipId: id(2),
            clinicId: id(3),
            clinicName: "Clínica QA",
            validFrom: fecha,
            validUntil: null,
          },
        ],
      }),
    );
  });

  const result = await api.obtenerPerfil({}, new AbortController().signal);

  assert.equal(llamada.input, "/api/professional/me?limit=20");
  assert.equal(llamada.init.headers.Authorization, "Bearer cabecera.cuerpo.firma");
  assert.equal(llamada.init.cache, "no-store");
  assert.equal(llamada.init.credentials, "same-origin");
  assert.equal(result.data.contexts[0].membershipId, id(2));
});

test("proyecta solicitudes profesionales sin filtrar PII inesperada", async () => {
  const api = cliente(async () =>
    respuesta(
      pagina("requests", {
        membershipId: id(2),
        professionalId: id(1),
        items: [
          {
            id: id(4),
            status: "requested",
            createdAt: fecha,
            preferredDate: "2026-11-15",
            preferredTime: null,
            isDemo: true,
            contact_email: "no-debe-llegar@example.test",
            message: "No debe llegar a la interfaz profesional",
            user_id: id(50),
          },
        ],
      }),
    ),
  );

  const result = await api.obtenerSolicitudes(
    id(2),
    { afterId: id(5), limit: 10 },
    new AbortController().signal,
  );

  assert.deepEqual(result.data.items[0], {
    id: id(4),
    status: "requested",
    createdAt: fecha,
    preferredDate: "2026-11-15",
    preferredTime: null,
    isDemo: true,
  });
  assert.equal(JSON.stringify(result).includes("no-debe-llegar"), false);
});

test("sin sesión no se emite ninguna solicitud HTTP", async () => {
  let llamadas = 0;
  const api = cliente(async () => {
    llamadas += 1;
    return respuesta({});
  }, null);

  await assert.rejects(
    () => api.obtenerPerfil({}, new AbortController().signal),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 401 &&
      error.code === "AUTHENTICATION_REQUIRED",
  );
  assert.equal(llamadas, 0);
});

test("un fallo transitorio de Supabase no se presenta como sesión ausente", async () => {
  let llamadas = 0;
  const api = crearClienteApiClinica({
    obtenerAccessToken: async () => {
      throw new Error("fallo transitorio del SDK");
    },
    fetchImpl: async () => {
      llamadas += 1;
      return respuesta({});
    },
  });

  await assert.rejects(
    () => api.obtenerPerfil({}, new AbortController().signal),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 503 &&
      error.code === "SESSION_UNAVAILABLE",
  );
  assert.equal(llamadas, 0);
});

test("una denegación del servidor no transporta cuerpo clínico", async () => {
  const api = cliente(async () =>
    respuesta(
      {
        ok: false,
        code: "ACCESS_DENIED",
        requestId: id(98),
        entries: ["no-debe-propagarse"],
      },
      403,
    ),
  );

  await assert.rejects(
    () => api.obtenerPacientes(id(2), {}, new AbortController().signal),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 403 &&
      error.code === "ACCESS_DENIED" &&
      error.requestId === id(98),
  );
});

test("preserva una indisponibilidad HTTP sin interpretar su cuerpo como datos", async () => {
  const api = cliente(async () =>
    respuesta(
      {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        requestId: id(97),
        entries: ["no-debe-propagarse"],
      },
      503,
    ),
  );

  await assert.rejects(
    () => api.obtenerHistorial(id(10), id(2), {}, new AbortController().signal),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 503 &&
      error.code === "SERVICE_UNAVAILABLE" &&
      error.requestId === id(97),
  );
});

test("rechaza un error clínico cuyo requestId no cumple el contrato", async () => {
  const api = cliente(async () =>
    respuesta(
      {
        ok: false,
        code: "ACCESS_DENIED",
        requestId: "traza-malformada",
      },
      403,
    ),
  );

  await assert.rejects(
    () => api.obtenerPacientes(id(2), {}, new AbortController().signal),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 503 &&
      error.code === "INVALID_RESPONSE" &&
      error.requestId === null,
  );
});

test("una ruta clínica ausente se traduce a un estado seguro aunque no devuelva JSON", async () => {
  const api = cliente(async () => new Response("Not found", { status: 404 }));

  await assert.rejects(
    () => api.obtenerPerfil({}, new AbortController().signal),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 404 &&
      error.code === "NOT_FOUND",
  );
});

test("rechaza respuestas exitosas con un contrato inesperado", async () => {
  const api = cliente(async () =>
    respuesta({ ok: true, apiVersion: "otro", data: { secret: "no" } }),
  );

  await assert.rejects(
    () => api.obtenerPacientes(id(2), {}, new AbortController().signal),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 503 &&
      error.code === "INVALID_RESPONSE",
  );
});

test("rechaza fechas ISO calendáricamente imposibles", () => {
  assert.throws(
    () =>
      parsearPerfilProfesional(
        pagina("professional", {
          professionalId: id(1),
          dentistId: null,
          contexts: [
            {
              membershipId: id(2),
              clinicId: id(3),
              clinicName: "Clínica QA",
              validFrom: "2026-02-30T01:00:00Z",
              validUntil: null,
            },
          ],
        }),
      ),
    (error) =>
      error instanceof ErrorApiClinica &&
      error.status === 503 &&
      error.code === "INVALID_RESPONSE",
  );
});

test("construye rutas de pacientes e historial con los parámetros oficiales", async () => {
  const llamadas = [];
  const api = cliente(async (input) => {
    llamadas.push(input);
    if (String(input).startsWith("/api/professional/patients")) {
      return respuesta(
        pagina("patients", { membershipId: id(2), items: [] }),
      );
    }
    return respuesta({
      ok: true,
      apiVersion: "clinical.v1",
      origen: "supabase",
      environment: "academic_remote",
      estado: "sin_datos",
      caso: {
        patientId: id(10),
        professionalContext: id(1),
        clinicContext: id(3),
      },
      entries: [],
      nextCursor: null,
      requestId: id(99),
    });
  });

  await api.obtenerPacientes(id(2), { afterId: id(4), limit: 10 }, new AbortController().signal);
  await api.obtenerHistorial(
    id(10),
    id(2),
    { cursor: "cursor-opaco", limit: 10 },
    new AbortController().signal,
  );

  assert.equal(
    llamadas[0],
    `/api/professional/patients?limit=10&afterId=${id(4)}&membershipId=${id(2)}`,
  );
  assert.equal(
    llamadas[1],
    `/api/clinical/patients/${id(10)}/history?membershipId=${id(2)}&limit=10&cursor=cursor-opaco`,
  );
});

test("una página de solicitudes debe coincidir con membresía y profesional actuales", () => {
  const datos = { membershipId: id(2), professionalId: id(1) };

  assert.equal(coincideProfesional(id(1), id(1)), true);
  assert.equal(coincideProfesional(id(1), id(9)), false);
  assert.equal(paginaSolicitudesCompatible(datos, id(2), id(1)), true);
  assert.equal(paginaSolicitudesCompatible(datos, id(8), id(1)), false);
  assert.equal(paginaSolicitudesCompatible(datos, id(2), id(9)), false);
});

test("conserva el cursor opaco de historial y proyecta solo el DTO permitido", () => {
  const cursor = "cursor-opaco-firmado-por-servidor";
  const result = parsearHistorialClinico({
    ok: true,
    apiVersion: "clinical.v1",
    origen: "supabase",
    environment: "academic_remote",
    estado: "listo",
    caso: {
      patientId: id(10),
      professionalContext: id(1),
      clinicContext: id(3),
    },
    entries: [
      {
        encounterId: id(11),
        attendedAt: fecha,
        recordedAt: fecha,
        status: "recorded",
        replacesId: null,
        correctionReason: null,
        origin: {
          clinicId: id(3),
          clinicName: "Clínica QA",
          professionalId: id(1),
          professionalName: null,
        },
        background: {
          id: id(12),
          state: "not_recorded",
          value: null,
          codeSystem: null,
          code: null,
        },
        clinicalEntries: [],
        diagnoses: [],
        treatments: [],
        exams: [],
        object_path: "nunca debe llegar",
      },
    ],
    nextCursor: cursor,
    requestId: id(99),
  });

  assert.equal(result.nextCursor, cursor);
  assert.equal(result.entries[0].origin.clinicName, "Clínica QA");
  assert.equal(JSON.stringify(result).includes("object_path"), false);
});

test("acepta el background no vacio emitido por el DTO real del BFF", () => {
  const result = parsearHistorialClinico(
    historialNoVacioConBackground({
      state: "recorded",
      value: "Antecedente validado",
      entryId: id(12),
    }),
  );

  assert.deepEqual(result.entries[0].background, {
    state: "recorded",
    value: "Antecedente validado",
    entryId: id(12),
  });
  assert.equal("id" in result.entries[0].background, false);
});

test("rechaza backgrounds que no cumplen el contrato real del BFF", () => {
  for (const background of [
    { value: null },
    { state: "recorded", value: 42 },
    { state: "recorded", value: "dato", entryId: "no-es-uuid" },
  ]) {
    assert.throws(
      () => parsearHistorialClinico(historialNoVacioConBackground(background)),
      (error) =>
        error instanceof ErrorApiClinica &&
        error.status === 503 &&
        error.code === "INVALID_RESPONSE",
    );
  }
});

test("clasifica un 403 de paginacion de contextos para limpiar el contexto", () => {
  assert.equal(
    clasificarErrorPaginacionContextos(
      new ErrorApiClinica(403, "ACCESS_DENIED"),
    ),
    "restringir-contexto",
  );
  assert.equal(
    clasificarErrorPaginacionContextos(
      new ErrorApiClinica(401, "AUTHENTICATION_REQUIRED"),
    ),
    "expirar-sesion",
  );
  assert.equal(
    clasificarErrorPaginacionContextos(
      new ErrorApiClinica(503, "SERVICE_UNAVAILABLE"),
    ),
    "mostrar-error",
  );
});
