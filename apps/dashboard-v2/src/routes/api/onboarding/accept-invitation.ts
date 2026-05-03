import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { env } from "@/env";
import { sendDirectOnboardingEmail } from "@/server/email-templates";
import {
	ensureRoleOnLogtoUser,
	findLogtoUserByEmail,
	isSupportedRole,
} from "@/server/logto";

const DEFAULT_ACCEPTED_ONBOARDING_TEMPLATE = `Hello {NAME}!

Congratulations on accepting the {POSITION} position for IEEE at UC San Diego.

Your onboarding process has begun. Please join the dashboard, review your onboarding steps, and keep an eye on your email for follow-up access information. {LEADER_INFO}

{CUSTOM_MESSAGE}

We are excited to have you on the board.`;

type PublicInvitation = {
	_id: string;
	name: string;
	email: string;
	role: string;
	position: string;
	status: "pending" | "accepted" | "declined" | "expired";
	invitedAt: number;
	expiresAt: number;
	message?: string;
	acceptanceDeadline?: string;
	leaderName?: string;
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

function invitationLookupUnavailableResponse(invitation: PublicInvitation | null) {
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

async function recordAcceptanceSideEffects(
	convex: ConvexHttpClient,
	inviteId: string,
	data: {
		onboardingEmailSent?: boolean;
		roleGranted?: boolean;
		userCreatedOrUpdated?: boolean;
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
		})) as PublicInvitation & {
			roleGranted?: boolean;
			userCreatedOrUpdated?: boolean;
		};

		const onboardingEmailSent = await sendDirectOnboardingEmail({
			name: acceptedInvitation.name,
			email: acceptedInvitation.email,
			role: acceptedInvitation.role,
			position: acceptedInvitation.position,
			leaderName: acceptedInvitation.leaderName,
			customMessage: acceptedInvitation.message,
			emailTemplate: DEFAULT_ACCEPTED_ONBOARDING_TEMPLATE,
		});

		let logtoUpdated = false;
		const warnings: string[] = [];
		if (isSupportedRole(acceptedInvitation.role)) {
			try {
				const logtoUser = await findLogtoUserByEmail(acceptedInvitation.email);
				if (logtoUser) {
					await ensureRoleOnLogtoUser(logtoUser.id, acceptedInvitation.role);
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
		}

		await recordAcceptanceSideEffects(convex, inviteId, {
			onboardingEmailSent,
			roleGranted: Boolean(acceptedInvitation.roleGranted || logtoUpdated),
			userCreatedOrUpdated: Boolean(acceptedInvitation.userCreatedOrUpdated),
		});

		return json({
			success: true,
			invitation: acceptedInvitation,
			onboardingEmailSent,
			roleGranted: Boolean(acceptedInvitation.roleGranted || logtoUpdated),
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
