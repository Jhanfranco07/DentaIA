import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), session: vi.fn(), list: vi.fn(),
}));
vi.mock("@/lib/supabase/server-auth", () => ({ getUserFromRequest: mocks.getUser }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({ limit: mocks.list }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({ checkout: { sessions: { create: mocks.session } } }),
}));
vi.mock("@/lib/stripe/urls", () => ({ siteUrl: () => "https://qa.example.test" }));

import { POST } from "./route";

const request = () => new Request("https://qa.example.test/api/stripe/subscription/checkout", { method: "POST" });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_REF", "integration/pr71-pr74-compat-20261117");
  vi.stubEnv("DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED", "true");
  vi.stubEnv("STRIPE_PREMIUM_PRICE_ID", "");
  mocks.getUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", email: "qa@example.test" });
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.session.mockResolvedValue({ id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/demo" });
});
afterEach(() => vi.unstubAllEnvs());

describe("Checkout de suscripción mensual", () => {
  it("falla cerrado fuera de Preview autorizado", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("requiere identidad validada", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("crea precio recurrente mensual fijo y usuario en metadata de servidor", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/demo" });
    expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      client_reference_id: "11111111-1111-4111-8111-111111111111",
      subscription_data: { metadata: { dentaia_user_id: "11111111-1111-4111-8111-111111111111", dentaia_plan: "premium" } },
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({
        unit_amount: 1490,
        currency: "pen",
        recurring: { interval: "month", interval_count: 1 },
      }) })],
    }));
  });
  it("no duplica suscripciones existentes", async () => {
    mocks.list.mockResolvedValue({ data: [{ stripe_subscription_id: "sub_existing", status: "active" }], error: null });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
