import { describe, expect, it } from "vitest";
import {
  applyResolvedAuditUserNames,
  hasUnknownUserName,
  resolveAuditActor,
} from "./constitutionAudit";

describe("resolveAuditActor", () => {
  it("uses the database user's name", () => {
    expect(
      resolveAuditActor(
        { logtoId: "logto|1", name: "Ada Lovelace", email: "ada@ieee.org" },
        "fallback",
      ),
    ).toEqual({ userId: "logto|1", userName: "Ada Lovelace" });
  });

  it("falls back to the email when the name is blank", () => {
    expect(
      resolveAuditActor(
        { logtoId: "logto|1", name: "   ", email: "ada@ieee.org" },
        "fallback",
      ),
    ).toEqual({ userId: "logto|1", userName: "ada@ieee.org" });
  });

  it("uses authUserId when logtoId is absent", () => {
    expect(
      resolveAuditActor(
        { authUserId: "auth-1", name: "Grace Hopper" },
        "fallback",
      ),
    ).toEqual({ userId: "auth-1", userName: "Grace Hopper" });
  });

  it("falls back to the provided logto id for the user id", () => {
    expect(resolveAuditActor({ name: "Grace Hopper" }, "logto|42")).toEqual({
      userId: "logto|42",
      userName: "Grace Hopper",
    });
  });

  it("reports an unknown user when no identity is available", () => {
    expect(resolveAuditActor(null, "logto|42")).toEqual({
      userId: "logto|42",
      userName: "Unknown User",
    });
  });
});

describe("hasUnknownUserName", () => {
  it.each([undefined, null, "", "   ", "Unknown User"])(
    "treats %j as unknown",
    (value) => {
      expect(hasUnknownUserName(value)).toBe(true);
    },
  );

  it("keeps a real name", () => {
    expect(hasUnknownUserName("Ada Lovelace")).toBe(false);
  });
});

describe("applyResolvedAuditUserNames", () => {
  it("returns the entries unchanged when nothing resolved", () => {
    const entries = [{ userId: "logto|1", userName: "Unknown User" }];
    expect(applyResolvedAuditUserNames(entries, new Map())).toBe(entries);
  });

  it("replaces an unknown name with the resolved display name", () => {
    const entries = [{ userId: "logto|1", userName: "Unknown User" }];
    const result = applyResolvedAuditUserNames(
      entries,
      new Map([["logto|1", "Grace Hopper"]]),
    );
    expect(result[0].userName).toBe("Grace Hopper");
  });

  it("preserves names that were already recorded", () => {
    const entries = [{ userId: "logto|1", userName: "Recorded Name" }];
    const result = applyResolvedAuditUserNames(
      entries,
      new Map([["logto|1", "Different Name"]]),
    );
    expect(result[0].userName).toBe("Recorded Name");
  });

  it("leaves entries without a resolvable actor untouched", () => {
    const entries = [{ userId: "logto|missing", userName: "Unknown User" }];
    const result = applyResolvedAuditUserNames(
      entries,
      new Map([["logto|1", "Grace Hopper"]]),
    );
    expect(result[0].userName).toBe("Unknown User");
  });

  it("ignores entries that have no actor id", () => {
    const entries = [{ userName: "Unknown User" }];
    const result = applyResolvedAuditUserNames(
      entries,
      new Map([["logto|1", "Grace Hopper"]]),
    );
    expect(result[0].userName).toBe("Unknown User");
  });
});
