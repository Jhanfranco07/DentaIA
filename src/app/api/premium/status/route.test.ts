import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), readPlan: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/supabase/server-auth", () => ({
  getAccessTokenFromRequest: (request: Request) => {
    const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
    return match?.[1] ?? null;
  },
  getUserFromRequest: mocks.getUser,
}));
vi.mock("@/features/planes/premium-server", () => ({ readEffectivePlan: mocks.readPlan }));
vi.mock("@/lib/supabase/request.server", () => ({
  createUserScopedSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => ({ maybeSingle: mocks.single }),
        }),
      }),
    }),
  }),
}));

import { GET } from "./route";

const request = (authorization?: string) => new Request("http://localhost/api/premium/status?user_id=another-user", {
  headers: authorization ? { authorization } : undefined,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
  mocks.readPlan.mockResolvedValue("basic");
  mocks.single.mockResolvedValue({ data: null, error: null });
});

describe("consulta server-side del plan", () => {
  it("rechaza solicitudes sin token", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(mocks.readPlan).not.toHaveBeenCalled();
  });

  it("deriva el plan de la sesión verificada, no de parámetros del cliente", async () => {
    mocks.readPlan.mockResolvedValue("premium");
    const response = await GET(request("Bearer token_fixture"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ plan: "premium", premium_vision_available: false, subscription: null });
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.readPlan).toHaveBeenCalledWith("token_fixture");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("no devuelve Basic si la verificación de la suscripción falla", async () => {
    mocks.readPlan.mockRejectedValue(new Error("fixture"));
    expect((await GET(request("Bearer token_fixture"))).status).toBe(503);
  });
});
