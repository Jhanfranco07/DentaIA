import { afterEach, describe, expect, it, vi } from "vitest";

const original = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  vi.resetModules();
  if (original === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = original;
});

describe("getStripe", () => {
  it("falla si falta la clave", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import("./server");
    expect(() => getStripe()).toThrow("Falta STRIPE_SECRET_KEY");
  });

  it("rechaza claves que no son de prueba", async () => {
    process.env.STRIPE_SECRET_KEY = "clave_que_no_es_de_prueba";
    const { getStripe } = await import("./server");
    expect(() => getStripe()).toThrow("sk_test_");
  });
});