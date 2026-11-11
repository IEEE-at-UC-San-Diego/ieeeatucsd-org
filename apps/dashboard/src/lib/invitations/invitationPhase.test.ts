import { describe, expect, it } from "vitest";
import {
	type Invitation,
	type InvitationPhase,
	initialInvitationPhase,
	invitationPhaseReducer,
	phaseForInvitation,
} from "./invitationPhase";

const NOW = Date.UTC(2026, 10, 8);
const DAY = 24 * 60 * 60 * 1000;

function invitation(overrides: Partial<Invitation> = {}): Invitation {
	return {
		name: "Ada Lovelace",
		email: "ada@ucsd.edu",
		role: "General Officer",
		position: "Webmaster",
		status: "pending",
		expiresAt: NOW + DAY,
		...overrides,
	};
}

describe("phaseForInvitation", () => {
	it("shows the offer for a pending invitation that hasn't expired", () => {
		const invite = invitation();
		expect(phaseForInvitation(invite, NOW)).toEqual({
			kind: "pending",
			invitation: invite,
		});
	});

	it("treats a pending invitation past its deadline as expired", () => {
		const invite = invitation({ expiresAt: NOW - 1 });
		expect(phaseForInvitation(invite, NOW)).toEqual({
			kind: "expired",
			invitation: invite,
		});
	});

	it("keeps a pending invitation open at the exact expiry instant", () => {
		const invite = invitation({ expiresAt: NOW });
		expect(phaseForInvitation(invite, NOW).kind).toBe("pending");
	});

	it("maps backend statuses to their phases regardless of the deadline", () => {
		const past = NOW - DAY;
		expect(
			phaseForInvitation(
				invitation({ status: "accepted", expiresAt: past }),
				NOW,
			).kind,
		).toBe("accepted");
		expect(
			phaseForInvitation(
				invitation({ status: "declined", expiresAt: past }),
				NOW,
			).kind,
		).toBe("declined");
		expect(
			phaseForInvitation(invitation({ status: "expired" }), NOW).kind,
		).toBe("expired");
	});
});

describe("invitationPhaseReducer", () => {
	const pending: InvitationPhase = {
		kind: "pending",
		invitation: invitation(),
	};

	it("starts in the loading phase", () => {
		expect(initialInvitationPhase).toEqual({ kind: "loading" });
	});

	it("resolves a load into the invitation's phase", () => {
		const invite = invitation({ status: "expired" });
		expect(
			invitationPhaseReducer(initialInvitationPhase, {
				type: "loadSucceeded",
				invitation: invite,
				now: NOW,
			}),
		).toEqual({ kind: "expired", invitation: invite });
	});

	it("records a load failure", () => {
		expect(
			invitationPhaseReducer(initialInvitationPhase, {
				type: "loadFailed",
				message: "Invitation not found",
			}),
		).toEqual({ kind: "loadFailed", message: "Invitation not found" });
	});

	it("ignores load results once the invitation has left the loading phase", () => {
		expect(
			invitationPhaseReducer(pending, {
				type: "loadFailed",
				message: "late",
			}),
		).toBe(pending);
		expect(
			invitationPhaseReducer(pending, {
				type: "loadSucceeded",
				invitation: invitation({ status: "declined" }),
				now: NOW,
			}),
		).toBe(pending);
	});

	it("returns to loading when a new load starts", () => {
		expect(invitationPhaseReducer(pending, { type: "loadStarted" })).toEqual({
			kind: "loading",
		});
		expect(
			invitationPhaseReducer(initialInvitationPhase, { type: "loadStarted" }),
		).toBe(initialInvitationPhase);
	});

	it("accepts a pending invitation with the server's copy", () => {
		const accepting = invitationPhaseReducer(pending, {
			type: "acceptStarted",
		});
		expect(accepting).toEqual({
			kind: "accepting",
			invitation: pending.invitation,
		});

		const accepted = invitation({ status: "accepted" });
		expect(
			invitationPhaseReducer(accepting, {
				type: "acceptSucceeded",
				invitation: accepted,
			}),
		).toEqual({ kind: "accepted", invitation: accepted });
	});

	it("declines a pending invitation with the server's copy", () => {
		const declining = invitationPhaseReducer(pending, {
			type: "declineStarted",
		});
		expect(declining).toEqual({
			kind: "declining",
			invitation: pending.invitation,
		});

		const declined = invitation({ status: "declined" });
		expect(
			invitationPhaseReducer(declining, {
				type: "declineSucceeded",
				invitation: declined,
			}),
		).toEqual({ kind: "declined", invitation: declined });
	});

	it("returns to the form with an inline error when an action fails", () => {
		for (const start of ["acceptStarted", "declineStarted"] as const) {
			const inFlight = invitationPhaseReducer(pending, { type: start });
			expect(
				invitationPhaseReducer(inFlight, {
					type: "actionFailed",
					message: "Email does not match this invitation",
				}),
			).toEqual({
				kind: "pending",
				invitation: pending.invitation,
				actionError: "Email does not match this invitation",
			});
		}
	});

	it("clears the inline error when the user retries", () => {
		const failed: InvitationPhase = {
			kind: "pending",
			invitation: pending.invitation,
			actionError: "Email does not match this invitation",
		};
		expect(invitationPhaseReducer(failed, { type: "acceptStarted" })).toEqual({
			kind: "accepting",
			invitation: pending.invitation,
		});
	});

	it("only starts an action from the pending phase", () => {
		const expired: InvitationPhase = {
			kind: "expired",
			invitation: invitation({ status: "expired" }),
		};
		expect(invitationPhaseReducer(expired, { type: "acceptStarted" })).toBe(
			expired,
		);
		expect(invitationPhaseReducer(expired, { type: "declineStarted" })).toBe(
			expired,
		);

		const accepting = invitationPhaseReducer(pending, {
			type: "acceptStarted",
		});
		expect(invitationPhaseReducer(accepting, { type: "declineStarted" })).toBe(
			accepting,
		);
	});

	it("ignores results that don't match the in-flight action", () => {
		const accepting = invitationPhaseReducer(pending, {
			type: "acceptStarted",
		});
		expect(
			invitationPhaseReducer(accepting, {
				type: "declineSucceeded",
				invitation: invitation({ status: "declined" }),
			}),
		).toBe(accepting);
		expect(
			invitationPhaseReducer(pending, {
				type: "actionFailed",
				message: "stray",
			}),
		).toBe(pending);
	});
});
