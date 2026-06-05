import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/server/auth";
import { createConvexSessionToken } from "@/server/convex-session";
import { errorMessage, logAuthEvent } from "@/lib/auth/logging";
import { isNativeAuthBridgeMode } from "@/lib/auth/mode";
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

    if (isNativeAuthBridgeMode()) {
      logAuthEvent("legacy_session_endpoint_rejected", { requestId });
      return new Response(
        JSON.stringify({ error: "Legacy session minting is disabled in native auth mode" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const authResult = await requireApiAuth(request, {
      allowMissingBody: true,
      allowUnprovisionedUser: true,
    });
    if (authResult instanceof Response) return authResult;

    const { logtoId, user } = authResult;
    logAuthEvent("legacy_session_endpoint_started", { requestId, logtoId });
    const { token, payload } = createConvexSessionToken({
      sub: logtoId,
      role: user.role as UserRole | undefined,
    });

    logAuthEvent("legacy_session_endpoint_succeeded", {
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
    logAuthEvent("legacy_session_endpoint_failed", {
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
