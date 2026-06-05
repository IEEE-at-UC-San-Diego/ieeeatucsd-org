import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/server/auth";
import { sendInvitationEmail } from "@/server/email-templates";

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
		const {
			inviteId,
			name,
			email,
			role,
			position,
			acceptanceDeadline,
			message,
			leaderName,
		} = data as Record<string, string | undefined>;
		const offeredPositions = Array.isArray(data.offeredPositions)
			? data.offeredPositions.filter(
					(value): value is string => typeof value === "string",
				)
			: undefined;

		if (!inviteId || !name || !email || !role || !position) {
			return new Response(
				JSON.stringify({ error: "Missing required fields" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const success = await sendInvitationEmail({
			inviteId,
			name,
			email,
			role,
			position,
			offeredPositions,
			acceptanceDeadline,
			message,
			leaderName,
		});

		if (!success) {
			return new Response(
				JSON.stringify({ error: "Failed to send invitation email" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				message: "Invitation email sent successfully",
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("Error in send-invitation API:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal server error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const Route = createFileRoute("/api/onboarding/send-invitation")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
