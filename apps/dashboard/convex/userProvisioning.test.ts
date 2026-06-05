import { describe, expect, it } from "vitest";
import { buildAuthUpsertResult } from "./userProvisioning";

describe("buildAuthUpsertResult", () => {
  it("returns contract fields for an existing signed-up user", () => {
    const result = buildAuthUpsertResult(
      "user_existing" as any,
      true,
      "Executive Officer",
    );

    expect(result).toEqual({
      userId: "user_existing",
      signedUp: true,
      role: "Executive Officer",
    });
  });

  it("returns contract fields for a new user", () => {
    const result = buildAuthUpsertResult("user_new" as any, false, "Member");

    expect(result).toEqual({
      userId: "user_new",
      signedUp: false,
      role: "Member",
    });
  });
});
