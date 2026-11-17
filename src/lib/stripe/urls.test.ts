import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./urls";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("usa localhost si no hay variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("usa la variable cuando existe", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ejemplo.vercel.app");
    expect(siteUrl()).toBe("https://ejemplo.vercel.app");
  });

  it("rechaza URLs de retorno inseguras y falta de origen en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(() => siteUrl()).toThrow("Falta configurar");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://ejemplo.test");
    expect(() => siteUrl()).toThrow("origen HTTPS");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://usuario:clave@ejemplo.test");
    expect(() => siteUrl()).toThrow("origen HTTPS");
  });
});