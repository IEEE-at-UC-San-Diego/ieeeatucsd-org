import { describe, expect, it } from "vitest";
import { GraphicsUploadSession } from "./graphicsUpload";

describe("GraphicsUploadSession", () => {
	it("ignores a finished upload once the modal shows a different event", () => {
		expect(GraphicsUploadSession.isActiveEvent("event_b", "event_a")).toBe(
			false,
		);
		expect(GraphicsUploadSession.isActiveEvent("event_a", "event_a")).toBe(
			true,
		);
		expect(GraphicsUploadSession.isActiveEvent(null, "event_a")).toBe(false);
	});

	it("keeps event B uploading when event A's upload finishes", () => {
		let inFlight = GraphicsUploadSession.start({}, "event_a");
		inFlight = GraphicsUploadSession.start(inFlight, "event_b");
		inFlight = GraphicsUploadSession.finish(inFlight, "event_a");

		expect(GraphicsUploadSession.isUploading(inFlight, "event_a")).toBe(false);
		expect(GraphicsUploadSession.isUploading(inFlight, "event_b")).toBe(true);
	});

	it("stays uploading until every in-flight upload for that event finishes", () => {
		let inFlight = GraphicsUploadSession.start({}, "event_a");
		inFlight = GraphicsUploadSession.start(inFlight, "event_a");
		inFlight = GraphicsUploadSession.finish(inFlight, "event_a");

		expect(GraphicsUploadSession.isUploading(inFlight, "event_a")).toBe(true);

		inFlight = GraphicsUploadSession.finish(inFlight, "event_a");
		expect(GraphicsUploadSession.isUploading(inFlight, "event_a")).toBe(false);
		expect(inFlight).toEqual({});
	});

	it("hashes the file the caller is about to upload", async () => {
		const digest = await GraphicsUploadSession.sha256Hex(new Blob(["abc"]));
		expect(digest).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("appends a resolved url onto the note for the event that owns the upload", () => {
		expect(
			GraphicsUploadSession.appendLinkedUrl("", " https://files.example/a "),
		).toBe("https://files.example/a");
		expect(
			GraphicsUploadSession.appendLinkedUrl(
				"https://files.example/a",
				"https://files.example/b",
			),
		).toBe("https://files.example/a\nhttps://files.example/b");
	});
});
