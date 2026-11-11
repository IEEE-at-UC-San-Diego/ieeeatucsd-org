import { describe, expect, it } from "vitest";
import { EventRequestMapping } from "../EventRequestMapping";
import type { EventFormData } from "../types";
import {
	canProceedFromStep,
	canSaveEventRequest,
	getBlockedMessage,
} from "./eventRequestWizardSteps";

const START = Date.UTC(2026, 10, 20, 18);

const complete: EventFormData = {
	...EventRequestMapping.defaultFormData,
	eventName: "Hack Night",
	eventDescription: "Build things",
	eventType: "technical",
	location: "EBU1",
	startDate: START,
	endDate: START + 3600000,
	eventCode: "HACK",
};

const input = (
	formData: Partial<EventFormData>,
	disclaimerAccepted = true,
) => ({
	formData: { ...complete, ...formData },
	disclaimerAccepted,
});

describe("canProceedFromStep", () => {
	it("requires the disclaimer on step 1", () => {
		expect(canProceedFromStep(1, input({}, false))).toBe(false);
		expect(canProceedFromStep(1, input({}, true))).toBe(true);
	});

	it("requires name, description, and type on step 2", () => {
		expect(canProceedFromStep(2, input({}))).toBe(true);
		expect(canProceedFromStep(2, input({ eventName: "  " }))).toBe(false);
		expect(canProceedFromStep(2, input({ eventDescription: "" }))).toBe(false);
		expect(canProceedFromStep(2, input({ eventType: "" }))).toBe(false);
	});

	it("requires location, a valid range, and a code on step 3", () => {
		expect(canProceedFromStep(3, input({}))).toBe(true);
		expect(canProceedFromStep(3, input({ location: "" }))).toBe(false);
		expect(canProceedFromStep(3, input({ eventCode: " " }))).toBe(false);
		expect(canProceedFromStep(3, input({ endDate: START }))).toBe(false);
	});

	it("does not gate later steps", () => {
		const empty = input({ eventName: "", location: "" }, false);

		expect(canProceedFromStep(4, empty)).toBe(true);
		expect(canProceedFromStep(5, empty)).toBe(true);
	});
});

describe("canSaveEventRequest", () => {
	it("needs basic info and logistics but not an event code", () => {
		expect(canSaveEventRequest({ ...complete, eventCode: "" })).toBe(true);
		expect(canSaveEventRequest({ ...complete, location: "" })).toBe(false);
		expect(canSaveEventRequest({ ...complete, endDate: START - 1 })).toBe(
			false,
		);
	});
});

describe("getBlockedMessage", () => {
	it("explains the step guard first", () => {
		expect(getBlockedMessage(1, input({}, false), true)).toBe(
			"Accept the requirements to continue.",
		);
		expect(getBlockedMessage(2, input({ eventName: "" }), true)).toBe(
			"Add the event name, description, and type to continue.",
		);
		expect(getBlockedMessage(3, input({ eventCode: "" }), false)).toBe(
			"Add a location, valid time range, and event code to continue.",
		);
	});

	it("explains why save is blocked only when saving is offered", () => {
		const missingLocation = input({ location: "" });

		expect(getBlockedMessage(4, missingLocation, true)).toBe(
			"Add the event name, description, type, location, and valid time range to save.",
		);
		expect(getBlockedMessage(4, missingLocation, false)).toBeNull();
	});

	it("returns null when nothing is blocked", () => {
		expect(getBlockedMessage(6, input({}), true)).toBeNull();
	});
});
