import type { Invoice, InvoiceItem } from "../types";
import { invoiceScanFailureMessage } from "./invoice-scan-error";

export interface ParsedInvoiceData {
	vendor: string;
	items: InvoiceItem[];
	tax: number;
	tip: number;
	subtotal: number;
	total: number;
}

export type InvoiceUploadFailureStage = "validate" | "upload" | "parse";

export type InvoiceUploadPhase =
	| { status: "idle" }
	| { status: "uploading" }
	| { status: "parsing" }
	| { status: "parsed" }
	| { status: "failed"; stage: InvoiceUploadFailureStage; message: string };

export interface InvoiceUploadState {
	requestId: number;
	phase: InvoiceUploadPhase;
}

export type InvoiceUploadAction =
	| { type: "start"; requestId: number; stage: "upload" | "parse" }
	| { type: "uploaded"; requestId: number }
	| { type: "parsed"; requestId: number }
	| {
			type: "fail";
			requestId: number;
			stage: InvoiceUploadFailureStage;
			message: string;
	  }
	| { type: "dismiss" };

export const initialInvoiceUploadState: InvoiceUploadState = {
	requestId: 0,
	phase: { status: "idle" },
};

export function isInvoiceUploadBusy(phase: InvoiceUploadPhase): boolean {
	switch (phase.status) {
		case "uploading":
		case "parsing":
			return true;
		case "idle":
		case "parsed":
		case "failed":
			return false;
		default: {
			const unreachable: never = phase;
			return unreachable;
		}
	}
}

export function invoiceUploadErrorMessage(phase: InvoiceUploadPhase): string {
	return phase.status === "failed" ? phase.message : "";
}

/**
 * Only the newest request may move the machine. A request begins with `start`
 * (or an immediate `fail`, e.g. validation) carrying a fresh, larger id; every
 * later action for an older id is ignored.
 */
export function invoiceUploadReducer(
	state: InvoiceUploadState,
	action: InvoiceUploadAction,
): InvoiceUploadState {
	switch (action.type) {
		case "start":
			if (action.requestId <= state.requestId) return state;
			return {
				requestId: action.requestId,
				phase: {
					status: action.stage === "upload" ? "uploading" : "parsing",
				},
			};
		case "uploaded":
			if (
				action.requestId !== state.requestId ||
				state.phase.status !== "uploading"
			) {
				return state;
			}
			return { ...state, phase: { status: "parsing" } };
		case "parsed":
			if (
				action.requestId !== state.requestId ||
				state.phase.status !== "parsing"
			) {
				return state;
			}
			return { ...state, phase: { status: "parsed" } };
		case "fail": {
			const beginsRequest = action.requestId > state.requestId;
			const failsActiveRequest =
				action.requestId === state.requestId &&
				isInvoiceUploadBusy(state.phase);
			if (!beginsRequest && !failsActiveRequest) return state;
			return {
				requestId: action.requestId,
				phase: {
					status: "failed",
					stage: action.stage,
					message: action.message,
				},
			};
		}
		case "dismiss":
			if (state.phase.status !== "failed") return state;
			return { ...state, phase: { status: "idle" } };
		default: {
			const unreachable: never = action;
			return unreachable;
		}
	}
}

const MAX_INVOICE_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_INVOICE_EXTENSIONS = [
	".pdf",
	".jpg",
	".jpeg",
	".png",
	".gif",
	".webp",
];

export function validateInvoiceFile(file: {
	name: string;
	size: number;
}): string | undefined {
	if (file.size > MAX_INVOICE_FILE_BYTES) {
		return "File too large. Choose a file under 10\u00a0MB.";
	}
	const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
	if (!ALLOWED_INVOICE_EXTENSIONS.includes(ext)) {
		return "Unsupported file type. Use PDF, JPG, PNG, GIF, or WebP.";
	}
	return undefined;
}

export type InvoiceParseOutcome =
	| { ok: true; data: ParsedInvoiceData }
	| { ok: false; message: string };

interface ParseInvoiceResponseBody {
	success?: boolean;
	error?: unknown;
	data?: Partial<Omit<ParsedInvoiceData, "items">> & {
		items?: Partial<InvoiceItem>[];
	};
}

export function interpretParseInvoiceResponse(
	responseOk: boolean,
	body: ParseInvoiceResponseBody,
): InvoiceParseOutcome {
	if (responseOk && body.success && body.data) {
		const parsed = body.data;
		return {
			ok: true,
			data: {
				vendor: parsed.vendor || "",
				items: (parsed.items || []).map((item) => ({
					description: item.description || "",
					quantity: item.quantity || 1,
					unitPrice: item.unitPrice || 0,
					total: item.total || 0,
				})),
				tax: parsed.tax || 0,
				tip: parsed.tip || 0,
				subtotal: parsed.subtotal || 0,
				total: parsed.total || 0,
			},
		};
	}
	return {
		ok: false,
		message: invoiceScanFailureMessage(
			typeof body.error === "string" ? body.error : undefined,
		),
	};
}

export function invoiceFromUpload(
	id: string,
	storageId: string | undefined,
	parsed: ParsedInvoiceData | undefined,
): Invoice {
	return {
		_id: id,
		vendor: parsed?.vendor ?? "",
		items: parsed?.items ?? [],
		tax: parsed?.tax ?? 0,
		tip: parsed?.tip ?? 0,
		invoiceFile: storageId,
		additionalFiles: [],
		subtotal: parsed?.subtotal ?? 0,
		total: parsed?.total ?? 0,
		amount: parsed?.total ?? 0,
		description: "",
	};
}
