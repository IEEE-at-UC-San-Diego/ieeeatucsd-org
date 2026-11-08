import type { EmailGenerationState } from "./types";

export type EmailGenerationEvent =
	| { type: "rejected"; message: string }
	| { type: "generateStarted" }
	| { type: "generateSucceeded"; email: string }
	| { type: "resetStarted" }
	| { type: "resetSucceeded"; message: string | undefined }
	| { type: "failed"; message: string };

export const initialEmailGenerationState: EmailGenerationState = {
	status: "idle",
	generatedEmail: null,
	notice: null,
};

/**
 * `rejected` is a client-side validation error and only applies while idle;
 * `failed` ends an in-flight request. Events that don't apply are ignored.
 */
export function emailGenerationReducer(
	state: EmailGenerationState,
	event: EmailGenerationEvent,
): EmailGenerationState {
	switch (event.type) {
		case "rejected":
			return state.status === "idle"
				? { ...state, notice: { kind: "error", message: event.message } }
				: state;
		case "generateStarted":
			return state.status === "idle"
				? { status: "generating", generatedEmail: state.generatedEmail }
				: state;
		case "generateSucceeded":
			return state.status === "generating"
				? {
						status: "idle",
						generatedEmail: event.email,
						notice: {
							kind: "success",
							message: `IEEE email ${event.email} created successfully!`,
						},
					}
				: state;
		case "resetStarted":
			return state.status === "idle"
				? { status: "resetting", generatedEmail: state.generatedEmail }
				: state;
		case "resetSucceeded":
			return state.status === "resetting"
				? {
						status: "idle",
						generatedEmail: state.generatedEmail,
						notice: event.message
							? { kind: "success", message: event.message }
							: null,
					}
				: state;
		case "failed":
			return state.status === "generating" || state.status === "resetting"
				? {
						status: "idle",
						generatedEmail: state.generatedEmail,
						notice: { kind: "error", message: event.message },
					}
				: state;
		default: {
			const unreachable: never = event;
			return unreachable;
		}
	}
}
