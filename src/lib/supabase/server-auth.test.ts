import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("./server", () => ({ crearClienteIdentidadServidor: () => ({ auth: { getUser: mocks.getUser } }) }));
import { getUserFromRequest } from "./server-auth";
beforeEach(() => { vi.resetAllMocks(); });
describe("identidad del endpoint Stripe", () => {
  it.each([undefined, "Basic credencial_fixture", "Bearer"])("sin bearer válido no consulta Auth: %s", async (authorization) => {
    const headers = authorization ? { authorization } : undefined;
    expect(await getUserFromRequest(new Request("http://localhost", { headers }))).toBeNull();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("valida el token con Auth y devuelve solo el usuario verificado", async () => {
    const user = { id: "user-fixture" }; mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await getUserFromRequest(new Request("http://localhost", { headers: { authorization: "Bearer token_fixture" } }))).toEqual(user);
    expect(mocks.getUser).toHaveBeenCalledWith("token_fixture");
  });
  it("un token rechazado no autoriza Checkout", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "token inválido" } });
    expect(await getUserFromRequest(new Request("http://localhost", { headers: { authorization: "Bearer invalido" } }))).toBeNull();
  });
});
