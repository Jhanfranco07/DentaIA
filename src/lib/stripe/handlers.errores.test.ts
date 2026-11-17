import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.admin }));
import { handleCheckoutCompleted } from "./handlers";
import type Stripe from "stripe";
const event = { id: "evt_new", type: "checkout.session.completed", livemode: false, data: { object: { id: "cs_fixture", client_reference_id: "11111111-1111-4111-8111-111111111111", mode: "payment", metadata: { plan: "premium-demo" }, amount_total: 2000, currency: "usd", payment_status: "paid" } } } as unknown as Stripe.Event;
const existing = { user_id: "11111111-1111-4111-8111-111111111111", stripe_session_id: "cs_fixture", stripe_event_id: "evt_old", plan: "premium-demo", amount_total: 2000, currency: "usd", status: "unpaid" };
const unique = { code: "23505" };
const update = vi.fn();
const read = vi.fn();
const insert = vi.fn();
beforeEach(() => {
  vi.resetAllMocks(); insert.mockResolvedValue({ error: unique }); read.mockResolvedValue({ data: existing, error: null }); update.mockResolvedValue({ error: null });
  mocks.admin = { from: () => ({ insert, select: () => ({ eq: () => ({ maybeSingle: read }) }), update: (changes: unknown) => ({ eq: (column: string, session: string) => ({ in: (stateColumn: string, states: string[]) => update(changes, column, session, stateColumn, states) }) }) }) };
});
describe("errores y actualización condicional de payments", () => {
  it.each([{ amount_total: 1900 }, { currency: "pen" }, { mode: "subscription" }])(
    "rechaza un Checkout inicial con contrato económico distinto: %j",
    async (change) => {
      const invalid = structuredClone(event) as Stripe.Event;
      Object.assign(invalid.data.object as Stripe.Checkout.Session, change);
      await expect(handleCheckoutCompleted(invalid)).rejects.toThrow();
      expect(insert).not.toHaveBeenCalled();
    },
  );
  it("no convierte errores de almacenamiento en éxito", async () => {
    insert.mockResolvedValue({ error: { code: "XX000" } });
    await expect(handleCheckoutCompleted(event)).rejects.toMatchObject({ code: "XX000" }); expect(read).not.toHaveBeenCalled();
  });
  it("propaga el fallo de lectura tras una colisión", async () => {
    read.mockResolvedValue({ data: null, error: { code: "503" } });
    await expect(handleCheckoutCompleted(event)).rejects.toMatchObject({ code: "503" });
  });
  it.each([{ amount_total: 999 }, { currency: "pen" }, { plan: "otro" }])("rechaza datos económicos distintos: %j", async (change) => {
    read.mockResolvedValue({ data: { ...existing, ...change }, error: null });
    await expect(handleCheckoutCompleted(event)).rejects.toMatchObject(unique); expect(update).not.toHaveBeenCalled();
  });
  it("actualiza solo status con condición atómica session/estados válidos, preservando event_id", async () => {
    await handleCheckoutCompleted(event);
    expect(update).toHaveBeenCalledWith({ status: "paid" }, "stripe_session_id", "cs_fixture", "status", ["unpaid", "failed"]);
  });
  it("propaga fallos de actualización para que Stripe pueda reintentar", async () => {
    update.mockResolvedValue({ error: { code: "42501" } });
    await expect(handleCheckoutCompleted(event)).rejects.toMatchObject({ code: "42501" });
  });
});
