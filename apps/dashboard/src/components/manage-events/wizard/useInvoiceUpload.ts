import { useLayoutEffect, useReducer, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { contentTypeForUpload } from "@/lib/uploadContentType";
import { invoiceScanFailureMessage } from "./invoice-scan-error";
import {
	type InvoiceParseOutcome,
	initialInvoiceUploadState,
	interpretParseInvoiceResponse,
	invoiceUploadReducer,
	type ParsedInvoiceData,
	validateInvoiceFile,
} from "./invoiceUploadState";

const UPLOAD_FAILED_MESSAGE =
	"Failed to upload file. Check your connection and try again.";
const AI_DISABLED_MESSAGE =
	"AI is disabled for this account. Enter the vendor and line items below.";

export interface InvoiceUploadResult {
	storageId?: string;
	parsed?: ParsedInvoiceData;
}

interface UseInvoiceUploadOptions {
	generateUploadUrl?: () => Promise<string>;
	parseWithAI: boolean;
	onUploaded?: (storageId: string) => void;
	/** Not called when validation or the storage upload fails. */
	onFinished: (result: InvoiceUploadResult) => void;
}

function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

async function uploadInvoiceFile(
	generateUploadUrl: () => Promise<string>,
	file: File,
): Promise<string> {
	const uploadUrl = await generateUploadUrl();
	const response = await fetch(uploadUrl, {
		method: "POST",
		headers: { "Content-Type": contentTypeForUpload(file) },
		body: file,
	});
	if (!response.ok) {
		throw new Error("Upload failed");
	}
	const { storageId } = await response.json();
	if (typeof storageId !== "string") {
		throw new Error("Upload returned no storage ID");
	}
	return storageId;
}

async function parseInvoiceFile(
	file: File,
	authHeaders: Record<string, string>,
): Promise<InvoiceParseOutcome> {
	try {
		const response = await fetch("/api/parse-invoice", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders },
			// Convex storage IDs are not fetchable URLs, so send the bytes.
			body: JSON.stringify({ imageUrl: await readFileAsDataUrl(file) }),
		});
		const body = await response.json().catch(() => ({}));
		return interpretParseInvoiceResponse(response.ok, body);
	} catch {
		return { ok: false, message: invoiceScanFailureMessage() };
	}
}

export function useInvoiceUpload({
	generateUploadUrl,
	parseWithAI,
	onUploaded,
	onFinished,
}: UseInvoiceUploadOptions) {
	const { getAuthHeaders } = useAuth();
	const [state, dispatch] = useReducer(
		invoiceUploadReducer,
		initialInvoiceUploadState,
	);
	const latestRequestId = useRef(0);
	const callbacks = useRef({ onUploaded, onFinished });
	useLayoutEffect(() => {
		callbacks.current = { onUploaded, onFinished };
	});

	const selectFile = async (file: File) => {
		const requestId = ++latestRequestId.current;
		const isCurrent = () => latestRequestId.current === requestId;

		const invalid = validateInvoiceFile(file);
		if (invalid) {
			dispatch({
				type: "fail",
				requestId,
				stage: "validate",
				message: invalid,
			});
			return;
		}

		let storageId: string | undefined;
		if (generateUploadUrl) {
			dispatch({ type: "start", requestId, stage: "upload" });
			try {
				storageId = await uploadInvoiceFile(generateUploadUrl, file);
			} catch {
				dispatch({
					type: "fail",
					requestId,
					stage: "upload",
					message: UPLOAD_FAILED_MESSAGE,
				});
				return;
			}
			if (!isCurrent()) return;
			callbacks.current.onUploaded?.(storageId);
		}

		if (!parseWithAI) {
			dispatch({
				type: "fail",
				requestId,
				stage: "parse",
				message: AI_DISABLED_MESSAGE,
			});
			callbacks.current.onFinished({ storageId });
			return;
		}

		dispatch(
			generateUploadUrl
				? { type: "uploaded", requestId }
				: { type: "start", requestId, stage: "parse" },
		);
		const outcome = await parseInvoiceFile(file, getAuthHeaders());
		if (!isCurrent()) return;
		if (outcome.ok) {
			dispatch({ type: "parsed", requestId });
			callbacks.current.onFinished({ storageId, parsed: outcome.data });
		} else {
			dispatch({
				type: "fail",
				requestId,
				stage: "parse",
				message: outcome.message,
			});
			callbacks.current.onFinished({ storageId });
		}
	};

	const dismiss = () => dispatch({ type: "dismiss" });

	return { phase: state.phase, selectFile, dismiss };
}
