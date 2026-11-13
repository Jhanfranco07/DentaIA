import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.admin }));
import { handleCheckoutCompleted } from "./handlers";
import type Stripe from "stripe";
const event = { id: "evt_new", data: { object: { id: "cs_fixture", client_reference_id: "user-1", metadata: { plan: "premium-demo" }, amount_total: 2000, currency: "usd", payment_status: "paid" } } } as unknown as Stripe.Event;
const existing = { user_id: "user-1", stripe_session_id: "cs_fixture", stripe_event_id: "evt_old", plan: "premium-demo", amount_total: 2000, currency: "usd", status: "unpaid" };
const unique = { code: "23505" };
const update = vi.fn();
const read = vi.fn();
const insert = vi.fn();
beforeEach(() => {
  vi.resetAllMocks(); insert.mockResolvedValue({ error: unique }); read.mockResolvedValue({ data: existing, error: null }); update.mockResolvedValue({ error: null });
  mocks.admin = { from: () => ({ insert, select: () => ({ eq: () => ({ maybeSingle: read }) }), update: (changes: unknown) => ({ eq: (column: string, session: string) => ({ eq: (stateColumn: string, state: string) => update(changes, column, session, stateColumn, state) }) }) }) };
});
describe("errores y actualización condicional de payments", () => {
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
  it("actualiza solo status con condición atómica session/unpaid, preservando event_id", async () => {
    await handleCheckoutCompleted(event);
    expect(update).toHaveBeenCalledWith({ status: "paid" }, "stripe_session_id", "cs_fixture", "status", "unpaid");
  });
  it("propaga fallos de actualización para que Stripe pueda reintentar", async () => {
    update.mockResolvedValue({ error: { code: "42501" } });
    await expect(handleCheckoutCompleted(event)).rejects.toMatchObject({ code: "42501" });
  });
});
