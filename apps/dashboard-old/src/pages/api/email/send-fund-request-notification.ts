import type { APIRoute } from "astro";
import { Resend } from "resend";
import {
    sendFundRequestSubmissionEmail,
    sendFundRequestStatusChangeEmail,
} from "../../../scripts/email/FundRequestEmailFunctions";

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
            case "fund_request_submission":
                success = await sendFundRequestSubmissionEmail(
                    resend,
                    fromEmail,
                    replyToEmail,
                    { requestId: data.requestId },
                );
                break;
            case "fund_request_status_change":
                success = await sendFundRequestStatusChangeEmail(
                    resend,
                    fromEmail,
                    replyToEmail,
                    {
                        requestId: data.requestId,
                        newStatus: data.newStatus,
                        reviewNotes: data.reviewNotes,
                        infoRequestNotes: data.infoRequestNotes,
                        selectedFundingSource: data.selectedFundingSource,
                        reviewerName: data.reviewerName,
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
        console.error("Fund request email API error:", error);
        return new Response(
            JSON.stringify({ success: false, error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
};
