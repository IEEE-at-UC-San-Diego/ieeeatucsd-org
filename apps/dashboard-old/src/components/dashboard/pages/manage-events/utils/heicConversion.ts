/**
 * HEIC to JPG Conversion Utility
 *
 * Provides functionality to convert HEIC image files to JPG format.
 * Used across file upload components for event requests, reimbursement receipts,
 * and fund deposits to ensure browser compatibility.
 *
 * IMPORTANT: Conversion now happens server-side via /api/convert-heic-to-jpg
 * to avoid browser compatibility issues with the heic-convert package.
 */

/**
 * Checks if a file is in HEIC format based on extension and MIME type
 * 
 * @param file - The file to check
 * @returns true if the file is HEIC format, false otherwise
 */
export function isHeicFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const hasHeicExtension = fileName.endsWith('.heic') || fileName.endsWith('.heif');
  const hasHeicMimeType = file.type === 'image/heic' || file.type === 'image/heif';
  
  return hasHeicExtension || hasHeicMimeType;
}

/**
 * Converts a HEIC file to JPG format using server-side API
 *
 * @param file - The HEIC file to convert
 * @returns Promise resolving to a new File object in JPG format
 * @throws Error if the conversion fails or if the input is not a HEIC file
 *
 * @example
 * ```typescript
 * const jpgFile = await convertHeicToJpg(heicFile);
 * // Use jpgFile for upload or further processing
 * ```
 */
export async function convertHeicToJpg(file: File): Promise<File> {
  // Validate input is HEIC format
  if (!isHeicFile(file)) {
    throw new Error(`File "${file.name}" is not a HEIC/HEIF format file`);
  }

  try {
    // Create form data with the HEIC file
    const formData = new FormData();
    formData.append('file', file);

    // Call the server-side conversion API
    const response = await fetch('/api/convert-heic-to-jpg', {
      method: 'POST',
      credentials: 'include', // Include session cookie for authentication
      body: formData,
    });

    if (!response.ok) {
      // Try to parse error message from response
      let errorMessage = 'Failed to convert HEIC file';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If JSON parsing fails, use default error message
      }
      throw new Error(errorMessage);
    }

    // Get the converted JPG blob from the response
    const blob = await response.blob();
    
    // Extract filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let jpgFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    
    if (contentDisposition) {
      const matches = /filename="([^"]+)"/.exec(contentDisposition);
      if (matches?.[1]) {
        jpgFileName = matches[1];
      }
    }

    // Create new File object with JPG data
    const jpgFile = new File(
      [blob],
      jpgFileName,
      {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      }
    );

    return jpgFile;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to convert HEIC file "${file.name}" to JPG: ${errorMessage}`);
  }
}

/**
 * Converts a HEIC file to JPG if needed, otherwise returns the original file
 * 
 * Useful wrapper for file upload handlers that should automatically convert
 * HEIC files but pass through other formats unchanged.
 * 
 * @param file - The file to potentially convert
 * @returns Promise resolving to either the converted JPG or original file
 * 
 * @example
 * ```typescript
 * const processedFile = await convertHeicIfNeeded(uploadedFile);
 * // processedFile is JPG if input was HEIC, otherwise unchanged
 * ```
 */
export async function convertHeicIfNeeded(file: File): Promise<File> {
  if (isHeicFile(file)) {
    return convertHeicToJpg(file);
  }
  return file;
}