import type { APIRoute } from "astro";
import { google } from "googleapis";
import { app } from "../../../firebase/server";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseEnv } from "../../../env";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, googleGroup, role } = await request.json();

    if (!email || !googleGroup) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: email, googleGroup",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`Adding ${email} to Google Group: ${googleGroup}`);

    // Get admin email from environment
    const adminEmail = process.env.GOOGLE_ADMIN_EMAIL || "admin@ieeeatucsd.org";

    console.log("Service Account Details:");
    console.log("- Project ID:", firebaseEnv.projectId);
    console.log("- Client Email:", firebaseEnv.clientEmail);
    console.log("- Client ID:", firebaseEnv.clientId);
    console.log("- Admin Email (subject):", adminEmail);
    console.log("- Private Key Available:", !!firebaseEnv.privateKey);

    // Initialize Google Admin SDK with service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: firebaseEnv.projectId,
        private_key_id: firebaseEnv.privateKeyId,
        private_key: firebaseEnv.privateKey?.replace(/\\n/g, "\n"), // Fix escaped newlines from env vars (already decoded from base64 if needed)
        client_email: firebaseEnv.clientEmail,
        client_id: firebaseEnv.clientId,
      },
      scopes: [
        "https://www.googleapis.com/auth/admin.directory.group",
        "https://www.googleapis.com/auth/admin.directory.group.member",
      ],
      // Subject is required for domain-wide delegation
      // This should be an admin user email in your Google Workspace
      clientOptions: {
        subject: adminEmail,
      },
    });

    const admin = google.admin({ version: "directory_v1", auth });

    try {
      // Add member to the Google Group
      await admin.members.insert({
        groupKey: googleGroup,
        requestBody: {
          email: email,
          role: "MEMBER", // Can be MEMBER, MANAGER, or OWNER
        },
      });

      console.log(`✅ Successfully added ${email} to ${googleGroup}`);

      // Log the assignment in Firestore
      const db = getFirestore(app);
      await db.collection("googleGroupAssignments").add({
        email,
        googleGroup,
        role,
        assignedAt: new Date(),
        success: true,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully added ${email} to ${googleGroup}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (googleError: any) {
      console.error("Google API Error:", googleError);

      // Check if user is already a member
      if (
        googleError.code === 409 ||
        googleError.message?.includes("already exists")
      ) {
        console.log(`User ${email} is already a member of ${googleGroup}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `${email} is already a member of ${googleGroup}`,
            alreadyMember: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // Log the failed assignment
      const db = getFirestore(app);
      await db.collection("googleGroupAssignments").add({
        email,
        googleGroup,
        role,
        assignedAt: new Date(),
        success: false,
        error: googleError.message,
      });

      throw googleError;
    }
  } catch (error) {
    console.error("Error adding member to Google Group:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to add member to Google Group",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
