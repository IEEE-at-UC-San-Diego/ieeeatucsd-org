import type { APIRoute } from "astro";
import { Resend } from "resend";
import {
  sendFundDepositSubmissionEmail,
  sendFundDepositStatusChangeEmail,
} from "../../../scripts/email/FundDepositEmailFunctions";

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    const fromEmail =
      import.meta.env.FROM_EMAIL ||
      "IEEE UCSD <noreply@transactional.ieeeatucsd.org>";
    const replyToEmail =
      import.meta.env.REPLY_TO_EMAIL || "treasurer@ieeeatucsd.org";

    let success = false;

    switch (data.type) {
      case "fund_deposit_submission":
        success = await sendFundDepositSubmissionEmail(
          resend,
          fromEmail,
          replyToEmail,
          { depositId: data.depositId },
        );
        break;
      case "fund_deposit_status_change":
        success = await sendFundDepositStatusChangeEmail(
          resend,
          fromEmail,
          replyToEmail,
          {
            depositId: data.depositId,
            newStatus: data.newStatus,
            rejectionReason: data.rejectionReason,
          },
        );
        break;
      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown notification type: ${data.type}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    return new Response(
      JSON.stringify({
        success,
        error: success ? null : "Failed to send notification",
      }),
      {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Fund deposit email API error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
