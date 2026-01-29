import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../../firebase/server";
import { performIndexing } from "../../../lib/indexing";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { action } = await request.json();

        if (action !== "index" && action !== "ensure_index") {
            return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
        }

        const db = getFirestore(app);

        // Use the shared indexing logic
        const { indexed, errors } = await performIndexing(db);

        if (errors.length > 0) {
            console.warn("Indexing completed with some errors:", errors);
        }

        return new Response(JSON.stringify({ success: true, indexed, errors, mode: action }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Indexing Error:", error);
        return new Response(JSON.stringify({ error: "Indexing failed", details: error instanceof Error ? error.message : "Unknown" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
