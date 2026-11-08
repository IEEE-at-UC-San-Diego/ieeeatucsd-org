import { describe, expect, it } from "vitest";
import {
	emailGenerationReducer,
	initialEmailGenerationState,
} from "./emailGenerationState";
import type { EmailGenerationState } from "./types";

const ADDRESS = "ada@ieeeucsd.org";

describe("emailGenerationReducer", () => {
	it("starts idle with no address or notice", () => {
		expect(initialEmailGenerationState).toEqual({
			status: "idle",
			generatedEmail: null,
			notice: null,
		});
	});

	it("shows a validation error while idle", () => {
		expect(
			emailGenerationReducer(initialEmailGenerationState, {
				type: "rejected",
				message: "Enter a password to continue.",
			}),
		).toEqual({
			status: "idle",
			generatedEmail: null,
			notice: { kind: "error", message: "Enter a password to continue." },
		});
	});

	it("replaces a previous success notice with a validation error", () => {
		const succeeded: EmailGenerationState = {
			status: "idle",
			generatedEmail: ADDRESS,
			notice: { kind: "success", message: "done" },
		};
		expect(
			emailGenerationReducer(succeeded, { type: "rejected", message: "bad" }),
		).toEqual({
			status: "idle",
			generatedEmail: ADDRESS,
			notice: { kind: "error", message: "bad" },
		});
	});

	it("clears the notice when a request starts", () => {
		const withError: EmailGenerationState = {
			status: "idle",
			generatedEmail: null,
			notice: { kind: "error", message: "bad" },
		};
		expect(
			emailGenerationReducer(withError, { type: "generateStarted" }),
		).toEqual({ status: "generating", generatedEmail: null });
		expect(emailGenerationReducer(withError, { type: "resetStarted" })).toEqual(
			{ status: "resetting", generatedEmail: null },
		);
	});

	it("remembers the generated address with a success notice", () => {
		const generating = emailGenerationReducer(initialEmailGenerationState, {
			type: "generateStarted",
		});
		expect(
			emailGenerationReducer(generating, {
				type: "generateSucceeded",
				email: ADDRESS,
			}),
		).toEqual({
			status: "idle",
			generatedEmail: ADDRESS,
			notice: {
				kind: "success",
				message: `IEEE email ${ADDRESS} created successfully!`,
			},
		});
	});

	it("keeps the generated address through a password reset", () => {
		const created: EmailGenerationState = {
			status: "idle",
			generatedEmail: ADDRESS,
			notice: null,
		};
		const resetting = emailGenerationReducer(created, {
			type: "resetStarted",
		});
		expect(resetting).toEqual({ status: "resetting", generatedEmail: ADDRESS });
		expect(
			emailGenerationReducer(resetting, {
				type: "resetSucceeded",
				message: "Password updated",
			}),
		).toEqual({
			status: "idle",
			generatedEmail: ADDRESS,
			notice: { kind: "success", message: "Password updated" },
		});
	});

	it("shows no notice when a reset succeeds without a message", () => {
		const resetting = emailGenerationReducer(initialEmailGenerationState, {
			type: "resetStarted",
		});
		expect(
			emailGenerationReducer(resetting, {
				type: "resetSucceeded",
				message: undefined,
			}),
		).toEqual(initialEmailGenerationState);
	});

	it("returns to idle with an error when a request fails", () => {
		for (const start of ["generateStarted", "resetStarted"] as const) {
			const inFlight = emailGenerationReducer(initialEmailGenerationState, {
				type: start,
			});
			expect(
				emailGenerationReducer(inFlight, { type: "failed", message: "boom" }),
			).toEqual({
				status: "idle",
				generatedEmail: null,
				notice: { kind: "error", message: "boom" },
			});
		}
	});

	it("doesn't start a second request while one is in flight", () => {
		const generating = emailGenerationReducer(initialEmailGenerationState, {
			type: "generateStarted",
		});
		expect(emailGenerationReducer(generating, { type: "resetStarted" })).toBe(
			generating,
		);
		expect(
			emailGenerationReducer(generating, { type: "generateStarted" }),
		).toBe(generating);
	});

	it("ignores validation errors and mismatched results while busy", () => {
		const resetting = emailGenerationReducer(initialEmailGenerationState, {
			type: "resetStarted",
		});
		expect(
			emailGenerationReducer(resetting, { type: "rejected", message: "bad" }),
		).toBe(resetting);
		expect(
			emailGenerationReducer(resetting, {
				type: "generateSucceeded",
				email: ADDRESS,
			}),
		).toBe(resetting);
		expect(
			emailGenerationReducer(initialEmailGenerationState, {
				type: "failed",
				message: "stray",
			}),
		).toBe(initialEmailGenerationState);
	});
});
