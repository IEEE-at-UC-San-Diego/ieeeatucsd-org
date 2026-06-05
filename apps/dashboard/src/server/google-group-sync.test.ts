import { beforeEach, describe, expect, it, vi } from "vitest";

const syncGoogleGroupsForRoleMock = vi.fn();

vi.mock("@/server/google-groups", () => ({
	getGoogleGroupForRole: (role: string) => {
		const map: Record<string, string> = {
			"Executive Officer": "executiveofficers@ieeeatucsd.org",
			Administrator: "executiveofficers@ieeeatucsd.org",
			"General Officer": "generalofficers@ieeeatucsd.org",
			"Past Officer": "pastofficers@ieeeatucsd.org",
		};
		return map[role] || null;
	},
	getGoogleGroupSyncPlan: (role: string) => {
		const map: Record<string, string> = {
			"Executive Officer": "executiveofficers@ieeeatucsd.org",
			Administrator: "executiveofficers@ieeeatucsd.org",
			"General Officer": "generalofficers@ieeeatucsd.org",
			"Past Officer": "pastofficers@ieeeatucsd.org",
		};
		const targetGroup = map[role] || null;
		return {
			targetGroup,
			groupsToRemove: [
				"executiveofficers@ieeeatucsd.org",
				"generalofficers@ieeeatucsd.org",
				"pastofficers@ieeeatucsd.org",
			].filter((group) => group !== targetGroup),
		};
	},
	syncGoogleGroupsForRole: syncGoogleGroupsForRoleMock,
}));

describe("syncGoogleGroupsForRoleWithAudit", () => {
	beforeEach(() => {
		syncGoogleGroupsForRoleMock.mockReset();
	});

	it("normalizes email, audits each Google Groups result, and returns success metadata", async () => {
		const mutation = vi.fn().mockResolvedValue("audit-id");
		syncGoogleGroupsForRoleMock.mockResolvedValue([
			{ group: "generalofficers@ieeeatucsd.org", added: true },
			{ group: "executiveofficers@ieeeatucsd.org", removed: true },
		]);
		const { syncGoogleGroupsForRoleWithAudit } = await import(
			"@/server/google-group-sync"
		);

		const result = await syncGoogleGroupsForRoleWithAudit(
			{ mutation } as never,
			" Person@UCSD.edu ",
			"General Officer",
		);

		expect(syncGoogleGroupsForRoleMock).toHaveBeenCalledWith(
			"person@ucsd.edu",
			"General Officer",
		);
		expect(mutation).toHaveBeenCalledTimes(2);
		expect(mutation).toHaveBeenCalledWith("googleGroupAssignments:create", {
			email: "person@ucsd.edu",
			googleGroup: "generalofficers@ieeeatucsd.org",
			role: "General Officer",
			success: true,
			error: undefined,
		});
		expect(result).toEqual({
			googleGroupUpdated: true,
			googleGroup: "generalofficers@ieeeatucsd.org",
			warnings: [],
		});
	});

	it("does not fail the sync when audit logging fails", async () => {
		const mutation = vi.fn().mockRejectedValue(new Error("audit failed"));
		syncGoogleGroupsForRoleMock.mockResolvedValue([
			{ group: "pastofficers@ieeeatucsd.org", added: true },
		]);
		const { syncGoogleGroupsForRoleWithAudit } = await import(
			"@/server/google-group-sync"
		);

		const result = await syncGoogleGroupsForRoleWithAudit(
			{ mutation } as never,
			"person@ucsd.edu",
			"Past Officer",
		);

		expect(result).toEqual({
			googleGroupUpdated: true,
			googleGroup: "pastofficers@ieeeatucsd.org",
			warnings: [],
		});
	});

	it("returns warnings when Google Groups reports an operation error", async () => {
		const mutation = vi.fn().mockResolvedValue("audit-id");
		syncGoogleGroupsForRoleMock.mockResolvedValue([
			{ group: "executiveofficers@ieeeatucsd.org", error: "permission denied" },
			{ group: "generalofficers@ieeeatucsd.org", removed: true },
		]);
		const { syncGoogleGroupsForRoleWithAudit } = await import(
			"@/server/google-group-sync"
		);

		const result = await syncGoogleGroupsForRoleWithAudit(
			{ mutation } as never,
			"person@ucsd.edu",
			"Executive Officer",
		);

		expect(result).toEqual({
			googleGroupUpdated: false,
			googleGroup: "executiveofficers@ieeeatucsd.org",
			warnings: [
				"Failed to sync Google Groups: executiveofficers@ieeeatucsd.org: permission denied",
			],
		});
	});
});
