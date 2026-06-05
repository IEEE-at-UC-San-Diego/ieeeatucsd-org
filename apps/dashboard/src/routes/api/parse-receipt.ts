import { createFileRoute } from "@tanstack/react-router";
import {
	createAiDisabledResponse,
	isAiEnabledForUser,
	requireApiAuth,
} from "@/server/auth";
import { validateExternalFileUrl } from "@/server/url-guard";

type ParsedReceiptResponse = {
	vendorName: string;
	location: string;
	dateOfPurchase: string;
	lineItems: Array<{
		description: string;
		category: string;
		amount: number;
	}>;
	subtotal: number;
	tax: number;
	tip: number;
	shipping: number;
	total: number;
};

const RECEIPT_CATEGORIES = [
	"Food & Beverages",
	"Transportation",
	"Materials & Supplies",
	"Registration Fees",
	"Equipment",
	"Software/Subscriptions",
	"Printing/Marketing",
	"Other",
];

async function handle({ request }: { request: Request }) {
	try {
		const authResult = await requireApiAuth(request);
		if (authResult instanceof Response) return authResult;
		const { body, user } = authResult;
		const { imageUrl } = body as { imageUrl?: string };

		if (!isAiEnabledForUser(user)) {
			return createAiDisabledResponse();
		}

		if (!imageUrl) {
			return new Response(JSON.stringify({ error: "Missing image URL" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const apiKey = process.env.OPENROUTER_API_KEY;
		if (!apiKey) {
			return new Response(
				JSON.stringify({ error: "AI service not configured" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		let finalUrl = imageUrl as string;
		let contentType: string | undefined;
		const isRemoteUrl =
			typeof imageUrl === "string" &&
			(imageUrl.startsWith("http://") || imageUrl.startsWith("https://"));

		if (isRemoteUrl) {
			const validation = validateExternalFileUrl(imageUrl);
			if (!validation.ok) {
				return new Response(
					JSON.stringify({
						error: "Blocked external URL",
						details: validation.reason,
					}),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}

			try {
				const fileResponse = await fetch(imageUrl);
				if (!fileResponse.ok) {
					throw new Error(`Failed to fetch file: ${fileResponse.status}`);
				}
				contentType = fileResponse.headers.get("content-type") || undefined;
				const arrayBuffer = await fileResponse.arrayBuffer();
				const base64 = Buffer.from(arrayBuffer).toString("base64");
				finalUrl = `data:${contentType ?? "image/jpeg"};base64,${base64}`;
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: "Failed to fetch file from storage",
						details: error instanceof Error ? error.message : "Unknown error",
					}),
					{ status: 500, headers: { "Content-Type": "application/json" } },
				);
			}
		}

		const isPdf =
			(contentType && /application\/pdf/i.test(contentType)) ||
			/\.pdf(?:\?|#|$)/i.test(imageUrl);

		const systemPrompt = `Extract data from this receipt into valid JSON.

Required JSON:
{
  "vendorName": "Business Name",
  "location": "Address or location",
  "dateOfPurchase": "YYYY-MM-DD",
  "lineItems": [
    {
      "description": "Item description",
      "category": "Category",
      "amount": 0.00
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "shipping": 0.00,
  "total": 0.00
}

Rules:
- Return ONLY JSON.
- category must be one of: ${RECEIPT_CATEGORIES.join(", ")}.
- If category is unclear, use "Other".
- Use 0 for missing monetary values.
- dateOfPurchase must be YYYY-MM-DD if found, otherwise empty string.`;

		const contentParts: Array<Record<string, unknown>> = [
			{
				type: "text",
				text: "Analyze this receipt and extract all structured fields.",
			},
			...(isPdf
				? [
					{
						type: "file",
						file: { filename: "receipt.pdf", file_data: finalUrl },
					},
				]
				: [{ type: "image_url", image_url: { url: finalUrl } }]),
		];

		const plugins = isPdf
			? [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }]
			: undefined;

		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "https://ieeeatucsd.org",
					"X-Title": "IEEE UCSD Reimbursement System",
				},
				body: JSON.stringify({
					model: "google/gemini-3-flash-preview",
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: contentParts },
					],
					...(plugins ? { plugins } : {}),
					response_format: { type: "json_object" },
					temperature: 0,
					reasoning: { effort: "high", exclude: true },
				}),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			return new Response(
				JSON.stringify({
					error: "Failed to parse receipt with AI",
					details: errorText,
				}),
				{
					status: response.status,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const aiData = await response.json();
		const content = aiData.choices?.[0]?.message?.content;
		if (!content) {
			return new Response(
				JSON.stringify({ error: "No content returned from AI" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		let parsedData: Record<string, unknown>;
		try {
			const cleanContent = content
				.replace(/```json\n?/g, "")
				.replace(/```\n?/g, "")
				.trim();
			parsedData = JSON.parse(cleanContent) as Record<string, unknown>;
		} catch {
			return new Response(
				JSON.stringify({
					error: "Invalid JSON response from AI",
					rawContent: content,
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}

		const roundToTwo = (num: number | string | undefined | null) =>
			Math.round((parseFloat(String(num ?? 0)) || 0) * 100) / 100;

		const normalized: ParsedReceiptResponse = {
			vendorName:
				(typeof parsedData.vendorName === "string" && parsedData.vendorName) ||
				(typeof parsedData.vendor === "string" && parsedData.vendor) ||
				"Unknown Vendor",
			location:
				typeof parsedData.location === "string" ? parsedData.location : "",
			dateOfPurchase:
				typeof parsedData.dateOfPurchase === "string"
					? parsedData.dateOfPurchase
					: "",
			lineItems: Array.isArray(parsedData.lineItems)
				? parsedData.lineItems.map((rawItem, index: number) => {
					const item = (rawItem || {}) as Record<string, unknown>;
					return {
						description:
							(typeof item.description === "string" && item.description) ||
							`Item ${index + 1}`,
						category:
							typeof item.category === "string" &&
								RECEIPT_CATEGORIES.includes(item.category)
								? item.category
								: "Other",
						amount: roundToTwo(
							(item.amount as number | string | undefined) ??
							(item.total as number | string | undefined) ??
							(item.unitPrice as number | string | undefined),
						),
					};
				})
				: Array.isArray(parsedData.items)
					? parsedData.items.map((rawItem, index: number) => {
						const item = (rawItem || {}) as Record<string, unknown>;
						return {
							description:
								(typeof item.description === "string" && item.description) ||
								`Item ${index + 1}`,
							category: "Other",
							amount: roundToTwo(
								(item.total as number | string | undefined) ??
								(item.amount as number | string | undefined) ??
								(item.unitPrice as number | string | undefined),
							),
						};
					})
					: [],
			subtotal: roundToTwo(parsedData.subtotal as number | string | undefined),
			tax: roundToTwo(parsedData.tax as number | string | undefined),
			tip: roundToTwo(parsedData.tip as number | string | undefined),
			shipping: roundToTwo(parsedData.shipping as number | string | undefined),
			total: roundToTwo(parsedData.total as number | string | undefined),
		};

		if (normalized.lineItems.length === 0 && normalized.total > 0) {
			normalized.lineItems = [
				{
					description: "Receipt Total",
					category: "Other",
					amount: normalized.total,
				},
			];
		}

		if (normalized.subtotal === 0 && normalized.lineItems.length > 0) {
			normalized.subtotal = roundToTwo(
				normalized.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0),
			);
		}

		if (normalized.total === 0) {
			normalized.total = roundToTwo(
				normalized.subtotal +
				normalized.tax +
				normalized.tip +
				normalized.shipping,
			);
		}

		return new Response(JSON.stringify({ success: true, data: normalized }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const Route = createFileRoute("/api/parse-receipt")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
