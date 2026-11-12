import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiAuthMock = vi.fn();

vi.mock("@/server/auth", () => ({
	requireApiAuth: (...args: unknown[]) => requireApiAuthMock(...args),
	isAiEnabledForUser: (user: { aiFeaturesEnabled?: boolean } | null) =>
		user?.aiFeaturesEnabled !== false,
	createAiDisabledResponse: () =>
		new Response(
			JSON.stringify({
				error: "AI features are disabled for this account",
				code: "AI_DISABLED_BY_USER",
			}),
			{ status: 403, headers: { "Content-Type": "application/json" } },
		),
}));

const JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

function modelResponse() {
	return new Response(
		JSON.stringify({
			choices: [
				{
					message: {
						content: JSON.stringify({
							vendorName: "Campus Cafe",
							total: 4.5,
						}),
					},
				},
			],
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

describe("POST /api/parse-receipt", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.stubEnv("OPENROUTER_API_KEY", "test-key");
	});

	it("sends the receipt to google/gemini-3.8-flash", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { imageUrl: JPEG_DATA_URL },
			user: { aiFeaturesEnabled: true },
		});
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(modelResponse());

		const { handle } = await import("./parse-receipt");
		const response = await handle({
			request: new Request("http://localhost/api/parse-receipt", {
				method: "POST",
				body: JSON.stringify({ imageUrl: JPEG_DATA_URL }),
			}),
		});

		expect(response.status).toBe(200);
		const init = (fetchMock.mock.calls.find(
			(call) =>
				typeof call[0] === "string" &&
				call[0].includes("openrouter.ai/api/v1/chat/completions"),
		)?.[1] ?? {}) as { body?: string };
		const body = JSON.parse(init.body ?? "{}") as {
			model?: string;
			temperature?: number;
			response_format?: { type?: string };
			reasoning?: { effort?: string; exclude?: boolean };
			plugins?: unknown;
		};
		expect(body.model).toBe("google/gemini-3.8-flash");
		expect(body.response_format).toEqual({ type: "json_object" });
		expect(body.temperature).toBe(0);
		expect(body.reasoning).toEqual({ effort: "low", exclude: true });
		expect(body.plugins).toBeUndefined();
	});

	it("passes an abort signal to OpenRouter", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { imageUrl: JPEG_DATA_URL },
			user: { aiFeaturesEnabled: true },
		});
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(modelResponse());

		const { handle } = await import("./parse-receipt");
		await handle({
			request: new Request("http://localhost/api/parse-receipt", {
				method: "POST",
				body: JSON.stringify({ imageUrl: JPEG_DATA_URL }),
			}),
		});

		const init = (fetchMock.mock.calls.find(
			(call) =>
				typeof call[0] === "string" &&
				call[0].includes("openrouter.ai/api/v1/chat/completions"),
		)?.[1] ?? {}) as { signal?: AbortSignal };
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("returns 504 when the OpenRouter fetch times out", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { imageUrl: JPEG_DATA_URL },
			user: { aiFeaturesEnabled: true },
		});
		vi.spyOn(globalThis, "fetch").mockRejectedValue(
			new DOMException(
				"The operation was aborted due to timeout",
				"TimeoutError",
			),
		);

		const { handle } = await import("./parse-receipt");
		const response = await handle({
			request: new Request("http://localhost/api/parse-receipt", {
				method: "POST",
				body: JSON.stringify({ imageUrl: JPEG_DATA_URL }),
			}),
		});

		expect(response.status).toBe(504);
		const payload = (await response.json()) as { error: string };
		expect(payload.error).toBe("The receipt scan timed out. Try again.");
	});
});
