import { useEffect, useCallback } from "react";

export type ModalType =
  | "reimbursement-submission"
  | "reimbursement-management"
  | "reimbursement-wizard"
  | "fund-deposit-new"
  | "fund-deposit-edit"
  | "event-graphics"
  | "event-file-management"
  | "event-request"
  | "example-modal"
  | null;

interface UseGlobalImagePasteOptions {
  /**
   * The type of modal currently open
   */
  modalType: ModalType;

  /**
   * Callback function to handle the pasted image file
   */
  onImagePaste: (file: File) => void;

  /**
   * Whether the paste handler is enabled
   */
  enabled?: boolean;

  /**
   * Optional callback for when paste is attempted but no image is found
   */
  onNonImagePaste?: () => void;

  /**
   * Optional callback for successful paste detection
   */
  onPasteSuccess?: () => void;
}

/**
 * Global image paste handler hook
 *
 * This hook sets up a global paste event listener that captures image data
 * from the clipboard and routes it to the appropriate modal handler.
 *
 * Features:
 * - Only processes paste events when the modal is open (enabled=true)
 * - Ignores paste events in text inputs, textareas, and contenteditable elements
 * - Extracts image data from clipboard
 * - Supports common image formats (PNG, JPEG, GIF, WebP, etc.)
 * - Provides visual feedback through callbacks
 * - Gracefully handles cases where ModalProvider is not available
 *
 * @example
 * ```tsx
 * const [file, setFile] = useState<File | null>(null);
 *
 * useGlobalImagePaste({
 *   modalType: 'reimbursement-submission',
 *   enabled: isModalOpen,
 *   onImagePaste: (file) => {
 *     setFile(file);
 *     // Handle the file upload
 *   },
 *   onPasteSuccess: () => {
 *     toast.success('Image pasted successfully!');
 *   }
 * });
 * ```
 */
export function useGlobalImagePaste({
  modalType,
  onImagePaste,
  enabled = true,
  onNonImagePaste,
  onPasteSuccess,
}: UseGlobalImagePasteOptions) {
  // Note: This hook works independently of the ModalContext
  // The ModalContext is optional and only used for coordination between multiple modals

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      // Only process if enabled and modal is open
      if (!enabled || !modalType) {
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
      let imageFound = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Check if the item is an image
        if (item.type.indexOf("image") !== -1) {
          imageFound = true;

          // Get the image file
          const file = item.getAsFile();

          if (file) {
            // Prevent default paste behavior
            event.preventDefault();
            event.stopPropagation();

            // Call the handler with the image file
            onImagePaste(file);

            // Call success callback if provided
            if (onPasteSuccess) {
              onPasteSuccess();
            }
          }

          break;
        }
      }

      // If no image was found and callback is provided
      if (!imageFound && onNonImagePaste) {
        onNonImagePaste();
      }
    },
    [enabled, modalType, onImagePaste, onNonImagePaste, onPasteSuccess],
  );

  useEffect(() => {
    // Only add listener if enabled
    if (!enabled || !modalType) {
      return;
    }

    // Add global paste event listener
    document.addEventListener("paste", handlePaste);

    // Cleanup
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [enabled, modalType, handlePaste]);
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
