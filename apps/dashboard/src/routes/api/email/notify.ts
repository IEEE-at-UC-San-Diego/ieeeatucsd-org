import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/server/auth";
import {
  lookupUser,
  sendReimbursementSubmitted,
  sendReimbursementStatusChanged,
  sendFundRequestSubmitted,
  sendFundRequestStatusChanged,
  sendEventRequestSubmitted,
  sendEventRequestStatusChanged,
  sendEventRequestEdited,
  sendGraphicsUploaded,
  sendAuditRequest,
} from "@/server/notifications";

/**
 * If submitterName/submitterEmail are missing but submittedBy (logtoId) is present,
 * resolve the user info server-side from Convex.
 */
async function resolveSubmitter(body: Record<string, unknown>) {
  if (body.submitterEmail && body.submitterName) return body;
  const userId = (body.submittedBy || body.requestedUser) as string | undefined;
  if (!userId) return body;

  const user = await lookupUser(userId);
  return {
    ...body,
    submitterName: body.submitterName || user.name,
    submitterEmail: body.submitterEmail || user.email,
  };
}

async function handle({ request }: { request: Request }) {
  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authResult = await requireApiAuth(request, { requiredRoles: ["Administrator", "Executive Officer", "General Officer"] });
    if (authResult instanceof Response) return authResult;
    const { body: rawBody } = authResult;
    const type = rawBody.type as string;

    if (!type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Resolve submitter info for types that need it
    const body = await resolveSubmitter(rawBody);

    switch (type) {
      case "reimbursement_submitted":
        await sendReimbursementSubmitted(body as any);
        break;

      case "reimbursement_status_changed":
        await sendReimbursementStatusChanged(body as any);
        break;

      case "fund_request_submitted":
        await sendFundRequestSubmitted(body as any);
        break;

      case "fund_request_status_changed":
        await sendFundRequestStatusChanged(body as any);
        break;

      case "event_request_submitted":
        await sendEventRequestSubmitted(body as any);
        break;

      case "event_request_status_changed":
        await sendEventRequestStatusChanged(body as any);
        break;

      case "event_request_edited":
        await sendEventRequestEdited(body as any);
        break;

      case "graphics_uploaded":
        await sendGraphicsUploaded(body as any);
        break;

      case "audit_request":
        await sendAuditRequest(body as any);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown notification type: ${type}` }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Email notification error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/email/notify")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
