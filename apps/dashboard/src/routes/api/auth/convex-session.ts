import { createFileRoute } from "@tanstack/react-router";
import { errorMessage, logAuthEvent } from "@/lib/auth/logging";
import { requireApiAuth } from "@/server/auth";
import { createConvexSessionToken } from "@/server/convex-session";
import type { UserRole } from "@/types/roles";

export async function handleConvexSession({ request }: { request: Request }) {
	const requestId = request.headers.get("X-Auth-Request-Id") ?? "unknown";
	try {
		if (request.method !== "POST") {
			return new Response(JSON.stringify({ error: "Method not allowed" }), {
				status: 405,
				headers: { "Content-Type": "application/json" },
			});
		}

		const authResult = await requireApiAuth(request, {
			allowMissingBody: true,
			allowUnprovisionedUser: true,
		});
		if (authResult instanceof Response) return authResult;

		const { logtoId, user } = authResult;
		logAuthEvent("convex_session_started", { requestId, logtoId });
		const { token, payload } = createConvexSessionToken({
			sub: logtoId,
			role: user.role as UserRole | undefined,
		});

		logAuthEvent("convex_session_succeeded", {
			requestId,
			logtoId,
			expiresAt: payload.exp * 1000,
		});
		return new Response(
			JSON.stringify({
				sessionToken: token,
				expiresAt: payload.exp * 1000,
				logtoId,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		logAuthEvent("convex_session_failed", {
			requestId,
			error: errorMessage(error),
		});
		return new Response(
			JSON.stringify({
				error: errorMessage(error),
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

export const Route = createFileRoute("/api/auth/convex-session")({
	server: {
		handlers: {
			POST: handleConvexSession,
		},
	},
});
