import { createFileRoute } from "@tanstack/react-router";
import {
	createAiDisabledResponse,
	isAiEnabledForUser,
	requireApiAuth,
} from "@/server/auth";

async function handle({ request }: { request: Request }) {
	try {
		const authResult = await requireApiAuth(request, {
			requiredRoles: ["Administrator", "Executive Officer", "General Officer"],
		});
		if (authResult instanceof Response) return authResult;

		if (!isAiEnabledForUser(authResult.user)) {
			return createAiDisabledResponse();
		}

		return new Response(
			JSON.stringify({
				error: "AI assistant is disabled",
				details: "The dashboard assistant is not deployed.",
			}),
			{
				status: 503,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("AI query route failed:", error);
		return new Response(JSON.stringify({ error: "Query failed" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

export const Route = createFileRoute("/api/ai/query")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
