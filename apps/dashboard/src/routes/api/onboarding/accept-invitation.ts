import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { env } from "@/env";
import { DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE } from "@/lib/onboarding-template";
import { sendDirectOnboardingEmail } from "@/server/email-templates";
import { syncGoogleGroupsForRoleWithAudit } from "@/server/google-group-sync";
import {
	findLogtoUserByEmail,
	isSupportedRole,
	syncOfficerRolesOnLogtoUser,
} from "@/server/logto";

type PublicInvitation = {
	_id: string;
	name: string;
	email: string;
	role: string;
	position: string;
	offeredPositions?: string[];
	status: "pending" | "accepted" | "declined" | "expired";
	invitedAt: number;
	expiresAt: number;
	message?: string;
	acceptanceDeadline?: string;
	leaderName?: string;
};

type PublicOnboardingEmailConfig = {
	googleSheetsContactListUrl?: string;
	directOnboardingEmailTemplate?: string;
};

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

function getInviteId(request: Request, body?: Record<string, unknown>) {
	const url = new URL(request.url);
	const queryInviteId = url.searchParams.get("inviteId");
	const bodyInviteId =
		typeof body?.inviteId === "string" ? body.inviteId : null;
	return queryInviteId || bodyInviteId || "";
}

function invitationUnavailableResponse(invitation: PublicInvitation | null) {
	if (!invitation) {
		return json({ error: "Invitation not found" }, 404);
	}
	if (invitation.status === "expired" || Date.now() > invitation.expiresAt) {
		return json({ error: "This invitation has expired" }, 410);
	}
	if (invitation.status === "accepted") {
		return json({ error: "This invitation has already been accepted" }, 409);
	}
	if (invitation.status === "declined") {
		return json({ error: "This invitation has already been declined" }, 409);
	}
	return null;
}

function invitationLookupUnavailableResponse(
	invitation: PublicInvitation | null,
) {
	if (!invitation) {
		return json({ error: "Invitation not found" }, 404);
	}
	return null;
}

async function readInvitation(convex: ConvexHttpClient, inviteId: string) {
	const getPublicFn =
		"officerInvitations:getPublic" as unknown as FunctionReference<"query">;
	return (await convex.query(getPublicFn, {
		id: inviteId,
	})) as PublicInvitation | null;
}

async function readOnboardingEmailConfig(convex: ConvexHttpClient) {
	const getConfigFn =
		"organizationSettings:getPublicOnboardingEmailConfig" as unknown as FunctionReference<"query">;
	return (await convex.query(getConfigFn, {})) as PublicOnboardingEmailConfig;
}

async function recordAcceptanceSideEffects(
	convex: ConvexHttpClient,
	inviteId: string,
	data: {
		onboardingEmailSent?: boolean;
		roleGranted?: boolean;
		userCreatedOrUpdated?: boolean;
		googleGroupAssigned?: boolean;
		googleGroup?: string;
	},
) {
	const recordFn =
		"officerInvitations:recordAcceptanceSideEffects" as unknown as FunctionReference<"mutation">;
	await convex.mutation(recordFn, { id: inviteId, ...data });
}

async function handleGet({ request }: { request: Request }) {
	try {
		const inviteId = getInviteId(request);
		if (!inviteId) {
			return json({ error: "Missing inviteId" }, 400);
		}

		const convex = getConvexClient();
		const invitation = await readInvitation(convex, inviteId);
		const unavailable = invitationLookupUnavailableResponse(invitation);
		if (unavailable) return unavailable;

		return json({ invitation });
	} catch (error) {
		console.error("Error reading invitation:", error);
		return json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			500,
		);
	}
}

async function handlePost({ request }: { request: Request }) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const inviteId = getInviteId(request, body);
		const action = typeof body.action === "string" ? body.action : "";
		const selectedPosition =
			typeof body.selectedPosition === "string"
				? body.selectedPosition
				: undefined;

		if (!inviteId) {
			return json({ error: "Missing inviteId" }, 400);
		}
		if (action !== "accept" && action !== "decline") {
			return json({ error: "Invalid action" }, 400);
		}

		const convex = getConvexClient();
		const invitation = await readInvitation(convex, inviteId);
		const unavailable = invitationUnavailableResponse(invitation);
		if (unavailable) return unavailable;

		if (action === "decline") {
			const declineFn =
				"officerInvitations:declinePublic" as unknown as FunctionReference<"mutation">;
			const declinedInvitation = await convex.mutation(declineFn, {
				id: inviteId,
			});
			return json({ success: true, invitation: declinedInvitation });
		}

		const acceptFn =
			"officerInvitations:acceptPublic" as unknown as FunctionReference<"mutation">;
		const acceptedInvitation = (await convex.mutation(acceptFn, {
			id: inviteId,
			selectedPosition,
		})) as PublicInvitation & {
			roleGranted?: boolean;
			userCreatedOrUpdated?: boolean;
		};

		const onboardingEmailConfig = await readOnboardingEmailConfig(convex);
		const onboardingEmailSent = await sendDirectOnboardingEmail(
			{
				name: acceptedInvitation.name,
				email: acceptedInvitation.email,
				role: acceptedInvitation.role,
				position: acceptedInvitation.position,
				leaderName: acceptedInvitation.leaderName,
				customMessage: acceptedInvitation.message,
				emailTemplate:
					onboardingEmailConfig.directOnboardingEmailTemplate ||
					DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE,
			},
			onboardingEmailConfig.googleSheetsContactListUrl,
		);

		let logtoUpdated = false;
		let googleGroupAssigned = false;
		let resolvedGoogleGroup: string | null = null;
		const warnings: string[] = [];
		if (isSupportedRole(acceptedInvitation.role)) {
			try {
				const logtoUser = await findLogtoUserByEmail(acceptedInvitation.email);
				if (logtoUser) {
					await syncOfficerRolesOnLogtoUser(
						logtoUser.id,
						acceptedInvitation.role,
					);
					logtoUpdated = true;
				} else {
					warnings.push(
						`No Logto user found for email '${acceptedInvitation.email}'`,
					);
				}
			} catch (error) {
				warnings.push(
					error instanceof Error
						? `Failed to sync role to Logto: ${error.message}`
						: "Failed to sync role to Logto",
				);
			}

			const googleGroupResult = await syncGoogleGroupsForRoleWithAudit(
				convex,
				acceptedInvitation.email,
				acceptedInvitation.role,
			);
			googleGroupAssigned = googleGroupResult.googleGroupUpdated;
			resolvedGoogleGroup = googleGroupResult.googleGroup;
			warnings.push(...googleGroupResult.warnings);
		}

		await recordAcceptanceSideEffects(convex, inviteId, {
			onboardingEmailSent,
			roleGranted: Boolean(acceptedInvitation.roleGranted || logtoUpdated),
			userCreatedOrUpdated: Boolean(acceptedInvitation.userCreatedOrUpdated),
			googleGroupAssigned,
			googleGroup: resolvedGoogleGroup || undefined,
		});

		return json({
			success: true,
			invitation: acceptedInvitation,
			onboardingEmailSent,
			roleGranted: Boolean(acceptedInvitation.roleGranted || logtoUpdated),
			googleGroupAssigned,
			warnings,
		});
	} catch (error) {
		console.error("Error accepting invitation:", error);
		return json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			500,
		);
	}
}

export const Route = createFileRoute("/api/onboarding/accept-invitation")({
	server: {
		handlers: {
			GET: handleGet,
			POST: handlePost,
		},
	},
});
