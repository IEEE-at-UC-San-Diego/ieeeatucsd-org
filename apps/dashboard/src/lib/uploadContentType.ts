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

const ALLOWED_CONTENT_TYPES = new Set(Object.values(CONTENT_TYPE_BY_EXTENSION));

export function contentTypeForUpload(file: {
	name: string;
	type: string;
}): string {
	const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
	const fromExtension =
		CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
	const declared = file.type.trim().toLowerCase();
	if (declared && ALLOWED_CONTENT_TYPES.has(declared)) return declared;
	return fromExtension;
}
