import { createFileRoute } from "@tanstack/react-router";

async function handle() {
	return new Response(
		JSON.stringify({
			service: "dashboard",
			status: "ok",
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
}

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: handle,
		},
	},
});
