export type Invitation = {
	name: string;
	email: string;
	role: string;
	position: string;
	offeredPositions?: string[];
	status: "pending" | "accepted" | "declined" | "expired";
	expiresAt: number;
	message?: string;
	acceptanceDeadline?: string;
};

export type InvitationPhase =
	| { kind: "loading" }
	| { kind: "loadFailed"; message: string }
	| { kind: "expired"; invitation: Invitation }
	| { kind: "pending"; invitation: Invitation; actionError?: string }
	| { kind: "accepting"; invitation: Invitation }
	| { kind: "declining"; invitation: Invitation }
	| { kind: "accepted"; invitation: Invitation }
	| { kind: "declined"; invitation: Invitation };

export type InvitationPhaseEvent =
	| { type: "loadStarted" }
	| { type: "loadSucceeded"; invitation: Invitation; now: number }
	| { type: "loadFailed"; message: string }
	| { type: "acceptStarted" }
	| { type: "acceptSucceeded"; invitation: Invitation }
	| { type: "declineStarted" }
	| { type: "declineSucceeded"; invitation: Invitation }
	| { type: "actionFailed"; message: string };

export const initialInvitationPhase: InvitationPhase = { kind: "loading" };

/** A pending invite past its `expiresAt` is expired even before the backend marks it. */
export function phaseForInvitation(
	invitation: Invitation,
	now: number,
): InvitationPhase {
	switch (invitation.status) {
		case "pending":
			return now > invitation.expiresAt
				? { kind: "expired", invitation }
				: { kind: "pending", invitation };
		case "accepted":
			return { kind: "accepted", invitation };
		case "declined":
			return { kind: "declined", invitation };
		case "expired":
			return { kind: "expired", invitation };
		default: {
			const unreachable: never = invitation.status;
			return unreachable;
		}
	}
}

/** Events that don't apply to the current phase are ignored. */
export function invitationPhaseReducer(
	phase: InvitationPhase,
	event: InvitationPhaseEvent,
): InvitationPhase {
	switch (event.type) {
		case "loadStarted":
			return phase.kind === "loading" ? phase : { kind: "loading" };
		case "loadSucceeded":
			return phase.kind === "loading"
				? phaseForInvitation(event.invitation, event.now)
				: phase;
		case "loadFailed":
			return phase.kind === "loading"
				? { kind: "loadFailed", message: event.message }
				: phase;
		case "acceptStarted":
			return phase.kind === "pending"
				? { kind: "accepting", invitation: phase.invitation }
				: phase;
		case "acceptSucceeded":
			return phase.kind === "accepting"
				? { kind: "accepted", invitation: event.invitation }
				: phase;
		case "declineStarted":
			return phase.kind === "pending"
				? { kind: "declining", invitation: phase.invitation }
				: phase;
		case "declineSucceeded":
			return phase.kind === "declining"
				? { kind: "declined", invitation: event.invitation }
				: phase;
		case "actionFailed":
			return phase.kind === "accepting" || phase.kind === "declining"
				? {
						kind: "pending",
						invitation: phase.invitation,
						actionError: event.message,
					}
				: phase;
		default: {
			const unreachable: never = event;
			return unreachable;
		}
	}
}
