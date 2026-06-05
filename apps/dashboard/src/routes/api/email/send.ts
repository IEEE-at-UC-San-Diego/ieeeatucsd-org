import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/server/auth";
import { sendEmail } from "@/server/email";

async function handle({ request }: { request: Request }) {
	try {
		if (request.method !== "POST") {
			return new Response(JSON.stringify({ error: "Method not allowed" }), {
				status: 405,
				headers: { "Content-Type": "application/json" },
			});
		}

		const authResult = await requireApiAuth(request, {
			requiredRoles: ["Administrator", "Executive Officer", "General Officer"],
		});
		if (authResult instanceof Response) return authResult;
		const { body } = authResult;
		const { to, subject, html } = body as {
			to?: string;
			subject?: string;
			html?: string;
		};

		if (!to || !subject || !html) {
			return new Response(
				JSON.stringify({ error: "Missing required fields: to, subject, html" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const result = await sendEmail({ to, subject, html });

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const Route = createFileRoute("/api/email/send")({
	server: {
		handlers: {
			POST: handle,
		},
	},
});
