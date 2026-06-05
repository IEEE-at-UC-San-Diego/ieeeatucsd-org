import { describe, expect, it } from "vitest";

import { getGoogleGroupForRole, getGoogleGroupSyncPlan } from "./google-groups";

describe("Google Groups role mapping", () => {
  it.each([
    ["General Officer", "generalofficers@ieeeatucsd.org"],
    ["Executive Officer", "executiveofficers@ieeeatucsd.org"],
    ["Administrator", "executiveofficers@ieeeatucsd.org"],
    ["Past Officer", "pastofficers@ieeeatucsd.org"],
  ])("maps %s to %s", (role, group) => {
    expect(getGoogleGroupForRole(role)).toBe(group);
  });

  it.each(["Member", "Member at Large", "Sponsor"])(
    "does not add a new Google Group for %s",
    (role) => {
      expect(getGoogleGroupForRole(role)).toBeNull();
    },
  );

  it("plans General Officer sync by adding general officers and removing stale groups", () => {
    expect(getGoogleGroupSyncPlan("General Officer")).toEqual({
      targetGroup: "generalofficers@ieeeatucsd.org",
      groupsToRemove: [
        "executiveofficers@ieeeatucsd.org",
        "pastofficers@ieeeatucsd.org",
      ],
    });
  });

  it.each(["Member", "Member at Large", "Sponsor"])(
    "plans stale officer group removal for %s",
    (role) => {
      expect(getGoogleGroupSyncPlan(role)).toEqual({
        targetGroup: null,
        groupsToRemove: [
          "executiveofficers@ieeeatucsd.org",
          "generalofficers@ieeeatucsd.org",
          "pastofficers@ieeeatucsd.org",
        ],
      });
    },
  );
});
