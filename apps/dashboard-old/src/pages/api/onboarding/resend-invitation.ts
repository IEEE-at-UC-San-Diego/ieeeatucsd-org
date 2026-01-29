import type { APIRoute } from "astro";
import { Resend } from "resend";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { app } from "../../../firebase/server";
import { sendInvitationEmail } from "../../../scripts/email/OnboardingEmailFunctions";

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { invitationId } = data;

    if (!invitationId) {
      return new Response(
        JSON.stringify({ error: "Missing invitation ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getFirestore(app);

    // Fetch the invitation from Firestore
    const invitationRef = db.collection("officerInvitations").doc(invitationId);
    const invitationDoc = await invitationRef.get();

    if (!invitationDoc.exists) {
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const invitation = invitationDoc.data();

    // Validate invitation is still pending
    if (invitation?.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `Cannot resend invitation with status: ${invitation?.status}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Resend
    const resend = new Resend(import.meta.env.RESEND_API_KEY);

    if (!import.meta.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const fromEmail =
      import.meta.env.FROM_EMAIL || "IEEE UCSD <noreply@ieeeatucsd.org>";
    const replyToEmail = import.meta.env.REPLY_TO_EMAIL || "ieee@ucsd.edu";

    // Calculate new expiration date
    // Get the original duration between invitedAt and expiresAt
    const originalInvitedAt = invitation.invitedAt.toDate();
    const originalExpiresAt = invitation.expiresAt.toDate();
    const durationMs = originalExpiresAt.getTime() - originalInvitedAt.getTime();

    // Set new expiration to the same duration from now
    const newExpiresAt = new Date(Date.now() + durationMs);

    // Format new deadline for email display
    const formattedDeadline = newExpiresAt.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Send invitation email
    const success = await sendInvitationEmail(resend, fromEmail, replyToEmail, {
      inviteId: invitationId,
      name: invitation.name,
      email: invitation.email,
      role: invitation.role,
      position: invitation.position,
      acceptanceDeadline: formattedDeadline,
      message: invitation.message,
      leaderName: invitation.leaderName,
    });

    if (!success) {
      return new Response(
        JSON.stringify({ error: "Failed to send invitation email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update Firestore with new expiration and resent timestamp
    await invitationRef.update({
      expiresAt: Timestamp.fromDate(newExpiresAt),
      acceptanceDeadline: formattedDeadline,
      resentAt: Timestamp.now(),
      lastSentAt: Timestamp.now(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation resent successfully",
        newExpiresAt: newExpiresAt.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in resend-invitation API:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

