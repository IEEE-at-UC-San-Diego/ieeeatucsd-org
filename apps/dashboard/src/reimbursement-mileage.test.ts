import { describe, expect, it } from "vite-plus/test";
import {
  computeMileageTotal,
  formatMileageRoute,
  MILEAGE_RATE_PER_MILE,
  metersToRoundedMiles,
  roundMileage,
} from "./lib/reimbursement-mileage";

describe("computeMileageTotal", () => {
  it("uses 20 cents per mile", () => {
    expect(MILEAGE_RATE_PER_MILE).toBe(0.2);
    expect(computeMileageTotal(10)).toBe(2);
    expect(computeMileageTotal(1)).toBe(0.2);
  });

  it("rounds to cents", () => {
    expect(computeMileageTotal(0.125)).toBe(0.03);
    expect(computeMileageTotal(3)).toBe(0.6);
  });

  it("returns 0 for non-positive or invalid", () => {
    expect(computeMileageTotal(0)).toBe(0);
    expect(computeMileageTotal(-1)).toBe(0);
    expect(computeMileageTotal(Number.NaN)).toBe(0);
  });
});

describe("roundMileage", () => {
  it("rounds positive mileage to two decimals", () => {
    expect(roundMileage(12.345)).toBe(12.35);
    expect(roundMileage(12.344)).toBe(12.34);
  });

  it("converts meters to rounded miles", () => {
    expect(metersToRoundedMiles(1609.344)).toBe(1);
    expect(metersToRoundedMiles(3218.688)).toBe(2);
    expect(metersToRoundedMiles(0)).toBe(0);
  });
});

describe("formatMileageRoute", () => {
  it("joins from, stops, and to", () => {
    expect(formatMileageRoute("A", "B", [])).toBe("A → B");
    expect(formatMileageRoute("A", "B", ["X", "Y"])).toBe("A → X → Y → B");
    expect(formatMileageRoute("", "B", undefined)).toBe("B");
    expect(formatMileageRoute("A", "", undefined)).toBe("A");
  });

  it("trims and drops empty parts", () => {
    expect(formatMileageRoute("  A  ", "  B ", ["  "])).toBe("A → B");
    expect(formatMileageRoute(undefined, undefined, undefined)).toBe("");
  });
});
