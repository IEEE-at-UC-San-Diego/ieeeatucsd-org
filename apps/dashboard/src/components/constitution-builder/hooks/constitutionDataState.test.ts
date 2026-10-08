import { describe, expect, it, vi } from "vitest";
import {
	isConstitutionDataLoading,
	resolveStableValue,
	retryWithBackoff,
} from "./constitutionDataState";

describe("resolveStableValue", () => {
	it("returns undefined before the first resolution", () => {
		expect(resolveStableValue<{ id: string }>(undefined, undefined)).toEqual({
			value: undefined,
			lastResolved: undefined,
		});
	});

	it("remembers the first resolved value", () => {
		const constitution = { id: "c1" };

		const result = resolveStableValue(constitution, undefined);

		expect(result.value).toBe(constitution);
		expect(result.lastResolved).toBe(constitution);
	});

	it("keeps the last resolved value when a refetch returns undefined", () => {
		const constitution = { id: "c1" };
		const afterFirst = resolveStableValue(constitution, undefined);

		// Simulate an auth session-token rotation: the authed query re-subscribes
		// and briefly reports `undefined` even though we already have data.
		const afterRefetch = resolveStableValue(undefined, afterFirst.lastResolved);

		expect(afterRefetch.value).toBe(constitution);
		expect(afterRefetch.lastResolved).toBe(constitution);
	});

	it("treats null as a resolved value", () => {
		const result = resolveStableValue<{ id: string }>(null, { id: "c1" });

		expect(result.value).toBeNull();
		expect(result.lastResolved).toBeNull();
	});

	it("treats an empty array as a resolved value", () => {
		const result = resolveStableValue<string[]>([], undefined);

		expect(result.value).toEqual([]);
		expect(result.lastResolved).toEqual([]);
	});
});

describe("isConstitutionDataLoading", () => {
	const base = {
		isAuthenticated: true,
		logtoId: "user-1",
		constitution: { id: "c1" },
		sections: [],
		ensuringDefault: false,
		initialized: true,
	};

	it("is loading before the first constitution resolves", () => {
		expect(
			isConstitutionDataLoading({
				...base,
				constitution: undefined,
				sections: undefined,
				initialized: false,
			}),
		).toBe(true);
	});

	it("is loading until sections resolve", () => {
		expect(isConstitutionDataLoading({ ...base, sections: undefined })).toBe(
			true,
		);
	});

	it("is not loading once constitution and sections are resolved", () => {
		expect(isConstitutionDataLoading(base)).toBe(false);
	});

	it("stays loaded while sections are an empty array", () => {
		expect(isConstitutionDataLoading({ ...base, sections: [] })).toBe(false);
	});

	it("keeps loading while the default constitution is being ensured", () => {
		expect(
			isConstitutionDataLoading({
				...base,
				constitution: null,
				sections: undefined,
			}),
		).toBe(true);
	});

	it("does not treat an unauthenticated user as loading", () => {
		expect(
			isConstitutionDataLoading({
				...base,
				isAuthenticated: false,
				constitution: undefined,
				sections: undefined,
				initialized: false,
			}),
		).toBe(false);
	});
});

describe("retryWithBackoff", () => {
	const options = { maxAttempts: 3, baseDelayMs: 10, sleep: async () => {} };

	it("returns the result without retrying on success", async () => {
		const operation = vi.fn().mockResolvedValue("ok");

		await expect(retryWithBackoff(operation, options)).resolves.toBe("ok");
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("retries a transient failure and then succeeds", async () => {
		const operation = vi
			.fn()
			.mockRejectedValueOnce(new Error("transient"))
			.mockResolvedValue("ok");

		await expect(retryWithBackoff(operation, options)).resolves.toBe("ok");
		expect(operation).toHaveBeenCalledTimes(2);
	});

	it("stops after the max attempts and rethrows the last error", async () => {
		const operation = vi.fn().mockRejectedValue(new Error("boom"));

		await expect(retryWithBackoff(operation, options)).rejects.toThrow("boom");
		expect(operation).toHaveBeenCalledTimes(3);
	});

	it("waits between attempts with linear backoff", async () => {
		const sleep = vi.fn(async () => {});
		const operation = vi.fn().mockRejectedValue(new Error("boom"));

		await expect(
			retryWithBackoff(operation, { ...options, sleep }),
		).rejects.toThrow("boom");
		expect(sleep).toHaveBeenNthCalledWith(1, 10);
		expect(sleep).toHaveBeenNthCalledWith(2, 20);
	});
});
