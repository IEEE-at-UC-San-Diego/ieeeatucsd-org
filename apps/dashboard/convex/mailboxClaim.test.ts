import { describe, expect, it } from "vitest";
import {
  decideMailboxClaim,
  loadMailboxHolders,
  matchingMailboxHolderIds,
  storedIeeeEmailAfterBackfill,
  type IeeeEmailIndexedUsers,
  type MailboxIndexRow,
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
