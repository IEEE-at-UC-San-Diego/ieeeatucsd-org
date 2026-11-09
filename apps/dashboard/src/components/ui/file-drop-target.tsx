import {
	type ClipboardEvent,
	type DragEvent,
	type ReactNode,
	useState,
} from "react";
import { cn } from "@/lib/utils";

export const pasteShortcutHint =
	"Paste with Cmd\u00A0+\u00A0V or Ctrl\u00A0+\u00A0V.";

interface FileDropTargetProps {
	disabled?: boolean;
	acceptPaste?: boolean;
	onFiles: (files: FileList) => void;
	className?: string;
	children: ReactNode;
}

function isTextEntry(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	if (target.tagName === "TEXTAREA") return true;
	if (target.tagName !== "INPUT") return false;
	return (target as HTMLInputElement).type !== "file";
}

function namedPasteFile(file: File, index: number): File {
	if (file.name.trim() !== "") return file;
	const raw = file.type.startsWith("image/")
		? (file.type.slice("image/".length).split(";")[0]?.split("+")[0] ?? "")
		: "";
	const extension = raw === "jpeg" ? "jpg" : raw;
	const name = extension
		? `Pasted image ${index + 1}.${extension}`
		: `Pasted file ${index + 1}`;
	return new File([file], name, {
		type: file.type,
		lastModified: file.lastModified,
	});
}

function filesFromClipboard(data: DataTransfer | null): File[] {
	if (!data) return [];
	const fromItems: File[] = [];
	const items = data.items;
	if (items) {
		for (let index = 0; index < items.length; index += 1) {
			const item = items[index];
			if (!item || item.kind !== "file") continue;
			const file = item.getAsFile();
			if (file) fromItems.push(namedPasteFile(file, fromItems.length));
		}
	}
	if (fromItems.length > 0) return fromItems;
	return Array.from(data.files ?? []).map((file, index) =>
		namedPasteFile(file, index),
	);
}

function fileListFrom(files: readonly File[]): FileList {
	const list: Record<number | string, unknown> = {
		length: files.length,
		item: (index: number) => files[index] ?? null,
		[Symbol.iterator]: function* iterator() {
			yield* files;
		},
	};
	files.forEach((file, index) => {
		list[index] = file;
	});
	return list as unknown as FileList;
}

export function FileDropTarget({
	disabled = false,
	acceptPaste = false,
	onFiles,
	className,
	children,
}: FileDropTargetProps) {
	const [depth, setDepth] = useState(0);
	const dragging = depth > 0 && !disabled;

	const keepInside = (event: DragEvent<HTMLFieldSetElement>) => {
		const next = event.relatedTarget;
		return next instanceof Node && event.currentTarget.contains(next);
	};

	const onDragEnter = (event: DragEvent<HTMLFieldSetElement>) => {
		event.preventDefault();
		if (disabled || keepInside(event)) return;
		setDepth((value) => value + 1);
	};

	const onDragLeave = (event: DragEvent<HTMLFieldSetElement>) => {
		event.preventDefault();
		if (disabled || keepInside(event)) return;
		setDepth((value) => Math.max(0, value - 1));
	};

	const onDragOver = (event: DragEvent<HTMLFieldSetElement>) => {
		event.preventDefault();
		event.stopPropagation();
	};

	const onDrop = (event: DragEvent<HTMLFieldSetElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setDepth(0);
		if (disabled) return;
		if (event.dataTransfer.files.length > 0) {
			onFiles(event.dataTransfer.files);
		}
	};

	const onPaste = (event: ClipboardEvent<HTMLFieldSetElement>) => {
		if (!acceptPaste || disabled) return;
		if (isTextEntry(event.target)) return;
		const files = filesFromClipboard(event.clipboardData);
		if (files.length === 0) return;
		event.preventDefault();
		event.stopPropagation();
		onFiles(fileListFrom(files));
	};

	return (
		<fieldset
			aria-label="File drop"
			data-drag-state={dragging ? "active" : "idle"}
			aria-disabled={disabled || undefined}
			tabIndex={acceptPaste && !disabled ? 0 : undefined}
			className={cn(
				"m-0 min-w-0 border-0 p-0 touch-manipulation transition-[background-color,border-color,opacity] duration-150 ease-[ease] motion-reduce:transition-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
				className,
				dragging && "border-2 border-dashed border-ds-blue-700 bg-ds-blue-100",
			)}
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onPaste={onPaste}
		>
			{dragging ? (
				<p className="text-sm font-medium text-ds-blue-1000">Drop to upload.</p>
			) : null}
			{children}
		</fieldset>
	);
}
