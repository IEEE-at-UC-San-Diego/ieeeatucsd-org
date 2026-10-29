import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { EventPoints } from "./eventPoints";

describe("EventPoints.getError", () => {
  it("accepts missing values so callers can default them", () => {
    expect(EventPoints.getError(undefined)).toBeNull();
    expect(EventPoints.getError(null)).toBeNull();
    expect(EventPoints.getError("")).toBeNull();
  });

  it("accepts zero and other non-negative integers", () => {
    expect(EventPoints.getError(0)).toBeNull();
    expect(EventPoints.getError(15)).toBeNull();
    expect(EventPoints.getError("0")).toBeNull();
    expect(EventPoints.getError("15")).toBeNull();
  });

  it("rejects negatives, fractions, and non-integers", () => {
    expect(EventPoints.getError(-1)).toBe("Points to reward cannot be negative.");
    expect(EventPoints.getError(1.5)).toBe(
      "Points to reward must be a non-negative integer.",
    );
    expect(EventPoints.getError("12.5")).toBe(
      "Points to reward must be a non-negative integer.",
    );
    expect(EventPoints.getError("abc")).toBe(
      "Points to reward must be a non-negative integer.",
    );
    expect(EventPoints.getError(Number.NaN)).toBe(
      "Points to reward must be a non-negative integer.",
    );
  });
});

describe("EventPoints.fromUnknown", () => {
  it("defaults missing values to zero", () => {
    expect(EventPoints.fromUnknown(undefined)).toBe(0);
    expect(EventPoints.fromUnknown(null)).toBe(0);
    expect(EventPoints.fromUnknown("")).toBe(0);
  });

  it("keeps an explicit officer-set value", () => {
    expect(EventPoints.fromUnknown(10)).toBe(10);
    expect(EventPoints.fromUnknown("10")).toBe(10);
  });

  it("throws on invalid values instead of coercing them", () => {
    expect(() => EventPoints.fromUnknown(-4)).toThrow(ConvexError);
    expect(() => EventPoints.fromUnknown(2.2)).toThrow(ConvexError);
  });
});

describe("EventPoints.parseInput", () => {
  it("treats a cleared field as zero", () => {
    expect(EventPoints.parseInput("")).toBe(0);
    expect(EventPoints.parseInput("   ")).toBe(0);
  });

  it("parses a whole-number field", () => {
    expect(EventPoints.parseInput("8")).toBe(8);
  });

  it("rejects invalid typed values", () => {
    expect(() => EventPoints.parseInput("-1")).toThrow(ConvexError);
    expect(() => EventPoints.parseInput("1.5")).toThrow(ConvexError);
  });
});

describe("EventPoints.tryParseInput", () => {
  it("returns null for invalid keystrokes instead of throwing", () => {
    expect(EventPoints.tryParseInput("-1")).toBeNull();
    expect(EventPoints.tryParseInput("1.5")).toBeNull();
    expect(EventPoints.tryParseInput("abc")).toBeNull();
  });

  it("parses empty and valid values", () => {
    expect(EventPoints.tryParseInput("")).toBe(0);
    expect(EventPoints.tryParseInput("9")).toBe(9);
  });
});

describe("EventPoints.fromDocument", () => {
  it("reads pointsToReward from a stored event", () => {
    expect(EventPoints.fromDocument({ pointsToReward: 12 })).toBe(12);
    expect(EventPoints.fromDocument({})).toBe(0);
  });
});
