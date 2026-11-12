const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
	pdf: "application/pdf",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const INVOICE_UPLOAD_TYPES = new Set([
	CONTENT_TYPE_BY_EXTENSION.pdf,
	CONTENT_TYPE_BY_EXTENSION.jpg,
	CONTENT_TYPE_BY_EXTENSION.png,
	CONTENT_TYPE_BY_EXTENSION.gif,
	CONTENT_TYPE_BY_EXTENSION.webp,
]);

export const ROOM_BOOKING_UPLOAD_TYPES = new Set([
	CONTENT_TYPE_BY_EXTENSION.pdf,
	CONTENT_TYPE_BY_EXTENSION.jpg,
	CONTENT_TYPE_BY_EXTENSION.png,
	CONTENT_TYPE_BY_EXTENSION.doc,
	CONTENT_TYPE_BY_EXTENSION.docx,
]);

export function contentTypeForUpload(
	file: { name: string; type: string },
	allowed: ReadonlySet<string>,
): string {
	const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
	const fromExtension =
		CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
	const declared = file.type.trim().toLowerCase();
	if (declared && allowed.has(declared)) return declared;
	return fromExtension;
}
