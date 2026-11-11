import { afterEach, describe, expect, it } from "vitest";
import { getCurrentUser } from "./permissions";

const SESSION_SECRET = "test-convex-session-secret";

async function mintBridgeToken(sub: string, expSeconds: number) {
  const payload = {
    sub,
    iat: expSeconds - 300,
    exp: expSeconds,
    v: 1,
  };
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${encodedPayload}.${hex}`;
}

function ctxThatMustNotReadDb() {
  return {
    auth: { getUserIdentity: async () => null },
    db: {
      query() {
        throw new Error("db should not be read");
      },
    },
  };
}

describe("expired bridge token", () => {
  afterEach(() => {
    delete process.env.CONVEX_SESSION_SECRET;
  });

  it("returns null from getCurrentUser instead of throwing Auth token expired", async () => {
    process.env.CONVEX_SESSION_SECRET = SESSION_SECRET;
    const token = await mintBridgeToken(
      "logto|daniel",
      Math.floor(Date.now() / 1000) - 30,
    );

    await expect(
      getCurrentUser(
        ctxThatMustNotReadDb() as never,
        "logto|daniel",
        token,
      ),
    ).resolves.toBeNull();
  });

  it("still rejects a bridge token with a bad signature", async () => {
    process.env.CONVEX_SESSION_SECRET = SESSION_SECRET;
    const token = await mintBridgeToken(
      "logto|daniel",
      Math.floor(Date.now() / 1000) + 300,
    );
    const forged = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(
      getCurrentUser(ctxThatMustNotReadDb() as never, "logto|daniel", forged),
    ).rejects.toThrow("signature");
  });
});
