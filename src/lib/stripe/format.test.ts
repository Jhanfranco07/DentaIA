import { describe, expect, it } from "vitest";
import { formatStripeAmount } from "./format";

describe("formatStripeAmount", () => {
  it("uses the currency's minor-unit scale instead of assuming cents", () => {
    expect(formatStripeAmount(1234, "USD", "en-US")).toBe("$12.34");
    expect(formatStripeAmount(123, "JPY", "en-US")).toBe("¥123");
    expect(formatStripeAmount(1234, "KWD", "en-US")).toContain("1.234");
  });
});
