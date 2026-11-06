import { describe, expect, it } from "vitest";
import {
  assertAccountCanAct,
  transitionAccountStatus,
} from "./accountStatusTransition";
import { constitutionsToArchive } from "./constitutionPublication";
import {
  eventRequestLabel,
  listingForStatus,
  transitionEventRequest,
} from "./eventRequestTransition";
import {
  assertFundDepositDeletable,
  transitionFundDeposit,
} from "./fundDepositTransition";
import {
  fundAuditAction,
  spentFundRequestTotal,
  transitionFundRequest,
} from "./fundRequestTransition";
import { serverPolicyAcceptance } from "./legalVersions";
import {
  assertInvitationServerWriter,
  expiredInvitationFailure,
  INVITATION_EXPIRED,
  transitionOfficerInvitation,
  type InvitationState,
} from "./officerInvitationTransition";
import {
  assertReimbursementDeletable,
  transitionReimbursementPayment,
  transitionReimbursementStatus,
} from "./reimbursementTransition";

const listing = (
  status: "draft" | "submitted" | "pending" | "completed" | "approved" | "declined" | "needs_review",
) => listingForStatus(status);

const invite = (overrides: Partial<InvitationState> = {}): InvitationState => ({
  status: "pending",
  expiresAt: 2_000,
  role: "Executive Officer",
  ...overrides,
});

describe("event request transitions", () => {
  it("rejects a member create that publishes", () => {
    expect(() =>
      transitionEventRequest(null, {
        kind: "create",
        isDraft: false,
        published: true,
        canPublish: false,
      }),
    ).toThrow(/member cannot publish/);
  });

  it("stores an officer publish as completed and public, not a draft", () => {
    expect(
      transitionEventRequest(null, {
        kind: "create",
        isDraft: false,
        published: true,
        canPublish: true,
      }),
    ).toEqual({ status: "completed", published: true, isDraft: false });
  });

  it("rejects an update that would leave a draft published", () => {
    expect(() =>
      transitionEventRequest(listing("draft"), {
        kind: "update",
        published: true,
        canPublish: true,
      }),
    ).toThrow(/draft cannot be published/);
  });

  it("rejects a member update that publishes", () => {
    expect(() =>
      transitionEventRequest(listing("approved"), {
        kind: "update",
        published: true,
        canPublish: false,
      }),
    ).toThrow(/member cannot publish/);
  });

  it("publishes an approved event in one result", () => {
    expect(
      transitionEventRequest(listing("approved"), {
        kind: "setStatus",
        status: "completed",
        canReview: true,
        canSubmitOwnDraft: false,
      }),
    ).toEqual({ status: "completed", published: true, isDraft: false });
  });

  it("rejects a jump straight to published from submitted", () => {
    expect(() =>
      transitionEventRequest(listing("submitted"), {
        kind: "setStatus",
        status: "completed",
        canReview: true,
        canSubmitOwnDraft: false,
      }),
    ).toThrow(/Cannot move an event request from submitted to completed/);
  });

  it("clears the public listing when an event is declined", () => {
    expect(
      transitionEventRequest(listing("completed"), {
        kind: "setStatus",
        status: "declined",
        canReview: true,
        canSubmitOwnDraft: false,
      }),
    ).toEqual({ status: "declined", published: false, isDraft: false });
  });

  it("sets isDraft when converting back to a draft", () => {
    expect(
      transitionEventRequest(listing("approved"), {
        kind: "setStatus",
        status: "draft",
        canReview: true,
        canSubmitOwnDraft: false,
      }),
    ).toEqual({ status: "draft", published: false, isDraft: true });
  });

  it("authorizes a same-status call and keeps a published event published", () => {
    const published = {
      status: "approved" as const,
      published: true,
      isDraft: false,
    };
    expect(
      transitionEventRequest(published, {
        kind: "setStatus",
        status: "approved",
        canReview: true,
        canSubmitOwnDraft: false,
      }),
    ).toEqual(published);
    expect(() =>
      transitionEventRequest(published, {
        kind: "setStatus",
        status: "approved",
        canReview: false,
        canSubmitOwnDraft: false,
      }),
    ).toThrow(/Cannot move an event request from approved to approved/);
    expect(() =>
      transitionEventRequest(listing("submitted"), {
        kind: "setStatus",
        status: "submitted",
        canReview: false,
        canSubmitOwnDraft: true,
      }),
    ).toThrow(/Cannot move an event request from submitted to submitted/);
  });

  it("lets a member submit only their own draft", () => {
    expect(
      transitionEventRequest(listing("draft"), {
        kind: "setStatus",
        status: "submitted",
        canReview: false,
        canSubmitOwnDraft: true,
      }).status,
    ).toBe("submitted");
    expect(() =>
      transitionEventRequest(listing("approved"), {
        kind: "setStatus",
        status: "declined",
        canReview: false,
        canSubmitOwnDraft: false,
      }),
    ).toThrow(/Cannot move an event request/);
  });

  it("shows published after reload only when the stored status is completed", () => {
    expect(eventRequestLabel("completed", true)).toBe("published");
    expect(eventRequestLabel("completed", false)).toBe("published");
    expect(eventRequestLabel("declined", true)).toBe("declined");
    expect(eventRequestLabel("draft", true)).toBe("draft");
    expect(eventRequestLabel(undefined, true)).toBe("published");
  });
});

describe("officer invitation transitions", () => {
  it("does not grant a role when the email does not match", () => {
    const result = transitionOfficerInvitation(
      invite(),
      { type: "accept", emailMatches: false },
      1_000,
    );
    expect(result.ok).toBe(false);
    expect(result.stamp?.grantRole).toBeUndefined();
  });

  it("grants the role in the same result as accepted and clears declinedAt", () => {
    const result = transitionOfficerInvitation(
      invite({ declinedAt: 50 }),
      { type: "accept", emailMatches: true },
      1_000,
    );
    expect(result.ok).toBe(true);
    expect(result.stamp).toMatchObject({
      status: "accepted",
      acceptedAt: 1_000,
      declinedAt: undefined,
      grantRole: true,
      role: "Executive Officer",
    });
  });

  it("stores a past deadline as expired on accept and decline", () => {
    const accept = transitionOfficerInvitation(
      invite({ expiresAt: 500 }),
      { type: "accept", emailMatches: true },
      1_000,
    );
    const decline = transitionOfficerInvitation(
      invite({ expiresAt: 500 }),
      { type: "decline" },
      1_000,
    );
    expect(accept).toMatchObject({
      ok: false,
      error: INVITATION_EXPIRED,
      stamp: { status: "expired", grantRole: false },
    });
    expect(decline.stamp?.status).toBe("expired");
    expect(expiredInvitationFailure(accept)).toEqual({
      ok: false,
      error: INVITATION_EXPIRED,
      status: "expired",
    });
    expect(expiredInvitationFailure(decline)).toEqual({
      ok: false,
      error: INVITATION_EXPIRED,
      status: "expired",
    });
  });

  it("does not persist a failed accept that has no expiry stamp", () => {
    const mismatch = transitionOfficerInvitation(
      invite(),
      { type: "accept", emailMatches: false },
      1_000,
    );
    expect(expiredInvitationFailure(mismatch)).toBeNull();
    expect(mismatch.stamp).toBeUndefined();
  });

  it("refuses to mark accepted without a role grant", () => {
    const result = transitionOfficerInvitation(
      invite(),
      { type: "setStatus", status: "accepted", grantRole: false },
      1_000,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/without granting the role/);
  });

  it("refuses to move an accepted invitation back to pending", () => {
    const result = transitionOfficerInvitation(
      invite({ status: "accepted", acceptedAt: 10 }),
      { type: "setStatus", status: "pending", grantRole: false },
      1_000,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/back to pending/);
  });

  it("clears acceptedAt when declining", () => {
    const result = transitionOfficerInvitation(
      invite({ acceptedAt: 10 }),
      { type: "decline" },
      1_000,
    );
    expect(result.stamp).toMatchObject({
      status: "declined",
      acceptedAt: undefined,
      declinedAt: 1_000,
      grantRole: false,
    });
  });

  it("copies an accepted invitation role through the accept transition", () => {
    const accepted = transitionOfficerInvitation(
      invite({ status: "accepted", acceptedAt: 10, declinedAt: 5 }),
      { type: "applyAccepted" },
      1_000,
    );
    expect(accepted.ok).toBe(true);
    expect(accepted.stamp).toMatchObject({
      grantRole: true,
      role: "Executive Officer",
      declinedAt: undefined,
    });
    const pending = transitionOfficerInvitation(
      invite(),
      { type: "applyAccepted" },
      1_000,
    );
    expect(pending.ok).toBe(false);
    expect(pending.stamp?.grantRole).toBeUndefined();
  });

  it("does not record role flags unless the invitation is accepted", () => {
    const pending = transitionOfficerInvitation(
      invite(),
      { type: "recordSideEffects", setsRoleFlags: true },
      1_000,
    );
    expect(pending.ok).toBe(false);
    const accepted = transitionOfficerInvitation(
      invite({ status: "accepted" }),
      { type: "recordSideEffects", setsRoleFlags: true },
      1_000,
    );
    expect(accepted.ok).toBe(true);
  });

  it("resends only a pending invitation that has not expired", () => {
    expect(
      transitionOfficerInvitation(invite(), { type: "resend" }, 1_000).ok,
    ).toBe(true);
    const expired = transitionOfficerInvitation(
      invite({ expiresAt: 500 }),
      { type: "resend" },
      1_000,
    );
    expect(expired.ok).toBe(false);
    expect(expired.stamp?.status).toBe("expired");
    expect(
      transitionOfficerInvitation(
        invite({ status: "accepted" }),
        { type: "resend" },
        1_000,
      ).ok,
    ).toBe(false);
  });

  it("rejects an unauthenticated side-effect writer", () => {
    const previous = process.env.CONVEX_SESSION_SECRET;
    process.env.CONVEX_SESSION_SECRET = "server-secret";
    expect(() => assertInvitationServerWriter(undefined)).toThrow(/Unauthorized/);
    expect(() => assertInvitationServerWriter("other")).toThrow(/Unauthorized/);
    expect(() => assertInvitationServerWriter("server-secret")).not.toThrow();
    process.env.CONVEX_SESSION_SECRET = previous;
  });
});

describe("fund request transitions", () => {
  it("lets the owner resubmit only from needs info", () => {
    expect(transitionFundRequest("needs_info", "submitted", "owner")).toBe(
      "submitted",
    );
    expect(() =>
      transitionFundRequest("approved", "submitted", "owner"),
    ).toThrow(/approved/);
    expect(() => transitionFundRequest("denied", "submitted", "owner")).toThrow(
      /denied/,
    );
    expect(() =>
      transitionFundRequest("completed", "submitted", "owner"),
    ).toThrow(/completed/);
    expect(() => transitionFundRequest("draft", "submitted", "owner")).toThrow(
      /draft/,
    );
    expect(() => transitionFundRequest("draft", "draft", "admin")).toThrow(
      /draft/,
    );
    expect(() => transitionFundRequest("submitted", "draft", "admin")).toThrow(
      /draft/,
    );
  });

  it("limits admin moves to the review edges and completed", () => {
    expect(transitionFundRequest("submitted", "needs_info", "admin")).toBe(
      "needs_info",
    );
    expect(transitionFundRequest("submitted", "approved", "admin")).toBe(
      "approved",
    );
    expect(transitionFundRequest("submitted", "denied", "admin")).toBe("denied");
    expect(transitionFundRequest("approved", "completed", "admin")).toBe(
      "completed",
    );
    expect(() =>
      transitionFundRequest("completed", "draft", "admin"),
    ).toThrow(/completed/);
    expect(() =>
      transitionFundRequest("denied", "approved", "admin"),
    ).toThrow(/denied/);
    expect(() =>
      transitionFundRequest("needs_info", "approved", "admin"),
    ).toThrow(/needs_info/);
  });

  it("keeps a notes-only save on the same status", () => {
    expect(transitionFundRequest("denied", "denied", "admin")).toBe("denied");
    expect(transitionFundRequest("needs_info", "needs_info", "admin")).toBe(
      "needs_info",
    );
  });

  it("never writes a draft audit action", () => {
    expect(fundAuditAction("needs_info", "submitted")).toBe("info_provided");
    expect(fundAuditAction("submitted", "approved")).toBe("approved");
    expect(fundAuditAction("approved", "completed")).toBe("completed");
    expect(fundAuditAction("denied", "denied")).toBe("updated");
    expect(fundAuditAction("submitted", "needs_info")).toBe("info_requested");
    expect(fundAuditAction("submitted", "denied")).toBe("denied");
  });

  it("counts completed fund requests as spent with approved ones", () => {
    expect(
      spentFundRequestTotal(
        [
          { department: "events", status: "approved", amount: 10 },
          { department: "events", status: "completed", amount: 5 },
          { department: "events", status: "submitted", amount: 100 },
          { department: "projects", status: "completed", amount: 7 },
        ],
        "events",
      ),
    ).toBe(15);
  });
});

describe("reimbursement transitions", () => {
  it("approves or declines only from submitted, and decline needs a reason", () => {
    expect(transitionReimbursementStatus("submitted", "approved", undefined)).toBe(
      "approved",
    );
    expect(() =>
      transitionReimbursementStatus("submitted", "declined", "  "),
    ).toThrow(/Decline reason is required/);
    expect(
      transitionReimbursementStatus("submitted", "declined", "Missing receipt"),
    ).toBe("declined");
  });

  it("pays only an approved reimbursement through payment details", () => {
    expect(transitionReimbursementPayment("approved")).toBe("paid");
    expect(() => transitionReimbursementPayment("submitted")).toThrow(/approved/);
    expect(() => transitionReimbursementPayment("declined")).toThrow(/approved/);
  });

  it("does not move a paid reimbursement backward", () => {
    expect(() =>
      transitionReimbursementStatus("paid", "submitted", undefined),
    ).toThrow(/paid reimbursement backward/);
    expect(() =>
      transitionReimbursementStatus("paid", "declined", "changed mind"),
    ).toThrow(/paid reimbursement backward/);
  });

  it("deletes only before paid", () => {
    expect(() => assertReimbursementDeletable("submitted")).not.toThrow();
    expect(() => assertReimbursementDeletable("approved")).not.toThrow();
    expect(() => assertReimbursementDeletable("declined")).not.toThrow();
    expect(() => assertReimbursementDeletable("paid")).toThrow(/paid/);
  });
});

describe("account status", () => {
  it("rejects suspended and inactive callers", () => {
    expect(() => assertAccountCanAct("suspended")).toThrow(/suspended/);
    expect(() => assertAccountCanAct("inactive")).toThrow(/inactive/);
    expect(() => assertAccountCanAct("active")).not.toThrow();
    expect(() => assertAccountCanAct(undefined)).not.toThrow();
  });

  it("lets an admin move between active, inactive, and suspended", () => {
    expect(transitionAccountStatus("active", "suspended")).toBe("suspended");
    expect(transitionAccountStatus("suspended", "active")).toBe("active");
    expect(transitionAccountStatus("active", "inactive")).toBe("inactive");
    expect(transitionAccountStatus("inactive", "active")).toBe("active");
  });
});

describe("fund deposits", () => {
  it("verifies or rejects only pending deposits and does not stamp verifiedAt on reject", () => {
    expect(transitionFundDeposit("pending", "verified")).toEqual({
      status: "verified",
      setVerifiedAt: true,
    });
    expect(transitionFundDeposit("pending", "rejected")).toEqual({
      status: "rejected",
      setVerifiedAt: false,
    });
    expect(() => transitionFundDeposit("verified", "rejected")).toThrow(
      /pending/,
    );
  });

  it("deletes only pending deposits", () => {
    expect(() => assertFundDepositDeletable("pending")).not.toThrow();
    expect(() => assertFundDepositDeletable("verified")).toThrow(/pending/);
    expect(() => assertFundDepositDeletable("rejected")).toThrow(/pending/);
  });
});

describe("policy versions", () => {
  it("stores the server policy version instead of a client string", () => {
    const stored = serverPolicyAcceptance(50);
    expect(stored.tosVersion).toBe("1.2");
    expect(stored.privacyPolicyVersion).toBe("1.2");
    expect(stored.tosVersion).not.toBe("client-supplied");
  });
});

describe("constitution publication", () => {
  it("archives every other published constitution", () => {
    expect(
      constitutionsToArchive(
        [{ _id: "a" }, { _id: "b" }, { _id: "c" }],
        "b",
      ).map((row) => row._id),
    ).toEqual(["a", "c"]);
  });
});
