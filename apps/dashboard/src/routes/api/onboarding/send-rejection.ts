import { createFileRoute } from "@tanstack/react-router";
import { sendRejectionEmail } from "@/server/email-templates";
import { requireApiAuth } from "@/server/auth";

async function handle({ request }: { request: Request }) {
  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authResult = await requireApiAuth(request, {
      requiredRoles: ["Administrator", "Executive Officer"],
    });
    if (authResult instanceof Response) return authResult;

    const data = authResult.body;
    const name = typeof data.name === "string" ? data.name : "";
    const email = typeof data.email === "string" ? data.email : "";
    const customMessage =
      typeof data.customMessage === "string" ? data.customMessage : undefined;
    const positions = Array.isArray(data.positions)
      ? data.positions.filter((value): value is string => typeof value === "string")
      : [];

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const success = await sendRejectionEmail({
      name,
      email,
      positions,
      customMessage,
    });

    if (!success) {
      return new Response(
        JSON.stringify({ error: "Failed to send rejection email" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Rejection email sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-rejection API:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/onboarding/send-rejection")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
