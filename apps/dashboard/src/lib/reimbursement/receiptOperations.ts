/**
 * `token` identifies the request that owns the operation. Every started
 * upload or parse gets a fresh token, so completions carrying an older token
 * are dropped instead of overwriting newer state.
 */
export type ReceiptOperation =
	| { status: "idle" }
	| { status: "uploading"; token: number }
	| { status: "parsing"; token: number }
	| { status: "parsed"; token: number; message: string }
	| { status: "failed"; token: number; message: string };

type TrackedReceiptOperation = Exclude<ReceiptOperation, { status: "idle" }>;

export type ReceiptOperations = Readonly<
	Record<string, TrackedReceiptOperation>
>;

export type ReceiptOperationAction =
	| { type: "uploadStarted"; receiptId: string; token: number }
	| {
			type: "uploadSucceeded";
			receiptId: string;
			token: number;
			autoParse: boolean;
	  }
	| { type: "uploadFailed"; receiptId: string; token: number; message: string }
	| { type: "parseStarted"; receiptId: string; token: number }
	| {
			type: "parseSucceeded";
			receiptId: string;
			token: number;
			message: string;
	  }
	| { type: "parseFailed"; receiptId: string; token: number; message: string }
	| { type: "cleared"; receiptId: string };

const IDLE: ReceiptOperation = { status: "idle" };

export function getReceiptOperation(
	operations: ReceiptOperations,
	receiptId: string,
): ReceiptOperation {
	return operations[receiptId] ?? IDLE;
}

export function isCurrentReceiptRequest(
	operations: ReceiptOperations,
	receiptId: string,
	token: number,
	status: "uploading" | "parsing",
): boolean {
	const operation = operations[receiptId];
	return operation?.status === status && operation.token === token;
}

function withOperation(
	operations: ReceiptOperations,
	receiptId: string,
	operation: TrackedReceiptOperation,
): ReceiptOperations {
	return { ...operations, [receiptId]: operation };
}

function withoutOperation(
	operations: ReceiptOperations,
	receiptId: string,
): ReceiptOperations {
	if (!(receiptId in operations)) return operations;
	const { [receiptId]: _removed, ...rest } = operations;
	return rest;
}

export function receiptOperationsReducer(
	operations: ReceiptOperations,
	action: ReceiptOperationAction,
): ReceiptOperations {
	const { receiptId } = action;
	switch (action.type) {
		case "uploadStarted":
			return withOperation(operations, receiptId, {
				status: "uploading",
				token: action.token,
			});
		case "uploadSucceeded":
			if (
				!isCurrentReceiptRequest(
					operations,
					receiptId,
					action.token,
					"uploading",
				)
			) {
				return operations;
			}
			return action.autoParse
				? withOperation(operations, receiptId, {
						status: "parsing",
						token: action.token,
					})
				: withoutOperation(operations, receiptId);
		case "uploadFailed":
			if (
				!isCurrentReceiptRequest(
					operations,
					receiptId,
					action.token,
					"uploading",
				)
			) {
				return operations;
			}
			return withOperation(operations, receiptId, {
				status: "failed",
				token: action.token,
				message: action.message,
			});
		case "parseStarted":
			return withOperation(operations, receiptId, {
				status: "parsing",
				token: action.token,
			});
		case "parseSucceeded":
		case "parseFailed":
			if (
				!isCurrentReceiptRequest(operations, receiptId, action.token, "parsing")
			) {
				return operations;
			}
			return withOperation(operations, receiptId, {
				status: action.type === "parseSucceeded" ? "parsed" : "failed",
				token: action.token,
				message: action.message,
			});
		case "cleared":
			return withoutOperation(operations, receiptId);
		default: {
			const unreachable: never = action;
			return unreachable;
		}
	}
}
