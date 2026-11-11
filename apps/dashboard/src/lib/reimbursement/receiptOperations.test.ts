import { describe, expect, it } from "vitest";
import {
	getReceiptOperation,
	isCurrentReceiptRequest,
	type ReceiptOperationAction,
	type ReceiptOperations,
	receiptOperationsReducer,
} from "./receiptOperations";

function run(
	actions: ReceiptOperationAction[],
	initial: ReceiptOperations = {},
): ReceiptOperations {
	return actions.reduce(receiptOperationsReducer, initial);
}

describe("receiptOperationsReducer", () => {
	it("treats unknown receipts as idle", () => {
		expect(getReceiptOperation({}, "r1")).toEqual({ status: "idle" });
	});

	it("moves an upload into parsing when auto-parse is on, then to parsed", () => {
		const ops = run([
			{ type: "uploadStarted", receiptId: "r1", token: 1 },
			{ type: "uploadSucceeded", receiptId: "r1", token: 1, autoParse: true },
		]);
		expect(getReceiptOperation(ops, "r1")).toEqual({
			status: "parsing",
			token: 1,
		});

		const parsed = receiptOperationsReducer(ops, {
			type: "parseSucceeded",
			receiptId: "r1",
			token: 1,
			message: "ok",
		});
		expect(getReceiptOperation(parsed, "r1")).toEqual({
			status: "parsed",
			token: 1,
			message: "ok",
		});
	});

	it("returns to idle after an upload when auto-parse is off", () => {
		const ops = run([
			{ type: "uploadStarted", receiptId: "r1", token: 1 },
			{ type: "uploadSucceeded", receiptId: "r1", token: 1, autoParse: false },
		]);
		expect(getReceiptOperation(ops, "r1")).toEqual({ status: "idle" });
	});

	it("records upload and parse failures", () => {
		expect(
			getReceiptOperation(
				run([
					{ type: "uploadStarted", receiptId: "r1", token: 1 },
					{
						type: "uploadFailed",
						receiptId: "r1",
						token: 1,
						message: "Upload failed",
					},
				]),
				"r1",
			),
		).toEqual({ status: "failed", token: 1, message: "Upload failed" });

		expect(
			getReceiptOperation(
				run([
					{ type: "parseStarted", receiptId: "r1", token: 2 },
					{
						type: "parseFailed",
						receiptId: "r1",
						token: 2,
						message: "AI parsing failed",
					},
				]),
				"r1",
			),
		).toEqual({ status: "failed", token: 2, message: "AI parsing failed" });
	});

	it("drops a stale parse result after the file is replaced", () => {
		const ops = run([
			{ type: "uploadStarted", receiptId: "r1", token: 1 },
			{ type: "uploadSucceeded", receiptId: "r1", token: 1, autoParse: true },
			{ type: "uploadStarted", receiptId: "r1", token: 2 },
		]);
		const afterStale = receiptOperationsReducer(ops, {
			type: "parseSucceeded",
			receiptId: "r1",
			token: 1,
			message: "stale",
		});
		expect(afterStale).toBe(ops);
		expect(getReceiptOperation(afterStale, "r1")).toEqual({
			status: "uploading",
			token: 2,
		});
		expect(isCurrentReceiptRequest(afterStale, "r1", 1, "parsing")).toBe(false);
		expect(isCurrentReceiptRequest(afterStale, "r1", 2, "uploading")).toBe(
			true,
		);
	});

	it("drops a stale upload completion after a newer upload starts", () => {
		const ops = run([
			{ type: "uploadStarted", receiptId: "r1", token: 1 },
			{ type: "uploadStarted", receiptId: "r1", token: 2 },
		]);
		expect(
			receiptOperationsReducer(ops, {
				type: "uploadSucceeded",
				receiptId: "r1",
				token: 1,
				autoParse: true,
			}),
		).toBe(ops);
		expect(
			receiptOperationsReducer(ops, {
				type: "uploadFailed",
				receiptId: "r1",
				token: 1,
				message: "stale",
			}),
		).toBe(ops);
	});

	it("ignores completions that don't match the in-flight phase", () => {
		const parsing = run([{ type: "parseStarted", receiptId: "r1", token: 3 }]);
		expect(
			receiptOperationsReducer(parsing, {
				type: "uploadSucceeded",
				receiptId: "r1",
				token: 3,
				autoParse: false,
			}),
		).toBe(parsing);

		const parsed = receiptOperationsReducer(parsing, {
			type: "parseSucceeded",
			receiptId: "r1",
			token: 3,
			message: "ok",
		});
		expect(
			receiptOperationsReducer(parsed, {
				type: "parseFailed",
				receiptId: "r1",
				token: 3,
				message: "late",
			}),
		).toBe(parsed);
	});

	it("clearing a receipt invalidates its in-flight request", () => {
		const cleared = run([
			{ type: "parseStarted", receiptId: "r1", token: 1 },
			{ type: "cleared", receiptId: "r1" },
		]);
		expect(getReceiptOperation(cleared, "r1")).toEqual({ status: "idle" });
		expect(
			receiptOperationsReducer(cleared, {
				type: "parseSucceeded",
				receiptId: "r1",
				token: 1,
				message: "late",
			}),
		).toBe(cleared);
		expect(
			receiptOperationsReducer(cleared, { type: "cleared", receiptId: "r1" }),
		).toBe(cleared);
	});

	it("keeps receipts independent", () => {
		const ops = run([
			{ type: "uploadStarted", receiptId: "r1", token: 1 },
			{ type: "parseStarted", receiptId: "r2", token: 2 },
			{
				type: "parseSucceeded",
				receiptId: "r2",
				token: 2,
				message: "ok",
			},
		]);
		expect(getReceiptOperation(ops, "r1")).toEqual({
			status: "uploading",
			token: 1,
		});
		expect(getReceiptOperation(ops, "r2").status).toBe("parsed");
	});
});
