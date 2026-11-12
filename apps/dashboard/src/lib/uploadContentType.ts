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

export function contentTypeForUpload(file: {
	name: string;
	type: string;
}): string {
	const declared = file.type.trim();
	if (declared) return declared;
	const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
	return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}
