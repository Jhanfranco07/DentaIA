import { describe, expect, it } from "vitest";
import { PLAN_PREMIUM } from "./plan";

describe("PLAN_PREMIUM", () => {
  it("tiene un monto entero positivo en centavos", () => {
    expect(Number.isInteger(PLAN_PREMIUM.amount)).toBe(true);
    expect(PLAN_PREMIUM.amount).toBeGreaterThan(0);
  });

  it("usa una moneda de 3 letras en minúsculas", () => {
    expect(PLAN_PREMIUM.currency).toMatch(/^[a-z]{3}$/);
  });
});