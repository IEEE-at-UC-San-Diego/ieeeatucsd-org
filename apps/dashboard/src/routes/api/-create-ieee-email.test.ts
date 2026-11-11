import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const createIEEEEmailMock = vi.fn();
const migrationGateMock = vi.fn();

vi.mock("@/server/auth", () => ({
	requireApiAuth: (...args: unknown[]) => requireApiAuthMock(...args),
}));

vi.mock("@/server/mxroute", () => ({
	createIEEEEmail: (...args: unknown[]) => createIEEEEmailMock(...args),
}));

vi.mock("@/server/mailbox-binding", () => ({
	mailboxMigrationGate: (...args: unknown[]) => migrationGateMock(...args),
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
		vi.stubEnv("MXROUTE_EMAIL_DOMAIN", "ieeeatucsd.org");
		createIEEEEmailMock.mockResolvedValue({ success: true });
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
});
