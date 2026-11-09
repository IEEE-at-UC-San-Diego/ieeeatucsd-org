import { type DragEvent, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface FileDropTargetProps {
	disabled?: boolean;
	onFiles: (files: FileList) => void;
	className?: string;
	children: ReactNode;
}

export function FileDropTarget({
	disabled = false,
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

	return (
		<fieldset
			aria-label="File drop"
			data-drag-state={dragging ? "active" : "idle"}
			aria-disabled={disabled || undefined}
			className={cn(
				"m-0 min-w-0 border-0 p-0 touch-manipulation transition-[background-color,border-color,opacity] duration-150 ease-[ease] motion-reduce:transition-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
				className,
				dragging && "border-2 border-dashed border-ds-blue-700 bg-ds-blue-100",
			)}
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
			{dragging ? (
				<p className="text-sm font-medium text-ds-blue-1000">Drop to upload.</p>
			) : null}
			{children}
		</fieldset>
	);
}
