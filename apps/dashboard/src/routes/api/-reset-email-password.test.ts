import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchingMailboxHolderIds } from "../../../convex/mailboxClaim";

const requireApiAuthMock = vi.fn();
const resetEmailPasswordMock = vi.fn();
const mailboxTakenMock = vi.fn();
const migrationGateMock = vi.fn();

vi.mock("@/server/auth", () => ({
	requireApiAuth: (...args: unknown[]) => requireApiAuthMock(...args),
}));

vi.mock("@/server/mxroute", () => ({
	resetEmailPassword: (...args: unknown[]) => resetEmailPasswordMock(...args),
}));

vi.mock("@/server/mailbox-binding", () => ({
	isMailboxBoundToAnotherAccount: (...args: unknown[]) =>
		mailboxTakenMock(...args),
	mailboxMigrationGate: (...args: unknown[]) => migrationGateMock(...args),
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
		mailboxTakenMock.mockResolvedValue(false);
		migrationGateMock.mockResolvedValue({ done: true, collision: false });
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

	it("resets the mailbox bound to this login when no other account holds it", async () => {
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-lovelace",
			body: { email: "AdaLovelace@IEEEATUCSD.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "Ada.Lovelace@ucsd.edu",
				ieeeEmail: "adalovelace@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("AdaLovelace@IEEEATUCSD.org"),
		});
		const payload = (await response.json()) as { success: boolean };

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mailboxTakenMock).toHaveBeenCalledWith({
			logtoId: "ada-lovelace",
			role: "Member",
			ieeeEmail: "adalovelace@ieeeatucsd.org",
			rawValues: ["AdaLovelace@IEEEATUCSD.org", "adalovelace@ieeeatucsd.org"],
		});
		expect(resetEmailPasswordMock).toHaveBeenCalledWith({
			email: "AdaLovelace@IEEEATUCSD.org",
			password: "new-secret",
		});
	});

	it("refuses a login that only shares a normalized mailbox local part", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { email: "ada@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada@another-domain.example",
				ieeeEmail: "not-ada@another-domain.example",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("ada@ieeeatucsd.org"),
		});

		expect(response.status).toBe(403);
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();
	});

	it("refuses a login that already stored the colliding mailbox when another account holds it", async () => {
		mailboxTakenMock.mockResolvedValue(true);
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-other",
			body: { email: "ada@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada@another-domain.example",
				ieeeEmail: "ada@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("ada@ieeeatucsd.org"),
		});

		expect(response.status).toBe(403);
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();
	});

	it("refuses a punctuation-stripped login when another account holds the mailbox", async () => {
		mailboxTakenMock.mockResolvedValue(true);
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-smith-plain",
			body: { email: "adasmith@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada.smith@ucsd.edu",
				ieeeEmail: "adasmith@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("adasmith@ieeeatucsd.org"),
		});

		expect(response.status).toBe(403);
		expect(mailboxTakenMock).toHaveBeenCalledWith({
			logtoId: "ada-smith-plain",
			role: "Member",
			ieeeEmail: "adasmith@ieeeatucsd.org",
			rawValues: ["adasmith@ieeeatucsd.org", "adasmith@ieeeatucsd.org"],
		});
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();
	});

	it("refuses a reset of a case variant another account already holds", async () => {
		mailboxTakenMock.mockImplementation(
			async (args: { ieeeEmail?: string }) => {
				const holderIds = matchingMailboxHolderIds(String(args.ieeeEmail), [
					{ id: "owner", ieeeEmail: "Ada@ieeeatucsd.org" },
				]);
				return holderIds.some((id) => id !== "intruder");
			},
		);
		requireApiAuthMock.mockResolvedValue({
			logtoId: "intruder",
			body: { email: "Ada@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada@another-domain.example",
				ieeeEmail: "ada@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("Ada@ieeeatucsd.org"),
		});

		expect(response.status).toBe(403);
		expect(mailboxTakenMock).toHaveBeenCalledWith({
			logtoId: "intruder",
			role: "Member",
			ieeeEmail: "ada@ieeeatucsd.org",
			rawValues: ["Ada@ieeeatucsd.org", "ada@ieeeatucsd.org"],
		});
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();
	});

	it("refuses a lowercase reset before the mailbox migration is done", async () => {
		migrationGateMock.mockResolvedValue({ done: false, collision: false });
		mailboxTakenMock.mockResolvedValue(false);
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-other",
			body: { email: "ada@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada@another-domain.example",
				ieeeEmail: "ada@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("ada@ieeeatucsd.org"),
		});

		expect(response.status).toBe(403);
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();
	});

	it("refuses a collided mailbox after the migration is done", async () => {
		migrationGateMock.mockResolvedValue({ done: true, collision: true });
		mailboxTakenMock.mockResolvedValue(false);
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-lovelace",
			body: { email: "ada@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "ada@ucsd.edu",
				ieeeEmail: "ada@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const response = await handle({
			request: post("ada@ieeeatucsd.org"),
		});

		expect(response.status).toBe(403);
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();
	});

	it("allows the same owner reset once the mailbox migration is done", async () => {
		migrationGateMock.mockResolvedValueOnce({ done: false, collision: false });
		requireApiAuthMock.mockResolvedValue({
			logtoId: "ada-lovelace",
			body: { email: "adalovelace@ieeeatucsd.org", password: "new-secret" },
			user: {
				role: "Member",
				email: "Ada.Lovelace@ucsd.edu",
				ieeeEmail: "adalovelace@ieeeatucsd.org",
			},
		});

		const { handle } = await import("./reset-email-password");
		const closed = await handle({
			request: post("adalovelace@ieeeatucsd.org"),
		});
		expect(closed.status).toBe(403);
		expect(resetEmailPasswordMock).not.toHaveBeenCalled();

		migrationGateMock.mockResolvedValueOnce({ done: true, collision: false });
		const open = await handle({
			request: post("adalovelace@ieeeatucsd.org"),
		});
		expect(open.status).toBe(200);
		expect(resetEmailPasswordMock).toHaveBeenCalledOnce();
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
		expect(migrationGateMock).not.toHaveBeenCalled();
		expect(mailboxTakenMock).not.toHaveBeenCalled();
		expect(resetEmailPasswordMock).toHaveBeenCalledOnce();
	});
});
