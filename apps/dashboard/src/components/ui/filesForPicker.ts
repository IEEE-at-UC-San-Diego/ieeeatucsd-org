export interface PickerPolicy {
	accept: string;
	multiple: boolean;
	maxBytes?: number;
	typeMessage?: string;
	sizeMessage?: string;
}

export type PickerRejectReason = "type" | "size" | "count";

export interface RejectedPickerFile {
	name: string;
	reason: PickerRejectReason;
}

export interface PickerDecision {
	files: File[];
	rejected: RejectedPickerFile[];
	message: string | null;
}

const EMPTY_DECISION: PickerDecision = {
	files: [],
	rejected: [],
	message: null,
};

const IMAGE_EXTENSIONS = new Set([
	".avif",
	".bmp",
	".gif",
	".heic",
	".heif",
	".jpeg",
	".jpg",
	".png",
	".svg",
	".tif",
	".tiff",
	".webp",
]);

function fileExtension(name: string): string {
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return "";
	return name.slice(dot).toLowerCase();
}

function fileMatchesAccept(file: File, accept: string): boolean {
	const tokens = accept
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean);
	const extension = fileExtension(file.name);
	const mime = file.type.toLowerCase();

	return tokens.some((token) => {
		if (token.startsWith(".")) return extension === token;
		if (token.endsWith("/*")) {
			const prefix = token.slice(0, -1);
			if (mime.startsWith(prefix)) return true;
			return (
				mime === "" && token === "image/*" && IMAGE_EXTENSIONS.has(extension)
			);
		}
		if (mime === token) return true;
		return mime === "" && token === "application/pdf" && extension === ".pdf";
	});
}

function reasonSentence(
	file: RejectedPickerFile,
	policy: PickerPolicy,
): string {
	switch (file.reason) {
		case "type":
			return policy.typeMessage
				? `${file.name}: ${policy.typeMessage}`
				: `${file.name} is not an accepted file type.`;
		case "size":
			return policy.sizeMessage
				? `${file.name}: ${policy.sizeMessage}`
				: `${file.name} is too large.`;
		case "count":
			return file.name;
		default: {
			const unreachable: never = file.reason;
			return unreachable;
		}
	}
}

export function filesForPicker(
	list: FileList | readonly File[] | null,
	policy: PickerPolicy,
): PickerDecision {
	const incoming = list ? Array.from(list) : [];
	if (incoming.length === 0) return EMPTY_DECISION;

	if (!policy.multiple && incoming.length > 1) {
		const rejected = incoming.map((file) => ({
			name: file.name,
			reason: "count" as const,
		}));
		return {
			files: [],
			rejected,
			message: `Drop one file. These were not added: ${rejected.map((file) => file.name).join(", ")}.`,
		};
	}

	const files: File[] = [];
	const rejected: RejectedPickerFile[] = [];
	for (const file of incoming) {
		if (!fileMatchesAccept(file, policy.accept)) {
			rejected.push({ name: file.name, reason: "type" });
			continue;
		}
		if (policy.maxBytes !== undefined && file.size > policy.maxBytes) {
			rejected.push({ name: file.name, reason: "size" });
			continue;
		}
		files.push(file);
	}

	if (rejected.length === 0) {
		return { files, rejected, message: null };
	}

	return {
		files,
		rejected,
		message: rejected.map((file) => reasonSentence(file, policy)).join(" "),
	};
}
