import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const createConvexSessionTokenMock = vi.fn();
const queryMock = vi.fn();
const mutationMock = vi.fn();
const sendDirectOnboardingEmailMock = vi.fn();
const findLogtoUserByEmailMock = vi.fn();
const syncOfficerRolesOnLogtoUserMock = vi.fn();
const syncGoogleGroupsForRoleWithAuditMock = vi.fn();

vi.mock("@/server/auth", () => ({
	requireApiAuth: requireApiAuthMock,
}));

vi.mock("@/server/convex-session", () => ({
	createConvexSessionToken: createConvexSessionTokenMock,
}));

vi.mock("convex/browser", () => ({
	ConvexHttpClient: class {
		query = queryMock;
		mutation = mutationMock;
	},
}));

vi.mock("@/env", () => ({
	env: {
		VITE_CONVEX_URL: "https://example.convex.cloud",
		CONVEX_SESSION_SECRET: "test-secret",
	},
}));

vi.mock("@/server/email-templates", () => ({
	sendDirectOnboardingEmail: sendDirectOnboardingEmailMock,
}));

vi.mock("@/server/logto", () => ({
	findLogtoUserByEmail: findLogtoUserByEmailMock,
	isSupportedRole: (role: string) =>
		[
			"Member",
			"General Officer",
			"Executive Officer",
			"Member at Large",
			"Past Officer",
			"Sponsor",
			"Administrator",
		].includes(role),
	syncOfficerRolesOnLogtoUser: syncOfficerRolesOnLogtoUserMock,
}));

vi.mock("@/server/google-group-sync", () => ({
	syncGoogleGroupsForRoleWithAudit: syncGoogleGroupsForRoleWithAuditMock,
}));

const invitation = {
	_id: "invite_1",
	name: "Alex Officer",
	email: "alex@ucsd.edu",
	role: "General Officer",
	position: "Project Lead",
	status: "pending" as const,
	invitedAt: Date.now() - 60_000,
	expiresAt: Date.now() + 86_400_000,
};

function authorized(overrides: Record<string, unknown> = {}) {
	return {
		logtoId: "logto|alex",
		accessToken: "access-token",
		body: { inviteId: "invite_1", action: "accept" },
		claims: { sub: "logto|alex", email: "alex@ucsd.edu" },
		user: { role: "Member", email: "alex@ucsd.edu" },
		...overrides,
	};
}

function postRequest(body: Record<string, unknown> = {}) {
	return new Request("http://localhost/api/onboarding/accept-invitation", {
		method: "POST",
		headers: {
			Authorization: "Bearer access-token",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

describe("AcceptInvitationApi.handlePost", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		createConvexSessionTokenMock.mockReturnValue({
			token: "session-token",
			payload: { exp: 1_700_000_000 },
		});
		queryMock.mockImplementation(async (fn: string) => {
			if (fn === "officerInvitations:getPublic") return invitation;
			if (fn === "organizationSettings:getPublicOnboardingEmailConfig") {
				return {};
			}
			return null;
		});
		mutationMock.mockResolvedValue({
			...invitation,
			status: "accepted",
			roleGranted: true,
			userCreatedOrUpdated: true,
		});
		sendDirectOnboardingEmailMock.mockResolvedValue(true);
		findLogtoUserByEmailMock.mockResolvedValue({ id: "logto-target" });
		syncOfficerRolesOnLogtoUserMock.mockResolvedValue(undefined);
		syncGoogleGroupsForRoleWithAuditMock.mockResolvedValue({
			googleGroupUpdated: true,
			googleGroup: "generalofficers@ieeeatucsd.org",
			warnings: [],
		});
		const { AcceptInvitationApi } = await import("./accept-invitation");
		AcceptInvitationApi.getConvexClient = () =>
			({ query: queryMock, mutation: mutationMock }) as never;
	});

	it("rejects an unauthenticated POST before any accept or sync", async () => {
		requireApiAuthMock.mockResolvedValue(
			new Response(JSON.stringify({ error: "Authentication required" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const { AcceptInvitationApi } = await import("./accept-invitation");

		const response = await AcceptInvitationApi.handlePost({
			request: postRequest({ inviteId: "invite_1", action: "accept" }),
		});

		expect(response.status).toBe(401);
		expect(queryMock).not.toHaveBeenCalled();
		expect(mutationMock).not.toHaveBeenCalled();
		expect(syncOfficerRolesOnLogtoUserMock).not.toHaveBeenCalled();
		expect(syncGoogleGroupsForRoleWithAuditMock).not.toHaveBeenCalled();
		expect(sendDirectOnboardingEmailMock).not.toHaveBeenCalled();
	});

	it("rejects a signed-in caller whose email does not match before accept or sync", async () => {
		requireApiAuthMock.mockResolvedValue(
			authorized({
				logtoId: "logto|intruder",
				claims: { sub: "logto|intruder", email: "intruder@ucsd.edu" },
				user: { role: "Member", email: "intruder@ucsd.edu" },
			}),
		);
		const { AcceptInvitationApi } = await import("./accept-invitation");

		const response = await AcceptInvitationApi.handlePost({
			request: postRequest({ inviteId: "invite_1", action: "accept" }),
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			error: "Invitation email does not match authenticated user",
		});
		expect(mutationMock).not.toHaveBeenCalled();
		expect(syncOfficerRolesOnLogtoUserMock).not.toHaveBeenCalled();
		expect(syncGoogleGroupsForRoleWithAuditMock).not.toHaveBeenCalled();
		expect(sendDirectOnboardingEmailMock).not.toHaveBeenCalled();
	});

	it("rejects decline from a mismatched email before the Convex mutation", async () => {
		requireApiAuthMock.mockResolvedValue(
			authorized({
				body: { inviteId: "invite_1", action: "decline" },
				claims: { sub: "logto|intruder", email: "intruder@ucsd.edu" },
				user: { role: "Member", email: "intruder@ucsd.edu" },
			}),
		);
		const { AcceptInvitationApi } = await import("./accept-invitation");

		const response = await AcceptInvitationApi.handlePost({
			request: postRequest({ inviteId: "invite_1", action: "decline" }),
		});

		expect(response.status).toBe(403);
		expect(mutationMock).not.toHaveBeenCalled();
	});

	it("accepts when the session email matches and passes HMAC credentials through", async () => {
		requireApiAuthMock.mockResolvedValue(
			authorized({
				body: {
					inviteId: "invite_1",
					action: "accept",
					selectedPosition: "Project Lead",
				},
			}),
		);
		const { AcceptInvitationApi } = await import("./accept-invitation");

		const response = await AcceptInvitationApi.handlePost({
			request: postRequest({
				inviteId: "invite_1",
				action: "accept",
				selectedPosition: "Project Lead",
			}),
		});

		expect(response.status).toBe(200);
		expect(createConvexSessionTokenMock).toHaveBeenCalledWith({
			sub: "logto|alex",
			role: "Member",
		});
		expect(mutationMock).toHaveBeenCalledWith(
			"officerInvitations:acceptPublic",
			{
				id: "invite_1",
				logtoId: "logto|alex",
				authToken: "session-token",
				selectedPosition: "Project Lead",
			},
		);
		expect(syncOfficerRolesOnLogtoUserMock).toHaveBeenCalledWith(
			"logto-target",
			"General Officer",
		);
		expect(syncGoogleGroupsForRoleWithAuditMock).toHaveBeenCalledWith(
			expect.anything(),
			"alex@ucsd.edu",
			"General Officer",
		);
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			roleGranted: true,
			googleGroupAssigned: true,
		});
	});

	it("declines when the session email matches and does not sync Logto or Groups", async () => {
		requireApiAuthMock.mockResolvedValue(
			authorized({
				body: { inviteId: "invite_1", action: "decline" },
			}),
		);
		mutationMock.mockResolvedValue({
			...invitation,
			status: "declined",
		});
		const { AcceptInvitationApi } = await import("./accept-invitation");

		const response = await AcceptInvitationApi.handlePost({
			request: postRequest({ inviteId: "invite_1", action: "decline" }),
		});

		expect(response.status).toBe(200);
		expect(mutationMock).toHaveBeenCalledWith(
			"officerInvitations:declinePublic",
			{
				id: "invite_1",
				logtoId: "logto|alex",
				authToken: "session-token",
			},
		);
		expect(syncOfficerRolesOnLogtoUserMock).not.toHaveBeenCalled();
		expect(syncGoogleGroupsForRoleWithAuditMock).not.toHaveBeenCalled();
		expect(sendDirectOnboardingEmailMock).not.toHaveBeenCalled();
	});
});
