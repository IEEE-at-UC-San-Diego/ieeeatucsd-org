export type ChatMeta = {
	status?: string;
	locale?: string;
	timeZone?: string;
	currentDateTime?: string;
	currentUser?: {
		name?: string;
		role?: string;
		position?: string;
		team?: string;
	};
	totalMatches?: number;
	scannedTables?: number;
	toolCallCount?: number;
};

export type ToolStartInfo = {
	id: string;
	name: string;
	args: Record<string, unknown>;
	round?: number;
};

export type StreamEvent =
	| { type: "status"; message: string }
	| { type: "reasoning"; content: string }
	| { type: "token"; content: string }
	| { type: "tool_start"; tools: ToolStartInfo[] }
	| {
			type: "tool_result";
			id: string;
			name: string;
			summary: string;
			durationMs: number;
	  }
	| { type: "done"; reply: string; steps: string[]; meta: ChatMeta }
	| { type: "error"; error: string };

type SubmittingPhase = { status: "submitting"; assistantId: string };

type StreamingPhase = {
	status: "streaming";
	assistantId: string;
	step: string;
	isReasoning: boolean;
	receivedToken: boolean;
};

type InFlightPhase = SubmittingPhase | StreamingPhase;

export type ChatRequestPhase =
	| { status: "idle" }
	| InFlightPhase
	| { status: "stopped" }
	| { status: "failed"; message: string };

export type ChatRequestAction =
	| { type: "submit"; assistantId: string }
	| { type: "stream_event"; assistantId: string; event: StreamEvent }
	| { type: "complete"; assistantId: string }
	| { type: "stop"; assistantId: string }
	| { type: "fail"; assistantId: string; message: string }
	| { type: "reset" };

export const IDLE_PHASE: ChatRequestPhase = { status: "idle" };

const READY_LABEL = "Ready";
const SUBMITTING_LABEL = "Submitting query…";

export function getActiveAssistantId(phase: ChatRequestPhase): string | null {
	return phase.status === "submitting" || phase.status === "streaming"
		? phase.assistantId
		: null;
}

export function isRequestInFlight(phase: ChatRequestPhase): boolean {
	return getActiveAssistantId(phase) !== null;
}

export function isReasoningActive(
	phase: ChatRequestPhase,
	messageId: string,
): boolean {
	return (
		phase.status === "streaming" &&
		phase.assistantId === messageId &&
		phase.isReasoning
	);
}

export function getStatusLabel(phase: ChatRequestPhase): string {
	switch (phase.status) {
		case "submitting":
			return SUBMITTING_LABEL;
		case "streaming":
			return phase.step;
		case "idle":
		case "stopped":
		case "failed":
			return READY_LABEL;
		default: {
			const exhaustive: never = phase;
			return exhaustive;
		}
	}
}

function toStreaming(phase: InFlightPhase): StreamingPhase {
	return phase.status === "streaming"
		? phase
		: {
				status: "streaming",
				assistantId: phase.assistantId,
				step: SUBMITTING_LABEL,
				isReasoning: false,
				receivedToken: false,
			};
}

function applyStreamEvent(
	phase: InFlightPhase,
	event: StreamEvent,
): InFlightPhase {
	switch (event.type) {
		case "status":
			return { ...toStreaming(phase), step: event.message };
		case "reasoning":
			return {
				...toStreaming(phase),
				step: "AI is thinking…",
				isReasoning: true,
			};
		case "tool_start":
			return phase.status === "streaming"
				? { ...phase, isReasoning: false }
				: phase;
		case "token": {
			const streaming = toStreaming(phase);
			return {
				...streaming,
				step: streaming.receivedToken ? streaming.step : "Streaming response…",
				isReasoning: false,
				receivedToken: true,
			};
		}
		case "done":
			return { ...toStreaming(phase), step: READY_LABEL, isReasoning: false };
		case "tool_result":
		case "error":
			return phase;
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
}

export function chatRequestReducer(
	phase: ChatRequestPhase,
	action: ChatRequestAction,
): ChatRequestPhase {
	if (action.type === "submit") {
		return isRequestInFlight(phase)
			? phase
			: { status: "submitting", assistantId: action.assistantId };
	}
	if (action.type === "reset") {
		return isRequestInFlight(phase) ? phase : IDLE_PHASE;
	}

	if (
		(phase.status !== "submitting" && phase.status !== "streaming") ||
		phase.assistantId !== action.assistantId
	) {
		return phase;
	}

	switch (action.type) {
		case "stream_event":
			return applyStreamEvent(phase, action.event);
		case "complete":
			return IDLE_PHASE;
		case "stop":
			return { status: "stopped" };
		case "fail":
			return { status: "failed", message: action.message };
		default: {
			const exhaustive: never = action;
			return exhaustive;
		}
	}
}
