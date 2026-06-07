import { describe, expect, it } from "vitest";
import {
  computeEventPickupCutoff,
  generateScheduleWindows,
  isPickupOptionSelectable,
  laLocalToUtc,
} from "./pickupHelpers";

describe("pickupHelpers", () => {
  it("computes relative event cutoff from hours before start", () => {
    const startDate = Date.UTC(2026, 5, 10, 20, 0);
    expect(
      computeEventPickupCutoff({
        startDate,
        merchPickupCutoffType: "relative",
        merchPickupCutoffAt: 24,
      }),
    ).toBe(startDate - 24 * 60 * 60 * 1000);
  });

  it("computes absolute event cutoff from fixed timestamp", () => {
    const startDate = Date.UTC(2026, 5, 10, 20, 0);
    const absoluteCutoff = Date.UTC(2026, 5, 9, 20, 0);
    expect(
      computeEventPickupCutoff({
        startDate,
        merchPickupCutoffType: "absolute",
        merchPickupCutoffAt: absoluteCutoff,
      }),
    ).toBe(absoluteCutoff);
  });

  it("rejects pickup options past cutoff or at capacity", () => {
    const now = Date.UTC(2026, 5, 10, 12, 0);
    expect(
      isPickupOptionSelectable(
        {
          status: "active",
          cutoffAt: now - 1,
          orderCount: 0,
          windowEnd: now + 3600000,
        },
        now,
      ),
    ).toBe(false);

    expect(
      isPickupOptionSelectable(
        {
          status: "active",
          cutoffAt: now + 3600000,
          capacity: 2,
          orderCount: 2,
          windowEnd: now + 7200000,
        },
        now,
      ),
    ).toBe(false);
  });

  it("generates weekly schedule windows", () => {
    const anchor = laLocalToUtc(2026, 6, 4, 12 * 60);
    const windows = generateScheduleWindows(
      {
        dayOfWeek: 3,
        startTimeMinutes: 12 * 60,
        endTimeMinutes: 14 * 60,
        instructions: "Project Space pickup",
        cutoffHoursBefore: 24,
        exceptions: [],
      },
      2,
      anchor,
    );
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0]?.instructions).toBe("Project Space pickup");
  });
});
