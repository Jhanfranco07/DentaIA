import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server-auth", () => ({ getUserFromRequest: mocks.getUser }));

import { POST } from "./route";

const patient = {
  id: "11111111-1111-4111-8111-111111111111",
  is_anonymous: false,
  email_confirmed_at: "2026-11-21T12:00:00Z",
  app_metadata: { dentaia: { version: 1, estado: "activo", roles: ["paciente"] } },
};
const request = (payload: unknown, options?: { bearer?: boolean; contentType?: string }) =>
  new Request("http://localhost/api/asistente/chat", {
    method: "POST",
    headers: {
      "Content-Type": options?.contentType ?? "application/json",
      ...(options?.bearer === false ? {} : { Authorization: "Bearer synthetic-patient-test-token" }),
    },
    body: JSON.stringify(payload),
  });
const body = (pregunta: string, historial: unknown[] = []) =>
  ({ pregunta, historial, observacion: null });
const upstream = (text: string) => ({
  output: [{ content: [{ type: "output_text", text }] }],
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue(patient);
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key-only");
  vi.stubEnv("OPENAI_MODEL", "synthetic-test-model");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "synthetic-test-redis-token");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/asistente/chat — integración simulada sin secretos", () => {
  it("rechaza solicitudes sin sesión confirmada y usuarios que no son pacientes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mocks.getUser.mockResolvedValueOnce(null);
    expect((await POST(request(body("¿Cómo me cepillo?")))).status).toBe(403);
    mocks.getUser.mockResolvedValueOnce({ ...patient, app_metadata: {
      dentaia: { version: 1, estado: "activo", roles: ["odontologo"] },
    } });
    expect((await POST(request(body("¿Cómo me cepillo?")))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza datos inválidos y limita el tamaño del historial", async () => {
    expect((await POST(request(body("a", Array.from({ length: 7 }, () => ({ rol: "usuario", texto: "x" }))))).status).toBe(400);
    expect((await POST(request({ pregunta: "a", historial: [], observacion: { evaluable: true, variacionesColor: 99, posiblesAusencias: 0, posiblesApiñamientos: 0 } }))).status).toBe(400);
    expect((await POST(request(body("a"), { contentType: "text/plain" }))).status).toBe(415);
  });

  it("realiza la ruta completa Upstash + OpenAI y etiqueta la respuesta real", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://example.test/") return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      if (url === "https://api.openai.com/v1/responses") {
        const req = JSON.parse(String(init?.body));
        expect(req.store).toBe(false);
        expect(req.tools).toEqual([]);
        expect(req.instructions).toContain("Cepillado");
        const context = JSON.parse(req.input);
        expect(context.pregunta).toBe("¿Cómo debo cepillarme correctamente?");
        expect(context.historial).toEqual([{ rol: "usuario", texto: "Quiero mejorar mi higiene" },
          { rol: "asistente", texto: "Podemos comenzar por el cepillado." }]);
        expect(context.guias.some((g: { id: string; pasos?: unknown }) => g.id === "cepillado" && Array.isArray(g.pasos))).toBe(true);
        return new Response(JSON.stringify(upstream("Cepilla por dos minutos, dos veces al día, con pasta fluorada.")), { status: 200 });
      }
      throw new Error("Unexpected external URL");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(body("¿Cómo debo cepillarme correctamente?", [
      { rol: "usuario", texto: "Quiero mejorar mi higiene" },
      { rol: "asistente", texto: "Podemos comenzar por el cepillado." },
    ])));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ texto: "Cepilla por dos minutos, dos veces al día, con pasta fluorada.", origen: "llm" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("no llama al LLM después de superar el límite de 20 solicitudes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: 21 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(body("¿Cómo uso el hilo dental?")));
    const result = await response.json();
    expect(result.origen).toBe("guiado");
    expect(result.texto).toContain("forma de C");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retorna orientación local si OpenAI falla sin etiquetarla como LLM", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response("service unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(body("¿Por qué tengo los dientes amarillos?")));
    const result = await response.json();
    expect(result.origen).toBe("guiado");
    expect(result.texto).toContain("no significa necesariamente caries");
  });

  it.each([
    "No puedo respirar",
    "Se me hinchó la cara",
    "No puedo tragar",
    "Tengo una hemorragia en la boca",
    "Me cuesta respirar y tengo dolor de muela",
  ])("interrumpe la ruta del LLM en una urgencia: %s", async (pregunta) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(body(pregunta)));
    const result = await response.json();
    expect(result.origen).toBe("seguridad");
    expect(result.texto).toContain("urgente");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
