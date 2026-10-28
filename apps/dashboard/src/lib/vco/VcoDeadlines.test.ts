import { describe, expect, it } from "vitest";
import { type CalendarDate, VcoDeadlines } from "./VcoDeadlines";

function d(year: number, month: number, day: number): CalendarDate {
	return { year, month, day };
}

/** 18:00 UTC is always the same calendar date in America/Los_Angeles. */
function pacificAfternoon(year: number, month: number, day: number): number {
	const monthStr = String(month).padStart(2, "0");
	const dayStr = String(day).padStart(2, "0");
	return Date.parse(`${year}-${monthStr}-${dayStr}T18:00:00.000Z`);
}

describe("VcoDeadlines.mondayOnOrBefore", () => {
	it("returns the same day when the date is already Monday", () => {
		expect(VcoDeadlines.mondayOnOrBefore(d(2026, 10, 12))).toEqual(
			d(2026, 10, 12),
		);
	});

	it("returns the preceding Monday for a mid-week date", () => {
		expect(VcoDeadlines.mondayOnOrBefore(d(2026, 10, 14))).toEqual(
			d(2026, 10, 12),
		);
	});

	it("returns the preceding Monday for Saturday", () => {
		expect(VcoDeadlines.mondayOnOrBefore(d(2026, 10, 17))).toEqual(
			d(2026, 10, 12),
		);
	});

	it("returns the preceding Monday for Sunday", () => {
		expect(VcoDeadlines.mondayOnOrBefore(d(2026, 10, 18))).toEqual(
			d(2026, 10, 12),
		);
	});
});

describe("VcoDeadlines.moveWeekendToFriday", () => {
	it("moves Saturday to the Friday before", () => {
		expect(VcoDeadlines.moveWeekendToFriday(d(2026, 10, 31))).toEqual(
			d(2026, 10, 30),
		);
	});

	it("moves Sunday to the Friday before", () => {
		expect(VcoDeadlines.moveWeekendToFriday(d(2026, 11, 1))).toEqual(
			d(2026, 10, 30),
		);
	});

	it("leaves a weekday unchanged", () => {
		expect(VcoDeadlines.moveWeekendToFriday(d(2026, 10, 28))).toEqual(
			d(2026, 10, 28),
		);
	});
});

describe("VcoDeadlines programming-app and officer-plan dates", () => {
	it("uses E-35 when that day is a Monday", () => {
		const eventDate = d(2026, 12, 14);
		expect(VcoDeadlines.programmingAppDeadline(eventDate)).toEqual(
			d(2026, 11, 9),
		);
		expect(VcoDeadlines.officerPlanDeadline(eventDate)).toEqual(
			d(2026, 10, 26),
		);
	});

	it("uses the Monday on or before E-35 and locks the officer plan 14 days earlier", () => {
		const eventDate = d(2026, 11, 18);
		const progApp = VcoDeadlines.programmingAppDeadline(eventDate);
		const officerPlan = VcoDeadlines.officerPlanDeadline(eventDate);
		expect(progApp).toEqual(d(2026, 10, 12));
		expect(officerPlan).toEqual(d(2026, 9, 28));
		expect(VcoDeadlines.dayOfWeek(progApp)).toBe(1);
		expect(VcoDeadlines.dayOfWeek(officerPlan)).toBe(1);
		expect(
			VcoDeadlines.compare(officerPlan, VcoDeadlines.addDays(eventDate, -49)),
		).toBeLessThanOrEqual(0);
	});
});

describe("VcoDeadlines T-Res dates", () => {
	it("keeps weekday E-21 and E-14", () => {
		const eventDate = d(2026, 11, 18);
		expect(VcoDeadlines.tresStartDeadline(eventDate)).toEqual(d(2026, 10, 28));
		expect(VcoDeadlines.tresFinishDeadline(eventDate)).toEqual(d(2026, 11, 4));
	});

	it("moves weekend T-Res deadlines to the Friday before", () => {
		const eventDate = d(2026, 11, 21);
		expect(VcoDeadlines.tresStartDeadline(eventDate)).toEqual(d(2026, 10, 30));
		expect(VcoDeadlines.tresFinishDeadline(eventDate)).toEqual(d(2026, 11, 6));
	});
});

describe("VcoDeadlines finals week", () => {
	it("treats Fall 2026 Dec 7-13 as finals by default", () => {
		expect(VcoDeadlines.isInFinalsWeek(d(2026, 12, 7))).toBe(true);
		expect(VcoDeadlines.isInFinalsWeek(d(2026, 12, 13))).toBe(true);
		expect(VcoDeadlines.isInFinalsWeek(d(2026, 12, 6))).toBe(false);
		expect(VcoDeadlines.isInFinalsWeek(d(2026, 12, 14))).toBe(false);
	});

	it("moves a deadline that lands in finals week to the Friday before", () => {
		expect(VcoDeadlines.moveOutOfFinalsWeek(d(2026, 12, 9))).toEqual(
			d(2026, 12, 4),
		);
	});

	it("moves T-Res FINISH out of Fall 2026 finals week", () => {
		expect(VcoDeadlines.tresFinishDeadline(d(2026, 12, 21))).toEqual(
			d(2026, 12, 4),
		);
	});

	it("derives finals week from a Fall week-0 start", () => {
		const weeks = VcoDeadlines.finalsWeeksFromQuarterStarts({
			fallWeek0Start: "2026-09-21",
		});
		expect(weeks).toEqual([{ start: d(2026, 12, 7), end: d(2026, 12, 13) }]);
	});

	it("accepts an explicit finals-week override", () => {
		const custom = [{ start: d(2027, 3, 15), end: d(2027, 3, 21) }];
		expect(VcoDeadlines.isInFinalsWeek(d(2027, 3, 16), custom)).toBe(true);
		expect(VcoDeadlines.moveOutOfFinalsWeek(d(2027, 3, 16), custom)).toEqual(
			d(2027, 3, 12),
		);
	});

	it("moves a Tuesday-start finals range to the Friday before, not the Monday", () => {
		const tuesdayFinals = [{ start: d(2026, 12, 8), end: d(2026, 12, 14) }];
		expect(VcoDeadlines.dayOfWeek(d(2026, 12, 8))).toBe(2);
		expect(
			VcoDeadlines.moveOutOfFinalsWeek(d(2026, 12, 9), tuesdayFinals),
		).toEqual(d(2026, 12, 4));
		expect(VcoDeadlines.fridayOnOrBefore(d(2026, 12, 7))).toEqual(
			d(2026, 12, 4),
		);
	});
});

describe("VcoDeadlines.isLateCreated", () => {
	const progApp = d(2026, 10, 12);

	it("is late when the event is created after the prog-app deadline", () => {
		expect(
			VcoDeadlines.isLateCreated(pacificAfternoon(2026, 10, 13), progApp),
		).toBe(true);
	});

	it("is not late when created on the prog-app deadline day", () => {
		expect(
			VcoDeadlines.isLateCreated(pacificAfternoon(2026, 10, 12), progApp),
		).toBe(false);
	});

	it("is not late when created before the prog-app deadline", () => {
		expect(
			VcoDeadlines.isLateCreated(pacificAfternoon(2026, 10, 5), progApp),
		).toBe(false);
	});
});

describe("VcoDeadlines.compute", () => {
	const now = pacificAfternoon(2026, 10, 27);

	it("flags a fully on-track funded event without red flags", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Industry Night",
				startDate: pacificAfternoon(2026, 12, 21),
				createdAt: pacificAfternoon(2026, 9, 1),
				location: "Qualcomm Room",
				expectedAttendance: 80,
				needsAsFunding: true,
				invoices: [{ vendor: "Costco", total: 400 }],
			},
			{ nowMs: now },
		);
		expect(status.needsDate).toBe(false);
		expect(status.funded).toBe(true);
		expect(status.lateCreated).toBe(false);
		expect(status.flags).toEqual([]);
		expect(status.nextDeadline?.phase).toBe("officer_plan");
		expect(status.nextDeadline?.overdue).toBe(false);
	});

	it("marks an overdue prog-app phase red", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Late Workshop",
				startDate: pacificAfternoon(2026, 11, 18),
				createdAt: pacificAfternoon(2026, 9, 1),
				location: "CSE 1202",
				expectedAttendance: 40,
				needsAsFunding: true,
			},
			{ nowMs: now },
		);
		expect(status.nextDeadline?.phase).toBe("officer_plan");
		expect(status.nextDeadline?.overdue).toBe(true);
		expect(
			status.phases.find((phase) => phase.phase === "prog_app")?.overdue,
		).toBe(true);
	});

	it("flags missing venue and missing headcount", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Social Mixer",
				startDate: pacificAfternoon(2026, 12, 14),
				createdAt: pacificAfternoon(2026, 9, 1),
				location: "TBD",
				expectedAttendance: 0,
				needsAsFunding: true,
			},
			{ nowMs: now },
		);
		expect(status.flags).toContain("missing_venue");
		expect(status.flags).toContain("missing_headcount");
	});

	it("flags late-created events", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Last-minute Talk",
				startDate: pacificAfternoon(2026, 11, 18),
				createdAt: pacificAfternoon(2026, 10, 20),
				location: "Center Hall",
				expectedAttendance: 30,
				needsAsFunding: true,
			},
			{ nowMs: now },
		);
		expect(status.lateCreated).toBe(true);
		expect(status.flags).toContain("late");
	});

	it("warns when food cost per head is over $10", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Fancy Dinner",
				startDate: pacificAfternoon(2026, 12, 14),
				createdAt: pacificAfternoon(2026, 9, 1),
				location: "Faculty Club",
				expectedAttendance: 20,
				hasFood: true,
				needsAsFunding: true,
				invoices: [{ vendor: "Caterer", total: 260 }],
			},
			{ nowMs: now },
		);
		expect(status.foodCostPerHead).toBe(13);
		expect(status.flags).toContain("food_over_cap");
	});

	it("does not treat a no-food equipment invoice as food cost per head", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Workshop",
				startDate: pacificAfternoon(2026, 12, 21),
				createdAt: pacificAfternoon(2026, 9, 1),
				location: "CSE 1202",
				expectedAttendance: 20,
				hasFood: false,
				needsAsFunding: true,
				invoices: [
					{
						vendor: "Campus AV",
						total: 500,
						items: [{ description: "Projector equipment rental" }],
					},
				],
			},
			{ nowMs: now },
		);
		expect(status.foodCostPerHead).toBeNull();
		expect(status.flags).not.toContain("food_over_cap");
		expect(status.invoiceTotal).toBe(500);
	});

	it("counts only food invoices when an event also has equipment costs", () => {
		expect(
			VcoDeadlines.foodCostPerHead(
				[
					{ vendor: "Caterer", total: 180 },
					{
						vendor: "Campus AV",
						total: 500,
						items: [{ description: "Projector equipment rental" }],
					},
				],
				20,
				{ hasFood: true },
			),
		).toBe(9);
	});

	it("puts date-TBD events in the needs-date bucket", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Undated Mixer",
				dateTbd: true,
				startDate: pacificAfternoon(2026, 12, 14),
				createdAt: pacificAfternoon(2026, 10, 1),
				location: "TBD",
			},
			{ nowMs: now },
		);
		expect(status.needsDate).toBe(true);
		expect(status.nextDeadline).toBeNull();
		expect(status.lateCreated).toBe(false);
	});

	it("skips prog app and T-Res for unfunded events", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Tabling at Library Walk",
				startDate: pacificAfternoon(2026, 12, 14),
				createdAt: pacificAfternoon(2026, 11, 1),
				location: "Library Walk",
				expectedAttendance: 15,
				funded: false,
			},
			{ nowMs: now },
		);
		expect(status.funded).toBe(false);
		expect(status.tresOwner).toBe("president");
		expect(status.phases.map((phase) => phase.phase)).toEqual(["officer_plan"]);
		expect(status.lateCreated).toBe(false);
		expect(status.flags).not.toContain("missing_invoice");
	});

	it("assigns the President as T-Res owner for GBMs", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Week 5 GBM",
				startDate: pacificAfternoon(2026, 12, 14),
				createdAt: pacificAfternoon(2026, 9, 1),
				location: "PC Theater",
				expectedAttendance: 100,
				needsAsFunding: true,
			},
			{ nowMs: now },
		);
		expect(status.tresOwner).toBe("president");
	});

	it("flags a missing invoice once that phase is due or past", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Invoice Due Social",
				startDate: pacificAfternoon(2026, 11, 4),
				createdAt: pacificAfternoon(2026, 8, 1),
				location: "Sun God Lawn",
				expectedAttendance: 50,
				needsAsFunding: true,
			},
			{ nowMs: now },
		);
		expect(status.flags).toContain("missing_invoice");
	});
});
