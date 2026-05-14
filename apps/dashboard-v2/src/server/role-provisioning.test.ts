import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findLogtoUserByEmail: vi.fn(),
	syncAppRoleOnLogtoUser: vi.fn(),
	syncGoogleGroupsForRoleWithAudit: vi.fn(),
}));

vi.mock("@/server/logto", () => ({
	findLogtoUserByEmail: mocks.findLogtoUserByEmail,
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
	syncAppRoleOnLogtoUser: mocks.syncAppRoleOnLogtoUser,
}));

vi.mock("@/server/google-group-sync", () => ({
	syncGoogleGroupsForRoleWithAudit: mocks.syncGoogleGroupsForRoleWithAudit,
}));

describe("syncExternalAccessForRole", () => {
	beforeEach(() => {
		mocks.findLogtoUserByEmail.mockReset();
		mocks.syncAppRoleOnLogtoUser.mockReset();
		mocks.syncGoogleGroupsForRoleWithAudit.mockReset();
		mocks.syncGoogleGroupsForRoleWithAudit.mockResolvedValue({
			googleGroupUpdated: true,
			googleGroup: "generalofficers@ieeeatucsd.org",
			warnings: [],
		});
	});

	it("uses a provided Logto user id without looking up by email", async () => {
		const { syncExternalAccessForRole } = await import("./role-provisioning");

		const result = await syncExternalAccessForRole({
			convex: {} as never,
			email: " Person@UCSD.edu ",
			role: "General Officer",
			logtoUserId: "logto-user",
		});

		expect(mocks.findLogtoUserByEmail).not.toHaveBeenCalled();
		expect(mocks.syncAppRoleOnLogtoUser).toHaveBeenCalledWith(
			"logto-user",
			"General Officer",
		);
		expect(mocks.syncGoogleGroupsForRoleWithAudit).toHaveBeenCalledWith(
			{},
			"person@ucsd.edu",
			"General Officer",
		);
		expect(result).toEqual({
			logtoUpdated: true,
			googleGroupUpdated: true,
			googleGroup: "generalofficers@ieeeatucsd.org",
			warnings: [],
		});
	});

	it("falls back to Logto lookup by normalized email", async () => {
		mocks.findLogtoUserByEmail.mockResolvedValue({ id: "found-logto-user" });
		const { syncExternalAccessForRole } = await import("./role-provisioning");

		await syncExternalAccessForRole({
			convex: {} as never,
			email: "Officer@UCSD.edu",
			role: "Executive Officer",
		});

		expect(mocks.findLogtoUserByEmail).toHaveBeenCalledWith("officer@ucsd.edu");
		expect(mocks.syncAppRoleOnLogtoUser).toHaveBeenCalledWith(
			"found-logto-user",
			"Executive Officer",
		);
	});

	it("returns a warning when no Logto user exists and still syncs Google Groups", async () => {
		mocks.findLogtoUserByEmail.mockResolvedValue(null);
		const { syncExternalAccessForRole } = await import("./role-provisioning");

		const result = await syncExternalAccessForRole({
			convex: {} as never,
			email: "missing@ucsd.edu",
			role: "Past Officer",
		});

		expect(mocks.syncAppRoleOnLogtoUser).not.toHaveBeenCalled();
		expect(mocks.syncGoogleGroupsForRoleWithAudit).toHaveBeenCalledWith(
			{},
			"missing@ucsd.edu",
			"Past Officer",
		);
		expect(result.warnings).toEqual([
			"No Logto user found for email 'missing@ucsd.edu'",
		]);
	});

	it("combines Logto and Google Groups warnings", async () => {
		mocks.findLogtoUserByEmail.mockResolvedValue({ id: "found-logto-user" });
		mocks.syncAppRoleOnLogtoUser.mockRejectedValue(
			new Error("Logto unavailable"),
		);
		mocks.syncGoogleGroupsForRoleWithAudit.mockResolvedValue({
			googleGroupUpdated: false,
			googleGroup: "executiveofficers@ieeeatucsd.org",
			warnings: ["Failed to sync Google Groups: permission denied"],
		});
		const { syncExternalAccessForRole } = await import("./role-provisioning");

		const result = await syncExternalAccessForRole({
			convex: {} as never,
			email: "exec@ucsd.edu",
			role: "Administrator",
		});

		expect(result).toEqual({
			logtoUpdated: false,
			googleGroupUpdated: false,
			googleGroup: "executiveofficers@ieeeatucsd.org",
			warnings: [
				"Failed to sync role to Logto: Logto unavailable",
				"Failed to sync Google Groups: permission denied",
			],
		});
	});

	it("returns a no-op warning for unsupported roles", async () => {
		const { syncExternalAccessForRole } = await import("./role-provisioning");

		const result = await syncExternalAccessForRole({
			convex: {} as never,
			email: "person@ucsd.edu",
			role: "Unknown",
		});

		expect(mocks.findLogtoUserByEmail).not.toHaveBeenCalled();
		expect(mocks.syncAppRoleOnLogtoUser).not.toHaveBeenCalled();
		expect(mocks.syncGoogleGroupsForRoleWithAudit).not.toHaveBeenCalled();
		expect(result).toEqual({
			logtoUpdated: false,
			googleGroupUpdated: false,
			googleGroup: null,
			warnings: ["Unsupported role 'Unknown' for external access sync"],
		});
	});
});
