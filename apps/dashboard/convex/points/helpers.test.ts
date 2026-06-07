import { describe, expect, it } from "vitest";
import {
  applyEarnedPoints,
  applyOfficerAward,
  applySpendableDeduction,
  applySpendableRefund,
  canAffordSpendable,
  getUserPointTotals,
} from "./helpers";

describe("getUserPointTotals", () => {
  it("falls back to legacy points field", () => {
    expect(getUserPointTotals({ points: 42 })).toEqual({
      lifetimePointsEarned: 42,
      spendablePoints: 42,
      pendingPointCorrection: 0,
    });
  });

  it("prefers explicit totals over legacy points", () => {
    expect(
      getUserPointTotals({
        points: 10,
        lifetimePointsEarned: 50,
        spendablePoints: 30,
        pendingPointCorrection: 5,
      }),
    ).toEqual({
      lifetimePointsEarned: 50,
      spendablePoints: 30,
      pendingPointCorrection: 5,
    });
  });
});

describe("applyEarnedPoints", () => {
  it("adds to both lifetime and spendable when no pending correction", () => {
    const result = applyEarnedPoints(
      { lifetimePointsEarned: 10, spendablePoints: 10, pendingPointCorrection: 0 },
      5,
    );
    expect(result.lifetimePointsEarned).toBe(15);
    expect(result.spendablePoints).toBe(15);
    expect(result.pendingRepaid).toBe(0);
  });

  it("repays pending correction before adding spendable", () => {
    const result = applyEarnedPoints(
      { lifetimePointsEarned: 20, spendablePoints: 0, pendingPointCorrection: 8 },
      10,
    );
    expect(result.lifetimePointsEarned).toBe(30);
    expect(result.pendingPointCorrection).toBe(0);
    expect(result.pendingRepaid).toBe(8);
    expect(result.spendablePoints).toBe(2);
  });

  it("partially repays pending correction", () => {
    const result = applyEarnedPoints(
      { lifetimePointsEarned: 20, spendablePoints: 0, pendingPointCorrection: 15 },
      10,
    );
    expect(result.pendingPointCorrection).toBe(5);
    expect(result.pendingRepaid).toBe(10);
    expect(result.spendablePoints).toBe(0);
  });
});

describe("applySpendableDeduction", () => {
  it("deducts from spendable when sufficient balance", () => {
    const result = applySpendableDeduction(
      { lifetimePointsEarned: 100, spendablePoints: 50, pendingPointCorrection: 0 },
      20,
    );
    expect(result.spendablePoints).toBe(30);
    expect(result.pendingPointCorrection).toBe(0);
    expect(result.pendingAdded).toBe(0);
  });

  it("creates pending correction when spendable would go negative", () => {
    const result = applySpendableDeduction(
      { lifetimePointsEarned: 100, spendablePoints: 10, pendingPointCorrection: 0 },
      25,
    );
    expect(result.spendablePoints).toBe(0);
    expect(result.pendingPointCorrection).toBe(15);
    expect(result.pendingAdded).toBe(15);
  });
});

describe("applyOfficerAward", () => {
  it("increases lifetime when affectsLifetime is true", () => {
    const result = applyOfficerAward(
      { lifetimePointsEarned: 10, spendablePoints: 10, pendingPointCorrection: 0 },
      5,
      true,
    );
    expect(result.lifetimePointsEarned).toBe(15);
    expect(result.spendablePoints).toBe(15);
  });

  it("only increases spendable when affectsLifetime is false", () => {
    const result = applyOfficerAward(
      { lifetimePointsEarned: 10, spendablePoints: 10, pendingPointCorrection: 0 },
      5,
      false,
    );
    expect(result.lifetimePointsEarned).toBe(10);
    expect(result.spendablePoints).toBe(15);
  });
});

describe("applySpendableRefund", () => {
  it("raises spendable without affecting lifetime", () => {
    const result = applySpendableRefund(
      { lifetimePointsEarned: 50, spendablePoints: 20, pendingPointCorrection: 0 },
      10,
    );
    expect(result.spendablePoints).toBe(30);
    expect(result.lifetimePointsEarned).toBe(50);
  });
});

describe("canAffordSpendable", () => {
  it("rejects insufficient balance", () => {
    expect(
      canAffordSpendable(
        { lifetimePointsEarned: 100, spendablePoints: 5, pendingPointCorrection: 0 },
        10,
      ),
    ).toBe(false);
  });
});
