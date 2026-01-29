/**
 * Utility functions for filename handling and truncation
 */

/**
 * Truncates a filename to a maximum length while preserving the extension
 * Format: "first20chars...extension" for filenames longer than 30 characters
 * 
 * @param filename - The original filename
 * @param maxLength - Maximum total length (default: 30)
 * @param prefixLength - Length of prefix to keep (default: 20)
 * @returns Truncated filename
 */
export function truncateFilename(
  filename: string, 
  maxLength: number = 30, 
  prefixLength: number = 20
): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  // Find the last dot to separate name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  
  if (lastDotIndex === -1) {
    // No extension found, just truncate with ellipsis
    return filename.substring(0, prefixLength) + '...';
  }

  const extension = filename.substring(lastDotIndex);
  const nameWithoutExtension = filename.substring(0, lastDotIndex);
  
  // If the extension itself is too long, truncate it too
  if (extension.length > 10) {
    return nameWithoutExtension.substring(0, prefixLength) + '...' + extension.substring(0, 7) + '...';
  }
  
  // Calculate available space for the name part
  const availableSpace = maxLength - extension.length - 3; // 3 for "..."
  
  if (availableSpace <= 0) {
    // Extension is too long, just show truncated extension
    return '...' + extension;
  }
  
  const truncatedName = nameWithoutExtension.substring(0, Math.min(prefixLength, availableSpace));
  return truncatedName + '...' + extension;
}

/**
 * Extracts filename from a URL or file path
 * 
 * @param urlOrPath - URL or file path
 * @returns Extracted filename
 */
export function extractFilename(urlOrPath: string): string {
  try {
    // Try to parse as URL first
    const url = new URL(urlOrPath);
    const pathname = url.pathname;
    let filename = pathname.split('/').pop() || 'file';
    
    // Remove timestamp prefix if present (format: timestamp_originalname)
    if (filename.includes('_')) {
      const parts = filename.split('_');
      if (parts.length > 1 && /^\d+$/.test(parts[0])) {
        filename = parts.slice(1).join('_');
      }
    }
    
    return filename;
  } catch {
    // Not a valid URL, treat as file path
    const parts = urlOrPath.split(/[/\\]/);
    return parts[parts.length - 1] || 'file';
  }
}

/**
 * Gets file extension from filename
 * 
 * @param filename - The filename
 * @returns File extension (including the dot) or empty string
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
}

/**
 * Checks if a file is an image based on its extension
 * 
 * @param filename - The filename to check
 * @returns True if the file is an image
 */
export function isImageFile(filename: string): boolean {
  const extension = getFileExtension(filename).toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(extension);
}

/**
 * Checks if a file is a PDF based on its extension
 * 
 * @param filename - The filename to check
 * @returns True if the file is a PDF
 */
export function isPdfFile(filename: string): boolean {
  return /\.pdf$/i.test(filename);
}

/**
 * Gets a human-readable file size string
 * 
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validates file type against allowed extensions
 * 
 * @param filename - The filename to validate
 * @param allowedExtensions - Array of allowed extensions (with or without dots)
 * @returns True if file type is allowed
 */
export function isFileTypeAllowed(filename: string, allowedExtensions: string[]): boolean {
  const extension = getFileExtension(filename).toLowerCase();
  const normalizedAllowed = allowedExtensions.map(ext => 
    ext.startsWith('.') ? ext.toLowerCase() : '.' + ext.toLowerCase()
  );
  
  return normalizedAllowed.includes(extension);
}

/**
 * Validates file size against maximum allowed size
 * 
 * @param fileSize - File size in bytes
 * @param maxSizeInMB - Maximum allowed size in MB
 * @returns True if file size is within limits
 */
export function isFileSizeValid(fileSize: number, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return fileSize <= maxSizeInBytes;
}

/**
 * Generates a unique filename by adding timestamp
 * 
 * @param originalFilename - Original filename
 * @returns Filename with timestamp prefix
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  return `${timestamp}_${originalFilename}`;
}
