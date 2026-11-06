import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const resetEmailPasswordMock = vi.fn();

vi.mock("@/server/auth", () => ({
	requireApiAuth: (...args: unknown[]) => requireApiAuthMock(...args),
}));

vi.mock("@/server/mxroute", () => ({
	resetEmailPassword: (...args: unknown[]) => resetEmailPasswordMock(...args),
}));

function post(email: string, password = "new-secret") {
	return new Request("http://localhost/api/reset-email-password", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
}

describe("POST /api/reset-email-password", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("MXROUTE_EMAIL_DOMAIN", "ieeeatucsd.org");
		resetEmailPasswordMock.mockResolvedValue({ success: true });
	});

	it("refuses a member reset of another mailbox even when ieeeEmail matches it", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { email: "president@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada@ucsd.edu",
				ieeeEmail: "president@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("president@ieeeatucsd.org"),
		});

		expect(response.status).toBe(403);
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();
	});

	it("resets the mailbox derived from the member login and ignores ieeeEmail", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { email: "AdaLovelace@IEEEATUCSD.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "Ada.Lovelace@ucsd.edu",
				ieeeEmail: "president@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("AdaLovelace@IEEEATUCSD.org"),
		});
		const payload = (await response.json()) as { success: boolean };

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(resetEmailPasswordMock).toHaveBeenCalledWith({
			email: "AdaLovelace@IEEEATUCSD.org",
			password: "new-secret",
		});
	});

	it("lets an officer reset a mailbox they do not own", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { email: "president@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "General Officer",
				email: "ada@ucsd.edu",
				ieeeEmail: "ada@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("president@ieeeatucsd.org"),
		});

		expect(response.status).toBe(200);
		expect(resetEmailPasswordMock).toHaveBeenCalledOnce();
	});
});
