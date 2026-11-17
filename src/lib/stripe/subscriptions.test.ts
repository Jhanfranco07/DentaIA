import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), lookup: vi.fn(), insert: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/stripe/server", () => ({ getStripe: () => ({ subscriptions: { retrieve: mocks.retrieve } }) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));
import { periodoSuscripcion, procesarEventoSuscripcion, precioPremiumConfigurado, sincronizarSuscripcion } from "./subscriptions";
import { suscripcionesSandboxHabilitadas } from "./subscription-runtime";
import type Stripe from "stripe";

const baseSubscription = {
  items: { data: [{
    price: { id: "price_monthly_demo", currency: "pen", unit_amount: 1490, recurring: { interval: "month", interval_count: 1 } },
    current_period_start: 1794960000,
    current_period_end: 1797552000,
  }] },
} as unknown as Stripe.Subscription;

describe("validación de suscripciones de prueba", () => {
  it("identifica únicamente el Preview autorizado", () => {
    const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "integration/pr71-pr74-compat-20261117", DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED: "true" };
    expect(suscripcionesSandboxHabilitadas(env)).toBe(true);
    expect(suscripcionesSandboxHabilitadas({ ...env, VERCEL_ENV: "production" })).toBe(false);
    expect(suscripcionesSandboxHabilitadas({ VERCEL_ENV: "production", DENTAIA_STRIPE_SANDBOX_PRODUCTION_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_example" })).toBe(true);
    expect(suscripcionesSandboxHabilitadas({ VERCEL_ENV: "production", DENTAIA_STRIPE_SANDBOX_PRODUCTION_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_example" })).toBe(false);
    expect(suscripcionesSandboxHabilitadas({ VERCEL_ENV: "production", STRIPE_SECRET_KEY: "sk_test_example" })).toBe(false);
    expect(suscripcionesSandboxHabilitadas({ ...env, VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
  });
  it("valida el intervalo mensual y el importe, sin aceptar precios alterados", () => {
    expect(periodoSuscripcion(baseSubscription, null).priceId).toBe("price_monthly_demo");
    expect(periodoSuscripcion(baseSubscription, "price_monthly_demo").end).toBeTruthy();
    expect(() => periodoSuscripcion(baseSubscription, "price_other")).toThrow();
    const legacy = {
      ...baseSubscription,
      items: { data: [{ ...baseSubscription.items.data[0], price: {
        ...baseSubscription.items.data[0].price, id: "price_old_usd", currency: "usd", unit_amount: 2000,
      } }] },
    } as Stripe.Subscription;
    expect(() => periodoSuscripcion(legacy, null)).toThrow();
    expect(periodoSuscripcion(legacy, null, "price_old_usd").priceId).toBe("price_old_usd");
    expect(() => periodoSuscripcion(legacy, null, "price_unrelated")).toThrow();
    expect(() => periodoSuscripcion({
      ...baseSubscription, items: { data: [{ ...baseSubscription.items.data[0], price: { ...baseSubscription.items.data[0].price, unit_amount: 100 } }] },
    } as Stripe.Subscription, null)).toThrow();
  });
  it("ignora eventos ajenos a DentaIA y no concede acceso", async () => {
    expect(await procesarEventoSuscripcion({ type: "customer.subscription.created", livemode: false, data: { object: { id: "sub_external", metadata: {} } } } as Stripe.Event)).toBe(false);
    expect(await procesarEventoSuscripcion({ type: "checkout.session.completed", livemode: false, data: { object: { mode: "subscription", metadata: {} } } } as Stripe.Event)).toBe(false);
  });
  it("rechaza eventos Live", async () => {
    await expect(procesarEventoSuscripcion({ type: "customer.subscription.updated", livemode: true } as Stripe.Event)).rejects.toThrow();
  });
  it("permite precios dinámicos al no establecer Price ID", () => {
    vi.stubEnv("STRIPE_PREMIUM_PRICE_ID", "");
    try { expect(precioPremiumConfigurado()).toBe(null); } finally { vi.unstubAllEnvs(); }
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_PREMIUM_PRICE_ID", "");
  mocks.lookup.mockResolvedValue({ data: null, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: mocks.lookup }),
    }),
    insert: mocks.insert,
  });
  mocks.retrieve.mockResolvedValue({
    ...baseSubscription,
    id: "sub_qa1234",
    livemode: false,
    status: "active",
    metadata: { dentaia_user_id: "11111111-1111-4111-8111-111111111111", dentaia_plan: "premium" },
    customer: "cus_qa1234",
    created: 1794950000,
    cancel_at_period_end: false,
    canceled_at: null,
  });
});
describe("persistencia verificada y vinculada a propietario", () => {
  it("un webhook firmado permite escribir Premium con periodo mensual y dueño", async () => {
    await sincronizarSuscripcion("sub_qa1234", 1794960100, "cs_qa1234");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "11111111-1111-4111-8111-111111111111",
      stripe_subscription_id: "sub_qa1234",
      stripe_customer_id: "cus_qa1234",
      stripe_price_id: "price_monthly_demo",
      status: "active",
      plan: "premium",
      checkout_session_id: "cs_qa1234",
      current_period_end: expect.any(String),
    }));
  });
  it("rechaza suscripciones sin dueño asignado en Stripe", async () => {
    mocks.retrieve.mockResolvedValueOnce({
      ...baseSubscription, id: "sub_qa1234", livemode: false, status: "active",
      metadata: {}, customer: "cus_qa1234", created: 1794950000,
    });
    await expect(sincronizarSuscripcion("sub_qa1234", 1794960100)).rejects.toThrow(/propietario/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("no concede Premium desde eventos Live", async () => {
    mocks.retrieve.mockResolvedValueOnce({
      ...baseSubscription, id: "sub_qa1234", livemode: true, status: "active",
      metadata: { dentaia_user_id: "11111111-1111-4111-8111-111111111111" },
    });
    await expect(sincronizarSuscripcion("sub_qa1234", 1794960100)).rejects.toThrow(/Live/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
