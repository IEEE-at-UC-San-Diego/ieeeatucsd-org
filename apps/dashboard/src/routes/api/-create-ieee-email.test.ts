import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const createIEEEEmailMock = vi.fn();
const migrationGateMock = vi.fn();
const steps: string[] = [];
const bindings = new Map<string, { email: string; claimToken: string }>();
let claimCount = 0;
let onSecondClaim: (() => void) | undefined;
const releasedClaims: string[] = [];

vi.mock("@/server/auth", () => ({
	requireApiAuth: (...args: unknown[]) => requireApiAuthMock(...args),
}));

vi.mock("@/server/mxroute", () => ({
	createIEEEEmail: (...args: unknown[]) => createIEEEEmailMock(...args),
}));

vi.mock("@/server/mailbox-binding", () => ({
	mailboxMigrationGate: (...args: unknown[]) => migrationGateMock(...args),
}));

vi.mock("@/server/convex-session", () => ({
	createConvexSessionToken: () => ({ token: "session" }),
}));

vi.mock("convex/browser", () => ({
	ConvexHttpClient: class {
		async mutation(
			fn: unknown,
			args: { logtoId?: string; ieeeEmail?: string; claimToken?: string },
		) {
			const name = String(fn);
			steps.push(name);
			if (name.endsWith("setIEEEEmail") && args.logtoId && args.ieeeEmail) {
				claimCount += 1;
				const claimToken = `claim-${claimCount}`;
				bindings.set(args.logtoId, {
					email: args.ieeeEmail,
					claimToken,
				});
				if (claimCount === 2) onSecondClaim?.();
				return claimToken;
			}
			if (name.endsWith("releaseIEEEEmail") && args.logtoId) {
				releasedClaims.push(args.claimToken ?? "");
				const row = bindings.get(args.logtoId);
				if (
					row &&
					row.email === args.ieeeEmail &&
					row.claimToken === args.claimToken
				) {
					bindings.delete(args.logtoId);
				}
			}
			return null;
		}
	},
}));

function post(username: string) {
	return new Request("http://localhost/api/create-ieee-email", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password: "new-secret" }),
	});
}

describe("POST /api/create-ieee-email", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		steps.length = 0;
		bindings.clear();
		claimCount = 0;
		onSecondClaim = undefined;
		releasedClaims.length = 0;
		vi.stubEnv("MXROUTE_EMAIL_DOMAIN", "ieeeatucsd.org");
		vi.stubEnv("CONVEX_URL", "http://127.0.0.1:3210");
		createIEEEEmailMock.mockImplementation(async () => {
			steps.push("provision");
			return { success: true, ieeeEmail: "placeholder@ieeeatucsd.org" };
		});
		migrationGateMock.mockResolvedValue({ done: true, collision: false });
	});

	it("does not create a mailbox for a member before the migration is done", async () => {
		migrationGateMock.mockResolvedValue({ done: false, collision: false });
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-lovelace",
			body: { username: "Ada.Lovelace", password: "new-secret" },
			user: { role: "Member", email: "Ada.Lovelace@ucsd.edu" },
		});

		const { handle } = await import("./create-ieee-email");
		const response = await handle({ request: post("Ada.Lovelace") });

		expect(response.status).toBe(403);
		expect(createIEEEEmailMock).not.toHaveBeenCalled();
	});

	it("lets an officer create a mailbox before the migration is done", async () => {
		migrationGateMock.mockResolvedValue({ done: false, collision: false });
		requireApiAuthMock.mockResolvedValue({
			logtoId: "officer",
			body: { username: "ada", password: "new-secret" },
			user: { role: "General Officer", email: "ada@ucsd.edu" },
		});

		const { handle } = await import("./create-ieee-email");
		const response = await handle({ request: post("ada") });

		expect(response.status).toBe(200);
		expect(migrationGateMock).not.toHaveBeenCalled();
		expect(createIEEEEmailMock).toHaveBeenCalledOnce();
		expect(steps[0]).toBe("users:setIEEEEmail");
		expect(bindings.get("officer")?.email).toBe("ada@ieeeatucsd.org");
		expect(steps).not.toContain("mailboxRelease:releaseIEEEEmail");
	});

	it("leaves no mailbox binding when provisioning fails", async () => {
		createIEEEEmailMock.mockImplementation(async () => {
			steps.push("provision");
			throw new Error("Failed to create email account");
		});
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-lovelace",
			body: { username: "Ada.Lovelace", password: "new-secret" },
			user: { role: "Member", email: "Ada.Lovelace@ucsd.edu" },
		});

		const { handle } = await import("./create-ieee-email");
		const response = await handle({ request: post("Ada.Lovelace") });

		expect(response.status).toBe(500);
		expect(bindings.size).toBe(0);
		expect(steps).toEqual([
			"users:setIEEEEmail",
			"provision",
			"mailboxRelease:releaseIEEEEmail",
		]);
	});

	it("treats an existing MXRoute mailbox for this owner as created", async () => {
		createIEEEEmailMock.mockImplementation(async () => {
			steps.push("provision");
			throw new Error("Email address ada@ieeeatucsd.org already exists.");
		});
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada",
			body: { username: "ada", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada@ucsd.edu",
				ieeeEmail: "ADA@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./create-ieee-email");
		const response = await handle({ request: post("ada") });

		expect(response.status).toBe(200);
		expect(bindings.get("ada")?.email).toBe("ada@ieeeatucsd.org");
		expect(steps).toEqual(["users:setIEEEEmail", "provision"]);
	});

	it("keeps the binding when an overlapping create fails", async () => {
		let provisions = 0;
		let markFirstProvisionWaiting: () => void = () => {};
		const firstProvisionWaiting = new Promise<void>((resolve) => {
			markFirstProvisionWaiting = resolve;
		});
		let markSecondClaimed: () => void = () => {};
		const secondClaimed = new Promise<void>((resolve) => {
			markSecondClaimed = resolve;
		});
		onSecondClaim = markSecondClaimed;
		createIEEEEmailMock.mockImplementation(async () => {
			provisions += 1;
			if (provisions === 1) {
				markFirstProvisionWaiting();
				await secondClaimed;
				throw new Error("Failed to create email account");
			}
			return { success: true, ieeeEmail: "ada@ieeeatucsd.org" };
		});
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada",
			body: { username: "ada", password: "new-secret" },
			user: { role: "Member", email: "ada@ucsd.edu" },
		});

		const { handle } = await import("./create-ieee-email");
		const first = handle({ request: post("ada") });
		await firstProvisionWaiting;
		const second = handle({ request: post("ada") });
		const [failed, created] = await Promise.all([first, second]);

		expect(failed.status).toBe(500);
		expect(created.status).toBe(200);
		expect(releasedClaims).toEqual(["claim-1"]);
		expect(bindings.get("ada")?.email).toBe("ada@ieeeatucsd.org");
		expect(bindings.get("ada")?.claimToken).toBe("claim-2");
	});
});
