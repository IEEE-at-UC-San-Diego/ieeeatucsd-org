import { describe, expect, it } from "vitest";
import { isDuplicateEventAttendance } from "./events";

describe("event check-in duplicate defense", () => {
  it("recognizes a normalized attendance row", () => {
    expect(isDuplicateEventAttendance({ _id: "attendance_1" }, {}, "user_1")).toBe(
      true,
    );
  });

  it("recognizes a legacy event attendee ID", () => {
    expect(
      isDuplicateEventAttendance(null, { attendees: ["user_1"] }, "user_1"),
    ).toBe(true);
  });

  it("allows a user absent from both attendance representations", () => {
    expect(
      isDuplicateEventAttendance(null, { attendees: ["user_2"] }, "user_1"),
    ).toBe(false);
  });
});
