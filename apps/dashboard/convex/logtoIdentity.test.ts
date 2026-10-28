import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogtoIdentity } from "./logtoIdentity";

const ISSUER = "https://auth.example.com/oidc";
const AUDIENCE = "logto-app-id";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function jsonToBase64Url(value: unknown) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function generateEs256Pair() {
  return await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
}

async function signEs256Jwt(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "ES256", typ: "JWT" },
) {
  const encodedHeader = jsonToBase64Url(header);
  const encodedPayload = jsonToBase64Url(payload);
  const signingInput = new TextEncoder().encode(
    `${encodedHeader}.${encodedPayload}`,
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      signingInput,
    ),
  );
  return `${encodedHeader}.${encodedPayload}.${bytesToBase64Url(signature)}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LogtoIdentity", () => {
  let privateKey: CryptoKey;
  let publicJwk: JsonWebKey & { kid?: string; alg?: string };

  beforeEach(async () => {
    process.env.LOGTO_ENDPOINT = "https://auth.example.com";
    process.env.LOGTO_APP_ID = AUDIENCE;
    LogtoIdentity.clearCache();
    LogtoIdentity.nowMs = () => 1_700_000_000_000;

    const pair = await generateEs256Pair();
    privateKey = pair.privateKey;
    publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey & {
      kid?: string;
      alg?: string;
    };
    publicJwk.kid = "test-key";
    publicJwk.alg = "ES256";
    publicJwk.use = "sig";

    LogtoIdentity.fetchImpl = vi.fn(async (input) => {
      expect(String(input)).toBe(`${ISSUER}/jwks`);
      return jsonResponse({ keys: [publicJwk] });
    }) as typeof fetch;
  });

  afterEach(() => {
    LogtoIdentity.clearCache();
    LogtoIdentity.fetchImpl = fetch;
    LogtoIdentity.nowMs = () => Date.now();
    delete process.env.LOGTO_ENDPOINT;
    delete process.env.LOGTO_APP_ID;
  });

  it("resolves Convex native identity when present", async () => {
    const identity = await LogtoIdentity.resolve(
      {
        auth: {
          getUserIdentity: async () =>
            ({
              subject: "logto|native",
              email: "native@example.com",
              name: "Native User",
              pictureUrl: "https://example.com/a.png",
            }) as never,
        },
      },
      "ignored-token",
    );

    expect(identity).toEqual({
      subject: "logto|native",
      email: "native@example.com",
      name: "Native User",
      picture: "https://example.com/a.png",
    });
    expect(LogtoIdentity.fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers when Convex auth and token are missing", async () => {
    await expect(
      LogtoIdentity.resolve({
        auth: { getUserIdentity: async () => null },
      }),
    ).rejects.toThrow("Authentication required");
  });

  it("verifies a valid Logto ID token via JWKS", async () => {
    const token = await signEs256Jwt(privateKey, {
      sub: "logto|valid",
      email: "valid@example.com",
      name: "Valid User",
      picture: "https://example.com/v.png",
      iss: ISSUER,
      aud: AUDIENCE,
      exp: 1_700_000_600,
      iat: 1_699_999_000,
    }, { alg: "ES256", typ: "JWT", kid: "test-key" });

    const identity = await LogtoIdentity.fromJwt(token);
    expect(identity).toEqual({
      subject: "logto|valid",
      email: "valid@example.com",
      name: "Valid User",
      picture: "https://example.com/v.png",
    });
  });

  it("rejects a forged signature", async () => {
    const otherPair = await generateEs256Pair();
    const token = await signEs256Jwt(otherPair.privateKey, {
      sub: "logto|forged",
      email: "forged@example.com",
      iss: ISSUER,
      aud: AUDIENCE,
      exp: 1_700_000_600,
    }, { alg: "ES256", typ: "JWT", kid: "test-key" });

    await expect(LogtoIdentity.fromJwt(token)).rejects.toThrow(
      "Invalid Logto token signature",
    );
  });

  it("rejects an expired token", async () => {
    const token = await signEs256Jwt(privateKey, {
      sub: "logto|expired",
      email: "expired@example.com",
      iss: ISSUER,
      aud: AUDIENCE,
      exp: 1_699_999_000,
    }, { alg: "ES256", typ: "JWT", kid: "test-key" });

    await expect(LogtoIdentity.fromJwt(token)).rejects.toThrow(
      "Logto token expired",
    );
  });

  it("rejects issuer and audience mismatches", async () => {
    const wrongIssuer = await signEs256Jwt(privateKey, {
      sub: "logto|user",
      email: "user@example.com",
      iss: "https://evil.example.com/oidc",
      aud: AUDIENCE,
      exp: 1_700_000_600,
    }, { alg: "ES256", typ: "JWT", kid: "test-key" });

    await expect(LogtoIdentity.fromJwt(wrongIssuer)).rejects.toThrow(
      "Logto token issuer mismatch",
    );

    const wrongAudience = await signEs256Jwt(privateKey, {
      sub: "logto|user",
      email: "user@example.com",
      iss: ISSUER,
      aud: "other-app",
      exp: 1_700_000_600,
    }, { alg: "ES256", typ: "JWT", kid: "test-key" });

    await expect(LogtoIdentity.fromJwt(wrongAudience)).rejects.toThrow(
      "Logto token audience mismatch",
    );
  });

  it("rejects HMAC bridge tokens that are not Logto JWTs", async () => {
    await expect(
      LogtoIdentity.fromJwt("%7B%22sub%22%3A%22x%22%7D.deadbeef"),
    ).rejects.toThrow("Invalid Logto token format");
  });
});
