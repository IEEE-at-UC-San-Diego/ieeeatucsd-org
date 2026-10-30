import { describe, expect, it } from "vitest";
import { canOfficerReadAiTable, projectAiRecord } from "./aiAccess";
import type { UserRole } from "./permissions";

const memberRecord = {
  _id: "users_bob",
  logtoId: "logto|bob",
  name: "Bob",
  email: "bob@example.com",
  role: "Member",
  status: "active",
  signedUp: true,
  pid: "A12345678",
  zelleInformation: "bob-zelle",
  resume: { storageId: "storage_1", fileName: "resume.pdf" },
  ieeeEmail: "bob@ieeeatucsd.org",
};

describe("canOfficerReadAiTable", () => {
  it("blocks general officers from admin-only tables", () => {
    expect(canOfficerReadAiTable("General Officer", "reimbursements")).toBe(
      false,
    );
    expect(canOfficerReadAiTable("General Officer", "organizationSettings")).toBe(
      false,
    );
    expect(canOfficerReadAiTable("General Officer", "logs")).toBe(false);
    expect(canOfficerReadAiTable("General Officer", "notifications")).toBe(
      false,
    );
    expect(canOfficerReadAiTable("General Officer", "invites")).toBe(false);
  });

  it("lets administrators and executive officers read those tables", () => {
    for (const role of ["Administrator", "Executive Officer"] as const) {
      expect(canOfficerReadAiTable(role, "reimbursements")).toBe(true);
      expect(canOfficerReadAiTable(role, "officerInvitations")).toBe(true);
    }
  });

  it("still lets general officers read officer-scoped tables", () => {
    expect(canOfficerReadAiTable("General Officer", "events")).toBe(true);
    expect(canOfficerReadAiTable("General Officer", "fundRequests")).toBe(true);
    expect(canOfficerReadAiTable("General Officer", "users")).toBe(true);
  });
});

describe("projectAiRecord", () => {
  it("strips payment and identity fields from users for general officers", () => {
    const visible = projectAiRecord(
      "users",
      "General Officer",
      memberRecord,
    );

    expect(visible).toMatchObject({
      name: "Bob",
      email: "bob@example.com",
      role: "Member",
    });
    expect(visible).not.toHaveProperty("zelleInformation");
    expect(visible).not.toHaveProperty("pid");
    expect(visible).not.toHaveProperty("resume");
    expect(visible).not.toHaveProperty("ieeeEmail");
  });

  it.each(["Administrator", "Executive Officer"] as const)(
    "keeps the full user record for %s",
    (role: UserRole) => {
      expect(projectAiRecord("users", role, memberRecord)).toBe(memberRecord);
    },
  );

  it("does not reshape records from other officer-readable tables", () => {
    const event = { eventName: "Info session", invoices: [{ total: 12 }] };
    expect(projectAiRecord("events", "General Officer", event)).toBe(event);
  });
});
