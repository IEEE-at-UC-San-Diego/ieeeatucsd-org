import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const createIEEEEmailMock = vi.fn();
const migrationGateMock = vi.fn();
const steps: string[] = [];
const bindings = new Map<string, string>();

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
			args: { logtoId?: string; ieeeEmail?: string },
		) {
			const name = String(fn);
			steps.push(name);
			if (name.endsWith("setIEEEEmail") && args.logtoId && args.ieeeEmail) {
				bindings.set(args.logtoId, args.ieeeEmail);
			}
			if (name.endsWith("releaseIEEEEmail") && args.logtoId) {
				if (bindings.get(args.logtoId) === args.ieeeEmail) {
					bindings.delete(args.logtoId);
				}
			}
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
			body: { username: "president", password: "new-secret" },
			user: { role: "General Officer", email: "ada@ucsd.edu" },
		});

		const { handle } = await import("./create-ieee-email");
		const response = await handle({ request: post("president") });

		expect(response.status).toBe(200);
		expect(migrationGateMock).not.toHaveBeenCalled();
		expect(createIEEEEmailMock).toHaveBeenCalledOnce();
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
		expect(steps[0]).toBe("users:setIEEEEmail");
		expect(steps).toContain("provision");
		expect(steps.at(-1)).toBe("users:releaseIEEEEmail");
	});
});
