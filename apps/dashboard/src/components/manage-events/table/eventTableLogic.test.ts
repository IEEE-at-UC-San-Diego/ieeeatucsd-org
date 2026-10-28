import { describe, expect, it } from "vitest";
import { VcoDeadlines } from "@/lib/vco/VcoDeadlines";
import { computeEventPipelineStatus } from "@/lib/vco/vcoEventStatus";
import type { EventRequest } from "../types";
import {
	matchesListFilters,
	matchesVcoExtraFilters,
	sortEvents,
} from "./eventTableLogic";

function pacificEvening(year: number, month: number, day: number): number {
	return Date.parse(
		`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T02:00:00.000Z`,
	);
}

function makeEvent(overrides: Partial<EventRequest> = {}): EventRequest {
	return {
		_id: overrides._id ?? "evt_1",
		_creationTime: 1,
		createdAt: pacificEvening(2026, 9, 2),
		eventName: "Industry Night",
		eventDescription: "Recruiting mixer",
		eventType: "professional",
		location: "Qualcomm Room",
		startDate: pacificEvening(2026, 12, 22),
		endDate: pacificEvening(2026, 12, 22) + 3600000,
		eventCode: "IN",
		hasFood: true,
		needsFlyers: false,
		needsGraphics: false,
		needsASFunding: true,
		estimatedAttendance: 80,
		status: "approved",
		files: [],
		invoices: [],
		createdBy: "Daniel VCO",
		dateTbd: false,
		finId: "FIN-21",
		funded: true,
		...overrides,
	};
}

const nowMs = Date.parse("2026-10-28T18:00:00.000Z");
const today = VcoDeadlines.toCalendarDate(nowMs);
const settings = {
	fallWeek0Start: "2026-09-21",
	winterWeek1Start: "2027-01-04",
	springWeek1Start: "2027-03-29",
};

describe("matchesListFilters", () => {
	it("matches the shared search, status, and team rules", () => {
		const event = makeEvent();
		expect(
			matchesListFilters(event, { search: "industry", statuses: [] }),
		).toBe(true);
		expect(matchesListFilters(event, { search: "missing", statuses: [] })).toBe(
			false,
		);
		expect(matchesListFilters(event, { search: "", statuses: ["draft"] })).toBe(
			false,
		);
		expect(
			matchesListFilters(event, {
				search: "",
				statuses: [],
				teamPreset: "for_operations",
			}),
		).toBe(false);
	});

	it("searches FIN-ID and officer only in the pipeline path", () => {
		const event = makeEvent({ finId: "FIN-88" });
		expect(matchesListFilters(event, { search: "fin-88", statuses: [] })).toBe(
			false,
		);
		expect(
			matchesListFilters(
				event,
				{ search: "fin-88", statuses: [] },
				{
					includePipelineSearch: true,
				},
			),
		).toBe(true);
	});
});

describe("matchesVcoExtraFilters", () => {
	const dated = computeEventPipelineStatus(makeEvent(), { nowMs });
	const undated = computeEventPipelineStatus(
		makeEvent({
			_id: "evt_undated",
			eventName: "Undated Mixer",
			dateTbd: true,
			location: "TBD",
			estimatedAttendance: 0,
		}),
		{ nowMs },
	);
	const flagged = computeEventPipelineStatus(
		makeEvent({
			_id: "evt_late",
			eventName: "Late Workshop",
			startDate: pacificEvening(2026, 11, 19),
			location: "TBD",
			estimatedAttendance: 0,
		}),
		{ nowMs },
	);

	it("keeps Needs date as a filter instead of a separate section", () => {
		expect(
			matchesVcoExtraFilters(dated, { needsDate: true }, today, settings),
		).toBe(false);
		expect(
			matchesVcoExtraFilters(undated, { needsDate: true }, today, settings),
		).toBe(true);
	});

	it("filters flagged rows and keeps undated events in This quarter", () => {
		expect(
			matchesVcoExtraFilters(dated, { flaggedOnly: true }, today, settings),
		).toBe(false);
		expect(
			matchesVcoExtraFilters(flagged, { flaggedOnly: true }, today, settings),
		).toBe(true);
		expect(
			matchesVcoExtraFilters(undated, { thisQuarter: true }, today, settings),
		).toBe(true);
	});
});

describe("sortEvents", () => {
	it("sorts the pipeline by next deadline and keeps undated last", () => {
		const lateWorkshop = makeEvent({
			_id: "late",
			eventName: "Late Workshop",
			startDate: pacificEvening(2026, 11, 19),
		});
		const industryNight = makeEvent({
			_id: "industry",
			eventName: "Industry Night",
			startDate: pacificEvening(2026, 12, 22),
		});
		const undated = makeEvent({
			_id: "undated",
			eventName: "Undated Mixer",
			dateTbd: true,
		});
		const pipelineById = {
			late: computeEventPipelineStatus(lateWorkshop, { nowMs }),
			industry: computeEventPipelineStatus(industryNight, { nowMs }),
			undated: computeEventPipelineStatus(undated, { nowMs }),
		};

		expect(
			sortEvents(
				[undated, industryNight, lateWorkshop],
				{ field: "nextDeadline", direction: "asc" },
				pipelineById,
			).map((event) => event.eventName),
		).toEqual(["Late Workshop", "Industry Night", "Undated Mixer"]);
	});
});
