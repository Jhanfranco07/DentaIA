import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ construct: vi.fn(), completed: vi.fn(), expired: vi.fn(), succeeded: vi.fn() }));
vi.mock("@/lib/stripe/server", () => ({ getStripe: () => ({ webhooks: { constructEvent: mocks.construct } }) }));
vi.mock("@/lib/stripe/handlers", () => ({ handleCheckoutCompleted: mocks.completed, handleCheckoutExpired: mocks.expired, handleAsyncPaymentSucceeded: mocks.succeeded }));
import { POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture_solo_pruebas"); });
afterEach(() => { vi.unstubAllEnvs(); });
const request = (signed = true) => new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: signed ? { "stripe-signature": "firma_fixture" } : {}, body: '{"raw":"sin transformar"}' });
describe("webhook con firma y eventos", () => {
  it("sin firma devuelve 400 y no procesa eventos", async () => {
    expect((await POST(request(false))).status).toBe(400);
    expect(mocks.construct).not.toHaveBeenCalled();
  });
  it("firma inválida devuelve 400", async () => {
    mocks.construct.mockImplementation(() => { throw new Error("firma inválida"); });
    expect((await POST(request())).status).toBe(400);
  });
  for (const [type, handler] of [["checkout.session.completed", mocks.completed], ["checkout.session.expired", mocks.expired], ["checkout.session.async_payment_succeeded", mocks.succeeded]] as const) {
    it(`despacha ${type} después de verificar el cuerpo original`, async () => {
      const event = { id: "evt_fixture", type }; mocks.construct.mockReturnValue(event);
      expect((await POST(request())).status).toBe(200);
      expect(mocks.construct).toHaveBeenCalledWith('{"raw":"sin transformar"}', "firma_fixture", "whsec_fixture_solo_pruebas");
      expect(handler).toHaveBeenCalledWith(event);
    });
  }
  it("conserva 500 ante error para permitir reintento de Stripe", async () => {
    mocks.construct.mockReturnValue({ type: "checkout.session.completed" }); mocks.completed.mockRejectedValue(new Error("fixture DB no disponible"));
    expect((await POST(request())).status).toBe(500);
  });
  it("eventos no soportados responden 200 sin escritura", async () => {
    mocks.construct.mockReturnValue({ type: "evento.no.soportado" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.completed).not.toHaveBeenCalled(); expect(mocks.succeeded).not.toHaveBeenCalled(); expect(mocks.expired).not.toHaveBeenCalled();
  });
});
