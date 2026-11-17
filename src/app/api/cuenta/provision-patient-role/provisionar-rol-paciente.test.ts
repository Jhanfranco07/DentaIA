import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getSession: mocks.getSession, refreshSession: mocks.refreshSession },
  }),
}));

import { provisionarRolPaciente } from "@/features/cuenta/provisionar-rol-paciente";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "access-token" } },
    error: null,
  });
  mocks.refreshSession.mockResolvedValue({
    data: { session: { access_token: "refreshed-access-token" } },
    error: null,
  });
});

describe("provisionamiento del rol paciente", () => {
  it("renueva el JWT despues de asignar el rol en el servidor", async () => {
    const llamadas: string[] = [];
    mocks.getSession.mockImplementation(async () => {
      llamadas.push("session");
      return { data: { session: { access_token: "access-token" } }, error: null };
    });
    const solicitar = vi.fn(async () => {
      llamadas.push("provision");
      return new Response(null, { status: 200 });
    });
    mocks.refreshSession.mockImplementation(async () => {
      llamadas.push("refresh");
      return { data: { session: { access_token: "refreshed-access-token" } }, error: null };
    });

    await provisionarRolPaciente(undefined, solicitar);

    expect(solicitar).toHaveBeenCalledWith("/api/cuenta/provision-patient-role", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
      cache: "no-store",
    });
    expect(llamadas).toEqual(["session", "provision", "refresh"]);
  });

  it("no continúa si Auth no pudo renovar la sesión", async () => {
    const error = new Error("refresh failed");
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error });

    await expect(provisionarRolPaciente(undefined, vi.fn(async () =>
      new Response(null, { status: 200 }),
    ))).rejects.toBe(error);
  });
});
