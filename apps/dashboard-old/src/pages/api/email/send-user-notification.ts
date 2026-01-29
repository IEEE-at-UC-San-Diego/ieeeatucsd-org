import type { APIRoute } from "astro";
import { Resend } from "resend";
import { getAuth } from "firebase-admin/auth";
import { app } from "../../../firebase/server";
import {
  sendUserProfileUpdateEmail,
  sendUserRoleChangeEmail,
} from "../../../scripts/email/UserEmailFunctions";

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const auth = getAuth(app);
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized: Missing or invalid authentication token",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (tokenError) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check if user is an officer or admin
    const userRole = decodedToken.role;
    const allowedRoles = [
      "General Officer",
      "Executive Officer",
      "Administrator",
    ];

    if (!allowedRoles.includes(userRole)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Insufficient permissions" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = await request.json();
    const { type } = data;

    // Validate input data
    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!type || typeof type !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid notification type" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate allowed notification types
    const allowedTypes = ["profile_update", "role_change"];
    if (!allowedTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid notification type" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const resendApiKey = import.meta.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Resend API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail =
      "IEEE at UC San Diego <noreply@transactional.ieeeatucsd.org>";
    const replyToEmail = "ieee@ucsd.edu";

    let success = false;

    switch (type) {
      case "profile_update": {
        const { userId, changes, changedByUserId } = data;

        // Validate required fields
        if (!userId || typeof userId !== "string") {
          return new Response(
            JSON.stringify({
              error:
                "Missing or invalid userId for profile update notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
          return new Response(
            JSON.stringify({
              error:
                "Missing or invalid changes for profile update notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!changedByUserId || typeof changedByUserId !== "string") {
          return new Response(
            JSON.stringify({
              error:
                "Missing or invalid changedByUserId for profile update notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        success = await sendUserProfileUpdateEmail(
          resend,
          fromEmail,
          replyToEmail,
          {
            userId,
            changes,
            changedByUserId,
          },
        );
        break;
      }

      case "role_change": {
        const {
          userId: roleUserId,
          oldRole,
          newRole,
          changedByUserId: roleChangedBy,
        } = data;

        // Validate required fields
        if (!roleUserId || typeof roleUserId !== "string") {
          return new Response(
            JSON.stringify({
              error: "Missing or invalid userId for role change notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!oldRole || typeof oldRole !== "string") {
          return new Response(
            JSON.stringify({
              error: "Missing or invalid oldRole for role change notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!newRole || typeof newRole !== "string") {
          return new Response(
            JSON.stringify({
              error: "Missing or invalid newRole for role change notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!roleChangedBy || typeof roleChangedBy !== "string") {
          return new Response(
            JSON.stringify({
              error:
                "Missing or invalid roleChangedBy for role change notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Validate allowed roles
        const allowedRoles = [
          "Member",
          "General Officer",
          "Executive Officer",
          "Administrator",
          "Sponsor",
        ];
        if (
          !allowedRoles.includes(oldRole) ||
          !allowedRoles.includes(newRole)
        ) {
          return new Response(
            JSON.stringify({
              error: "Invalid role values for role change notification",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        success = await sendUserRoleChangeEmail(
          resend,
          fromEmail,
          replyToEmail,
          {
            userId: roleUserId,
            oldRole,
            newRole,
            changedByUserId: roleChangedBy,
          },
        );
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown notification type" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    return new Response(
      JSON.stringify({
        success,
        message: success
          ? "User email notification sent successfully"
          : "Failed to send user email notification",
      }),
      {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Log detailed error for debugging, but don't expose it to client
    console.error("Error in send-user-notification:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
