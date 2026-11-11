import type { EmailInboxState, EmailMessage, InboxCredentials } from "./types";

export type EmailInboxEvent =
	| { type: "signInStarted" }
	| {
			type: "signInSucceeded";
			credentials: InboxCredentials;
			emails: EmailMessage[];
	  }
	| { type: "signInFailed"; message: string }
	| { type: "refreshStarted" }
	| { type: "refreshSucceeded"; emails: EmailMessage[] }
	| { type: "refreshFailed"; message: string };

export const initialEmailInboxState: EmailInboxState = { status: "signedOut" };

/** Events that don't apply to the current state are ignored. */
export function emailInboxReducer(
	state: EmailInboxState,
	event: EmailInboxEvent,
): EmailInboxState {
	switch (event.type) {
		case "signInStarted":
			return state.status === "signedOut" || state.status === "failed"
				? { status: "signingIn" }
				: state;
		case "signInSucceeded":
			return state.status === "signingIn"
				? {
						status: "signedIn",
						credentials: event.credentials,
						emails: event.emails,
						refreshing: false,
						refreshError: null,
					}
				: state;
		case "signInFailed":
			return state.status === "signedIn"
				? state
				: { status: "failed", message: event.message };
		case "refreshStarted":
			return state.status === "signedIn" && !state.refreshing
				? { ...state, refreshing: true, refreshError: null }
				: state;
		case "refreshSucceeded":
			return state.status === "signedIn" && state.refreshing
				? { ...state, emails: event.emails, refreshing: false }
				: state;
		case "refreshFailed":
			return state.status === "signedIn" && state.refreshing
				? { ...state, refreshing: false, refreshError: event.message }
				: state;
		default: {
			const unreachable: never = event;
			return unreachable;
		}
	}
}
