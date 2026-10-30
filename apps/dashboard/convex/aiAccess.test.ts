import { describe, expect, it } from "vitest";
import { AiAccess } from "./aiAccess";
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

const knownTables = [
  ...AiAccess.officerReadableTables,
  ...AiAccess.adminOnlyTables,
];

const deposits = [
  { depositedBy: "officer-me", amount: 25, status: "verified" },
  { depositedBy: "officer-other", amount: 400, status: "verified" },
];

describe("canOfficerReadAiTable", () => {
  it("blocks general officers from admin-only tables", () => {
    expect(AiAccess.canOfficerReadAiTable("General Officer", "reimbursements")).toBe(
      false,
    );
    expect(
      AiAccess.canOfficerReadAiTable("General Officer", "organizationSettings"),
    ).toBe(false);
    expect(AiAccess.canOfficerReadAiTable("General Officer", "logs")).toBe(
      false,
    );
    expect(
      AiAccess.canOfficerReadAiTable("General Officer", "notifications"),
    ).toBe(false);
    expect(AiAccess.canOfficerReadAiTable("General Officer", "invites")).toBe(
      false,
    );
  });

  it("lets administrators and executive officers read those tables", () => {
    for (const role of ["Administrator", "Executive Officer"] as const) {
      expect(AiAccess.canOfficerReadAiTable(role, "reimbursements")).toBe(true);
      expect(AiAccess.canOfficerReadAiTable(role, "officerInvitations")).toBe(
        true,
      );
    }
  });

  it("still lets general officers read every officer-scoped table", () => {
    for (const table of AiAccess.officerReadableTables) {
      expect(AiAccess.canOfficerReadAiTable("General Officer", table)).toBe(
        true,
      );
    }
    expect(AiAccess.canOfficerReadAiTable("General Officer", "events")).toBe(
      true,
    );
    expect(
      AiAccess.canOfficerReadAiTable("General Officer", "fundRequests"),
    ).toBe(true);
    expect(AiAccess.canOfficerReadAiTable("General Officer", "users")).toBe(
      true,
    );
  });

  it("denies tables that are not explicitly classified", () => {
    for (const role of [
      "General Officer",
      "Executive Officer",
      "Administrator",
    ] as const) {
      expect(AiAccess.canOfficerReadAiTable(role, "payrollSecrets")).toBe(
        false,
      );
    }
  });
});

describe("fund deposit row scope", () => {
  it.each(["General Officer", "Executive Officer"] as const)(
    "hides the rest of the deposit table from %s, including amount sums",
    (role: UserRole) => {
      expect(AiAccess.readsFullFundDepositTable(role)).toBe(false);
      expect(
        AiAccess.scopeRecords("fundDeposits", role, "officer-me", deposits),
      ).toEqual([deposits[0]]);
      expect(
        AiAccess.canReadRecord(
          "fundDeposits",
          role,
          "officer-me",
          deposits[1],
        ),
      ).toBe(false);
      expect(
        AiAccess.canReadRecord(
          "fundDeposits",
          role,
          "officer-me",
          deposits[0],
        ),
      ).toBe(true);
      expect(
        AiAccess.canReadRecord("fundDeposits", role, "", deposits[0]),
      ).toBe(false);
      expect(
        AiAccess.summarize("fundDeposits", role, "officer-me", deposits),
      ).toEqual({
        totalCount: 1,
        statusCounts: { verified: 1 },
        totalAmount: 25,
      });
    },
  );

  it("lets administrators read the full deposit table and its amount sum", () => {
    expect(AiAccess.readsFullFundDepositTable("Administrator")).toBe(true);
    expect(
      AiAccess.scopeRecords(
        "fundDeposits",
        "Administrator",
        "admin",
        deposits,
      ),
    ).toEqual(deposits);
    expect(
      AiAccess.canReadRecord(
        "fundDeposits",
        "Administrator",
        "admin",
        deposits[1],
      ),
    ).toBe(true);
    expect(
      AiAccess.summarize("fundDeposits", "Administrator", "admin", deposits),
    ).toMatchObject({ totalCount: 2, totalAmount: 425 });
  });

  it("matches listAll identity: logtoId, otherwise authUserId", () => {
    expect(
      AiAccess.actorId({ logtoId: "logto-1", authUserId: "auth-1" }),
    ).toBe("logto-1");
    expect(AiAccess.actorId({ authUserId: "auth-1" })).toBe("auth-1");

    const byIdentity = [
      { depositedBy: "auth-1", amount: 5 },
      { depositedBy: "logto-1", amount: 9 },
    ];
    expect(
      AiAccess.scopeRecords(
        "fundDeposits",
        "General Officer",
        AiAccess.actorId({ authUserId: "auth-1" }),
        byIdentity,
      ),
    ).toEqual([byIdentity[0]]);
    expect(
      AiAccess.scopeRecords(
        "fundDeposits",
        "Executive Officer",
        AiAccess.actorId({ logtoId: "logto-1", authUserId: "auth-1" }),
        byIdentity,
      ),
    ).toEqual([byIdentity[1]]);
    expect(
      AiAccess.summarize(
        "fundDeposits",
        "Executive Officer",
        AiAccess.actorId({ authUserId: "auth-1" }),
        byIdentity,
      ).totalAmount,
    ).toBe(5);
  });

  it("does not row-scope other officer-readable tables", () => {
    const events = [
      { status: "published", depositedBy: "someone-else" },
      { status: "draft", depositedBy: "me" },
    ];
    expect(
      AiAccess.scopeRecords("events", "General Officer", "me", events),
    ).toEqual(events);
    expect(
      AiAccess.summarize("events", "General Officer", "me", events),
    ).toEqual({
      totalCount: 2,
      statusCounts: { published: 1, draft: 1 },
    });
    expect(
      AiAccess.summarize("fundRequests", "Executive Officer", "me", [
        { amount: 10, depositedBy: "other" },
        { amount: 4, depositedBy: "me" },
      ]).totalAmount,
    ).toBe(14);
  });
});

describe("budget reimbursement totals", () => {
  const input = {
    department: "events",
    totalBudget: 1000,
    adjustments: 100,
    approvedFundRequests: 200,
    verifiedDeposits: 50,
    approvedReimbursements: 4242,
  };

  it("keeps reimbursement totals off the overview for general officers", () => {
    expect(AiAccess.includeReimbursementTotals("General Officer")).toBe(false);
    const row = AiAccess.budgetDepartment("General Officer", input);
    expect(row).not.toHaveProperty("approvedReimbursements");
    expect(JSON.stringify(row)).not.toContain("4242");
    expect(row.remaining).toBe(1000 + 100 + 50 - 200);
    expect(row.verifiedDeposits).toBe(50);
  });

  it.each(["Administrator", "Executive Officer"] as const)(
    "includes reimbursement totals for %s",
    (role: UserRole) => {
      expect(AiAccess.includeReimbursementTotals(role)).toBe(true);
      const row = AiAccess.budgetDepartment(role, input);
      expect(row.approvedReimbursements).toBe(4242);
      expect(row.remaining).toBe(1000 + 100 + 50 - 200 - 4242);
    },
  );
});

describe("named table search", () => {
  it("returns Insufficient permissions when the named table is admin-only", () => {
    expect(
      AiAccess.searchTables("General Officer", "reimbursements", knownTables),
    ).toEqual({ error: "Insufficient permissions", tables: [] });
    expect(
      AiAccess.namedSearchAccessError("General Officer", "logs", knownTables),
    ).toBe("Insufficient permissions");
  });

  it("still lets executive officers name an admin-only table", () => {
    expect(
      AiAccess.searchTables("Executive Officer", "reimbursements", knownTables),
    ).toEqual({ error: null, tables: ["reimbursements"] });
  });

  it("keeps the default search on officer tables", () => {
    const selection = AiAccess.searchTables(
      "General Officer",
      undefined,
      knownTables,
    );
    expect(selection.error).toBeNull();
    expect(selection.tables).toContain("events");
    expect(selection.tables).toContain("fundRequests");
    expect(selection.tables).toContain("fundDeposits");
    expect(selection.tables).not.toContain("reimbursements");
    expect(selection.tables).not.toContain("invites");
    expect(selection.tables).not.toContain("logs");
  });

  it("default-denies an unclassified table even if the caller names it", () => {
    const withUnlisted = ["payrollSecrets", "events"];
    expect(
      AiAccess.searchTables("General Officer", "payrollSecrets", withUnlisted),
    ).toEqual({ error: "Insufficient permissions", tables: [] });
    expect(
      AiAccess.searchTables("Administrator", "payrollSecrets", withUnlisted),
    ).toEqual({ error: "Insufficient permissions", tables: [] });
    expect(
      AiAccess.searchTables("General Officer", "events", withUnlisted).tables,
    ).toEqual(["events"]);
    expect(
      AiAccess.summarize("payrollSecrets", "Administrator", "admin", [
        { amount: 999, status: "paid" },
      ]),
    ).toEqual({ totalCount: 0 });
  });
});

describe("projectAiRecord", () => {
  it("strips payment and identity fields from users for general officers", () => {
    const visible = AiAccess.projectAiRecord(
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
      expect(AiAccess.projectAiRecord("users", role, memberRecord)).toBe(
        memberRecord,
      );
    },
  );

  it("does not reshape records from other officer-readable tables", () => {
    const event = { eventName: "Info session", invoices: [{ total: 12 }] };
    expect(AiAccess.projectAiRecord("events", "General Officer", event)).toBe(
      event,
    );
  });
});
