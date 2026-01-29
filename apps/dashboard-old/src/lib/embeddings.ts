export const EMBEDDING_MODEL = "google/gemini-embedding-001";
export const EMBEDDING_DIM = 3072;

export async function generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = import.meta.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error("OPENROUTER_API_KEY is not set.");
        return null;
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://ieeeatucsd.org",
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: text,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter Embedding Error:", errorText);
            return null;
        }

        const data = await response.json();
        // OpenRouter/OpenAI format: { data: [{ embedding: [...] }] }
        const embedding = data.data?.[0]?.embedding || null;
        if (embedding && embedding.length !== EMBEDDING_DIM) {
            console.warn(
                `Embedding dimension ${embedding.length} does not match expected ${EMBEDDING_DIM} for ${EMBEDDING_MODEL}.`
            );
        }
        return embedding;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
}
