import { createFileRoute } from "@tanstack/react-router";

import { AcceptInvitationApi } from "@/server/accept-invitation";

export const Route = createFileRoute("/api/onboarding/accept-invitation")({
	server: {
		handlers: {
			GET: AcceptInvitationApi.handleGet,
			POST: AcceptInvitationApi.handlePost,
		},
	},
});
