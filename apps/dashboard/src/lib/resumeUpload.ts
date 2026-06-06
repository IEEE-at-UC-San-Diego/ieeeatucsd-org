import type { Id } from "@convex/_generated/dataModel";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function validateResumeFile(file: File): string | null {
	const isPdf =
		file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
	if (!isPdf) {
		return "Resume must be a PDF file";
	}
	if (file.size > MAX_RESUME_BYTES) {
		return "Resume must be 5MB or smaller";
	}
	return null;
}

export async function uploadResumeToStorage(
	file: File,
	generateUploadUrl: () => Promise<string>,
): Promise<Id<"_storage">> {
	const validationError = validateResumeFile(file);
	if (validationError) {
		throw new Error(validationError);
	}

	const uploadUrl = await generateUploadUrl();
	const uploadResponse = await fetch(uploadUrl, {
		method: "POST",
		headers: { "Content-Type": file.type || "application/pdf" },
		body: file,
	});

	if (!uploadResponse.ok) {
		throw new Error("Failed to upload resume");
	}

	const { storageId } = (await uploadResponse.json()) as {
		storageId: Id<"_storage">;
	};
	return storageId;
}

export async function downloadFileFromUrl(url: string, fileName: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to download file");
	}

	const blob = await response.blob();
	const objectUrl = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = fileName;
	link.style.visibility = "hidden";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(objectUrl);
}
