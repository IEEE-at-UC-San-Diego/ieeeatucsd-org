type InvoiceContentPart =
	| { type: "text"; text: string }
	| { type: "file"; file: { filename: string; file_data: string } }
	| { type: "image_url"; image_url: { url: string } };

type InvoiceMedia =
	| { kind: "pdf"; dataUrl: string }
	| { kind: "image"; dataUrl: string };

const USER_PROMPT =
	"Analyze this invoice/receipt and extract all line items and totals.";
const PDF_PATH = /\.pdf(?:\?|#|$)/i;
const DATA_URL = /^data:([^;,]+)?(?:;base64)?,([\s\S]*)$/i;

export const INVOICE_SCAN_NOT_CONFIGURED =
	"Invoice scanning is not configured. Enter the vendor and line items below.";
export const INVOICE_SCAN_REJECTED =
	"The invoice scan rejected this file. Upload a PDF, JPG, or PNG under 10MB, or enter the vendor and line items below.";
export const INVOICE_SCAN_EMPTY =
	"The invoice scan finished without line items. Enter the vendor and line items below.";
export const INVOICE_SCAN_UNREADABLE =
	"The invoice scan returned data the form could not read. Enter the vendor and line items below.";

function readDataUrl(
	imageUrl: string,
): { mime: string; payload: string } | null {
	if (!imageUrl.startsWith("data:")) return null;
	const match = DATA_URL.exec(imageUrl);
	if (!match) return null;
	return {
		mime: (match[1] ?? "").trim().toLowerCase(),
		payload: match[2] ?? "",
	};
}

function sniffMime(payload: string) {
	const compact = payload.replace(/\s/g, "");
	if (compact.startsWith("JVBERi")) return "application/pdf";
	if (compact.startsWith("/9j/")) return "image/jpeg";
	if (compact.startsWith("iVBORw0KGgo")) return "image/png";
	if (compact.startsWith("R0lGOD")) return "image/gif";
	if (compact.startsWith("UklGR")) return "image/webp";
	return undefined;
}

function isGenericMime(mime: string) {
	return (
		mime.length === 0 ||
		mime === "application/octet-stream" ||
		mime === "binary/octet-stream"
	);
}

function prepareInvoiceMedia(
	imageUrl: string,
	contentType?: string,
): InvoiceMedia {
	const data = readDataUrl(imageUrl);
	const headerMime = contentType?.split(";")[0]?.trim().toLowerCase() || "";
	const declared = headerMime || data?.mime || "";
	const sniffed = data ? sniffMime(data.payload) : undefined;
	const mime = isGenericMime(declared) ? sniffed || declared : declared;

	if (
		mime === "application/pdf" ||
		mime === "application/x-pdf" ||
		(!data && PDF_PATH.test(imageUrl))
	) {
		if (!data) return { kind: "pdf", dataUrl: imageUrl };
		return {
			kind: "pdf",
			dataUrl: `data:application/pdf;base64,${data.payload}`,
		};
	}

	if (data && sniffed?.startsWith("image/") && isGenericMime(declared)) {
		return {
			kind: "image",
			dataUrl: `data:${sniffed};base64,${data.payload}`,
		};
	}

	return { kind: "image", dataUrl: imageUrl };
}

export function invoiceUserContent(
	imageUrl: string,
	contentType?: string,
): InvoiceContentPart[] {
	const media = prepareInvoiceMedia(imageUrl, contentType);
	switch (media.kind) {
		case "pdf":
			return [
				{ type: "text", text: USER_PROMPT },
				{
					type: "file",
					file: { filename: "invoice.pdf", file_data: media.dataUrl },
				},
			];
		case "image":
			return [
				{ type: "text", text: USER_PROMPT },
				{ type: "image_url", image_url: { url: media.dataUrl } },
			];
		default: {
			const unreachable: never = media;
			return unreachable;
		}
	}
}
