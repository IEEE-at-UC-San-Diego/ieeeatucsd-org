import { describe, expect, it } from "vitest";
import { emailInboxReducer, initialEmailInboxState } from "./emailInboxState";
import type { EmailInboxState, EmailMessage, InboxCredentials } from "./types";

const credentials: InboxCredentials = {
	email: "ada@ieeeucsd.org",
	password: "Secret123!",
};

function message(id: string): EmailMessage {
	return {
		id,
		subject: `Subject ${id}`,
		from: "Slack <no-reply@slack.com>",
		date: "Nov 8",
		preview: "Your confirmation code",
		isRead: false,
		uid: Number(id),
	};
}

const signedIn: EmailInboxState = {
	status: "signedIn",
	credentials,
	emails: [message("1")],
	refreshing: false,
	refreshError: null,
};

describe("emailInboxReducer", () => {
	it("starts signed out", () => {
		expect(initialEmailInboxState).toEqual({ status: "signedOut" });
	});

	it("signs in with the submitted credentials and fetched emails", () => {
		const signingIn = emailInboxReducer(initialEmailInboxState, {
			type: "signInStarted",
		});
		expect(signingIn).toEqual({ status: "signingIn" });

		expect(
			emailInboxReducer(signingIn, {
				type: "signInSucceeded",
				credentials,
				emails: [message("1")],
			}),
		).toEqual(signedIn);
	});

	it("records a failed sign-in and lets the user retry", () => {
		const signingIn = emailInboxReducer(initialEmailInboxState, {
			type: "signInStarted",
		});
		const failed = emailInboxReducer(signingIn, {
			type: "signInFailed",
			message: "Login failed.",
		});
		expect(failed).toEqual({ status: "failed", message: "Login failed." });
		expect(emailInboxReducer(failed, { type: "signInStarted" })).toEqual({
			status: "signingIn",
		});
	});

	it("shows a validation error before signing in", () => {
		expect(
			emailInboxReducer(initialEmailInboxState, {
				type: "signInFailed",
				message: "Enter your email password to open the inbox.",
			}),
		).toEqual({
			status: "failed",
			message: "Enter your email password to open the inbox.",
		});
	});

	it("ignores sign-in events once signed in", () => {
		expect(emailInboxReducer(signedIn, { type: "signInStarted" })).toBe(
			signedIn,
		);
		expect(
			emailInboxReducer(signedIn, { type: "signInFailed", message: "late" }),
		).toBe(signedIn);
		expect(
			emailInboxReducer(initialEmailInboxState, {
				type: "signInSucceeded",
				credentials,
				emails: [],
			}),
		).toBe(initialEmailInboxState);
	});

	it("replaces the emails after a refresh and keeps the credentials", () => {
		const refreshing = emailInboxReducer(signedIn, { type: "refreshStarted" });
		expect(refreshing).toEqual({ ...signedIn, refreshing: true });

		const refreshed = emailInboxReducer(refreshing, {
			type: "refreshSucceeded",
			emails: [message("2"), message("1")],
		});
		expect(refreshed).toEqual({
			...signedIn,
			emails: [message("2"), message("1")],
		});
		expect(refreshed.status === "signedIn" && refreshed.credentials).toBe(
			credentials,
		);
	});

	it("keeps the current emails when a refresh fails", () => {
		const refreshing = emailInboxReducer(signedIn, { type: "refreshStarted" });
		const failed = emailInboxReducer(refreshing, {
			type: "refreshFailed",
			message: "Failed to refresh.",
		});
		expect(failed).toEqual({ ...signedIn, refreshError: "Failed to refresh." });
	});

	it("clears a previous refresh error when a new refresh starts", () => {
		const withError: EmailInboxState = {
			...signedIn,
			refreshError: "Failed to refresh.",
		};
		expect(emailInboxReducer(withError, { type: "refreshStarted" })).toEqual({
			...signedIn,
			refreshing: true,
		});
	});

	it("ignores refresh events outside an in-flight refresh", () => {
		const refreshing = emailInboxReducer(signedIn, { type: "refreshStarted" });
		expect(emailInboxReducer(refreshing, { type: "refreshStarted" })).toBe(
			refreshing,
		);
		expect(
			emailInboxReducer(signedIn, { type: "refreshSucceeded", emails: [] }),
		).toBe(signedIn);
		expect(
			emailInboxReducer(initialEmailInboxState, { type: "refreshStarted" }),
		).toBe(initialEmailInboxState);
	});
});
