import { describe, expect, it } from "vitest";
import { buildVariantLabel, cartesianProduct, getStockDisplay } from "./helpers";

describe("getStockDisplay", () => {
  it("returns sold_out at zero", () => {
    expect(getStockDisplay(0, 5)).toBe("sold_out");
  });

  it("returns low_stock at threshold", () => {
    expect(getStockDisplay(5, 5)).toBe("low_stock");
  });

  it("returns in_stock above threshold", () => {
    expect(getStockDisplay(10, 5)).toBe("in_stock");
  });
});

describe("cartesianProduct", () => {
  it("generates all combinations", () => {
    expect(
      cartesianProduct([
        ["S", "M"],
        ["Red", "Blue"],
      ]),
    ).toEqual([
      ["S", "Red"],
      ["S", "Blue"],
      ["M", "Red"],
      ["M", "Blue"],
    ]);
  });
});

describe("buildVariantLabel", () => {
  it("joins option values", () => {
    expect(buildVariantLabel(["Large", "Navy"])).toBe("Large / Navy");
  });
});
