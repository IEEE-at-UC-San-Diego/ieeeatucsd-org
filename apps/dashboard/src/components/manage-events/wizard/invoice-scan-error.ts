const FALLBACK =
	"The invoice scan did not return line items. Enter the vendor and line items below, or upload a PDF, JPG, or PNG under 10MB.";

export function invoiceScanFailureMessage(serverError?: string) {
	const text = serverError?.replace(/\s+/g, " ").trim();
	if (
		!text ||
		text.length > 240 ||
		text.startsWith("{") ||
		text.startsWith("<")
	) {
		return FALLBACK;
	}
	if (/enter the vendor and line items/i.test(text)) return text;
	const sentence = text.endsWith(".") ? text : `${text}.`;
	return `${sentence} Enter the vendor and line items below, or upload a PDF, JPG, or PNG under 10MB.`;
}
