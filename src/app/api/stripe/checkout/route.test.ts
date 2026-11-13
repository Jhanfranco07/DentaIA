import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/supabase/server-auth", () => ({ getUserFromRequest: mocks.getUser }));
vi.mock("@/lib/stripe/server", () => ({ getStripe: () => ({ checkout: { sessions: { create: mocks.create } } }) }));
import { POST } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ id: "user-1", email: "fixture@example.test" }); });
const request = () => new Request("http://localhost/api/stripe/checkout", { method: "POST" });
describe("contrato Checkout", () => {
  it("mantiene 401 sin sesión y no llama a Stripe", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("devuelve id y URL que consume el botón existente", async () => {
    mocks.create.mockResolvedValue({ id: "cs_fixture", url: "https://checkout.stripe.com/c/pay/fixture" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "cs_fixture", url: "https://checkout.stripe.com/c/pay/fixture" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment", client_reference_id: "user-1" }));
  });
  it("rechaza una sesión sin URL en lugar de redirigir a undefined", async () => {
    mocks.create.mockResolvedValue({ id: "cs_fixture", url: null });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await POST(request())).status).toBe(502); } finally { log.mockRestore(); }
  });
  it("no publica detalles internos de Stripe en respuesta o logs", async () => {
    mocks.create.mockRejectedValue(new Error("detalle_privado_fixture_no_publicar"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(502);
      expect(JSON.stringify(await response.json())).not.toContain("detalle_privado_fixture");
      expect(JSON.stringify(log.mock.calls)).not.toContain("detalle_privado_fixture");
    } finally { log.mockRestore(); }
  });

});
