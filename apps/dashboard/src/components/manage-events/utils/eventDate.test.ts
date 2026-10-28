import { describe, expect, it } from "vitest";
import { VcoDeadlines } from "@/lib/vco/VcoDeadlines";
import { formatManageEventDate } from "./eventDate";

describe("formatManageEventDate", () => {
	it("uses America/Los_Angeles so evening Pacific events stay on that calendar day", () => {
		// 2026-11-19T02:00:00.000Z is 6:00 PM PST on Nov 18.
		const lateWorkshop = Date.parse("2026-11-19T02:00:00.000Z");
		// 2026-12-22T02:00:00.000Z is 6:00 PM PST on Dec 21.
		const industryNight = Date.parse("2026-12-22T02:00:00.000Z");

		expect(formatManageEventDate(lateWorkshop)).toBe("Nov 18, 2026");
		expect(formatManageEventDate(industryNight)).toBe("Dec 21, 2026");
		expect(formatManageEventDate(lateWorkshop)).toBe(
			VcoDeadlines.formatEventDate(lateWorkshop),
		);
		expect(formatManageEventDate(industryNight, { dateTbd: true })).toBe(
			"Needs date",
		);
	});
});
