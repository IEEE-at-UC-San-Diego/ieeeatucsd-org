import type { APIRoute } from "astro";
import { adminAuth, app } from "../../firebase/server";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Payment confirmation upload request received");

    // Get the authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const idToken = authHeader.split("Bearer ")[1];

    // Verify the ID token and get user info
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const userId = decodedToken.uid;
    console.log("User authenticated:", userId);

    // Get user role from Firestore
    const db = getFirestore(app);
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      console.error("User document not found:", userId);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userData = userDoc.data();
    const userRole = userData?.role;

    // Check if user is Executive Officer or Administrator
    if (!["Executive Officer", "Administrator"].includes(userRole)) {
      console.error("User does not have permission:", userId, userRole);
      return new Response(
        JSON.stringify({
          error:
            "Forbidden - Only Executive Officers and Administrators can upload payment confirmations",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("User authorized:", userId, userRole);

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const reimbursementId = formData.get("reimbursementId") as string;

    if (!file) {
      return new Response(JSON.stringify({ error: "Missing file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!reimbursementId) {
      return new Response(
        JSON.stringify({ error: "Missing reimbursementId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("File received:", file.name, file.type, file.size);
    console.log("Reimbursement ID:", reimbursementId);

    // Verify the reimbursement exists
    const reimbursementDoc = await db
      .collection("reimbursements")
      .doc(reimbursementId)
      .get();

    if (!reimbursementDoc.exists) {
      console.error("Reimbursement not found:", reimbursementId);
      return new Response(
        JSON.stringify({ error: "Reimbursement not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const storagePath = `payment-confirmations/${reimbursementId}/${timestamp}_${safeName}`;

    console.log("Uploading to storage path:", storagePath);

    // Get Firebase Storage bucket
    let storage, bucket;
    try {
      storage = getStorage(app);
      bucket = storage.bucket();
      console.log("Storage bucket initialized:", bucket.name);
    } catch (storageError) {
      console.error("Failed to initialize storage bucket:", storageError);
      throw new Error(
        `Storage initialization failed: ${storageError instanceof Error ? storageError.message : "Unknown error"}`,
      );
    }

    // Convert File to Buffer
    let buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      console.log("File converted to buffer, size:", buffer.length);
    } catch (bufferError) {
      console.error("Failed to convert file to buffer:", bufferError);
      throw new Error(
        `File conversion failed: ${bufferError instanceof Error ? bufferError.message : "Unknown error"}`,
      );
    }

    // Upload file to Firebase Storage using Admin SDK
    let fileRef;
    try {
      fileRef = bucket.file(storagePath);
      await fileRef.save(buffer, {
        metadata: {
          contentType: file.type,
          metadata: {
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
            reimbursementId: reimbursementId,
          },
        },
      });
      console.log("File uploaded successfully to storage");
    } catch (uploadError) {
      console.error("Failed to upload file to storage:", uploadError);
      throw new Error(
        `File upload failed: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
      );
    }

    // Generate a long-lived signed URL (since uniform bucket-level access prevents makePublic)
    let downloadUrl;
    try {
      const [signedUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
      });
      downloadUrl = signedUrl;
      console.log("Generated signed URL:", downloadUrl);
    } catch (signedUrlError) {
      console.error("Failed to get signed URL:", signedUrlError);
      throw new Error(
        `Failed to generate download URL: ${signedUrlError instanceof Error ? signedUrlError.message : "Unknown error"}`,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl,
        storagePath,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error uploading payment confirmation:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to upload payment confirmation",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
