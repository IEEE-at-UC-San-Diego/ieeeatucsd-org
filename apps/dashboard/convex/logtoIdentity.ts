import type { UserIdentity } from "convex/server";

export type VerifiedIdentity = {
  subject: string;
  email: string;
  name?: string;
  picture?: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  sub?: unknown;
  email?: unknown;
  name?: unknown;
  picture?: unknown;
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
};

type JsonWebKeyWithKid = JsonWebKey & { kid?: string; alg?: string };

type JwksDocument = {
  keys?: JsonWebKeyWithKid[];
};

export type AuthLike = {
  auth: {
    getUserIdentity: () => Promise<UserIdentity | null>;
  };
};

const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const SUPPORTED_ALGS = new Set(["ES256", "ES384", "RS256"]);

let jwksCache: { uri: string; keys: JsonWebKeyWithKid[]; expiresAt: number } | null =
  null;

/**
 * Resolves a verified Logto identity for Convex functions.
 *
 * Prefers Convex native auth (`ctx.auth.getUserIdentity()`), which works when
 * the deployment can verify the Logto JWT (typically RS256/ES256). Logto Cloud
 * defaults to ES384, which Convex cannot verify — in that case the caller must
 * pass the Logto ID token and we validate it against the Logto JWKS.
 */
export class LogtoIdentity {
  static fetchImpl: typeof fetch = fetch;
  static nowMs: () => number = () => Date.now();

  static clearCache() {
    jwksCache = null;
  }

  static resolveOidcIssuer(endpoint: string): string {
    const normalized = endpoint.trim().replace(/\/+$/, "");
    if (!normalized) {
      throw new Error("Logto endpoint is empty");
    }
    return normalized.endsWith("/oidc") ? normalized : `${normalized}/oidc`;
  }

  static getConfig() {
    const endpoint =
      process.env.LOGTO_ENDPOINT || process.env.VITE_LOGTO_ENDPOINT;
    const applicationID =
      process.env.LOGTO_APP_ID || process.env.VITE_LOGTO_APP_ID;

    if (!endpoint) {
      throw new Error(
        "Missing LOGTO_ENDPOINT or VITE_LOGTO_ENDPOINT for Logto token verification",
      );
    }
    if (!applicationID) {
      throw new Error(
        "Missing LOGTO_APP_ID or VITE_LOGTO_APP_ID for Logto token verification",
      );
    }

    return {
      issuer: LogtoIdentity.resolveOidcIssuer(endpoint),
      audience: applicationID,
    };
  }

  static async fromConvexAuth(ctx: AuthLike): Promise<VerifiedIdentity | null> {
    try {
      const identity = await ctx.auth.getUserIdentity();
      return LogtoIdentity.fromUserIdentity(identity);
    } catch {
      return null;
    }
  }

  static fromUserIdentity(
    identity: UserIdentity | null | undefined,
  ): VerifiedIdentity | null {
    if (!identity?.subject) return null;
    const email = identity.email;
    if (!email || typeof email !== "string") return null;
    return {
      subject: identity.subject,
      email,
      name: typeof identity.name === "string" ? identity.name : undefined,
      picture:
        typeof identity.pictureUrl === "string" ? identity.pictureUrl : undefined,
    };
  }

  static async fromJwt(token: string): Promise<VerifiedIdentity> {
    const { issuer, audience } = LogtoIdentity.getConfig();
    const claims = await LogtoIdentity.verifyJwt(token, issuer, audience);
    const subject = asNonEmptyString(claims.sub);
    const email = asNonEmptyString(claims.email);
    if (!subject) {
      throw new Error("Logto token missing subject");
    }
    if (!email) {
      throw new Error("Logto token missing email");
    }
    return {
      subject,
      email,
      name: asNonEmptyString(claims.name),
      picture: asNonEmptyString(claims.picture),
    };
  }

  /**
   * Prefer a Convex-verified identity. If that is unavailable (common when
   * Logto signs ID tokens with ES384), verify `authToken` as a Logto JWT.
   */
  static async resolve(
    ctx: AuthLike,
    authToken?: string,
  ): Promise<VerifiedIdentity> {
    const native = await LogtoIdentity.fromConvexAuth(ctx);
    if (native) {
      return native;
    }
    if (!authToken || authToken.trim().length === 0) {
      throw new Error("Authentication required");
    }
    return await LogtoIdentity.fromJwt(authToken);
  }

  static async verifyJwt(
    token: string,
    issuer: string,
    audience: string,
  ): Promise<JwtPayload> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid Logto token format");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    let header: JwtHeader;
    let payload: JwtPayload;
    try {
      header = decodeJson<JwtHeader>(encodedHeader);
      payload = decodeJson<JwtPayload>(encodedPayload);
    } catch {
      throw new Error("Invalid Logto token format");
    }

    const alg = header.alg;
    if (!alg || !SUPPORTED_ALGS.has(alg)) {
      throw new Error("Unsupported Logto token algorithm");
    }

    const keys = await LogtoIdentity.getJwks(issuer);
    const candidates = keys.filter((key) => {
      if (header.kid && key.kid && key.kid !== header.kid) return false;
      if (key.alg && key.alg !== alg) return false;
      return true;
    });
    if (candidates.length === 0) {
      throw new Error("Logto token signing key not found");
    }

    const signingInput = new TextEncoder().encode(
      `${encodedHeader}.${encodedPayload}`,
    );
    const signature = decodeBase64Url(encodedSignature);

    let verified = false;
    for (const jwk of candidates) {
      try {
        const key = await importVerifyKey(jwk, alg);
        verified = await crypto.subtle.verify(
          verifyAlgorithm(alg),
          key,
          signature.buffer as ArrayBuffer,
          signingInput,
        );
        if (verified) break;
      } catch {
        // Try the next JWKS candidate.
      }
    }

    if (!verified) {
      throw new Error("Invalid Logto token signature");
    }

    const now = LogtoIdentity.nowMs();
    if (typeof payload.exp !== "number") {
      throw new Error("Logto token missing expiry");
    }
    if (payload.exp * 1000 <= now - CLOCK_SKEW_MS) {
      throw new Error("Logto token expired");
    }
    if (
      typeof payload.nbf === "number" &&
      payload.nbf * 1000 > now + CLOCK_SKEW_MS
    ) {
      throw new Error("Logto token is not yet valid");
    }
    if (payload.iss !== issuer) {
      throw new Error("Logto token issuer mismatch");
    }
    if (!audienceMatches(payload.aud, audience)) {
      throw new Error("Logto token audience mismatch");
    }

    return payload;
  }

  private static async getJwks(issuer: string): Promise<JsonWebKeyWithKid[]> {
    const jwksUri = `${issuer}/jwks`;
    const now = LogtoIdentity.nowMs();
    if (
      jwksCache &&
      jwksCache.uri === jwksUri &&
      jwksCache.expiresAt > now
    ) {
      return jwksCache.keys;
    }

    const response = await LogtoIdentity.fetchImpl(jwksUri);
    if (!response.ok) {
      throw new Error("Failed to fetch Logto JWKS");
    }

    const document = (await response.json()) as JwksDocument;
    const keys = Array.isArray(document.keys) ? document.keys : [];
    if (keys.length === 0) {
      throw new Error("Logto JWKS did not contain any keys");
    }

    jwksCache = {
      uri: jwksUri,
      keys,
      expiresAt: now + JWKS_TTL_MS,
    };
    return keys;
  }
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function audienceMatches(aud: unknown, expected: string): boolean {
  if (typeof aud === "string") return aud === expected;
  if (Array.isArray(aud)) {
    return aud.some((value) => value === expected);
  }
  return false;
}

function decodeBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJson<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(input))) as T;
}

function verifyAlgorithm(alg: string): AlgorithmIdentifier | EcdsaParams {
  if (alg === "ES256") return { name: "ECDSA", hash: "SHA-256" };
  if (alg === "ES384") return { name: "ECDSA", hash: "SHA-384" };
  return { name: "RSASSA-PKCS1-v1_5" };
}

function importAlgorithm(alg: string, jwk: JsonWebKey): EcKeyImportParams | RsaHashedImportParams {
  if (alg === "ES256") {
    return { name: "ECDSA", namedCurve: jwk.crv ?? "P-256" };
  }
  if (alg === "ES384") {
    return { name: "ECDSA", namedCurve: jwk.crv ?? "P-384" };
  }
  return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
}

async function importVerifyKey(jwk: JsonWebKey, alg: string) {
  return await crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["verify"], ext: true },
    importAlgorithm(alg, jwk),
    false,
    ["verify"],
  );
}
