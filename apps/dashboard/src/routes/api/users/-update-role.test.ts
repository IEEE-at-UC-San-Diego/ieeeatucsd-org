import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	requireApiAuthMock,
	queryMock,
	mutationMock,
	findLogtoUserByEmailMock,
	syncOfficerRolesOnLogtoUserMock,
	syncGoogleGroupsForRoleWithAuditMock,
} = vi.hoisted(() => ({
	requireApiAuthMock: vi.fn(),
	queryMock: vi.fn(),
	mutationMock: vi.fn(),
	findLogtoUserByEmailMock: vi.fn(),
	syncOfficerRolesOnLogtoUserMock: vi.fn(),
	syncGoogleGroupsForRoleWithAuditMock: vi.fn(),
}));

vi.mock("@/server/auth", () => ({
	requireApiAuth: (...args: unknown[]) => requireApiAuthMock(...args),
}));

vi.mock("@/server/convex-session", () => ({
	createConvexSessionToken: () => ({ token: "test-token" }),
}));

vi.mock("@/server/logto", () => ({
	findLogtoUserByEmail: (...args: unknown[]) =>
		findLogtoUserByEmailMock(...args),
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
	syncOfficerRolesOnLogtoUser: (...args: unknown[]) =>
		syncOfficerRolesOnLogtoUserMock(...args),
}));

vi.mock("@/server/google-group-sync", () => ({
	syncGoogleGroupsForRoleWithAudit: (...args: unknown[]) =>
		syncGoogleGroupsForRoleWithAuditMock(...args),
}));

vi.mock("convex/browser", () => ({
	ConvexHttpClient: class ConvexHttpClient {
		query(...args: unknown[]) {
			return queryMock(...args);
		}
		mutation(...args: unknown[]) {
			return mutationMock(...args);
		}
	},
}));

function executiveOfficerRequest(body: Record<string, unknown>) {
	requireApiAuthMock.mockResolvedValue({
		body,
		logtoId: "exec-1",
		user: { role: "Executive Officer", email: "exec@ieeeatucsd.org" },
	});
	return new Request("http://localhost/api/users/update-role", {
		method: "POST",
	});
}

describe("POST /api/users/update-role", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.VITE_CONVEX_URL = "http://127.0.0.1:3210";
		findLogtoUserByEmailMock.mockResolvedValue({ id: "logto-admin" });
		syncOfficerRolesOnLogtoUserMock.mockResolvedValue(undefined);
		syncGoogleGroupsForRoleWithAuditMock.mockResolvedValue({
			googleGroupUpdated: true,
			googleGroup: "executiveofficers@ieeeatucsd.org",
			warnings: [],
		});
	});

	it("does not change Logto or Google Groups when no member record matches the email", async () => {
		queryMock.mockResolvedValue(null);
		const { handle } = await import("./update-role");
		const response = await handle({
			request: executiveOfficerRequest({
				email: "Admin@ieeeatucsd.org",
				role: "Administrator",
				source: "manage-users",
			}),
		});

		expect(response.status).toBe(404);
		const payload = (await response.json()) as { error?: string };
		expect(payload.error).toBe("No matching Convex user found to update");
		expect(mutationMock).not.toHaveBeenCalled();
		expect(findLogtoUserByEmailMock).not.toHaveBeenCalled();
		expect(syncOfficerRolesOnLogtoUserMock).not.toHaveBeenCalled();
		expect(syncGoogleGroupsForRoleWithAuditMock).not.toHaveBeenCalled();
	});

	it("updates Logto and Google Groups after the member record role update succeeds", async () => {
		queryMock.mockResolvedValue({
			_id: "users:1",
			email: "member@ieeeatucsd.org",
			logtoId: "logto-member",
		});
		mutationMock.mockResolvedValue("users:1");
		const { handle } = await import("./update-role");
		const response = await handle({
			request: executiveOfficerRequest({
				email: "member@ieeeatucsd.org",
				role: "General Officer",
				source: "manage-users",
			}),
		});

		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			success?: boolean;
			convexUpdated?: boolean;
			logtoUpdated?: boolean;
			googleGroupUpdated?: boolean;
		};
		expect(payload.success).toBe(true);
		expect(payload.convexUpdated).toBe(true);
		expect(payload.logtoUpdated).toBe(true);
		expect(payload.googleGroupUpdated).toBe(true);
		expect(syncOfficerRolesOnLogtoUserMock).toHaveBeenCalledWith(
			"logto-member",
			"General Officer",
		);
		expect(findLogtoUserByEmailMock).not.toHaveBeenCalled();
		expect(syncGoogleGroupsForRoleWithAuditMock).toHaveBeenCalledWith(
			expect.anything(),
			"member@ieeeatucsd.org",
			"General Officer",
		);
	});
});
