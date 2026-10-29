import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { EventRequestMapping } from "./EventRequestMapping";
import type { EventFormData, EventRequest } from "./types";

function sampleForm(overrides: Partial<EventFormData> = {}): EventFormData {
	return {
		...EventRequestMapping.defaultFormData,
		eventName: "Soldering Night",
		eventDescription: "Learn to solder",
		eventType: "technical",
		location: "CSE 1202",
		eventCode: "SOLDER-26",
		pointsToReward: 15,
		startDate: 1_762_000_000_000,
		endDate: 1_762_003_600_000,
		...overrides,
	};
}

function sampleRequest(overrides: Partial<EventRequest> = {}): EventRequest {
	return {
		...EventRequestMapping.fromDocument({
			_id: "events:solder",
			_creationTime: 1_760_000_000_000,
			eventName: "Soldering Night",
			eventDescription: "Learn to solder",
			eventType: "technical",
			location: "CSE 1202",
			eventCode: "SOLDER-26",
			pointsToReward: 15,
			startDate: 1_762_000_000_000,
			endDate: 1_762_003_600_000,
			published: true,
			expectedAttendance: 40,
		}),
		...overrides,
	};
}

describe("EventRequestMapping.fromDocument", () => {
	it("maps stored points onto the manage-events row", () => {
		const event = EventRequestMapping.fromDocument({
			_id: "events:workshop",
			_creationTime: 1,
			eventName: "Workshop",
			eventDescription: "Desc",
			location: "CSE",
			startDate: 10,
			endDate: 20,
			published: true,
			pointsToReward: 12,
		});

		expect(event.pointsToReward).toBe(12);
		expect(event.status).toBe("published");
	});

	it("defaults missing points to zero so new events are not left undefined", () => {
		const event = EventRequestMapping.fromDocument({
			_id: "events:social",
			_creationTime: 1,
			eventName: "Social",
			eventDescription: "Desc",
			location: "PC",
			startDate: 10,
			endDate: 20,
		});

		expect(event.pointsToReward).toBe(0);
	});
});

describe("EventRequestMapping.toFormData", () => {
	it("loads existing points into the edit form", () => {
		const form = EventRequestMapping.toFormData(sampleRequest());
		expect(form.pointsToReward).toBe(15);
		expect(form.eventCode).toBe("SOLDER-26");
	});

	it("starts a new request at zero points", () => {
		expect(EventRequestMapping.toFormData().pointsToReward).toBe(0);
	});
});

describe("EventRequestMapping create and update args", () => {
	it("sends pointsToReward on create so Convex can persist it", () => {
		const args = EventRequestMapping.toCreateArgs(
			"logto|officer",
			sampleForm(),
		);
		expect(args.pointsToReward).toBe(15);
		expect(args.eventCode).toBe("SOLDER-26");
		expect(args.isDraft).toBe(false);
	});

	it("sends pointsToReward on update so published check-in can award them", () => {
		const args = EventRequestMapping.toUpdateArgs(
			"logto|officer",
			"events:solder",
			sampleForm({ pointsToReward: 8 }),
		);
		expect(args.pointsToReward).toBe(8);
		expect(args.id).toBe("events:solder");
	});

	it("persists an explicit zero instead of dropping the field", () => {
		const createArgs = EventRequestMapping.toCreateArgs(
			"logto|officer",
			sampleForm({ pointsToReward: 0 }),
		);
		const updateArgs = EventRequestMapping.toUpdateArgs(
			"logto|officer",
			"events:solder",
			sampleForm({ pointsToReward: 0 }),
		);

		expect(createArgs.pointsToReward).toBe(0);
		expect(updateArgs.pointsToReward).toBe(0);
		expect("pointsToReward" in createArgs).toBe(true);
		expect("pointsToReward" in updateArgs).toBe(true);
	});

	it("includes points on draft create and draft update", () => {
		const draft = sampleRequest({ status: "draft", pointsToReward: 4 });
		const createArgs = EventRequestMapping.toDraftCreateArgs("logto|officer", {
			eventName: "Draft",
			pointsToReward: 6,
		});
		const updateArgs = EventRequestMapping.toDraftUpdateArgs(
			"logto|officer",
			"events:draft",
			{ eventName: "Draft", pointsToReward: 9 },
			draft,
		);

		expect(createArgs.pointsToReward).toBe(6);
		expect(createArgs.isDraft).toBe(true);
		expect(updateArgs.pointsToReward).toBe(9);
	});

	it("rejects invalid points instead of coercing them", () => {
		expect(() =>
			EventRequestMapping.toCreateArgs(
				"logto|officer",
				sampleForm({ pointsToReward: -3 }),
			),
		).toThrow(ConvexError);
	});
});
