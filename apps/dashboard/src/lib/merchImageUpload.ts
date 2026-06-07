import type { Id } from "@convex/_generated/dataModel";

export const MAX_MERCH_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
]);

export function validateMerchImageFile(file: File): string | null {
	if (
		!ALLOWED_IMAGE_TYPES.has(file.type) &&
		!/\.(jpe?g|png|webp|gif)$/i.test(file.name)
	) {
		return "Image must be JPEG, PNG, WebP, or GIF";
	}
	if (file.size > MAX_MERCH_IMAGE_BYTES) {
		return "Image must be 5MB or smaller";
	}
	return null;
}

export async function uploadMerchImageToStorage(
	file: File,
	generateUploadUrl: () => Promise<string>,
): Promise<Id<"_storage">> {
	const validationError = validateMerchImageFile(file);
	if (validationError) {
		throw new Error(validationError);
	}

	const uploadUrl = await generateUploadUrl();
	const uploadResponse = await fetch(uploadUrl, {
		method: "POST",
		headers: { "Content-Type": file.type || "application/octet-stream" },
		body: file,
	});

	if (!uploadResponse.ok) {
		throw new Error("Failed to upload image");
	}

	const { storageId } = (await uploadResponse.json()) as {
		storageId: Id<"_storage">;
	};
	return storageId;
}
