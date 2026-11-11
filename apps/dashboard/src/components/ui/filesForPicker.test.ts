import { describe, expect, it } from "vitest";
import { filesForPicker } from "./filesForPicker";

function file(name: string, type = "", size = 12): File {
	const contents = new Uint8Array(size);
	return new File([contents], name, { type });
}

describe("filesForPicker", () => {
	it("returns no files and no message for an empty drop", () => {
		expect(filesForPicker(null, { accept: ".pdf", multiple: false })).toEqual({
			files: [],
			rejected: [],
			message: null,
		});
		expect(filesForPicker([], { accept: ".pdf", multiple: false })).toEqual({
			files: [],
			rejected: [],
			message: null,
		});
	});

	it("accepts one matching file and names nothing", () => {
		const pdf = file("receipt.pdf", "application/pdf");
		expect(
			filesForPicker([pdf], {
				accept: "image/*,.heic,.heif,application/pdf",
				multiple: false,
				maxBytes: 20,
			}),
		).toEqual({ files: [pdf], rejected: [], message: null });
	});

	it("matches an empty MIME type by extension, including image wildcards", () => {
		const heic = file("scan.HEIC", "");
		const ai = file("poster.ai", "");
		const png = file("photo.PNG", "");
		expect(
			filesForPicker([heic], {
				accept: "image/*,.heic,.heif,application/pdf",
				multiple: false,
			}).files,
		).toEqual([heic]);
		expect(
			filesForPicker([ai], {
				accept: "image/*,application/pdf,.ai,.psd,.svg,.eps,.fig",
				multiple: false,
			}).files,
		).toEqual([ai]);
		expect(
			filesForPicker([png], { accept: "image/*", multiple: false }).files,
		).toEqual([png]);
		expect(
			filesForPicker([file("resume.pdf", "")], {
				accept: ".pdf,application/pdf",
				multiple: false,
			}).files,
		).toHaveLength(1);
	});

	it("uploads nothing and names every file when a single-file control receives several", () => {
		const decision = filesForPicker(
			[file("a.pdf", "application/pdf"), file("b.png", "image/png")],
			{ accept: "application/pdf,image/*", multiple: false },
		);
		expect(decision.files).toEqual([]);
		expect(decision.rejected.map((item) => item.name)).toEqual([
			"a.pdf",
			"b.png",
		]);
		expect(decision.message).toBe(
			"Drop one file. These were not added: a.pdf, b.png.",
		);
	});

	it("keeps matching files and names every reject on a multi-file control", () => {
		const good = file("room.pdf", "application/pdf");
		const decision = filesForPicker(
			[
				good,
				file("notes.txt", "text/plain"),
				file("huge.pdf", "application/pdf", 30),
			],
			{
				accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx",
				multiple: true,
				maxBytes: 20,
				sizeMessage: "Choose a smaller file.",
			},
		);
		expect(decision.files).toEqual([good]);
		expect(decision.message).toBe(
			"notes.txt is not an accepted file type. huge.pdf: Choose a smaller file.",
		);
	});

	it("uses the caller size and type sentences for a single invalid file", () => {
		expect(
			filesForPicker([file("slides.ppt", "application/vnd.ms-powerpoint")], {
				accept: ".pdf,application/pdf",
				multiple: false,
				typeMessage: "Resume must be a PDF file",
			}).message,
		).toBe("slides.ppt: Resume must be a PDF file");
		expect(
			filesForPicker([file("big.pdf", "application/pdf", 30)], {
				accept: ".pdf,application/pdf",
				multiple: false,
				maxBytes: 20,
				sizeMessage: "Resume must be 5MB or smaller",
			}).message,
		).toBe("big.pdf: Resume must be 5MB or smaller");
	});

	it("treats a file at the size limit as acceptable", () => {
		const exact = file("exact.pdf", "application/pdf", 20);
		expect(
			filesForPicker([exact], {
				accept: "application/pdf",
				multiple: false,
				maxBytes: 20,
			}).files,
		).toEqual([exact]);
	});
});
