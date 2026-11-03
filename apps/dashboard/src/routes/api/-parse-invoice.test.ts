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

const PDF_DATA_URL = "data:application/pdf;base64,JVBERi0xLjQK";
const JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

const MODEL_INVOICE = {
	vendor: "Costco",
	items: [
		{
			description: "Pizza",
			quantity: 2,
			unitPrice: 10,
			total: 20,
		},
	],
	subtotal: 20,
	tax: 1.5,
	tip: 0,
	total: 21.5,
};

function modelResponse() {
	return new Response(
		JSON.stringify({
			choices: [
				{
					message: { content: JSON.stringify(MODEL_INVOICE) },
				},
			],
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

function sentFilePart(fetchMock: { mock: { calls: unknown[][] } }): {
	type?: string;
	file?: { file_data?: string };
} {
	const init = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
	const body = JSON.parse(init?.body ?? "{}") as {
		messages?: Array<{ content?: Array<Record<string, unknown>> }>;
	};
	return (body.messages?.[1]?.content?.[1] ?? {}) as {
		type?: string;
		file?: { file_data?: string };
	};
}

describe("POST /api/parse-invoice", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.stubEnv("OPENROUTER_API_KEY", "test-key");
	});

	it("extracts line items from a PDF data URL by sending the file to the model", async () => {
		requireApiAuthMock.mockResolvedValue({
			body: { imageUrl: PDF_DATA_URL },
			user: { aiFeaturesEnabled: true },
		});
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(modelResponse());

		const { handle } = await import("./parse-invoice");
		const response = await handle({
			request: new Request("http://localhost/api/parse-invoice", {
				method: "POST",
				body: JSON.stringify({ imageUrl: PDF_DATA_URL }),
			}),
		});

		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			success: boolean;
			data: {
				vendor: string;
				items: Array<{ description: string; total: number }>;
			};
		};
		expect(payload.success).toBe(true);
		expect(payload.data.vendor).toBe("Costco");
		expect(payload.data.items).toEqual([
			{
				description: "Pizza",
				quantity: 2,
				unitPrice: 10,
				total: 20,
			},
		]);
		expect(sentFilePart(fetchMock).type).toBe("file");
		expect(sentFilePart(fetchMock).file?.file_data).toContain(
			"application/pdf",
		);
	});

	it("treats an unlabeled PDF data URL as a PDF file", async () => {
		const imageUrl = "data:application/octet-stream;base64,JVBERi0xLjQK";
		requireApiAuthMock.mockResolvedValue({
			body: { imageUrl },
			user: { aiFeaturesEnabled: true },
		});
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(modelResponse());

		const { handle } = await import("./parse-invoice");
		const response = await handle({
			request: new Request("http://localhost/api/parse-invoice", {
				method: "POST",
				body: JSON.stringify({ imageUrl }),
			}),
		});

		expect(response.status).toBe(200);
		expect(sentFilePart(fetchMock).type).toBe("file");
		expect(
			sentFilePart(fetchMock).file?.file_data?.startsWith(
				"data:application/pdf;base64,",
			),
		).toBe(true);
	});

	it("tells the officer how to continue when scanning is not configured", async () => {
		vi.stubEnv("OPENROUTER_API_KEY", "");
		requireApiAuthMock.mockResolvedValue({
			body: { imageUrl: JPEG_DATA_URL },
			user: { aiFeaturesEnabled: true },
		});
		const fetchMock = vi.spyOn(globalThis, "fetch");

		const { handle } = await import("./parse-invoice");
		const response = await handle({
			request: new Request("http://localhost/api/parse-invoice", {
				method: "POST",
				body: JSON.stringify({ imageUrl: JPEG_DATA_URL }),
			}),
		});

		expect(response.status).toBe(500);
		const payload = (await response.json()) as { error: string };
		expect(payload.error).toBe(
			"Invoice scanning is not configured. Enter the vendor and line items below.",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		["JPG", JPEG_DATA_URL],
		["PNG", PNG_DATA_URL],
	])("extracts line items from a %s data URL", async (_label, imageUrl) => {
		requireApiAuthMock.mockResolvedValue({
			body: { imageUrl },
			user: { aiFeaturesEnabled: true },
		});
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(modelResponse());

		const { handle } = await import("./parse-invoice");
		const response = await handle({
			request: new Request("http://localhost/api/parse-invoice", {
				method: "POST",
				body: JSON.stringify({ imageUrl }),
			}),
		});

		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			data: { items: Array<{ description: string }> };
		};
		expect(payload.data.items[0]?.description).toBe("Pizza");
		expect(sentFilePart(fetchMock).type).toBe("image_url");
	});
});
