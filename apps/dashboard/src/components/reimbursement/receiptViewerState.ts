export type FileKind = "pdf" | "image" | "unknown";

export const HEIC_CONVERSION_FAILED_MESSAGE =
	"Failed to convert HEIC image. Try downloading the file directly.";
export const RECEIPT_LOAD_FAILED_MESSAGE =
	"Failed to load receipt. The file may be corrupted or in an unsupported format.";

export type ReceiptViewerState =
	| { status: "loading" }
	| { status: "converting" }
	| { status: "ready"; kind: "pdf" }
	| {
			status: "ready";
			kind: "image";
			url: string;
			canFallBackToPdf: boolean;
	  }
	| { status: "failed"; message: string };

export type ReceiptViewerEvent =
	| { type: "load" }
	| { type: "detected"; kind: FileKind; url: string }
	| { type: "conversionStarted" }
	| { type: "converted"; url: string }
	| { type: "conversionFailed" }
	| { type: "imageFailed"; url: string };

export const initialReceiptViewerState: ReceiptViewerState = {
	status: "loading",
};

export function receiptViewerReducer(
	state: ReceiptViewerState,
	event: ReceiptViewerEvent,
): ReceiptViewerState {
	switch (event.type) {
		case "load":
			return state.status === "loading" ? state : { status: "loading" };
		case "detected":
			if (state.status !== "loading") return state;
			// Unknown files are tried as an image first; a render error falls back to PDF.
			return event.kind === "pdf"
				? { status: "ready", kind: "pdf" }
				: {
						status: "ready",
						kind: "image",
						url: event.url,
						canFallBackToPdf: true,
					};
		case "conversionStarted":
			return state.status === "loading" ? { status: "converting" } : state;
		case "converted":
			if (state.status !== "converting") return state;
			return {
				status: "ready",
				kind: "image",
				url: event.url,
				canFallBackToPdf: false,
			};
		case "conversionFailed":
			if (state.status !== "converting") return state;
			return { status: "failed", message: HEIC_CONVERSION_FAILED_MESSAGE };
		case "imageFailed":
			if (
				state.status !== "ready" ||
				state.kind !== "image" ||
				state.url !== event.url
			) {
				return state;
			}
			return state.canFallBackToPdf
				? { status: "ready", kind: "pdf" }
				: { status: "failed", message: RECEIPT_LOAD_FAILED_MESSAGE };
		default: {
			const unhandled: never = event;
			return unhandled;
		}
	}
}
