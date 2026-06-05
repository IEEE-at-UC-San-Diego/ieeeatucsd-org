import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const mutationMock = vi.fn();
const syncGoogleGroupsForRoleWithAuditMock = vi.fn();
const findLogtoUserByEmailMock = vi.fn();
const syncOfficerRolesOnLogtoUserMock = vi.fn();

vi.mock("convex/browser", () => ({
	ConvexHttpClient: vi.fn(() => ({
		query: queryMock,
		mutation: mutationMock,
	})),
}));

vi.mock("@/env", () => ({
	env: {
		VITE_CONVEX_URL: "https://example.convex.cloud",
		CONVEX_SESSION_SECRET: "test-secret",
	},
}));

vi.mock("@/server/google-group-sync", () => ({
	syncGoogleGroupsForRoleWithAudit: syncGoogleGroupsForRoleWithAuditMock,
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

describe("syncUserRole", () => {
	beforeEach(() => {
		queryMock.mockReset();
		mutationMock.mockReset();
		syncGoogleGroupsForRoleWithAuditMock.mockReset();
		findLogtoUserByEmailMock.mockReset();
		syncOfficerRolesOnLogtoUserMock.mockReset();
		syncGoogleGroupsForRoleWithAuditMock.mockResolvedValue({
			googleGroupUpdated: true,
			googleGroup: "generalofficers@ieeeatucsd.org",
			warnings: [],
		});
	});

	it("updates an existing General Officer by id and syncs Logto and Google Groups", async () => {
		queryMock.mockResolvedValue({
			_id: "user-1",
			email: "person@ucsd.edu",
			logtoId: "logto-target",
		});
		mutationMock.mockResolvedValue("user-1");
		const { syncUserRole } = await import("@/server/user-role-sync");

		const result = await syncUserRole({
			actorLogtoId: "admin-logto",
			actorRole: "Administrator",
			userId: "user-1",
			role: "General Officer",
			position: "Project Lead",
			team: "Projects",
			source: "manage-users",
		});

		expect(mutationMock).toHaveBeenCalledWith("users:updateRole", {
			logtoId: "admin-logto",
			authToken: expect.any(String),
			userId: "user-1",
			role: "General Officer",
			position: "Project Lead",
			team: "Projects",
		});
		expect(syncOfficerRolesOnLogtoUserMock).toHaveBeenCalledWith(
			"logto-target",
			"General Officer",
		);
		expect(syncGoogleGroupsForRoleWithAuditMock).toHaveBeenCalledWith(
			expect.anything(),
			"person@ucsd.edu",
			"General Officer",
		);
		expect(result).toEqual({
			convexUpdated: true,
			logtoUpdated: true,
			googleGroupUpdated: true,
			googleGroup: "generalofficers@ieeeatucsd.org",
			warnings: [],
		});
	});

	it.each([
		["Executive Officer", "executiveofficers@ieeeatucsd.org"],
		["Administrator", "executiveofficers@ieeeatucsd.org"],
	])("syncs %s by email through Logto lookup", async (role, group) => {
		queryMock.mockResolvedValue({
			_id: "user-1",
			email: "person@ucsd.edu",
		});
		mutationMock.mockResolvedValue("user-1");
		findLogtoUserByEmailMock.mockResolvedValue({ id: "logto-target" });
		syncGoogleGroupsForRoleWithAuditMock.mockResolvedValue({
			googleGroupUpdated: true,
			googleGroup: group,
			warnings: [],
		});
		const { syncUserRole } = await import("@/server/user-role-sync");

		const result = await syncUserRole({
			actorLogtoId: "admin-logto",
			actorRole: "Administrator",
			email: "Person@UCSD.edu",
			role,
			source: "manage-users",
		});

		expect(findLogtoUserByEmailMock).toHaveBeenCalledWith("person@ucsd.edu");
		expect(syncOfficerRolesOnLogtoUserMock).toHaveBeenCalledWith(
			"logto-target",
			role,
		);
		expect(syncGoogleGroupsForRoleWithAuditMock).toHaveBeenCalledWith(
			expect.anything(),
			"person@ucsd.edu",
			role,
		);
		expect(result.googleGroup).toBe(group);
	});

	it("creates an onboarding placeholder and treats a missing Logto user as a warning", async () => {
		queryMock.mockResolvedValue(null);
		mutationMock.mockResolvedValue("new-user-id");
		findLogtoUserByEmailMock.mockResolvedValue(null);
		syncGoogleGroupsForRoleWithAuditMock.mockResolvedValue({
			googleGroupUpdated: true,
			googleGroup: null,
			warnings: [],
		});
		const { syncUserRole } = await import("@/server/user-role-sync");

		const result = await syncUserRole({
			actorLogtoId: "admin-logto",
			actorRole: "Executive Officer",
			email: "newperson@ucsd.edu",
			name: "New Person",
			role: "Member",
			source: "onboarding",
		});

		expect(mutationMock).toHaveBeenCalledWith("users:createPlaceholder", {
			logtoId: "admin-logto",
			authToken: expect.any(String),
			email: "newperson@ucsd.edu",
			name: "New Person",
			role: "Member",
			position: undefined,
			team: undefined,
		});
		expect(syncOfficerRolesOnLogtoUserMock).not.toHaveBeenCalled();
		expect(syncGoogleGroupsForRoleWithAuditMock).toHaveBeenCalledWith(
			expect.anything(),
			"newperson@ucsd.edu",
			"Member",
		);
		expect(result).toEqual({
			convexUpdated: true,
			logtoUpdated: false,
			googleGroupUpdated: true,
			googleGroup: null,
			warnings: ["No Logto user found for email 'newperson@ucsd.edu'"],
		});
	});

	it("returns Google Groups warnings while preserving a successful Convex update", async () => {
		queryMock.mockResolvedValue({
			_id: "user-1",
			email: "person@ucsd.edu",
			logtoId: "logto-target",
		});
		mutationMock.mockResolvedValue("user-1");
		syncGoogleGroupsForRoleWithAuditMock.mockResolvedValue({
			googleGroupUpdated: false,
			googleGroup: "pastofficers@ieeeatucsd.org",
			warnings: ["Failed to sync Google Groups: permission denied"],
		});
		const { syncUserRole } = await import("@/server/user-role-sync");

		const result = await syncUserRole({
			actorLogtoId: "admin-logto",
			actorRole: "Administrator",
			userId: "user-1",
			role: "Past Officer",
			source: "manage-users",
		});

		expect(result).toEqual({
			convexUpdated: true,
			logtoUpdated: true,
			googleGroupUpdated: false,
			googleGroup: "pastofficers@ieeeatucsd.org",
			warnings: ["Failed to sync Google Groups: permission denied"],
		});
	});
});
