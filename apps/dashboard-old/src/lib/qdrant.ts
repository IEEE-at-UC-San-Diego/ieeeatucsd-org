/**
 * Lightweight Qdrant REST client using native fetch.
 * Replaces @qdrant/js-client-rest which has undici dependency issues with Bun.
 */

import { EMBEDDING_DIM } from "./embeddings";

export const DASHBOARD_COLLECTION = "dashboard_data";

// Lazy config getters - read env vars at runtime, not at module load time
// This is necessary because Vite/Astro's ESM bundling makes process.env unavailable at import time
function getConfig() {
    // Try multiple sources for env vars
    const getEnv = (key: string, fallback: string = ""): string => {
        // process.env (Node.js / Bun runtime)
        if (typeof process !== "undefined" && process.env && process.env[key]) {
            return process.env[key] as string;
        }
        // import.meta.env (Vite/Astro)
        if (typeof import.meta !== "undefined" && import.meta.env) {
            const env = import.meta.env as Record<string, string>;
            if (env[key]) return env[key];
        }
        return fallback;
    };

    let url = getEnv("QDRANT_URL", "https://qdrant.ieeeatucsd.org");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
    }
    url = url.replace(/\/$/, ""); // Remove trailing slash

    const apiKey = getEnv("QDRANT_API_KEY");

    return { url, apiKey };
}

interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, unknown>;
}

interface QdrantSearchResult {
    id: string | number;
    version: number;
    score: number;
    payload?: Record<string, unknown>;
    vector?: number[];
}

interface QdrantCollection {
    name: string;
}

interface QdrantCountResult {
    count: number;
}

interface QdrantCollectionInfo {
    config?: {
        params?: {
            vectors?: { size?: number } | Record<string, { size?: number }>;
        };
    };
}

async function qdrantRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const config = getConfig();

    if (!config.apiKey) {
        throw new Error("QDRANT_API_KEY is not configured. Please set it in your .env file.");
    }

    const url = `${config.url}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "api-key": config.apiKey,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qdrant request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.result as T;
}

export const qdrantClient = {
    async getCollections(): Promise<{ collections: QdrantCollection[] }> {
        return qdrantRequest<{ collections: QdrantCollection[] }>("/collections");
    },
    async getCollection(collectionName: string): Promise<QdrantCollectionInfo> {
        return qdrantRequest<QdrantCollectionInfo>(`/collections/${collectionName}`);
    },

    async createCollection(
        collectionName: string,
        config: {
            vectors: {
                size: number;
                distance: "Cosine" | "Euclid" | "Dot";
            };
        }
    ): Promise<boolean> {
        return qdrantRequest<boolean>(`/collections/${collectionName}`, {
            method: "PUT",
            body: JSON.stringify(config),
        });
    },
    async count(
        collectionName: string,
        options: { exact?: boolean } = {}
    ): Promise<QdrantCountResult> {
        return qdrantRequest<QdrantCountResult>(
            `/collections/${collectionName}/points/count`,
            {
                method: "POST",
                body: JSON.stringify({ exact: options.exact ?? true }),
            }
        );
    },

    async upsert(
        collectionName: string,
        options: { points: QdrantPoint[]; wait?: boolean }
    ): Promise<{ status: string }> {
        return qdrantRequest<{ status: string }>(
            `/collections/${collectionName}/points?wait=${options.wait ?? true}`,
            {
                method: "PUT",
                body: JSON.stringify({ points: options.points }),
            }
        );
    },

    async search(
        collectionName: string,
        request: {
            vector: number[];
            limit: number;
            with_payload?: boolean;
            with_vector?: boolean;
            score_threshold?: number;
            filter?: Record<string, unknown>;
        }
    ): Promise<QdrantSearchResult[]> {
        return qdrantRequest<QdrantSearchResult[]>(
            `/collections/${collectionName}/points/search`,
            {
                method: "POST",
                body: JSON.stringify(request),
            }
        );
    },

    async delete(
        collectionName: string,
        options: { points: (string | number)[]; wait?: boolean }
    ): Promise<{ status: string }> {
        return qdrantRequest<{ status: string }>(
            `/collections/${collectionName}/points/delete?wait=${options.wait ?? true}`,
            {
                method: "POST",
                body: JSON.stringify({ points: options.points }),
            }
        );
    },

    async scroll(
        collectionName: string,
        options: {
            limit?: number;
            offset?: string | number | null;
            with_payload?: boolean;
            with_vector?: boolean;
            filter?: Record<string, unknown>;
        }
    ): Promise<{ points: QdrantSearchResult[]; next_page_offset: string | number | null }> {
        return qdrantRequest<{ points: QdrantSearchResult[]; next_page_offset: string | number | null }>(
            `/collections/${collectionName}/points/scroll`,
            {
                method: "POST",
                body: JSON.stringify(options),
            }
        );
    },
};

export async function ensureCollectionExists(expectedVectorSize: number = EMBEDDING_DIM) {
    try {
        const result = await qdrantClient.getCollections();
        const exists = result.collections.some((c) => c.name === DASHBOARD_COLLECTION);

        if (!exists) {
            console.log(`Creating collection ${DASHBOARD_COLLECTION}...`);
            await qdrantClient.createCollection(DASHBOARD_COLLECTION, {
                vectors: {
                    size: expectedVectorSize, // google/gemini-embedding-001 dimension
                    distance: "Cosine",
                },
            });
            console.log(`Collection ${DASHBOARD_COLLECTION} created.`);
            return;
        }

        const info = await qdrantClient.getCollection(DASHBOARD_COLLECTION);
        const vectorConfig = info.config?.params?.vectors;
        let existingSize: number | null = null;
        if (vectorConfig && typeof vectorConfig === "object") {
            if ("size" in vectorConfig && typeof vectorConfig.size === "number") {
                existingSize = vectorConfig.size;
            } else {
                for (const value of Object.values(vectorConfig)) {
                    if (value && typeof value === "object" && typeof value.size === "number") {
                        existingSize = value.size;
                        break;
                    }
                }
            }
        }

        if (existingSize && existingSize !== expectedVectorSize) {
            throw new Error(
                `Qdrant collection "${DASHBOARD_COLLECTION}" has vector size ${existingSize}, expected ${expectedVectorSize}. ` +
                "Delete the collection and re-index to continue."
            );
        }
    } catch (error) {
        console.error("Error ensuring Qdrant collection exists:", error);
        throw error; // Re-throw so callers know it failed
    }
}
