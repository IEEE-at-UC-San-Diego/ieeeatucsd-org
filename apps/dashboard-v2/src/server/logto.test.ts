import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
	env: {
		LOGTO_ENDPOINT: "https://logto.example",
		LOGTO_M2M_APP_ID: "m2m-app",
		LOGTO_M2M_APP_SECRET: "m2m-secret",
	},
}));

const roleIds: Record<string, string> = {
	Member: "role-member",
	"General Officer": "role-general-officer",
	"Executive Officer": "role-executive-officer",
	"Member at Large": "role-member-at-large",
	"Past Officer": "role-past-officer",
	Sponsor: "role-sponsor",
	Administrator: "role-administrator",
	Unrelated: "role-unrelated",
};

const knownRoles = Object.entries(roleIds).map(([name, id]) => ({ name, id }));

function okJson(data: unknown) {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function okText(data = "") {
	return new Response(data, { status: 200 });
}

async function importLogtoWithFetch(fetchMock: ReturnType<typeof vi.fn>) {
	vi.resetModules();
	vi.stubGlobal("fetch", fetchMock);
	return await import("./logto");
}

describe("syncAppRoleOnLogtoUser", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it("assigns the target role and removes every other known IEEE role", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.endsWith("/oidc/token"))
					return okJson({ access_token: "token", expires_in: 3600 });
				if (url.includes("/api/roles?page=1&page_size=100"))
					return okJson(knownRoles);
				if (init?.method === "POST") return okText();
				if (init?.method === "DELETE") return okText();
				return okText();
			},
		);
		const { syncAppRoleOnLogtoUser } = await importLogtoWithFetch(fetchMock);

		await syncAppRoleOnLogtoUser("logto-user", "Executive Officer");

		expect(fetchMock).toHaveBeenCalledWith(
			"https://logto.example/api/roles/role-executive-officer/users",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ userIds: ["logto-user"] }),
			}),
		);
		for (const [roleName, roleId] of Object.entries(roleIds)) {
			if (roleName === "Executive Officer" || roleName === "Unrelated")
				continue;
			expect(fetchMock).toHaveBeenCalledWith(
				`https://logto.example/api/roles/${roleId}/users/logto-user`,
				expect.objectContaining({ method: "DELETE" }),
			);
		}
	});

	it("does not remove unrelated Logto roles", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.endsWith("/oidc/token"))
					return okJson({ access_token: "token", expires_in: 3600 });
				if (url.includes("/api/roles?page=1&page_size=100"))
					return okJson(knownRoles);
				if (init?.method === "POST" || init?.method === "DELETE")
					return okText();
				return okText();
			},
		);
		const { syncAppRoleOnLogtoUser } = await importLogtoWithFetch(fetchMock);

		await syncAppRoleOnLogtoUser("logto-user", "Administrator");

		expect(fetchMock).not.toHaveBeenCalledWith(
			"https://logto.example/api/roles/role-unrelated/users/logto-user",
			expect.anything(),
		);
	});

	it("ignores target role already-assigned responses", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.endsWith("/oidc/token"))
					return okJson({ access_token: "token", expires_in: 3600 });
				if (url.includes("/api/roles?page=1&page_size=100"))
					return okJson(knownRoles);
				if (init?.method === "POST") {
					return new Response(JSON.stringify({ code: "role.user_exists" }), {
						status: 422,
					});
				}
				if (init?.method === "DELETE") return okText();
				return okText();
			},
		);
		const { syncAppRoleOnLogtoUser } = await importLogtoWithFetch(fetchMock);

		await expect(
			syncAppRoleOnLogtoUser("logto-user", "Member"),
		).resolves.toBeUndefined();
	});

	it("ignores missing stale role removals", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.endsWith("/oidc/token"))
					return okJson({ access_token: "token", expires_in: 3600 });
				if (url.includes("/api/roles?page=1&page_size=100"))
					return okJson(knownRoles);
				if (init?.method === "POST") return okText();
				if (init?.method === "DELETE") return new Response("", { status: 404 });
				return okText();
			},
		);
		const { syncAppRoleOnLogtoUser } = await importLogtoWithFetch(fetchMock);

		await expect(
			syncAppRoleOnLogtoUser("logto-user", "Sponsor"),
		).resolves.toBeUndefined();
	});

	it("throws when target role assignment fails", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.endsWith("/oidc/token"))
					return okJson({ access_token: "token", expires_in: 3600 });
				if (url.includes("/api/roles?page=1&page_size=100"))
					return okJson(knownRoles);
				if (init?.method === "POST")
					return new Response("assign failed", { status: 500 });
				return okText();
			},
		);
		const { syncAppRoleOnLogtoUser } = await importLogtoWithFetch(fetchMock);

		await expect(
			syncAppRoleOnLogtoUser("logto-user", "Past Officer"),
		).rejects.toThrow("Failed to assign Logto role");
	});
});
