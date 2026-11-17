import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/stripe/server", () => ({ getStripe: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
import { periodoSuscripcion, procesarEventoSuscripcion, precioPremiumConfigurado } from "./subscriptions";
import { suscripcionesSandboxHabilitadas } from "./subscription-runtime";
import type Stripe from "stripe";

const baseSubscription = {
  items: { data: [{
    price: { id: "price_monthly_demo", currency: "usd", unit_amount: 2000, recurring: { interval: "month", interval_count: 1 } },
    current_period_start: 1794960000,
    current_period_end: 1797552000,
  }] },
} as unknown as Stripe.Subscription;

describe("validación de suscripciones de prueba", () => {
  it("identifica únicamente el Preview autorizado", () => {
    const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "integration/pr71-pr74-compat-20261117", DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED: "true" };
    expect(suscripcionesSandboxHabilitadas(env)).toBe(true);
    expect(suscripcionesSandboxHabilitadas({ ...env, VERCEL_ENV: "production" })).toBe(false);
    expect(suscripcionesSandboxHabilitadas({ ...env, VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
  });
  it("valida el intervalo mensual y el importe, sin aceptar precios alterados", () => {
    expect(periodoSuscripcion(baseSubscription, null).priceId).toBe("price_monthly_demo");
    expect(periodoSuscripcion(baseSubscription, "price_monthly_demo").end).toBeTruthy();
    expect(() => periodoSuscripcion(baseSubscription, "price_other")).toThrow();
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
