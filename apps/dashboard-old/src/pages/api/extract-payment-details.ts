import type { APIRoute } from "astro";
import sharp from "sharp";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { imageUrl } = await request.json();

        console.log(
            "[extract-payment] Received imageUrl:",
            imageUrl?.substring(0, 100),
        );

        if (!imageUrl) {
            return new Response(JSON.stringify({ error: "Missing image URL" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const apiKey = import.meta.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            console.error("OPENROUTER_API_KEY not configured");
            return new Response(
                JSON.stringify({ error: "AI service not configured" }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        // Process Image similar to parse-receipt logic
        let finalUrl = imageUrl;
        let contentType: string | undefined;
        const isFirebaseUrl = imageUrl.includes("firebasestorage.googleapis.com");

        if (isFirebaseUrl) {
            try {
                const fileResponse = await fetch(imageUrl);
                if (!fileResponse.ok) throw new Error("Failed to fetch file");

                contentType = fileResponse.headers.get("content-type") || undefined;
                const arrayBuffer = await fileResponse.arrayBuffer();
                let buffer: Buffer = Buffer.from(arrayBuffer);

                // Resize if not PDF
                const isPdf = contentType && /application\/pdf/i.test(contentType);
                if (!isPdf) {
                    const isJpeg = contentType && /image\/jpe?g/i.test(contentType);
                    const outputFormat = isJpeg ? "jpeg" : "png";
                    buffer = await sharp(buffer)
                        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
                    [outputFormat]({ quality: 85 })
                        .toBuffer();
                    contentType = outputFormat === "jpeg" ? "image/jpeg" : "image/png";
                }

                const base64 = buffer.toString("base64");
                const dataMime = contentType ?? "image/jpeg";
                finalUrl = `data:${dataMime};base64,${base64}`;

            } catch (error) {
                console.error("[extract-payment] Error processing image:", error);
                return new Response(JSON.stringify({ error: "Failed to process image" }), { status: 500 });
            }
        }

        const isPdf = (contentType && /application\/pdf/i.test(contentType)) || /\.pdf(?:\?|#|$)/i.test(imageUrl);

        const systemPrompt = `You are a precise payment confirmation extraction assistant. Extract payment details from the image/screenshot (Zelle, Venmo, Bank Transfer, Check, etc.) and return ONLY valid JSON.

Required JSON structure:
{
  "confirmationNumber": "The transaction ID or reference number",
  "paymentDate": "YYYY-MM-DD",
  "amountPaid": 0.00,
  "vendorOrRecipient": "Name of person/entity paid",
  "memo": "Any notes or memo text found"
}

Rules:
- Return ONLY JSON.
- If a field is not found, use null or 0 for numbers.
- amountPaid must be a number with 2 decimal places.
- Date must be YYYY-MM-DD.
`;

        const userPrompt = "Analyze this payment proof and extract details.";

        const contentParts: any[] = [
            { type: "text", text: userPrompt },
            ...(isPdf
                ? [{ type: "file", file: { filename: "payment.pdf", file_data: finalUrl } }]
                : [{ type: "image_url", image_url: { url: finalUrl } }]),
        ];

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://ieeeatucsd.org",
            },
            body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: contentParts },
                ],
                response_format: { type: "json_object" },
                temperature: 0.0,
            }),
        });

        if (!response.ok) {
            const errToken = await response.text();
            console.error("OpenRouter Error:", errToken);
            throw new Error("AI API Failed");
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error("No content from AI");

        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsedData = JSON.parse(cleanContent);

        return new Response(JSON.stringify({ success: true, data: parsedData }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("[extract-payment] Error:", error);
        return new Response(JSON.stringify({ error: "Internal Error", details: error instanceof Error ? error.message : "Unknown" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
