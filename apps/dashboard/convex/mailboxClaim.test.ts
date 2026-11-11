import { describe, expect, it } from "vitest";
import { decideMailboxClaim, matchingMailboxHolderIds } from "./mailboxClaim";

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
