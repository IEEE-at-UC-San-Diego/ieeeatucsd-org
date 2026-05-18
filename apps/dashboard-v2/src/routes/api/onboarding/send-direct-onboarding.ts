import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE } from "@/lib/onboarding-template";
import { requireApiAuth } from "@/server/auth";
import { sendDirectOnboardingEmail } from "@/server/email-templates";
import { syncUserRole, UserRoleSyncInputError } from "@/server/user-role-sync";

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
			name,
			email,
			role,
			position,
			leaderName,
			customMessage,
			emailTemplate,
			googleSheetsUrl,
			team,
		} = data as Record<string, string | undefined>;

		if (!name || !email || !role || !position) {
			return new Response(
				JSON.stringify({ error: "Missing required fields" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const emailSuccess = await sendDirectOnboardingEmail(
			{
				name,
				email,
				role,
				position,
				leaderName,
				customMessage,
				emailTemplate:
					emailTemplate || DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE,
			},
			googleSheetsUrl,
		);

		if (!emailSuccess) {
			return new Response(
				JSON.stringify({ error: "Failed to send onboarding email" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		const roleSyncResult = await syncUserRole({
			actorLogtoId: authResult.logtoId,
			actorRole: authResult.user.role,
			email,
			name,
			role,
			position,
			team,
			source: "onboarding",
		});

		return new Response(
			JSON.stringify({
				success: true,
				message: "Officer onboarded successfully",
				emailSent: emailSuccess,
				roleGranted:
					roleSyncResult.convexUpdated || roleSyncResult.logtoUpdated,
				googleGroupAssigned: roleSyncResult.googleGroupUpdated,
				googleGroup: roleSyncResult.googleGroup,
				warnings: roleSyncResult.warnings,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		if (error instanceof UserRoleSyncInputError) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: error.status,
				headers: { "Content-Type": "application/json" },
			});
		}

		console.error("Error in send-direct-onboarding API:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal server error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const Route = createFileRoute("/api/onboarding/send-direct-onboarding")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
