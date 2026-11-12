import { describe, expect, it } from "vitest";
import {
  decideMailboxClaim,
  loadMailboxHolders,
  matchingMailboxHolderIds,
  nextMailboxMigrationPhase,
  nonOfficerMailboxAccess,
  patchMailboxPage,
  scanMailboxPage,
  storedIeeeEmailAfterBackfill,
  type IeeeEmailIndexedUsers,
  type MailboxIndexRow,
  type MailboxMigrationPhase,
} from "./mailboxClaim";

function exactIeeeEmailIndex(rows: readonly MailboxIndexRow[]) {
  const queried: string[] = [];
  let fullTableCollects = 0;
  const db = {
    query(table: "users") {
      if (table !== "users") throw new Error(table);
      return {
        withIndex(
          indexName: "by_ieeeEmail",
          indexRange: (q: {
            eq: (field: "ieeeEmail", value: string) => unknown;
          }) => unknown,
        ) {
          if (indexName !== "by_ieeeEmail") throw new Error(indexName);
          let key = "";
          indexRange({
            eq(field, value) {
              if (field !== "ieeeEmail") throw new Error(field);
              key = value;
              return undefined;
            },
          });
          queried.push(key);
          return {
            collect: async () => rows.filter((row) => row.ieeeEmail === key),
          };
        },
        collect: async () => {
          fullTableCollects += 1;
          throw new Error("full table collect");
        },
      };
    },
  };
  return {
    db: db as IeeeEmailIndexedUsers,
    queried: () => queried,
    fullTableCollects: () => fullTableCollects,
  };
}

describe("decideMailboxClaim", () => {
  it("lets the login that normalizes to the mailbox claim it first", () => {
    expect(
      decideMailboxClaim({
        callerId: "ada-ucsd",
        callerEmail: "Ada.Lovelace@ucsd.edu",
        requestedMailbox: "adalovelace@ieeeatucsd.org",
        holderIds: [],
      }),
    ).toBe("allow");
  });

  it("lets the account that already holds the mailbox keep it", () => {
    expect(
      decideMailboxClaim({
        callerId: "ada-ucsd",
        callerEmail: "ada@ucsd.edu",
        requestedMailbox: "ADA@IEEEATUCSD.org",
        holderIds: ["ada-ucsd"],
      }),
    ).toBe("allow");
  });

  it("rejects a mailbox whose local part is not this login", () => {
    expect(
      decideMailboxClaim({
        callerId: "ada-ucsd",
        callerEmail: "ada@ucsd.edu",
        requestedMailbox: "president@ieeeatucsd.org",
        holderIds: [],
      }),
    ).toBe("mismatch");
  });

  it("treats a case variant as the same held mailbox", () => {
    const holderIds = matchingMailboxHolderIds("ada@ieeeatucsd.org", [
      { id: "owner", ieeeEmail: "Ada@ieeeatucsd.org" },
    ]);

    expect(holderIds).toEqual(["owner"]);
    expect(
      decideMailboxClaim({
        callerId: "intruder",
        callerEmail: "ada@another-domain.example",
        requestedMailbox: "ada@ieeeatucsd.org",
        holderIds,
      }),
    ).toBe("taken");
  });

  it("rejects a second login that strips to a mailbox someone else holds", () => {
    expect(
      decideMailboxClaim({
        callerId: "ada-other",
        callerEmail: "ada@another-domain.example",
        requestedMailbox: "ada@ieeeatucsd.org",
        holderIds: ["ada-ucsd"],
      }),
    ).toBe("taken");

    expect(
      decideMailboxClaim({
        callerId: "ada-smith-plain",
        callerEmail: "adasmith@ucsd.edu",
        requestedMailbox: "adasmith@ieeeatucsd.org",
        holderIds: ["ada-smith-dotted"],
      }),
    ).toBe("taken");
  });
});

describe("loadMailboxHolders", () => {
  const rows: MailboxIndexRow[] = [
    { _id: "owner", ieeeEmail: "Ada@ieeeatucsd.org" },
    { _id: "president", ieeeEmail: "president@ieeeatucsd.org" },
  ];

  it("matches a legacy mixed-case row from the raw index key without collecting users", async () => {
    const index = exactIeeeEmailIndex(rows);
    const holders = await loadMailboxHolders(index.db, "ada@ieeeatucsd.org", [
      "Ada@ieeeatucsd.org",
    ]);

    expect(holders.map((holder) => holder.id)).toEqual(["owner"]);
    expect(index.queried()).toEqual([
      "ada@ieeeatucsd.org",
      "Ada@ieeeatucsd.org",
    ]);
    expect(index.fullTableCollects()).toBe(0);
  });

  it("finds the same row from the lowercase index key after backfill", async () => {
    const rewritten = rows.map((row) => {
      const next = storedIeeeEmailAfterBackfill(row.ieeeEmail);
      return next.changed ? { ...row, ieeeEmail: next.ieeeEmail } : row;
    });
    const index = exactIeeeEmailIndex(rewritten);
    const holders = await loadMailboxHolders(index.db, "ada@ieeeatucsd.org");

    expect(rewritten[0]?.ieeeEmail).toBe("ada@ieeeatucsd.org");
    expect(storedIeeeEmailAfterBackfill(rewritten[0]?.ieeeEmail).changed).toBe(
      false,
    );
    expect(holders.map((holder) => holder.id)).toEqual(["owner"]);
    expect(index.queried()).toEqual(["ada@ieeeatucsd.org"]);
    expect(index.fullTableCollects()).toBe(0);
  });
});

describe("mailbox migration", () => {
  it("keeps a non-officer closed until the migration is done, then opens", () => {
    expect(
      nonOfficerMailboxAccess({ migrationDone: false, collision: false }),
    ).toBe("closed");
    expect(
      nonOfficerMailboxAccess({ migrationDone: true, collision: false }),
    ).toBe("open");
    expect(
      nonOfficerMailboxAccess({ migrationDone: true, collision: true }),
    ).toBe("collision");
  });

  it("does not rewrite rows that collapse to one mailbox, and records the collision", () => {
    const rows = [
      { id: "mixed", ieeeEmail: "Ada@ieeeatucsd.org" },
      { id: "lower", ieeeEmail: "ada@ieeeatucsd.org" },
      { id: "unique", ieeeEmail: "President@ieeeatucsd.org" },
    ];
    const planned = patchMailboxPage(rows, (canon) =>
      canon === "ada@ieeeatucsd.org" ? 2 : 1,
    );

    expect(planned.patches).toEqual([
      { id: "unique", ieeeEmail: "president@ieeeatucsd.org" },
    ]);
    expect(planned.collisions).toEqual(["ada@ieeeatucsd.org"]);
  });

  it("pages past the first page and records done only on the last patch page", () => {
    const rows = [
      { id: "mixed", ieeeEmail: "Ada@ieeeatucsd.org" },
      { id: "lower", ieeeEmail: "ada@ieeeatucsd.org" },
      { id: "unique", ieeeEmail: "President@ieeeatucsd.org" },
    ];
    const pageSize = 2;
    const holders = new Map<string, string>();
    let phase: MailboxMigrationPhase = "scan";
    let cursor = 0;
    const seen: { phase: MailboxMigrationPhase; recordDone: boolean }[] = [];
    const patches: { id: string; ieeeEmail: string }[] = [];
    const collisions = new Set<string>();

    while (phase !== "done") {
      const page = rows.slice(cursor, cursor + pageSize);
      const isLastPage = cursor + pageSize >= rows.length;
      if (phase === "scan") {
        for (const note of scanMailboxPage(page)) {
          holders.set(note.userId, note.canon);
        }
      } else {
        const counts = new Map<string, number>();
        for (const canon of holders.values()) {
          counts.set(canon, (counts.get(canon) ?? 0) + 1);
        }
        const planned = patchMailboxPage(
          page,
          (canon) => counts.get(canon) ?? 0,
        );
        patches.push(...planned.patches);
        for (const canon of planned.collisions) collisions.add(canon);
      }
      const step = nextMailboxMigrationPhase(phase, isLastPage);
      seen.push({ phase, recordDone: step.recordDone });
      cursor = isLastPage ? 0 : cursor + pageSize;
      phase = step.phase;
    }

    expect(seen.map((step) => step.phase)).toEqual([
      "scan",
      "scan",
      "patch",
      "patch",
    ]);
    expect(seen.slice(0, -1).every((step) => !step.recordDone)).toBe(true);
    expect(seen.at(-1)?.recordDone).toBe(true);
    expect(patches).toEqual([
      { id: "unique", ieeeEmail: "president@ieeeatucsd.org" },
    ]);
    expect([...collisions]).toEqual(["ada@ieeeatucsd.org"]);
  });
});
