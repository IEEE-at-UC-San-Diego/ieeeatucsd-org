/**
 * Native Convex auth against Logto (works on self-hosted Convex).
 *
 * This is OIDC JWT validation via auth.config — not the @convex-dev/auth
 * component. Self-hosted deployments support this path.
 *
 * LOGTO_ENDPOINT may be either the Logto base URL or the OIDC issuer
 * (`…/oidc`). We normalize to the issuer so `domain` matches the ID token `iss`.
 */
function resolveLogtoOidcIssuer(endpoint: string): string {
  const normalized = endpoint.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("Logto endpoint is empty");
  }
  return normalized.endsWith("/oidc") ? normalized : `${normalized}/oidc`;
}

const logtoEndpoint =
  process.env.LOGTO_ENDPOINT || process.env.VITE_LOGTO_ENDPOINT;
const applicationID = process.env.LOGTO_APP_ID || process.env.VITE_LOGTO_APP_ID;

if (!logtoEndpoint) {
  throw new Error(
    "Missing LOGTO_ENDPOINT or VITE_LOGTO_ENDPOINT for Convex auth",
  );
}

if (!applicationID) {
  throw new Error("Missing LOGTO_APP_ID or VITE_LOGTO_APP_ID for Convex auth");
}

const domain = resolveLogtoOidcIssuer(logtoEndpoint);

export default {
  providers: [
    {
      domain,
      applicationID,
    },
  ],
};
