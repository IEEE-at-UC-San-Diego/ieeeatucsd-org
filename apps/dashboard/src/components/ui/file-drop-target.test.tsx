/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileDropTarget, pasteShortcutHint } from "./file-drop-target";

afterEach(() => {
	cleanup();
});

function fileItem(file: File) {
	return {
		kind: "file",
		type: file.type,
		getAsFile: () => file,
	};
}

function pasteOn(
	target: Element,
	items: Array<{ kind: string; type: string; getAsFile: () => File | null }>,
) {
	const list = {
		length: items.length,
		item: (index: number) => items[index] ?? null,
		[Symbol.iterator]: function* iterator() {
			yield* items;
		},
	};
	items.forEach((item, index) => {
		(list as Record<number, unknown>)[index] = item;
	});
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: {
			items: list,
			files: { length: 0, item: () => null },
		},
	});
	target.dispatchEvent(event);
	return event;
}

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

	it("ignores a paste unless the control opts in", () => {
		const onFiles = vi.fn();
		const shot = new File(["img"], "shot.png", { type: "image/png" });
		const { rerender } = render(
			<FileDropTarget onFiles={onFiles}>
				<input type="file" aria-label="Receipt file" />
			</FileDropTarget>,
		);
		const input = screen.getByLabelText("Receipt file");
		const zone = input.parentElement;
		if (!zone) throw new Error("missing drop target");
		expect(zone.hasAttribute("tabindex")).toBe(false);

		const ignored = pasteOn(input, [fileItem(shot)]);
		expect(ignored.defaultPrevented).toBe(false);
		expect(onFiles).not.toHaveBeenCalled();

		rerender(
			<FileDropTarget acceptPaste onFiles={onFiles}>
				<input type="file" aria-label="Receipt file" />
			</FileDropTarget>,
		);
		const pasteZone = screen.getByLabelText("Receipt file").parentElement;
		if (!pasteZone) throw new Error("missing drop target");
		pasteZone.focus();
		expect(document.activeElement).toBe(pasteZone);
		expect(pasteZone.className).toContain("focus-within:ring-2");
		expect(pasteZone.tabIndex).toBe(0);

		pasteOn(screen.getByLabelText("Receipt file"), [fileItem(shot)]);
		expect(onFiles).toHaveBeenCalledTimes(1);
		expect(Array.from(onFiles.mock.calls[0]?.[0] as FileList)[0]?.name).toBe(
			"shot.png",
		);
	});

	it("leaves a text paste inside the control alone", () => {
		const onFiles = vi.fn();
		render(
			<FileDropTarget acceptPaste onFiles={onFiles}>
				<input type="text" aria-label="Vendor" defaultValue="" />
			</FileDropTarget>,
		);
		const vendor = screen.getByLabelText("Vendor");
		vendor.focus();
		const pasted = pasteOn(vendor, [
			{ kind: "string", type: "text/plain", getAsFile: () => null },
		]);
		expect(pasted.defaultPrevented).toBe(false);
		expect(onFiles).not.toHaveBeenCalled();
		expect(pasteShortcutHint).toMatch(/Cmd/);
		expect(pasteShortcutHint).toMatch(/Ctrl/);
	});

	it("does not start a paste while the control is pending", () => {
		const onFiles = vi.fn();
		render(
			<FileDropTarget acceptPaste disabled onFiles={onFiles}>
				<input type="file" aria-label="Invoice file" />
			</FileDropTarget>,
		);
		const zone = screen.getByLabelText("Invoice file").parentElement;
		if (!zone) throw new Error("missing drop target");
		expect(zone.hasAttribute("tabindex")).toBe(false);
		pasteOn(zone, [
			fileItem(new File(["img"], "shot.png", { type: "image/png" })),
		]);
		expect(onFiles).not.toHaveBeenCalled();
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
