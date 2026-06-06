import { useCallback, useEffect, useState } from "react";

interface UseGlobalImagePasteOptions {
	/**
	 * Callback function to handle pasted image files
	 */
	onImagePasted: (files: File[]) => void;

	/**
	 * Whether the paste handler is enabled
	 * @default true
	 */
	enabled?: boolean;
}

interface UseGlobalImagePasteReturn {
	/**
	 * Whether the hook is currently listening for paste events
	 */
	isListening: boolean;
}

/**
 * Global image paste handler hook for the dashboard app
 *
 * This hook sets up a global paste event listener that captures image data
 * from the clipboard and routes it to the callback handler.
 *
 * Features:
 * - Only processes paste events when enabled
 * - Ignores paste events in text inputs, textareas, and contenteditable elements
 * - Extracts image data from clipboard
 * - Supports common image formats (PNG, JPEG, GIF, WebP, etc.)
 * - Returns listening state for UI feedback
 * - Cleans up event listener on unmount
 *
 * @example
 * ```tsx
 * const { isListening } = useGlobalImagePaste({
 *   enabled: isModalOpen,
 *   onImagePasted: (files) => {
 *     files.forEach(file => uploadFile(file));
 *   }
 * });
 * ```
 */
export function useGlobalImagePaste({
	onImagePasted,
	enabled = true,
}: UseGlobalImagePasteOptions): UseGlobalImagePasteReturn {
	const [isListening, setIsListening] = useState(false);

	const handlePaste = useCallback(
		(event: ClipboardEvent) => {
			// Only process if enabled
			if (!enabled) {
				return;
			}

			// Check if the paste event is happening in a text input, textarea, or contenteditable element
			const target = event.target as HTMLElement;
			const isTextInput =
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable ||
				target.getAttribute("contenteditable") === "true";

			// If pasting in a text field, let the default behavior happen
			if (isTextInput) {
				return;
			}

			// Get clipboard data
			const clipboardData = event.clipboardData;
			if (!clipboardData) {
				return;
			}

			// Look for image data in clipboard
			const items = clipboardData.items;
			const imageFiles: File[] = [];

			for (let i = 0; i < items.length; i++) {
				const item = items[i];

				// Check if the item is an image
				if (item.type.indexOf("image") !== -1) {
					// Get the image file
					const file = item.getAsFile();

					if (file) {
						imageFiles.push(file);
					}
				}
			}

			// If images were found, prevent default and call handler
			if (imageFiles.length > 0) {
				event.preventDefault();
				event.stopPropagation();
				onImagePasted(imageFiles);
			}
		},
		[enabled, onImagePasted],
	);

	useEffect(() => {
		// Update listening state
		setIsListening(enabled);

		// Only add listener if enabled
		if (!enabled) {
			return;
		}

		// Add global paste event listener
		document.addEventListener("paste", handlePaste);

		// Cleanup
		return () => {
			document.removeEventListener("paste", handlePaste);
		};
	}, [enabled, handlePaste]);

	return { isListening };
}

/**
 * Helper function to check if a file is an image
 */
export function isImageFile(file: File): boolean {
	return file.type.startsWith("image/");
}

/**
 * Helper function to validate image file size
 */
export function validateImageSize(file: File, maxSizeMB: number = 10): boolean {
	const maxSizeBytes = maxSizeMB * 1024 * 1024;
	return file.size <= maxSizeBytes;
}

/**
 * Helper function to get a preview URL for an image file
 */
export function getImagePreviewUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onloadend = () => {
			resolve(reader.result as string);
		};

		reader.onerror = () => {
			reject(new Error("Failed to read file"));
		};

		reader.readAsDataURL(file);
	});
}
