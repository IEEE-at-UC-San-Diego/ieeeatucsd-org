import { afterEach, describe, expect, it, vi } from "vitest";

import { createIEEEEmail } from "./mxroute";

function postedUser(fetchMock: ReturnType<typeof vi.fn>) {
	const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
	const body = init?.body;
	if (!(body instanceof URLSearchParams)) {
		throw new Error("MXRoute request did not send form fields");
	}
	return body.get("user");
}

describe("createIEEEEmail mailbox name", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it.each(["Alice", "ALICE", "aLiCe"])(
		"keeps letters from %s as the lowercase mailbox alice",
		async (username) => {
			vi.stubEnv("MXROUTE_LOGIN_KEY", "key");
			vi.stubEnv("MXROUTE_SERVER_LOGIN", "login");
			vi.stubEnv("MXROUTE_SERVER_URL", "https://mx.example.test");
			vi.stubEnv("MXROUTE_EMAIL_DOMAIN", "ieee.example");
			const fetchMock = vi.fn(
				async () => new Response("error=0", { status: 200 }),
			);
			vi.stubGlobal("fetch", fetchMock);

			const result = await createIEEEEmail({
				username,
				password: "secret",
			});

			expect(result).toEqual({
				success: true,
				ieeeEmail: "alice@ieee.example",
			});
			expect(postedUser(fetchMock)).toBe("alice");
		},
	);
});
