import type { APIRoute } from "astro";
import { adminAuth } from "../../firebase/server";
import heicConvert from "heic-convert";

/**
 * POST /api/convert-heic-to-jpg
 * 
 * Converts HEIC/HEIF image files to JPEG format server-side.
 * This endpoint handles HEIC conversion to avoid browser compatibility issues
 * with the heic-convert package which requires Node.js APIs.
 * 
 * Authentication: Required (Firebase Auth session)
 * 
 * Request: multipart/form-data with 'file' field containing HEIC file
 * 
 * Success Response (200):
 * - Returns converted JPEG file with appropriate headers
 * - Content-Type: image/jpeg
 * - Content-Disposition: attachment with .jpg filename
 * 
 * Error Responses:
 * - 401: Unauthorized (not authenticated)
 * - 400: Bad request (no file or invalid file type)
 * - 500: Conversion error
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Authenticate user via session cookie
    const sessionCookie = cookies.get("session")?.value;
    
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: No session found" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify the session cookie
    try {
      await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid session" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".heic") && !fileName.endsWith(".heif")) {
      return new Response(
        JSON.stringify({
          error: "Invalid file type. Only HEIC/HEIF files are supported.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Convert HEIC to JPG
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });

    // Generate JPG filename
    const jpgFileName = fileName.replace(/\.(heic|heif)$/i, ".jpg");

    // Return the converted JPG file
    return new Response(outputBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${jpgFileName}"`,
      },
    });
  } catch (error) {
    console.error("HEIC conversion error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to convert HEIC file",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};