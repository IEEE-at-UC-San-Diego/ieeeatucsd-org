import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { env } from "@/env";
import { requireApiAuth } from "@/server/auth";
import { createConvexSessionToken } from "@/server/convex-session";
import { isSupportedRole } from "@/server/logto";
import { syncExternalAccessForRole } from "@/server/role-provisioning";
import type { UserRole } from "@/types/roles";

type OfficerTeam = "Internal" | "Events" | "Projects";
type Source = "manage-users" | "onboarding";

const VALID_TEAMS: OfficerTeam[] = ["Internal", "Events", "Projects"];

function getConvexClient() {
	const url =
		env.VITE_CONVEX_URL ||
		process.env.CONVEX_URL ||
		process.env.VITE_CONVEX_URL;
	if (!url) {
		throw new Error("Missing required env: VITE_CONVEX_URL or CONVEX_URL");
	}
	return new ConvexHttpClient(url);
}

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
		const role = body.role as string | undefined;
		const source = (body.source as Source | undefined) || "manage-users";
		const email = body.email as string | undefined;
		const name = body.name as string | undefined;
		const userId = body.userId as string | undefined;
		const position = body.position as string | undefined;
		const rawTeam = body.team as string | undefined;
		const team = rawTeam && rawTeam.length > 0 ? rawTeam : undefined;

		if (!role || !isSupportedRole(role)) {
			return new Response(JSON.stringify({ error: "Invalid role" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!userId && !email) {
			return new Response(
				JSON.stringify({ error: "Either userId or email is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		if (source !== "manage-users" && source !== "onboarding") {
			return new Response(JSON.stringify({ error: "Invalid source" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (team && !VALID_TEAMS.includes(team as OfficerTeam)) {
			return new Response(JSON.stringify({ error: "Invalid team" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		let convexUpdated = false;
		let resolvedEmail = email?.trim().toLowerCase();
		let resolvedLogtoUserId: string | null = null;

		const convex = getConvexClient();
		const { token } = createConvexSessionToken({
			sub: logtoId,
			role: user.role as UserRole | undefined,
		});
		const getByIdFn =
			"users:getByIdForAdmin" as unknown as FunctionReference<"query">;
		const getByEmailFn =
			"users:getByEmailForAdmin" as unknown as FunctionReference<"query">;
		const updateRoleFn =
			"users:updateRole" as unknown as FunctionReference<"mutation">;

		let targetUser: {
			_id: string;
			email: string;
			logtoId?: string;
		} | null = null;

		if (userId) {
			targetUser = (await convex.query(getByIdFn, {
				logtoId,
				authToken: token,
				userId,
			})) as typeof targetUser;

			if (!targetUser) {
				return new Response(
					JSON.stringify({
						error: "No matching Convex user found to update",
						warnings: [`No Convex user found for id '${userId}'`],
					}),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			}

			try {
				await convex.mutation(updateRoleFn, {
					logtoId,
					authToken: token,
					userId,
					role,
					position: position || undefined,
					team: team as OfficerTeam | undefined,
				});
				convexUpdated = true;
			} catch (error) {
				return new Response(
					JSON.stringify({
						error:
							error instanceof Error
								? error.message
								: "Failed to update role in Convex",
					}),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}
		} else if (resolvedEmail) {
			targetUser = (await convex.query(getByEmailFn, {
				logtoId,
				authToken: token,
				email: resolvedEmail,
			})) as { _id: string; email: string; logtoId?: string } | null;

			if (targetUser?._id) {
				await convex.mutation(updateRoleFn, {
					logtoId,
					authToken: token,
					userId: targetUser._id,
					role,
					position: position || undefined,
					team: team as OfficerTeam | undefined,
				});
				convexUpdated = true;
			} else if (source === "onboarding" && resolvedEmail) {
				const createPlaceholderFn =
					"users:createPlaceholder" as unknown as FunctionReference<"mutation">;
				const newUserId = await convex.mutation(createPlaceholderFn, {
					logtoId,
					authToken: token,
					email: resolvedEmail,
					name: name || resolvedEmail.split("@")[0],
					role,
					position: position || undefined,
					team: team as OfficerTeam | undefined,
				});
				targetUser = { _id: newUserId as string, email: resolvedEmail };
				convexUpdated = true;
			} else {
				return new Response(
					JSON.stringify({
						error: "No matching Convex user found to update",
						warnings: [`No Convex user found for email '${resolvedEmail}'`],
					}),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			}
		}

		if (targetUser) {
			resolvedEmail = (resolvedEmail || targetUser.email).trim().toLowerCase();
			resolvedLogtoUserId = targetUser.logtoId || null;
		}

		if (resolvedEmail) {
			const externalSync = await syncExternalAccessForRole({
				convex,
				email: resolvedEmail,
				role,
				logtoUserId: resolvedLogtoUserId,
			});

			return new Response(
				JSON.stringify({
					success: true,
					convexUpdated,
					logtoUpdated: externalSync.logtoUpdated,
					googleGroupUpdated: externalSync.googleGroupUpdated,
					googleGroup: externalSync.googleGroup,
					warnings: externalSync.warnings,
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				convexUpdated,
				logtoUpdated: false,
				googleGroupUpdated: false,
				googleGroup: null,
				warnings: [
					"External access sync skipped because no email was resolved",
				],
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
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
