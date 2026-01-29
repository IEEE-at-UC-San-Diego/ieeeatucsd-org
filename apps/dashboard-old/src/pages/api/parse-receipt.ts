import type { APIRoute } from "astro";
import sharp from "sharp";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { imageUrl } = await request.json();

    console.log(
      "[parse-receipt] Received imageUrl:",
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

    // Fetch the file from Firebase Storage (if applicable) and convert to base64 data URL
    let finalUrl = imageUrl;
    let contentType: string | undefined;

    const isFirebaseUrl = imageUrl.includes("firebasestorage.googleapis.com");
    console.log("[parse-receipt] Is Firebase URL:", isFirebaseUrl);

    if (isFirebaseUrl) {
      try {
        console.log("[parse-receipt] Fetching file from Firebase Storage...");
        const fileResponse = await fetch(imageUrl);

        console.log(
          "[parse-receipt] Fetch response status:",
          fileResponse.status,
        );

        if (!fileResponse.ok) {
          const errorText = await fileResponse.text();
          console.error("[parse-receipt] Fetch failed:", errorText);
          throw new Error(
            `Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`,
          );
        }

        contentType = fileResponse.headers.get("content-type") || undefined;
        console.log("[parse-receipt] Content type:", contentType);

        const arrayBuffer = await fileResponse.arrayBuffer();
        let buffer: Buffer = Buffer.from(arrayBuffer);

        // Log original file size
        console.log(
          "[parse-receipt] Original file size:",
          buffer.length,
          "bytes",
        );

        // Resize and compress image if it's not a PDF
        const isPdf = contentType && /application\/pdf/i.test(contentType);
        if (!isPdf) {
          try {
            // Resize image to max 2048px on longest side and compress
            // Convert to PNG or JPEG based on original format
            const isJpeg = contentType && /image\/jpe?g/i.test(contentType);
            const outputFormat = isJpeg ? "jpeg" : "png";

            const resizedBuffer: Buffer = await sharp(buffer)
              .resize(2048, 2048, {
                fit: "inside",
                withoutEnlargement: true,
              })
            [outputFormat]({
              quality: outputFormat === "jpeg" ? 85 : undefined,
              compressionLevel: outputFormat === "png" ? 8 : undefined,
            })
              .toBuffer();

            buffer = resizedBuffer;
            contentType = outputFormat === "jpeg" ? "image/jpeg" : "image/png";

            console.log(
              "[parse-receipt] Resized file size:",
              buffer.length,
              "bytes",
            );
            console.log("[parse-receipt] Output format:", outputFormat);
          } catch (resizeError) {
            console.error("[parse-receipt] Error resizing image:", resizeError);
            // Continue with original buffer if resize fails
          }
        }

        const base64 = buffer.toString("base64");

        // Use detected contentType; fall back to image/jpeg if unknown
        const dataMime = contentType ?? "image/jpeg";
        finalUrl = `data:${dataMime};base64,${base64}`;

        console.log(
          "[parse-receipt] Data URL prefix:",
          finalUrl.substring(0, 50),
        );
        console.log("[parse-receipt] Final data URL length:", finalUrl.length);
      } catch (error) {
        console.error(
          "[parse-receipt] Error fetching Firebase Storage file:",
          error,
        );
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

    console.log("[parse-receipt] isPdf:", isPdf);

    console.log(
      "[parse-receipt] Sending to AI with URL length:",
      finalUrl.length,
    );

    const systemPrompt = `Extract data from this receipt into the following JSON structure. Return ONLY valid JSON with no additional text or markdown formatting.

Required JSON structure:
{
  "vendorName": "Business Name",
  "location": "Full Address",
  "dateOfPurchase": "YYYY-MM-DD",
  "lineItems": [
    {
      "description": "Item description",
      "category": "Category",
      "amount": 0.00,
      "quantity": 1
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "shipping": 0.00,
  "otherCharges": 0.00,
  "total": 0.00
}

Categories must be one of: Food & Beverages, Transportation, Materials & Supplies, Registration Fees, Equipment, Software/Subscriptions, Printing/Marketing, Other`;

    const userPrompt = `Analyze this receipt and extract the data.`;

    // Build content with correct modality
    const contentParts: any[] = [
      { type: "text", text: userPrompt },
      ...(isPdf
        ? [
          {
            type: "file",
            file: {
              filename: "receipt.pdf",
              // OpenRouter accepts either a direct URL or a base64 data URL here
              file_data: finalUrl,
            },
          },
        ]
        : [
          {
            type: "image_url",
            image_url: { url: finalUrl },
          },
        ]),
    ];

    // Optional: Explicitly configure PDF engine for better OCR of scanned receipts
    // Remove or change engine if you prefer defaults
    const plugins = isPdf
      ? [
        {
          id: "file-parser",
          pdf: {
            // 'mistral-ocr' is robust for scanned/image-based PDFs. 'pdf-text' is free for text-based PDFs.
            engine: "mistral-ocr",
          },
        },
      ]
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
          temperature: 0.0,
          max_tokens: 2000,
          reasoning: {
            effort: "medium",
            exclude: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
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

    const data = await response.json();

    console.log(
      "[parse-receipt] AI response data:",
      JSON.stringify(data, null, 2),
    );

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error(
        "[parse-receipt] No content in AI response. Full response:",
        data,
      );
      console.error("[parse-receipt] Choices array:", data.choices);
      console.error("[parse-receipt] First choice:", data.choices?.[0]);
      console.error("[parse-receipt] Message:", data.choices?.[0]?.message);

      return new Response(
        JSON.stringify({
          error: "No content returned from AI",
          details:
            "The AI service returned an empty response. This may be due to image size or format issues.",
          aiResponse: data,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log("[parse-receipt] AI content received, length:", content.length);

    let parsedData;
    try {
      const cleanContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON response from AI",
          rawContent: content,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Round and normalize all monetary values to 2 decimal places
    const roundToTwo = (num: number | string) =>
      Math.round((parseFloat(String(num)) || 0) * 100) / 100;
    const inferQuantityFromDescription = (
      description: string | undefined,
    ): number | null => {
      if (!description || typeof description !== "string") return null;
      const patterns = [
        /\b(?:qty|quantity)\s*[:#]?\s*(\d+)\b/i,
        /^\s*(\d+)\s*[x×]\s+\S/i,
      ];

      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
          const quantity = parseInt(match[1], 10);
          if (Number.isFinite(quantity) && quantity > 1) return quantity;
        }
      }

      return null;
    };

    const normalizedData = {
      vendorName: parsedData.vendorName || "Unknown Vendor",
      location: parsedData.location || "",
      dateOfPurchase:
        parsedData.dateOfPurchase || new Date().toISOString().split("T")[0],
      lineItems: Array.isArray(parsedData.lineItems)
        ? parsedData.lineItems
        : [],
      subtotal: roundToTwo(parsedData.subtotal),
      tax: roundToTwo(parsedData.tax),
      tip: roundToTwo(parsedData.tip),
      shipping: roundToTwo(parsedData.shipping),
      otherCharges: roundToTwo(parsedData.otherCharges),
      total: roundToTwo(parsedData.total),
    };

    // Validation and consistency checks
    console.log("[parse-receipt] Performing validation checks...");

    // Check for duplicate charges in otherCharges
    if (normalizedData.otherCharges > 0) {
      const hasTax = normalizedData.tax > 0;
      const hasTip = normalizedData.tip > 0;
      const hasShipping = normalizedData.shipping > 0;

      console.log("[parse-receipt] Charge breakdown:", {
        otherCharges: normalizedData.otherCharges,
        hasTax,
        hasTip,
        hasShipping,
        subtotal: normalizedData.subtotal,
        total: normalizedData.total,
      });

      // If otherCharges seems to duplicate other charges, reset it
      const calculatedTotal =
        normalizedData.subtotal +
        normalizedData.tax +
        normalizedData.tip +
        normalizedData.shipping +
        normalizedData.otherCharges;
      const totalDifference = Math.abs(calculatedTotal - normalizedData.total);

      if (totalDifference > 0.05) {
        // Allow 5 cent tolerance
        console.log(
          "[parse-receipt] Total mismatch detected, adjusting otherCharges",
        );
        const adjustedOtherCharges =
          normalizedData.total -
          (normalizedData.subtotal +
            normalizedData.tax +
            normalizedData.tip +
            normalizedData.shipping);

        if (adjustedOtherCharges >= -0.01 && adjustedOtherCharges <= 0.01) {
          normalizedData.otherCharges = 0;
          console.log(
            "[parse-receipt] otherCharges adjusted to 0 due to total match",
          );
        } else {
          normalizedData.otherCharges = roundToTwo(
            Math.max(0, adjustedOtherCharges),
          );
          console.log(
            "[parse-receipt] otherCharges adjusted to match total:",
            normalizedData.otherCharges,
          );
        }
      }
    }

    if (!normalizedData.lineItems || normalizedData.lineItems.length === 0) {
      normalizedData.lineItems = [
        {
          description: "Receipt Total",
          category: "Other",
          amount: normalizedData.total,
        },
      ];
    }

    normalizedData.lineItems = normalizedData.lineItems.map(
      (item: any, index: number) => {
        const explicitQuantity = parseInt(item.quantity);
        const inferredQuantity = inferQuantityFromDescription(item.description);
        let quantity =
          explicitQuantity > 0
            ? explicitQuantity
            : inferredQuantity ?? 1;
        if (explicitQuantity === 1 && inferredQuantity && inferredQuantity > 1) {
          quantity = inferredQuantity;
        }
        const totalAmount = roundToTwo(item.amount);

        return {
          description: item.description || `Item ${index + 1}`,
          category: item.category || "Other",
          amount: totalAmount, // Keep line total; do not split bundles
          quantity,
        };
      },
    );

    // Final validation log
    const finalCalculatedTotal =
      normalizedData.subtotal +
      normalizedData.tax +
      normalizedData.tip +
      normalizedData.shipping +
      normalizedData.otherCharges;
    const finalDifference = Math.abs(
      finalCalculatedTotal - normalizedData.total,
    );

    console.log("[parse-receipt] Final validation:", {
      calculatedTotal: finalCalculatedTotal,
      reportedTotal: normalizedData.total,
      difference: finalDifference,
      breakdown: {
        subtotal: normalizedData.subtotal,
        tax: normalizedData.tax,
        tip: normalizedData.tip,
        shipping: normalizedData.shipping,
        otherCharges: normalizedData.otherCharges,
      },
    });

    // Add warning if totals don't match
    if (finalDifference > 0.05) {
      console.warn(
        "[parse-receipt] WARNING: Total calculation mismatch exceeds tolerance",
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: normalizedData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in parse-receipt API:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
