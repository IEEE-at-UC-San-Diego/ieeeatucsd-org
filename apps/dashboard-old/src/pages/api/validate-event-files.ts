import type { APIRoute } from "astro";
import { adminAuth } from "../../firebase/server";

/**
 * Allowed file extensions for event uploads
 */
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "heic"] as const;

/**
 * Allowed MIME types mapped to their valid extensions
 * Used for security validation to prevent MIME type spoofing
 */
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heic"],
};

/**
 * Maximum file size in bytes (10MB by default)
 * Can be overridden via MAX_FILE_SIZE_MB environment variable
 */
const MAX_FILE_SIZE_BYTES = (Number(import.meta.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

/**
 * Type definition for validation request payload
 */
interface ValidationRequest {
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Type definition for validation response
 */
interface ValidationResponse {
  valid: boolean;
  error?: string;
  details?: {
    filename: string;
    extension: string;
    mimeType: string;
    size: number;
    maxSize: number;
  };
}

/**
 * Extracts file extension from filename
 * @param filename - The filename to extract extension from
 * @returns Lowercase file extension without the dot
 */
function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Validates if the file extension is allowed
 * @param extension - File extension to validate
 * @returns True if extension is allowed, false otherwise
 */
function isExtensionAllowed(extension: string): boolean {
  return ALLOWED_EXTENSIONS.includes(extension as typeof ALLOWED_EXTENSIONS[number]);
}

/**
 * Validates if MIME type matches the file extension (security check)
 * @param mimeType - MIME type from the file
 * @param extension - File extension
 * @returns True if MIME type is valid for the extension, false otherwise
 */
function isMimeTypeValid(mimeType: string, extension: string): boolean {
  const allowedExtensions = ALLOWED_MIME_TYPES[mimeType.toLowerCase()];
  return allowedExtensions ? allowedExtensions.includes(extension) : false;
}

/**
 * Validates file size against the maximum allowed size
 * @param size - File size in bytes
 * @returns True if file size is within limits, false otherwise
 */
function isFileSizeValid(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE_BYTES;
}

/**
 * POST /api/validate-event-files
 * 
 * Validates file information for event request uploads before uploading to Firebase Storage.
 * Performs server-side validation of file type, MIME type, and size to provide an additional
 * layer of security beyond client-side validation.
 * 
 * Authentication: Required (Firebase Auth session)
 * 
 * Request Body:
 * ```json
 * {
 *   "filename": "document.pdf",
 *   "mimeType": "application/pdf",
 *   "size": 1048576
 * }
 * ```
 * 
 * Success Response (200):
 * ```json
 * {
 *   "valid": true,
 *   "details": {
 *     "filename": "document.pdf",
 *     "extension": "pdf",
 *     "mimeType": "application/pdf",
 *     "size": 1048576,
 *     "maxSize": 10485760
 *   }
 * }
 * ```
 * 
 * Error Responses:
 * - 401: Unauthorized (not authenticated)
 * - 400: Bad request (missing or invalid parameters)
 * - 413: File too large
 * - 415: Unsupported file type or MIME type mismatch
 * 
 * @param context - Astro API context
 * @returns JSON response indicating validation result
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user via session cookie
    const sessionCookie = cookies.get("session")?.value;
    
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Unauthorized: No session found",
        } satisfies ValidationResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify the session cookie
    let decodedClaims;
    try {
      decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch (error) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Unauthorized: Invalid session",
        } satisfies ValidationResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body: ValidationRequest;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Bad request: Invalid JSON payload",
        } satisfies ValidationResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    const { filename, mimeType, size } = body;

    if (!filename || typeof filename !== "string") {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Bad request: Missing or invalid 'filename' field",
        } satisfies ValidationResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!mimeType || typeof mimeType !== "string") {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Bad request: Missing or invalid 'mimeType' field",
        } satisfies ValidationResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (typeof size !== "number" || size < 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Bad request: Missing or invalid 'size' field",
        } satisfies ValidationResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Extract and validate file extension
    const extension = getFileExtension(filename);

    if (!extension) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Invalid file: No file extension found",
          details: {
            filename,
            extension: "",
            mimeType,
            size,
            maxSize: MAX_FILE_SIZE_BYTES,
          },
        } satisfies ValidationResponse),
        {
          status: 415,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!isExtensionAllowed(extension)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Unsupported file type: .${extension}. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`,
          details: {
            filename,
            extension,
            mimeType,
            size,
            maxSize: MAX_FILE_SIZE_BYTES,
          },
        } satisfies ValidationResponse),
        {
          status: 415,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate MIME type matches extension (security check)
    if (!isMimeTypeValid(mimeType, extension)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `MIME type mismatch: ${mimeType} does not match file extension .${extension}`,
          details: {
            filename,
            extension,
            mimeType,
            size,
            maxSize: MAX_FILE_SIZE_BYTES,
          },
        } satisfies ValidationResponse),
        {
          status: 415,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate file size
    if (!isFileSizeValid(size)) {
      const maxSizeMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
      const fileSizeMB = (size / (1024 * 1024)).toFixed(2);
      
      return new Response(
        JSON.stringify({
          valid: false,
          error: `File too large: ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`,
          details: {
            filename,
            extension,
            mimeType,
            size,
            maxSize: MAX_FILE_SIZE_BYTES,
          },
        } satisfies ValidationResponse),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // All validations passed
    return new Response(
      JSON.stringify({
        valid: true,
        details: {
          filename,
          extension,
          mimeType,
          size,
          maxSize: MAX_FILE_SIZE_BYTES,
        },
      } satisfies ValidationResponse),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error validating event files:", error);
    
    return new Response(
      JSON.stringify({
        valid: false,
        error: "Internal server error: Failed to validate file",
      } satisfies ValidationResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};