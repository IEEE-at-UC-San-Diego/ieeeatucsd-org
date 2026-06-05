import { createFileRoute } from "@tanstack/react-router";
import {
	createAiDisabledResponse,
	isAiEnabledForUser,
	requireApiAuth,
} from "@/server/auth";
import { validateExternalFileUrl } from "@/server/url-guard";

type PaymentDetailsResponse = {
	confirmationNumber: string;
	paymentDate: string;
	amountPaid: number;
	vendorOrRecipient: string;
	memo: string;
};

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

		const systemPrompt = `You extract payment-confirmation data from screenshots and receipts.

Return ONLY valid JSON in this format:
{
  "confirmationNumber": "Transaction/reference number",
  "paymentDate": "YYYY-MM-DD",
  "amountPaid": 0.00,
  "vendorOrRecipient": "Payee/recipient name",
  "memo": "Any memo or notes text"
}

Rules:
- If missing, return empty string for text fields and 0 for amountPaid.
- paymentDate must be YYYY-MM-DD if present; otherwise empty string.
- amountPaid must be numeric.`;

		const contentParts: Array<Record<string, unknown>> = [
			{
				type: "text",
				text: "Analyze this proof of payment and extract payment details.",
			},
			...(isPdf
				? [
					{
						type: "file",
						file: { filename: "payment-proof.pdf", file_data: finalUrl },
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
					"X-Title": "IEEE UCSD Reimbursement Management",
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
					error: "Failed to extract payment details",
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

		const amount =
			Math.round(
				(parseFloat(
					String((parsedData.amountPaid as number | string | undefined) ?? 0),
				) || 0) * 100,
			) / 100;

		const normalized: PaymentDetailsResponse = {
			confirmationNumber:
				(typeof parsedData.confirmationNumber === "string" &&
					parsedData.confirmationNumber) ||
				(typeof parsedData.transactionId === "string" &&
					parsedData.transactionId) ||
				(typeof parsedData.referenceNumber === "string" &&
					parsedData.referenceNumber) ||
				"",
			paymentDate:
				typeof parsedData.paymentDate === "string"
					? parsedData.paymentDate
					: "",
			amountPaid: amount,
			vendorOrRecipient:
				(typeof parsedData.vendorOrRecipient === "string" &&
					parsedData.vendorOrRecipient) ||
				(typeof parsedData.recipient === "string" && parsedData.recipient) ||
				(typeof parsedData.vendor === "string" && parsedData.vendor) ||
				"",
			memo: typeof parsedData.memo === "string" ? parsedData.memo : "",
		};

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

export const Route = createFileRoute("/api/extract-payment-details")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
