import { describe, expect, it } from "vitest";
import { parsePacificLocal, toPacificLocalInput } from "./timezone";

describe("Pacific local time parsing", () => {
	it("uses the correct seasonal offset", () => {
		expect(new Date(parsePacificLocal("2026-07-13T12:00")).toISOString()).toBe(
			"2026-07-13T19:00:00.000Z",
		);
		expect(new Date(parsePacificLocal("2026-01-13T12:00")).toISOString()).toBe(
			"2026-01-13T20:00:00.000Z",
		);
	});
	it("rejects spring gaps and fall folds", () => {
		expect(() => parsePacificLocal("2026-03-08T02:30")).toThrow(
			/does not exist/,
		);
		expect(() => parsePacificLocal("2026-11-01T01:30")).toThrow(/occurs twice/);
	});
	it("round trips a valid wall time", () => {
		expect(toPacificLocalInput(parsePacificLocal("2026-10-20T18:45"))).toBe(
			"2026-10-20T18:45",
		);
	});
});
