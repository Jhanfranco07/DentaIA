import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "./urls";

const original = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("siteUrl", () => {
  it("usa localhost si no hay variable", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("usa la variable cuando existe", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://ejemplo.vercel.app";
    expect(siteUrl()).toBe("https://ejemplo.vercel.app");
  });
});