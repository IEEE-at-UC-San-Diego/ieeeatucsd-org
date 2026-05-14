import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { env } from "@/env";
import { DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE } from "@/lib/onboarding-template";
import { requireApiAuth } from "@/server/auth";
import { createConvexSessionToken } from "@/server/convex-session";
import { sendDirectOnboardingEmail } from "@/server/email-templates";
import { isSupportedRole } from "@/server/logto";
import { syncExternalAccessForRole } from "@/server/role-provisioning";
import type { OfficerTeam, UserRole } from "@/types/roles";

const VALID_TEAMS: OfficerTeam[] = ["Internal", "Events", "Projects"];

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function getConvexClient() {
	const url =
		env.VITE_CONVEX_URL ||
		process.env.CONVEX_URL ||
		process.env.VITE_CONVEX_URL;
	if (!url) {
		throw new Error("Missing required env: VITE_CONVEX_URL or CONVEX_URL");
	}
	return new ConvexHttpClient(url);
}

async function handle({ request }: { request: Request }) {
	try {
		if (request.method !== "POST") {
			return json({ error: "Method not allowed" }, 405);
		}

		const authResult = await requireApiAuth(request, {
			requiredRoles: ["Administrator", "Executive Officer"],
		});
		if (authResult instanceof Response) return authResult;
		const { body, logtoId, user } = authResult;
		const {
			name,
			email,
			role,
			position,
			leaderName,
			customMessage,
			emailTemplate,
			googleSheetsUrl,
		} = body as Record<string, string | undefined>;
		const rawTeam = typeof body.team === "string" ? body.team : undefined;
		const team = rawTeam && rawTeam !== "none" ? rawTeam : undefined;
		const normalizedEmail = email?.trim().toLowerCase();

		if (!name?.trim() || !normalizedEmail || !role || !position?.trim()) {
			return json({ error: "Missing required fields" }, 400);
		}

		if (!isSupportedRole(role)) {
			return json({ error: "Invalid role" }, 400);
		}

		if (team && !VALID_TEAMS.includes(team as OfficerTeam)) {
			return json({ error: "Invalid team" }, 400);
		}

		const emailSuccess = await sendDirectOnboardingEmail(
			{
				name: name.trim(),
				email: normalizedEmail,
				role,
				position: position.trim(),
				leaderName,
				customMessage,
				emailTemplate:
					emailTemplate || DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE,
			},
			googleSheetsUrl,
		);

		if (!emailSuccess) {
			return json({ error: "Failed to send onboarding email" }, 500);
		}

		const convex = getConvexClient();
		const { token } = createConvexSessionToken({
			sub: logtoId,
			role: user.role as UserRole | undefined,
		});
		const getByEmailFn =
			"users:getByEmailForAdmin" as unknown as FunctionReference<"query">;
		const updateRoleFn =
			"users:updateRole" as unknown as FunctionReference<"mutation">;
		const createPlaceholderFn =
			"users:createPlaceholder" as unknown as FunctionReference<"mutation">;
		const createDirectOnboardingFn =
			"directOnboardings:create" as unknown as FunctionReference<"mutation">;

		const targetUser = (await convex.query(getByEmailFn, {
			logtoId,
			authToken: token,
			email: normalizedEmail,
		})) as { _id: string; email: string; logtoId?: string } | null;

		let convexUserId: string;
		if (targetUser?._id) {
			await convex.mutation(updateRoleFn, {
				logtoId,
				authToken: token,
				userId: targetUser._id,
				role,
				position: position.trim(),
				team: team as OfficerTeam | undefined,
			});
			convexUserId = targetUser._id;
		} else {
			convexUserId = (await convex.mutation(createPlaceholderFn, {
				logtoId,
				authToken: token,
				email: normalizedEmail,
				name: name.trim(),
				role,
				position: position.trim(),
				team: team as OfficerTeam | undefined,
			})) as string;
		}

		const externalSync = await syncExternalAccessForRole({
			convex,
			email: normalizedEmail,
			role,
			logtoUserId: targetUser?.logtoId,
		});

		const directOnboardingId = (await convex.mutation(
			createDirectOnboardingFn,
			{
				logtoId,
				authToken: token,
				name: name.trim(),
				email: normalizedEmail,
				role,
				position: position.trim(),
				team: team as OfficerTeam | undefined,
				emailSent: true,
				googleGroupAssigned: externalSync.googleGroupUpdated,
				googleGroup: externalSync.googleGroup || undefined,
				logtoRoleGranted: externalSync.logtoUpdated,
			},
		)) as string;

		return json({
			success: true,
			message: "Officer onboarded successfully",
			emailSent: true,
			convexUpdated: true,
			convexUserId,
			directOnboardingId,
			logtoUpdated: externalSync.logtoUpdated,
			googleGroupUpdated: externalSync.googleGroupUpdated,
			googleGroup: externalSync.googleGroup,
			warnings: externalSync.warnings,
		});
	} catch (error) {
		console.error("Error in send-direct-onboarding API:", error);
		return json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			500,
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
