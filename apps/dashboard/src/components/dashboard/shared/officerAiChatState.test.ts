import { describe, expect, it } from "vitest";
import {
	type ChatRequestAction,
	type ChatRequestPhase,
	chatRequestReducer,
	getActiveAssistantId,
	getStatusLabel,
	IDLE_PHASE,
	isReasoningActive,
	isRequestInFlight,
	type StreamEvent,
} from "./officerAiChatState";

const ASSISTANT_ID = "msg-1";

function run(
	actions: ChatRequestAction[],
	initial: ChatRequestPhase = IDLE_PHASE,
): ChatRequestPhase {
	return actions.reduce(chatRequestReducer, initial);
}

function streamEvent(
	event: StreamEvent,
	assistantId = ASSISTANT_ID,
): ChatRequestAction {
	return { type: "stream_event", assistantId, event };
}

const submit: ChatRequestAction = { type: "submit", assistantId: ASSISTANT_ID };

describe("chatRequestReducer", () => {
	it("enters submitting on submit", () => {
		const phase = run([submit]);

		expect(phase).toEqual({ status: "submitting", assistantId: ASSISTANT_ID });
		expect(getStatusLabel(phase)).toBe("Submitting query…");
		expect(getActiveAssistantId(phase)).toBe(ASSISTANT_ID);
	});

	it("ignores a second submit while a request is in flight", () => {
		const phase = run([submit, { type: "submit", assistantId: "msg-2" }]);

		expect(getActiveAssistantId(phase)).toBe(ASSISTANT_ID);
	});

	it("allows a new submit after the previous request stopped or failed", () => {
		const stopped = run([submit, { type: "stop", assistantId: ASSISTANT_ID }]);
		const failed = run([
			submit,
			{ type: "fail", assistantId: ASSISTANT_ID, message: "boom" },
		]);

		for (const phase of [stopped, failed]) {
			expect(
				getActiveAssistantId(
					chatRequestReducer(phase, { type: "submit", assistantId: "msg-2" }),
				),
			).toBe("msg-2");
		}
	});

	it("uses status messages as the step", () => {
		const phase = run([
			submit,
			streamEvent({ type: "status", message: "Searching events…" }),
		]);

		expect(phase.status).toBe("streaming");
		expect(getStatusLabel(phase)).toBe("Searching events…");
	});

	it("marks reasoning active until a tool call, token, or done arrives", () => {
		const reasoning = run([
			submit,
			streamEvent({ type: "reasoning", content: "hmm" }),
		]);
		expect(getStatusLabel(reasoning)).toBe("AI is thinking…");
		expect(isReasoningActive(reasoning, ASSISTANT_ID)).toBe(true);
		expect(isReasoningActive(reasoning, "other")).toBe(false);

		const endingEvents: StreamEvent[] = [
			{ type: "tool_start", tools: [] },
			{ type: "token", content: "Hi" },
			{ type: "done", reply: "Hi", steps: [], meta: {} },
		];
		for (const event of endingEvents) {
			expect(
				isReasoningActive(
					chatRequestReducer(reasoning, streamEvent(event)),
					ASSISTANT_ID,
				),
			).toBe(false);
		}
	});

	it("keeps reasoning active across status and tool results", () => {
		const phase = run([
			submit,
			streamEvent({ type: "reasoning", content: "hmm" }),
			streamEvent({ type: "status", message: "Looking up budgets…" }),
			streamEvent({
				type: "tool_result",
				id: "t1",
				name: "get_budget",
				summary: "ok",
				durationMs: 5,
			}),
		]);

		expect(isReasoningActive(phase, ASSISTANT_ID)).toBe(true);
		expect(getStatusLabel(phase)).toBe("Looking up budgets…");
	});

	it("leaves the submitting step alone for tool events before any status", () => {
		const phase = run([submit, streamEvent({ type: "tool_start", tools: [] })]);

		expect(getStatusLabel(phase)).toBe("Submitting query…");
	});

	it("only switches to the streaming step on the first token", () => {
		const firstToken = run([
			submit,
			streamEvent({ type: "token", content: "A" }),
		]);
		expect(getStatusLabel(firstToken)).toBe("Streaming response…");

		const laterStatus = run(
			[
				streamEvent({ type: "status", message: "Checking sources…" }),
				streamEvent({ type: "token", content: "B" }),
			],
			firstToken,
		);
		expect(getStatusLabel(laterStatus)).toBe("Checking sources…");
	});

	it("shows Ready after done until the request completes", () => {
		const done = run([
			submit,
			streamEvent({ type: "token", content: "A" }),
			streamEvent({ type: "done", reply: "A", steps: [], meta: {} }),
		]);
		expect(isRequestInFlight(done)).toBe(true);
		expect(getStatusLabel(done)).toBe("Ready");

		const completed = chatRequestReducer(done, {
			type: "complete",
			assistantId: ASSISTANT_ID,
		});
		expect(completed).toEqual(IDLE_PHASE);
	});

	it("ends in stopped or failed and reports Ready", () => {
		const stopped = run([
			submit,
			streamEvent({ type: "reasoning", content: "hmm" }),
			{ type: "stop", assistantId: ASSISTANT_ID },
		]);
		expect(stopped).toEqual({ status: "stopped" });
		expect(isRequestInFlight(stopped)).toBe(false);
		expect(getStatusLabel(stopped)).toBe("Ready");

		const failed = run([
			submit,
			{ type: "fail", assistantId: ASSISTANT_ID, message: "Query failed" },
		]);
		expect(failed).toEqual({ status: "failed", message: "Query failed" });
		expect(getStatusLabel(failed)).toBe("Ready");
	});

	it("keeps the terminal phase when the request settles after a stop or failure", () => {
		const stopped = run([
			submit,
			{ type: "stop", assistantId: ASSISTANT_ID },
			{ type: "stop", assistantId: ASSISTANT_ID },
			{ type: "complete", assistantId: ASSISTANT_ID },
		]);
		expect(stopped).toEqual({ status: "stopped" });

		const failed = run([
			submit,
			{ type: "fail", assistantId: ASSISTANT_ID, message: "boom" },
			{ type: "complete", assistantId: ASSISTANT_ID },
		]);
		expect(failed).toEqual({ status: "failed", message: "boom" });
	});

	it("ignores actions from a previous request", () => {
		const current = run([
			submit,
			{ type: "stop", assistantId: ASSISTANT_ID },
			{ type: "submit", assistantId: "msg-2" },
		]);

		const staleActions: ChatRequestAction[] = [
			streamEvent({ type: "token", content: "late" }),
			{ type: "fail", assistantId: ASSISTANT_ID, message: "late" },
			{ type: "stop", assistantId: ASSISTANT_ID },
			{ type: "complete", assistantId: ASSISTANT_ID },
		];
		for (const action of staleActions) {
			expect(chatRequestReducer(current, action)).toBe(current);
		}
	});

	it("ignores request actions when nothing is in flight", () => {
		expect(
			chatRequestReducer(IDLE_PHASE, {
				type: "complete",
				assistantId: ASSISTANT_ID,
			}),
		).toBe(IDLE_PHASE);
	});

	it("resets terminal phases to idle but never cancels an in-flight request", () => {
		expect(
			run([
				submit,
				{ type: "stop", assistantId: ASSISTANT_ID },
				{ type: "reset" },
			]),
		).toEqual(IDLE_PHASE);

		const inFlight = run([submit]);
		expect(chatRequestReducer(inFlight, { type: "reset" })).toBe(inFlight);
	});
});
