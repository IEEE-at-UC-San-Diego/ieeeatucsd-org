/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileDropTarget } from "./file-drop-target";

afterEach(() => {
	cleanup();
});

function fileList(name: string): FileList {
	const dropped = new File(["x"], name, { type: "application/pdf" });
	const list = {
		0: dropped,
		length: 1,
		item: (index: number) => (index === 0 ? dropped : null),
		[Symbol.iterator]: function* () {
			yield dropped;
		},
	};
	return list as unknown as FileList;
}

describe("FileDropTarget", () => {
	it("keeps the drag state while the pointer moves onto a child", () => {
		render(
			<FileDropTarget onFiles={vi.fn()}>
				<button type="button">Browse</button>
			</FileDropTarget>,
		);
		const zone = screen.getByText("Browse").parentElement;
		if (!zone) throw new Error("missing drop target");
		const child = screen.getByRole("button", { name: "Browse" });

		fireEvent.dragEnter(zone);
		expect(zone.getAttribute("data-drag-state")).toBe("active");
		expect(screen.getByText("Drop to upload.")).toBeTruthy();

		fireEvent.dragEnter(child, { relatedTarget: zone });
		fireEvent.dragLeave(zone, { relatedTarget: child });
		expect(zone.getAttribute("data-drag-state")).toBe("active");

		fireEvent.dragLeave(zone, { relatedTarget: document.body });
		expect(zone.getAttribute("data-drag-state")).toBe("idle");
	});

	it("forwards a dropped file list and does not forward a drop while disabled", () => {
		const onFiles = vi.fn();
		const { rerender } = render(
			<FileDropTarget onFiles={onFiles}>
				<input type="file" aria-label="Receipt file" />
			</FileDropTarget>,
		);
		const zone = screen.getByLabelText("Receipt file").parentElement;
		if (!zone) throw new Error("missing drop target");
		const dropped = fileList("receipt.pdf");

		fireEvent.drop(zone, { dataTransfer: { files: dropped } });
		expect(onFiles).toHaveBeenCalledTimes(1);
		expect(onFiles.mock.calls[0]?.[0]).toBe(dropped);
		expect(zone.getAttribute("data-drag-state")).toBe("idle");

		rerender(
			<FileDropTarget disabled onFiles={onFiles}>
				<input type="file" aria-label="Receipt file" />
			</FileDropTarget>,
		);
		const disabledZone = screen.getByLabelText("Receipt file").parentElement;
		if (!disabledZone) throw new Error("missing drop target");
		fireEvent.dragEnter(disabledZone);
		expect(disabledZone.getAttribute("data-drag-state")).toBe("idle");
		fireEvent.drop(disabledZone, {
			dataTransfer: { files: fileList("other.pdf") },
		});
		expect(onFiles).toHaveBeenCalledTimes(1);
	});

	it("leaves the native file input in the tab order", () => {
		render(
			<FileDropTarget onFiles={vi.fn()}>
				<input type="file" aria-label="Invoice file" className="sr-only" />
			</FileDropTarget>,
		);
		const input = screen.getByLabelText("Invoice file");
		expect(input.tagName).toBe("INPUT");
		expect(input.getAttribute("type")).toBe("file");
		input.focus();
		expect(document.activeElement).toBe(input);
	});
});
