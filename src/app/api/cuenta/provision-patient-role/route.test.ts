import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/server-auth", () => ({ getUserFromRequest: mocks.getUser }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { getUserById: mocks.getUserById, updateUserById: mocks.updateUserById } },
  }),
}));

import { POST } from "./route";

const userId = "11111111-1111-4111-8111-111111111111";
const request = () => new Request("http://localhost/api/cuenta/provision-patient-role", { method: "POST" });
const user = (app_metadata: Record<string, unknown> = { provider: "email" }) => ({
  id: userId,
  confirmed_at: "2026-11-17T00:00:00.000Z",
  is_anonymous: false,
  app_metadata,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue(user());
  mocks.getUserById.mockResolvedValue({ data: { user: user() }, error: null });
  mocks.updateUserById.mockResolvedValue({
    data: { user: user({ provider: "email", dentaia: { version: 1, estado: "activo", roles: ["paciente"] } }) },
    error: null,
  });
});

describe("provisionamiento server-side del rol paciente", () => {
  it("rechaza la solicitud sin identidad verificada", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("rechaza cuentas anónimas", async () => {
    mocks.getUser.mockResolvedValue({ ...user(), is_anonymous: true });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("rechaza identidades no confirmadas", async () => {
    mocks.getUser.mockResolvedValue({ ...user(), confirmed_at: null });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("asigna únicamente paciente y conserva app_metadata confiable", async () => {
    mocks.getUser.mockResolvedValue({
      ...user(),
      user_metadata: { dentaia: { roles: ["superusuario"] } },
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.updateUserById).toHaveBeenCalledWith(userId, {
      app_metadata: { provider: "email", dentaia: { version: 1, estado: "activo", roles: ["paciente"] } },
    });
    expect(mocks.updateUserById).not.toHaveBeenCalledWith(userId, expect.objectContaining({
      user_metadata: expect.anything(),
    }));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("no reemplaza una asignación de rol existente", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: user({ provider: "email", dentaia: { version: 1, estado: "activo", roles: ["odontologo"] } }) },
      error: null,
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("no normaliza ni reemplaza una asignación existente inválida", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: user({ provider: "email", dentaia: { roles: ["superusuario"] } }) },
      error: null,
    });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("expone un fallo de Auth como servicio no disponible", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: null }, error: new Error("fixture") });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });
});
