import type { APIRoute } from "astro";
import { Resend } from "resend";
import {
  sendReimbursementSubmissionEmail,
  sendAuditRequestEmail,
  sendReimbursementStatusChangeEmail,
} from "../../../scripts/email/ReimbursementEmailFunctions";

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Initialize Resend
    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    const fromEmail =
      import.meta.env.FROM_EMAIL ||
      "IEEE UCSD <noreply@transactional.ieeeatucsd.org>";
    const replyToEmail =
      import.meta.env.REPLY_TO_EMAIL || "treasurer@ieeeatucsd.org";

    let success = false;

    switch (data.type) {
      case "reimbursement_submission":
        success = await sendReimbursementSubmissionEmail(
          resend,
          fromEmail,
          replyToEmail,
          data,
        );
        break;

      case "audit_request":
        success = await sendAuditRequestEmail(
          resend,
          fromEmail,
          replyToEmail,
          data,
        );
        break;

      case "status_change":
        success = await sendReimbursementStatusChangeEmail(
          resend,
          fromEmail,
          replyToEmail,
          {
            reimbursementId: data.reimbursementId,
            newStatus: data.newStatus,
            previousStatus: data.previousStatus,
            changedByUserId: data.changedByUserId,
            rejectionReason: data.rejectionReason,
            paymentConfirmation: data.paymentConfirmation,
            approvedAmount: data.approvedAmount,
            partialReason: data.partialReason,
          },
        );
        break;

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown notification type: ${data.type}`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
    }

    return new Response(
      JSON.stringify({
        success,
        message: success
          ? "Notification sent successfully"
          : "Failed to send notification",
      }),
      {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
