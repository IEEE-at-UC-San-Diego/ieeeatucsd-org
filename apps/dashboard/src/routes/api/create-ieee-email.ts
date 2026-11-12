import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { requireApiAuth } from "@/server/auth";
import { createConvexSessionToken } from "@/server/convex-session";
import { mailboxMigrationGate } from "@/server/mailbox-binding";
import { createIEEEEmail } from "@/server/mxroute";
import type { UserRole } from "@/types/roles";
import {
	canonicalMailbox,
	isMailboxOfficer,
	nonOfficerMailboxAccess,
} from "../../../convex/mailboxClaim";

function convexUrl() {
	return (
		process.env.CONVEX_URL ||
		process.env.VITE_CONVEX_URL ||
		(
			import.meta as ImportMeta & {
				env?: Record<string, string | undefined>;
			}
		).env?.VITE_CONVEX_URL
	);
}

function mailboxAlreadyProvisioned(error: unknown, claimed: string) {
	return (
		error instanceof Error &&
		error.message.includes("already exists") &&
		error.message.includes(claimed)
	);
}

async function writeMailbox(args: {
	name: "users:setIEEEEmail" | "mailboxRelease:releaseIEEEEmail";
	logtoId: string;
	role: UserRole | undefined;
	ieeeEmail: string;
	claimToken?: string;
}) {
	const url = convexUrl();
	if (!url) {
		throw new Error("Missing required env: VITE_CONVEX_URL or CONVEX_URL");
	}
	const client = new ConvexHttpClient(url);
	const fn = args.name as unknown as FunctionReference<"mutation">;
	const { token } = createConvexSessionToken({
		sub: args.logtoId,
		role: args.role,
	});
	return await client.mutation(fn, {
		logtoId: args.logtoId,
		authToken: token,
		ieeeEmail: args.ieeeEmail,
		...(args.claimToken ? { claimToken: args.claimToken } : {}),
	});
}

export async function handle({ request }: { request: Request }) {
	try {
		const authResult = await requireApiAuth(request);
		if (authResult instanceof Response) return authResult;
		const { logtoId, body, user } = authResult;
		const { username, password } = body as {
			username?: string;
			password?: string;
		};

		if (!username || !password) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Missing username or password",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const normalizedUsername = username
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");
		const domain = (process.env.MXROUTE_EMAIL_DOMAIN || "ieeeatucsd.org")
			.trim()
			.toLowerCase();
		const claimed = `${normalizedUsername}@${domain}`;
		const previousValue =
			typeof user.ieeeEmail === "string"
				? canonicalMailbox(user.ieeeEmail)
				: "";
		const previous = previousValue || undefined;
		const isPrivileged = isMailboxOfficer(String(user.role || ""));
		const requesterEmail = String(user.email || "");
		const requesterUsername = requesterEmail
			.split("@")[0]
			?.toLowerCase()
			.replace(/[^a-z0-9]/g, "");

		if (
			!isPrivileged &&
			requesterUsername &&
			normalizedUsername !== requesterUsername
		) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Forbidden: cannot create another user's mailbox",
				}),
				{ status: 403, headers: { "Content-Type": "application/json" } },
			);
		}

		if (!isPrivileged) {
			const gate = await mailboxMigrationGate({
				logtoId,
				role: user.role as UserRole | undefined,
				ieeeEmail: claimed,
			});
			if (
				nonOfficerMailboxAccess({
					migrationDone: gate.done,
					collision: gate.collision,
				}) !== "open"
			) {
				return new Response(
					JSON.stringify({
						success: false,
						error: "Forbidden: mailbox ownership mismatch",
					}),
					{ status: 403, headers: { "Content-Type": "application/json" } },
				);
			}
		}

		const role = user.role as UserRole | undefined;
		const claimedToken = await writeMailbox({
			name: "users:setIEEEEmail",
			logtoId,
			role,
			ieeeEmail: claimed,
		});
		if (typeof claimedToken !== "string" || claimedToken.length === 0) {
			throw new Error("Mailbox claim did not return a token");
		}

		try {
			const result = await createIEEEEmail({ username, password });
			return new Response(JSON.stringify(result), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (provisionError) {
			if (mailboxAlreadyProvisioned(provisionError, claimed)) {
				return new Response(
					JSON.stringify({ success: true, ieeeEmail: claimed }),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			if (previous !== claimed) {
				try {
					if (previous) {
						await writeMailbox({
							name: "users:setIEEEEmail",
							logtoId,
							role,
							ieeeEmail: previous,
						});
					} else {
						await writeMailbox({
							name: "mailboxRelease:releaseIEEEEmail",
							logtoId,
							role,
							ieeeEmail: claimed,
							claimToken: claimedToken,
						});
					}
				} catch (rollbackError) {
					const reason =
						rollbackError instanceof Error
							? rollbackError.message
							: "unknown error";
					throw new Error(
						`Mailbox provisioning failed and the claim could not be rolled back: ${reason}`,
					);
				}
			}
			throw provisionError;
		}
	} catch (error) {
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const Route = createFileRoute("/api/create-ieee-email")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
