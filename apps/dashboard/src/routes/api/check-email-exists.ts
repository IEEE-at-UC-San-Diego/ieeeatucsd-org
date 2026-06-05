import { createFileRoute } from "@tanstack/react-router";
import { checkEmailExists } from "@/server/mxroute";
import { requireApiAuth } from "@/server/auth";

async function handle({ request }: { request: Request }) {
  try {
    const authResult = await requireApiAuth(request);
    if (authResult instanceof Response) return authResult;
    const { body, user } = authResult;
    const { email } = body as { email?: string };

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const privilegedRoles = new Set(["Administrator", "Executive Officer", "General Officer"]);
    const isPrivileged = privilegedRoles.has(String(user.role || ""));
    if (!isPrivileged) {
      const requesterEmail = String(user.email || "");
      const requesterUsername = requesterEmail
        .split("@")[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const mxDomain = (process.env.MXROUTE_EMAIL_DOMAIN || "ieeeatucsd.org").toLowerCase();
      const expectedEmail = requesterUsername
        ? `${requesterUsername}@${mxDomain}`
        : "";

      if (!expectedEmail || email.toLowerCase() !== expectedEmail) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: cannot query other mailboxes" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const result = await checkEmailExists(email);

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/check-email-exists")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
