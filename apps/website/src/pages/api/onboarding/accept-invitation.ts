import type { APIRoute } from "astro";

const DASHBOARD_FALLBACK_URL = "https://dashboard.ieeeatucsd.org";

const getDashboardApiUrl = () => {
	const baseUrl = (
		import.meta.env.PUBLIC_DASHBOARD_URL || DASHBOARD_FALLBACK_URL
	)
		.trim()
		.replace(/\/$/, "");

	return `${baseUrl}/api/onboarding/accept-invitation`;
};

export const GET: APIRoute = async ({ request }) => {
	try {
		const requestUrl = new URL(request.url);
		const endpoint = new URL(getDashboardApiUrl());
		const inviteId = requestUrl.searchParams.get("inviteId");
		if (inviteId) {
			endpoint.searchParams.set("inviteId", inviteId);
		}

		const response = await fetch(endpoint.toString(), {
			method: "GET",
		});

		const responseBody = await response.text();
		const responseContentType =
			response.headers.get("content-type") || "application/json";

		return new Response(responseBody, {
			status: response.status,
			headers: {
				"Content-Type": responseContentType,
			},
		});
	} catch (error) {
		console.error("Error proxying invitation lookup request:", error);
		return new Response(
			JSON.stringify({
				error: "Unable to reach dashboard onboarding service",
			}),
			{
				status: 502,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.text();
		const contentType =
			request.headers.get("content-type") || "application/json";
		const endpoint = getDashboardApiUrl();

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": contentType,
			},
			body,
		});

		const responseBody = await response.text();
		const responseContentType =
			response.headers.get("content-type") || "application/json";

		return new Response(responseBody, {
			status: response.status,
			headers: {
				"Content-Type": responseContentType,
			},
		});
	} catch (error) {
		console.error("Error proxying accept-invitation request:", error);
		return new Response(
			JSON.stringify({
				error: "Unable to reach dashboard onboarding service",
			}),
			{
				status: 502,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
