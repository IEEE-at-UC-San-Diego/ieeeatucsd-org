import type { APIRoute } from "astro";
import { Resend } from "resend";
import { sendInvitationEmail } from "../../../scripts/email/OnboardingEmailFunctions";

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    const {
      inviteId,
      name,
      email,
      role,
      position,
      acceptanceDeadline,
      message,
      leaderName,
    } = data;

    if (!inviteId || !name || !email || !role || !position) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
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

    const success = await sendInvitationEmail(resend, fromEmail, replyToEmail, {
      inviteId,
      name,
      email,
      role,
      position,
      acceptanceDeadline,
      message,
      leaderName,
    });

    if (!success) {
      return new Response(
        JSON.stringify({ error: "Failed to send invitation email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation email sent successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-invitation API:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

