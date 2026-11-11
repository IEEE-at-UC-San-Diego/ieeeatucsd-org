import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/server/auth";
import { isMailboxBoundToAnotherAccount } from "@/server/mailbox-binding";
import { resetEmailPassword } from "@/server/mxroute";

function ownershipMismatch() {
	return new Response(
		JSON.stringify({
			success: false,
			error: "Forbidden: mailbox ownership mismatch",
		}),
		{ status: 403, headers: { "Content-Type": "application/json" } },
	);
}

export async function handle({ request }: { request: Request }) {
	try {
		const authResult = await requireApiAuth(request);
		if (authResult instanceof Response) return authResult;
		const { body, logtoId, user } = authResult;
		const { email, password } = body as { email?: string; password?: string };

		if (!email || !password) {
			return new Response(
				JSON.stringify({ success: false, error: "Missing email or password" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const privilegedRoles = new Set([
			"Administrator",
			"Executive Officer",
			"General Officer",
		]);
		const isPrivileged = privilegedRoles.has(String(user.role || ""));
		if (!isPrivileged) {
			const requesterEmail = String(user.email || "");
			const requesterUsername = requesterEmail
				.split("@")[0]
				?.toLowerCase()
				.replace(/[^a-z0-9]/g, "");
			const mxDomain = (
				process.env.MXROUTE_EMAIL_DOMAIN || "ieeeatucsd.org"
			).toLowerCase();
			const expectedEmail = requesterUsername
				? `${requesterUsername}@${mxDomain}`
				: "";
			const boundEmail = String(user.ieeeEmail || "").toLowerCase();

			if (
				!expectedEmail ||
				email.toLowerCase() !== expectedEmail ||
				boundEmail !== expectedEmail
			) {
				return ownershipMismatch();
			}

			const taken = await isMailboxBoundToAnotherAccount({
				logtoId,
				role: user.role,
				ieeeEmail: expectedEmail,
				rawValues: [email, String(user.ieeeEmail || "")],
			});
			if (taken) return ownershipMismatch();
		}

		const result = await resetEmailPassword({ email, password });

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
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

export const Route = createFileRoute("/api/reset-email-password")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
