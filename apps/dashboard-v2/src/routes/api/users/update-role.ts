import { createFileRoute } from "@tanstack/react-router";

import { requireApiAuth } from "@/server/auth";
import { syncUserRole, UserRoleSyncInputError } from "@/server/user-role-sync";

async function handle({ request }: { request: Request }) {
	try {
		if (request.method !== "POST") {
			return new Response(JSON.stringify({ error: "Method not allowed" }), {
				status: 405,
				headers: { "Content-Type": "application/json" },
			});
		}

		const authResult = await requireApiAuth(request, {
			requiredRoles: ["Administrator", "Executive Officer"],
		});
		if (authResult instanceof Response) return authResult;

		const { body, logtoId, user } = authResult;
		const source = typeof body.source === "string" ? body.source : undefined;
		const result = await syncUserRole({
			actorLogtoId: logtoId,
			actorRole: user.role,
			userId: typeof body.userId === "string" ? body.userId : undefined,
			email: typeof body.email === "string" ? body.email : undefined,
			name: typeof body.name === "string" ? body.name : undefined,
			role: typeof body.role === "string" ? body.role : undefined,
			position: typeof body.position === "string" ? body.position : undefined,
			team: typeof body.team === "string" ? body.team : undefined,
			source: source as "manage-users" | "onboarding" | undefined,
		});

		if (
			!result.convexUpdated &&
			(source ?? "manage-users") === "manage-users"
		) {
			return new Response(
				JSON.stringify({
					error: "No matching Convex user found to update",
					warnings: result.warnings,
				}),
				{ status: 404, headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				...result,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		if (error instanceof UserRoleSyncInputError) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: error.status,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Internal server error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const Route = createFileRoute("/api/users/update-role")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
