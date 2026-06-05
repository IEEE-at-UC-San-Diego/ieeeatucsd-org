import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { env } from "@/env";
import type { UserRole } from "@/types/roles";

/**
 * Validates a logtoId by checking if the user exists in Convex.
 * Returns the user record if valid, null otherwise.
 */
export async function validateLogtoId(logtoId: string | undefined | null) {
  if (!logtoId || typeof logtoId !== "string" || logtoId.trim().length === 0) {
    return null;
  }

  const url =
    process.env.CONVEX_URL ||
    process.env.VITE_CONVEX_URL ||
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
      .env?.VITE_CONVEX_URL;

  if (!url) return null;

  try {
    const client = new ConvexHttpClient(url);
    const fn = "users:getByLogtoId" as unknown as FunctionReference<"query">;
    const user = await client.query(fn, { logtoId });
    return user ?? null;
  } catch {
    return null;
  }
}

type LogtoOidcMeResponse = {
  sub?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}

export async function validateLogtoAccessToken(accessToken: string) {
  const endpoint = env.LOGTO_ENDPOINT || env.VITE_LOGTO_ENDPOINT;
  if (!endpoint) {
    throw new Error("Missing required env: LOGTO_ENDPOINT (or VITE_LOGTO_ENDPOINT)");
  }

  const response = await fetch(`${endpoint}/oidc/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return null;
  }

  const profile = (await response.json()) as LogtoOidcMeResponse;
  if (!profile.sub || typeof profile.sub !== "string") {
    return null;
  }

  return profile;
}

export function isAiEnabledForUser(
  user: { aiFeaturesEnabled?: boolean } | null | undefined,
) {
  return user?.aiFeaturesEnabled !== false;
}

export function createAiDisabledResponse() {
  return new Response(
    JSON.stringify({
      error: "AI features are disabled for this account",
      code: "AI_DISABLED_BY_USER",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * Returns a 401/403 JSON response for invalid/missing bearer auth.
 * Use at the top of API route handlers.
 */
export async function requireApiAuth(
  request: Request,
  options?: {
    allowMissingBody?: boolean;
    allowUnprovisionedUser?: boolean;
    requiredRoles?: UserRole[];
    validateAccessToken?: (accessToken: string) => Promise<LogtoOidcMeResponse | null>;
    validateProvisionedUser?: (
      logtoId: string,
    ) => Promise<({ role?: UserRole; aiFeaturesEnabled?: boolean } & Record<string, unknown>) | null>;
  },
): Promise<{
  accessToken: string;
  logtoId: string;
  body: Record<string, unknown>;
  claims: LogtoOidcMeResponse;
  user: { role?: UserRole; aiFeaturesEnabled?: boolean } & Record<string, unknown>;
} | Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    if (!options?.allowMissingBody) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Authentication required: missing bearer token" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const validateAccessToken = options?.validateAccessToken ?? validateLogtoAccessToken;
  const validateProvisionedUser = options?.validateProvisionedUser ?? validateLogtoId;

  const claims = await validateAccessToken(accessToken);
  const logtoId = claims?.sub;

  if (!logtoId) {
    return new Response(
      JSON.stringify({ error: "Authentication failed: invalid access token" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const user = await validateProvisionedUser(logtoId);
  if (!user && !options?.allowUnprovisionedUser) {
    return new Response(
      JSON.stringify({ error: "Authenticated user is not provisioned in dashboard" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  if (options?.requiredRoles?.length) {
    const currentRole = user?.role as UserRole | undefined;
    if (!currentRole || !options.requiredRoles.includes(currentRole)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  return {
    accessToken,
    logtoId,
    body,
    claims,
    user: (user ?? {}) as { aiFeaturesEnabled?: boolean } & Record<string, unknown>,
  };
}
