import { describe, expect, it } from "vitest";
import { getEventTimeRangeError } from "./eventTimeRange";

describe("getEventTimeRangeError", () => {
  it("accepts a valid time range", () => {
    expect(getEventTimeRangeError(1_000, 2_000)).toBeNull();
  });

  it("rejects equal start and end times", () => {
    expect(getEventTimeRangeError(1_000, 1_000)).toBe("End time must be after start time.");
  });

  it("rejects an end time before the start time", () => {
    expect(getEventTimeRangeError(2_000, 1_000)).toBe("End time must be after start time.");
  });

  it("rejects invalid timestamps", () => {
    expect(getEventTimeRangeError(Number.NaN, 1_000)).toBe("Start and end time must be valid dates.");
  });
});
