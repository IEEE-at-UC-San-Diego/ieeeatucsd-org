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

describe("VcoDeadlines programming-app dates", () => {
	it("uses E-35 when that day is a Monday", () => {
		const eventDate = d(2026, 12, 14);
		expect(VcoDeadlines.programmingAppDeadline(eventDate)).toEqual(
			d(2026, 11, 9),
		);
		expect(VcoDeadlines.dayOfWeek(d(2026, 11, 9))).toBe(1);
	});

	it("uses the Monday on or before E-35", () => {
		const eventDate = d(2026, 11, 18);
		const progApp = VcoDeadlines.programmingAppDeadline(eventDate);
		expect(progApp).toEqual(d(2026, 10, 12));
		expect(VcoDeadlines.dayOfWeek(progApp)).toBe(1);
		expect(
			VcoDeadlines.compare(progApp, VcoDeadlines.addDays(eventDate, -35)),
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

describe("VcoDeadlines event display formatting", () => {
	it("formats date and time in America/Los_Angeles, not UTC", () => {
		// 2026-11-19T02:00:00.000Z is 6:00 PM PST on Nov 18.
		const lateWorkshop = Date.parse("2026-11-19T02:00:00.000Z");
		expect(VcoDeadlines.formatEventDate(lateWorkshop)).toBe("Nov 18, 2026");
		expect(VcoDeadlines.formatEventTime(lateWorkshop)).toBe("6:00 PM");

		// UTC midnight would render as 12:00 AM in a UTC browser.
		const lastMinuteTalk = Date.parse("2026-11-19T00:00:00.000Z");
		expect(VcoDeadlines.formatEventDate(lastMinuteTalk)).toBe("Nov 18, 2026");
		expect(VcoDeadlines.formatEventTime(lastMinuteTalk)).toBe("4:00 PM");
	});

	it("renders an evening Pacific event on the same calendar date in both tabs", () => {
		// Events List used date-fns local/UTC formatting and showed Nov 19 / Dec 22.
		// VCO Pipeline already used these America/Los_Angeles helpers (Nov 18 / Dec 21).
		const lateWorkshop = Date.parse("2026-11-19T02:00:00.000Z");
		const industryNight = Date.parse("2026-12-22T02:00:00.000Z");

		const utcDate = (ms: number) =>
			new Intl.DateTimeFormat("en-US", {
				timeZone: "UTC",
				month: "short",
				day: "numeric",
				year: "numeric",
			}).format(new Date(ms));

		expect(utcDate(lateWorkshop)).toBe("Nov 19, 2026");
		expect(utcDate(industryNight)).toBe("Dec 22, 2026");

		const listLateWorkshop = VcoDeadlines.formatEventDate(lateWorkshop);
		const pipelineLateWorkshop = VcoDeadlines.formatEventDate(lateWorkshop);
		const listIndustryNight = VcoDeadlines.formatEventDate(industryNight);
		const pipelineIndustryNight = VcoDeadlines.formatEventDate(industryNight);

		expect(listLateWorkshop).toBe("Nov 18, 2026");
		expect(pipelineLateWorkshop).toBe(listLateWorkshop);
		expect(listIndustryNight).toBe("Dec 21, 2026");
		expect(pipelineIndustryNight).toBe(listIndustryNight);
		const listLateWorkshopTime = VcoDeadlines.formatEventTime(lateWorkshop);
		const pipelineLateWorkshopTime = VcoDeadlines.formatEventTime(lateWorkshop);
		expect(listLateWorkshopTime).toBe("6:00 PM");
		expect(pipelineLateWorkshopTime).toBe(listLateWorkshopTime);
		expect(VcoDeadlines.formatEventTime(industryNight)).toBe("6:00 PM");
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
		expect(status.overdueFlags).toEqual([]);
		expect(status.phases.map((phase) => phase.phase)).toEqual([
			"prog_app",
			"tres_start",
			"invoices_tres_finish",
		]);
		expect(status.nextDeadline?.phase).toBe("prog_app");
		expect(status.nextDeadline?.overdue).toBe(false);
		expect(status.nextDeadline?.isoDate).toBe("2026-11-16");
	});

	it("marks an overdue prog-app phase red and uses it as the next deadline", () => {
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
		expect(status.nextDeadline?.phase).toBe("prog_app");
		expect(status.nextDeadline?.overdue).toBe(true);
		expect(status.nextDeadline?.isoDate).toBe("2026-10-12");
		expect(
			status.phases.find((phase) => phase.phase === "prog_app")?.overdue,
		).toBe(true);
		expect(status.flags).toContain("overdue");
	});

	it("shows missing venue and headcount before the prog-app deadline without marking them overdue", () => {
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
		expect(status.nextDeadline?.phase).toBe("prog_app");
		expect(status.nextDeadline?.overdue).toBe(false);
		expect(status.nextDeadline?.isoDate).toBe("2026-11-09");
		expect(status.flags).toContain("missing_venue");
		expect(status.flags).toContain("missing_headcount");
		expect(status.overdueFlags).not.toContain("missing_venue");
		expect(status.overdueFlags).not.toContain("missing_headcount");
	});

	it("marks missing venue and headcount overdue after the prog-app deadline", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Social Mixer",
				startDate: pacificAfternoon(2026, 11, 18),
				createdAt: pacificAfternoon(2026, 9, 1),
				location: "TBD",
				expectedAttendance: 0,
				needsAsFunding: true,
			},
			{ nowMs: now },
		);
		expect(status.nextDeadline?.phase).toBe("prog_app");
		expect(status.nextDeadline?.overdue).toBe(true);
		expect(status.flags).toContain("missing_venue");
		expect(status.flags).toContain("missing_headcount");
		expect(status.overdueFlags).toContain("missing_venue");
		expect(status.overdueFlags).toContain("missing_headcount");
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
		expect(status.phases).toEqual([]);
		expect(status.nextDeadline).toBeNull();
		expect(status.lateCreated).toBe(false);
		expect(status.flags).not.toContain("missing_invoice");
		expect(status.flags).not.toContain("late");
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

	it("still flags missing_invoice when the only vendor is a display placeholder", () => {
		const status = VcoDeadlines.compute(
			{
				eventName: "Invoice Due Social",
				startDate: pacificAfternoon(2026, 11, 4),
				createdAt: pacificAfternoon(2026, 8, 1),
				location: "Sun God Lawn",
				expectedAttendance: 50,
				needsAsFunding: true,
				invoices: [{ vendor: "Unknown", total: 0 }],
			},
			{ nowMs: now },
		);
		expect(VcoDeadlines.hasInvoice([{ vendor: "Unknown", total: 0 }])).toBe(
			false,
		);
		expect(status.invoiceIn).toBe(false);
		expect(status.flags).toContain("missing_invoice");
	});

	it("treats an attached file or a positive total as invoice evidence", () => {
		expect(
			VcoDeadlines.hasInvoice([{ vendor: "Unknown", invoiceFile: "file_1" }]),
		).toBe(true);
		expect(VcoDeadlines.hasInvoice([{ vendor: "Unknown", total: 12 }])).toBe(
			true,
		);
		const status = VcoDeadlines.compute(
			{
				eventName: "Invoice Due Social",
				startDate: pacificAfternoon(2026, 11, 4),
				createdAt: pacificAfternoon(2026, 8, 1),
				location: "Sun God Lawn",
				expectedAttendance: 50,
				needsAsFunding: true,
				invoices: [{ vendor: "Unknown", invoiceFile: "file_1" }],
			},
			{ nowMs: now },
		);
		expect(status.invoiceIn).toBe(true);
		expect(status.flags).not.toContain("missing_invoice");
	});
});

describe("VcoDeadlines.sortByNextDeadline", () => {
	const now = pacificAfternoon(2026, 10, 27);

	function row(
		eventName: string,
		input: Parameters<typeof VcoDeadlines.compute>[0],
	) {
		return {
			eventName,
			status: VcoDeadlines.compute(input, { nowMs: now }),
		};
	}

	it("orders funded events by the next remaining phase, then undated last", () => {
		const overdueProgApp = row("Late Workshop", {
			eventName: "Late Workshop",
			startDate: pacificAfternoon(2026, 11, 18),
			createdAt: pacificAfternoon(2026, 9, 1),
			location: "CSE 1202",
			expectedAttendance: 40,
			needsAsFunding: true,
		});
		const upcomingProgApp = row("Industry Night", {
			eventName: "Industry Night",
			startDate: pacificAfternoon(2026, 12, 21),
			createdAt: pacificAfternoon(2026, 9, 1),
			location: "Qualcomm Room",
			expectedAttendance: 80,
			needsAsFunding: true,
		});
		const laterProgApp = row("Winter Banquet", {
			eventName: "Winter Banquet",
			startDate: pacificAfternoon(2026, 12, 28),
			createdAt: pacificAfternoon(2026, 9, 1),
			location: "Faculty Club",
			expectedAttendance: 60,
			needsAsFunding: true,
		});
		const needsDate = row("Undated Mixer", {
			eventName: "Undated Mixer",
			dateTbd: true,
			startDate: pacificAfternoon(2026, 12, 14),
			createdAt: pacificAfternoon(2026, 10, 1),
			location: "TBD",
		});

		expect(overdueProgApp.status.nextDeadline?.phase).toBe("prog_app");
		expect(overdueProgApp.status.nextDeadline?.isoDate).toBe("2026-10-12");
		expect(upcomingProgApp.status.nextDeadline?.phase).toBe("prog_app");
		expect(upcomingProgApp.status.nextDeadline?.isoDate).toBe("2026-11-16");
		expect(laterProgApp.status.nextDeadline?.phase).toBe("prog_app");
		expect(laterProgApp.status.nextDeadline?.isoDate).toBe("2026-11-23");
		expect(needsDate.status.nextDeadline).toBeNull();

		const sorted = VcoDeadlines.sortByNextDeadline([
			laterProgApp,
			needsDate,
			upcomingProgApp,
			overdueProgApp,
		]);
		expect(sorted.map((item) => item.eventName)).toEqual([
			"Late Workshop",
			"Industry Night",
			"Winter Banquet",
			"Undated Mixer",
		]);
	});
});

describe("VcoDeadlines.currentQuarterRange", () => {
	const academicYearSettings = {
		fallWeek0Start: "2026-09-21",
		winterWeek1Start: "2026-01-05",
		springWeek1Start: "2026-03-30",
	};

	it("keeps October inside fall when winter is stored as January of the same calendar year", () => {
		const october = d(2026, 10, 15);
		expect(
			VcoDeadlines.currentQuarterRange(october, academicYearSettings),
		).toEqual({
			start: d(2026, 9, 21),
			end: d(2027, 1, 4),
		});
		expect(
			VcoDeadlines.isInCurrentQuarter(october, october, academicYearSettings),
		).toBe(true);
	});

	it("rolls winter and spring into the following year after fall", () => {
		expect(
			VcoDeadlines.currentQuarterRange(d(2027, 1, 10), academicYearSettings),
		).toEqual({
			start: d(2027, 1, 5),
			end: d(2027, 3, 29),
		});
		expect(
			VcoDeadlines.currentQuarterRange(d(2026, 2, 1), academicYearSettings),
		).toEqual({
			start: d(2026, 1, 5),
			end: d(2026, 3, 29),
		});
	});
});
