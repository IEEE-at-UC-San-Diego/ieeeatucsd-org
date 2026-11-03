type InvoiceContentPart =
	| { type: "text"; text: string }
	| { type: "file"; file: { filename: string; file_data: string } }
	| { type: "image_url"; image_url: { url: string } };

const USER_PROMPT =
	"Analyze this invoice/receipt and extract all line items and totals.";

export function invoiceUserContent(
	imageUrl: string,
	contentType?: string,
): InvoiceContentPart[] {
	const isPdf =
		(Boolean(contentType) && /application\/pdf/i.test(contentType ?? "")) ||
		/\.pdf(?:\?|#|$)/i.test(imageUrl);

	if (isPdf) {
		return [
			{ type: "text", text: USER_PROMPT },
			{
				type: "file",
				file: { filename: "invoice.pdf", file_data: imageUrl },
			},
		];
	}

	return [
		{ type: "text", text: USER_PROMPT },
		{ type: "image_url", image_url: { url: imageUrl } },
	];
}
