import { OfficerInvitationAccess } from "@convex/officerInvitationAccess";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { env } from "@/env";
import { DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE } from "@/lib/onboarding-template";
import { requireApiAuth } from "@/server/auth";
import { createConvexSessionToken } from "@/server/convex-session";
import { sendDirectOnboardingEmail } from "@/server/email-templates";
import { syncGoogleGroupsForRoleWithAudit } from "@/server/google-group-sync";
import {
	findLogtoUserByEmail,
	isSupportedRole,
	syncOfficerRolesOnLogtoUser,
} from "@/server/logto";
import type { UserRole } from "@/types/roles";

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

type ConvexSessionFn = typeof createConvexSessionToken;
type RequireApiAuthFn = typeof requireApiAuth;

/**
 * Authenticated accept/decline for officer invitations.
 *
 * The public POST used to act on `inviteId` alone, then sync Logto and Google
 * Groups. A session is required and the verified email must match before any
 * accept, decline, or side-effect sync.
 */
export class AcceptInvitationApi {
	static requireAuth: RequireApiAuthFn = requireApiAuth;
	static createSession: ConvexSessionFn = createConvexSessionToken;
	static sendOnboardingEmail = sendDirectOnboardingEmail;
	static findLogtoUser = findLogtoUserByEmail;
	static syncLogtoRoles = syncOfficerRolesOnLogtoUser;
	static syncGoogleGroups = syncGoogleGroupsForRoleWithAudit;

	static json(data: unknown, status = 200) {
		return new Response(JSON.stringify(data), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	}

	static getConvexClient() {
		const url =
			env.VITE_CONVEX_URL ||
			process.env.CONVEX_URL ||
			process.env.VITE_CONVEX_URL;
		if (!url) {
			throw new Error("Missing required env: VITE_CONVEX_URL or CONVEX_URL");
		}
		return new ConvexHttpClient(url);
	}

	static getInviteId(request: Request, body?: Record<string, unknown>) {
		const url = new URL(request.url);
		const queryInviteId = url.searchParams.get("inviteId");
		const bodyInviteId =
			typeof body?.inviteId === "string" ? body.inviteId : null;
		return queryInviteId || bodyInviteId || "";
	}

	static invitationUnavailableResponse(invitation: PublicInvitation | null) {
		if (!invitation) {
			return AcceptInvitationApi.json({ error: "Invitation not found" }, 404);
		}
		if (invitation.status === "expired" || Date.now() > invitation.expiresAt) {
			return AcceptInvitationApi.json(
				{ error: "This invitation has expired" },
				410,
			);
		}
		if (invitation.status === "accepted") {
			return AcceptInvitationApi.json(
				{ error: "This invitation has already been accepted" },
				409,
			);
		}
		if (invitation.status === "declined") {
			return AcceptInvitationApi.json(
				{ error: "This invitation has already been declined" },
				409,
			);
		}
		return null;
	}

	static invitationLookupUnavailableResponse(
		invitation: PublicInvitation | null,
	) {
		if (!invitation) {
			return AcceptInvitationApi.json({ error: "Invitation not found" }, 404);
		}
		return null;
	}

	static async readInvitation(convex: ConvexHttpClient, inviteId: string) {
		const getPublicFn =
			"officerInvitations:getPublic" as unknown as FunctionReference<"query">;
		return (await convex.query(getPublicFn, {
			id: inviteId,
		})) as PublicInvitation | null;
	}

	static async readOnboardingEmailConfig(convex: ConvexHttpClient) {
		const getConfigFn =
			"organizationSettings:getPublicOnboardingEmailConfig" as unknown as FunctionReference<"query">;
		return (await convex.query(getConfigFn, {})) as PublicOnboardingEmailConfig;
	}

	static async recordAcceptanceSideEffects(
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

	static async handleGet({ request }: { request: Request }) {
		try {
			const inviteId = AcceptInvitationApi.getInviteId(request);
			if (!inviteId) {
				return AcceptInvitationApi.json({ error: "Missing inviteId" }, 400);
			}

			const convex = AcceptInvitationApi.getConvexClient();
			const invitation = await AcceptInvitationApi.readInvitation(
				convex,
				inviteId,
			);
			const unavailable =
				AcceptInvitationApi.invitationLookupUnavailableResponse(invitation);
			if (unavailable) return unavailable;

			return AcceptInvitationApi.json({ invitation });
		} catch (error) {
			console.error("Error reading invitation:", error);
			return AcceptInvitationApi.json(
				{
					error:
						error instanceof Error ? error.message : "Internal server error",
				},
				500,
			);
		}
	}

	static async handlePost({ request }: { request: Request }) {
		try {
			const authResult = await AcceptInvitationApi.requireAuth(request);
			if (authResult instanceof Response) return authResult;

			const { body, logtoId, user, claims } = authResult;
			const inviteId = AcceptInvitationApi.getInviteId(request, body);
			const action = typeof body.action === "string" ? body.action : "";
			const selectedPosition =
				typeof body.selectedPosition === "string"
					? body.selectedPosition
					: undefined;

			if (!inviteId) {
				return AcceptInvitationApi.json({ error: "Missing inviteId" }, 400);
			}
			if (action !== "accept" && action !== "decline") {
				return AcceptInvitationApi.json({ error: "Invalid action" }, 400);
			}

			const convex = AcceptInvitationApi.getConvexClient();
			const invitation = await AcceptInvitationApi.readInvitation(
				convex,
				inviteId,
			);
			if (!invitation) {
				return AcceptInvitationApi.json({ error: "Invitation not found" }, 404);
			}

			const callerEmail = OfficerInvitationAccess.callerEmailFromAuth({
				claimsEmail:
					typeof claims.email === "string" ? claims.email : undefined,
				userEmail: typeof user.email === "string" ? user.email : undefined,
			});
			if (!OfficerInvitationAccess.emailsMatch(callerEmail, invitation.email)) {
				return AcceptInvitationApi.json(
					{ error: OfficerInvitationAccess.EMAIL_MISMATCH },
					403,
				);
			}

			const unavailable =
				AcceptInvitationApi.invitationUnavailableResponse(invitation);
			if (unavailable) return unavailable;

			const { token } = AcceptInvitationApi.createSession({
				sub: logtoId,
				role: user.role as UserRole | undefined,
			});

			if (action === "decline") {
				const declineFn =
					"officerInvitations:declinePublic" as unknown as FunctionReference<"mutation">;
				const declinedInvitation = await convex.mutation(declineFn, {
					id: inviteId,
					logtoId,
					authToken: token,
				});
				return AcceptInvitationApi.json({
					success: true,
					invitation: declinedInvitation,
				});
			}

			const acceptFn =
				"officerInvitations:acceptPublic" as unknown as FunctionReference<"mutation">;
			const acceptedInvitation = (await convex.mutation(acceptFn, {
				id: inviteId,
				logtoId,
				authToken: token,
				selectedPosition,
			})) as PublicInvitation & {
				roleGranted?: boolean;
				userCreatedOrUpdated?: boolean;
			};

			const onboardingEmailConfig =
				await AcceptInvitationApi.readOnboardingEmailConfig(convex);
			const onboardingEmailSent = await AcceptInvitationApi.sendOnboardingEmail(
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
					const logtoUser = await AcceptInvitationApi.findLogtoUser(
						acceptedInvitation.email,
					);
					if (logtoUser) {
						await AcceptInvitationApi.syncLogtoRoles(
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

				const googleGroupResult = await AcceptInvitationApi.syncGoogleGroups(
					convex,
					acceptedInvitation.email,
					acceptedInvitation.role,
				);
				googleGroupAssigned = googleGroupResult.googleGroupUpdated;
				resolvedGoogleGroup = googleGroupResult.googleGroup;
				warnings.push(...googleGroupResult.warnings);
			}

			await AcceptInvitationApi.recordAcceptanceSideEffects(convex, inviteId, {
				onboardingEmailSent,
				roleGranted: Boolean(acceptedInvitation.roleGranted || logtoUpdated),
				userCreatedOrUpdated: Boolean(acceptedInvitation.userCreatedOrUpdated),
				googleGroupAssigned,
				googleGroup: resolvedGoogleGroup || undefined,
			});

			return AcceptInvitationApi.json({
				success: true,
				invitation: acceptedInvitation,
				onboardingEmailSent,
				roleGranted: Boolean(acceptedInvitation.roleGranted || logtoUpdated),
				googleGroupAssigned,
				warnings,
			});
		} catch (error) {
			console.error("Error accepting invitation:", error);
			return AcceptInvitationApi.json(
				{
					error:
						error instanceof Error ? error.message : "Internal server error",
				},
				500,
			);
		}
	}
}
