import { describe, expect, it } from "vitest";
import { hasAdminAccess, type UserRole } from "../../convex/permissions";

const ROLES: UserRole[] = [
	"Member",
	"General Officer",
	"Executive Officer",
	"Member at Large",
	"Past Officer",
	"Sponsor",
	"Administrator",
];

describe("members CSV export access", () => {
	it("matches the Manage Users list gate (admin or executive only)", () => {
		const allowed = ROLES.filter((role) => hasAdminAccess(role));
		const denied = ROLES.filter((role) => !hasAdminAccess(role));

		expect(allowed).toEqual(["Executive Officer", "Administrator"]);
		expect(denied).toEqual([
			"Member",
			"General Officer",
			"Member at Large",
			"Past Officer",
			"Sponsor",
		]);
	});
});
