import { createFileRoute } from "@tanstack/react-router";
import { resetEmailPassword } from "@/server/mxroute";
import { requireApiAuth } from "@/server/auth";

async function handle({ request }: { request: Request }) {
  try {
    const authResult = await requireApiAuth(request);
    if (authResult instanceof Response) return authResult;
    const { body, user } = authResult;
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email or password" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const privilegedRoles = new Set(["Administrator", "Executive Officer", "General Officer"]);
    const isPrivileged = privilegedRoles.has(String(user.role || ""));
    if (!isPrivileged && user.ieeeEmail !== email) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: mailbox ownership mismatch" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await resetEmailPassword({ email, password });

    return new Response(JSON.stringify(result), {
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

export const Route = createFileRoute("/api/reset-email-password")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
