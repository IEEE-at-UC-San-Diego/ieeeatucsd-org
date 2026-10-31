/**
 * Local bookkeeping for a graphics upload that may finish after the
 * modal has switched events.
 */
export class GraphicsUploadSession {
	static isActiveEvent(
		activeEventId: string | null | undefined,
		uploadEventId: string,
	): boolean {
		return Boolean(uploadEventId) && activeEventId === uploadEventId;
	}

	static start(
		inFlight: Readonly<Record<string, number>>,
		eventId: string,
	): Record<string, number> {
		return { ...inFlight, [eventId]: (inFlight[eventId] ?? 0) + 1 };
	}

	static finish(
		inFlight: Readonly<Record<string, number>>,
		eventId: string,
	): Record<string, number> {
		const next = (inFlight[eventId] ?? 0) - 1;
		if (next <= 0) {
			if (!(eventId in inFlight)) return inFlight;
			const rest = { ...inFlight };
			delete rest[eventId];
			return rest;
		}
		return { ...inFlight, [eventId]: next };
	}

	static isUploading(
		inFlight: Readonly<Record<string, number>>,
		eventId: string | null | undefined,
	): boolean {
		if (!eventId) return false;
		return (inFlight[eventId] ?? 0) > 0;
	}

	static persistedFileIds(
		graphicsFiles: readonly string[] | null | undefined,
	): string[] {
		const ids: string[] = [];
		for (const raw of graphicsFiles ?? []) {
			const id = raw.trim();
			if (id && !ids.includes(id)) ids.push(id);
		}
		return ids;
	}

	static appendLinkedUrl(note: string, fileUrl: string): string {
		const trimmed = fileUrl.trim();
		if (!trimmed) return note;
		return note ? `${note}\n${trimmed}` : trimmed;
	}

	static async sha256Hex(file: Blob): Promise<string> {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			await file.arrayBuffer(),
		);
		return [...new Uint8Array(digest)]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	}
}
