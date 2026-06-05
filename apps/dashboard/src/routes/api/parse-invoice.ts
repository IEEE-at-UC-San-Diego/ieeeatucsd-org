import { createFileRoute } from "@tanstack/react-router";
import {
  createAiDisabledResponse,
  isAiEnabledForUser,
  requireApiAuth,
} from "@/server/auth";
import { validateExternalFileUrl } from "@/server/url-guard";

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
      console.error("OPENROUTER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch the file and convert to base64 data URL if it's a remote URL
    let finalUrl = imageUrl;
    let contentType: string | undefined;

    const isRemoteUrl = imageUrl.startsWith("http://") || imageUrl.startsWith("https://");

    if (isRemoteUrl) {
      const validation = validateExternalFileUrl(imageUrl);
      if (!validation.ok) {
        return new Response(
          JSON.stringify({ error: "Blocked external URL", details: validation.reason }),
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
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        const dataMime = contentType ?? "image/jpeg";
        finalUrl = `data:${dataMime};base64,${base64}`;
      } catch (error) {
        console.error("[parse-invoice] Error fetching file:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to fetch file from storage",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Determine if this is a PDF
    const isPdf =
      (contentType && /application\/pdf/i.test(contentType)) ||
      /\.pdf(?:\?|#|$)/i.test(imageUrl);

    const systemPrompt = `Extract data from this invoice/receipt into the following JSON structure. Return ONLY valid JSON with no additional text or markdown formatting.

Required JSON structure:
{
  "vendor": "Business/Store Name",
  "items": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 0.00,
      "total": 0.00
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "total": 0.00
}

Rules:
- Each line item should have a clear description, quantity, unit price, and total
- If quantity is not specified, default to 1
- unitPrice should be the price per single item
- total for each item = quantity * unitPrice
- subtotal = sum of all item totals
- tax, tip should be extracted if present, otherwise 0
- total = subtotal + tax + tip
- All monetary values should be numbers with 2 decimal places
- Return ONLY the JSON object, no markdown or extra text`;

    const userPrompt = "Analyze this invoice/receipt and extract all line items and totals.";

    // Build content parts based on file type
    const contentParts: any[] = [
      { type: "text", text: userPrompt },
      ...(isPdf
        ? [{ type: "file", file: { filename: "invoice.pdf", file_data: finalUrl } }]
        : [{ type: "image_url", image_url: { url: finalUrl } }]),
    ];

    const plugins = isPdf
      ? [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }]
      : undefined;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ieeeatucsd.org",
        "X-Title": "IEEE UCSD Event Management",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentParts },
        ],
        ...(plugins ? { plugins } : {}),
        response_format: { type: "json_object" },
        temperature: 0.0,
        reasoning: { effort: "high", exclude: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to parse invoice with AI", details: errorText }),
        { status: response.status, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content returned from AI" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    let parsedData;
    try {
      const cleanContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsedData = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Invalid JSON response from AI", rawContent: content }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Normalize monetary values
    const roundToTwo = (num: number | string) =>
      Math.round((parseFloat(String(num)) || 0) * 100) / 100;

    const normalizedData = {
      vendor: parsedData.vendor || parsedData.vendorName || "Unknown Vendor",
      items: Array.isArray(parsedData.items)
        ? parsedData.items.map((item: any, index: number) => ({
          description: item.description || `Item ${index + 1}`,
          quantity: parseInt(item.quantity) || 1,
          unitPrice: roundToTwo(item.unitPrice || item.amount || 0),
          total: roundToTwo(item.total || item.amount || 0),
        }))
        : Array.isArray(parsedData.lineItems)
          ? parsedData.lineItems.map((item: any, index: number) => ({
            description: item.description || `Item ${index + 1}`,
            quantity: parseInt(item.quantity) || 1,
            unitPrice: roundToTwo(item.unitPrice || (item.amount / (parseInt(item.quantity) || 1)) || 0),
            total: roundToTwo(item.amount || item.total || 0),
          }))
          : [],
      subtotal: roundToTwo(parsedData.subtotal),
      tax: roundToTwo(parsedData.tax),
      tip: roundToTwo(parsedData.tip),
      total: roundToTwo(parsedData.total),
    };

    // If no items but we have a total, create a single line item
    if (normalizedData.items.length === 0 && normalizedData.total > 0) {
      normalizedData.items = [{
        description: "Invoice Total",
        quantity: 1,
        unitPrice: normalizedData.total,
        total: normalizedData.total,
      }];
    }

    return new Response(JSON.stringify({ success: true, data: normalizedData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in parse-invoice API:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/parse-invoice")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
