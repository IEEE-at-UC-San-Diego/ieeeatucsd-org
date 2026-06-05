import { describe, expect, it, vi } from "vitest";
import {
  finalizeSignInAndGetRedirect,
  getPostSignInRedirectPath,
} from "./callbackFlow";

describe("getPostSignInRedirectPath", () => {
  it("returns get-started for unsigned non-sponsor user", () => {
    expect(getPostSignInRedirectPath(false, "Member")).toBe("/get-started");
  });

  it("returns overview for signed-up user", () => {
    expect(getPostSignInRedirectPath(true, "Member")).toBe("/overview");
  });

  it("returns overview for sponsor user", () => {
    expect(getPostSignInRedirectPath(false, "Sponsor")).toBe("/overview");
  });
});

describe("finalizeSignInAndGetRedirect", () => {
  it("routes new non-sponsor users to get-started", async () => {
    const redirect = await finalizeSignInAndGetRedirect({
      getIdTokenClaims: async () => ({
        sub: "logto|new-user",
        email: "new-user@example.com",
        name: "New User",
      }),
      getAccessToken: async () => "access-token",
      createSession: async () => ({ sessionToken: "session-token" }),
      upsertUser: async () => ({
        signedUp: false,
        role: "Member",
      }),
    });

    expect(redirect).toBe("/get-started");
  });

  it("routes existing users to overview", async () => {
    const redirect = await finalizeSignInAndGetRedirect({
      getIdTokenClaims: async () => ({
        sub: "logto|existing-user",
        email: "existing-user@example.com",
        name: "Existing User",
      }),
      getAccessToken: async () => "access-token",
      createSession: async () => ({ sessionToken: "session-token" }),
      upsertUser: async () => ({
        signedUp: true,
        role: "Member",
      }),
    });

    expect(redirect).toBe("/overview");
  });

  it("throws if session creation fails so caller can route to signin", async () => {
    const createSession = vi.fn(async () => {
      throw new Error("session failed");
    });

    await expect(
      finalizeSignInAndGetRedirect({
        getIdTokenClaims: async () => ({
          sub: "logto|user",
          email: "user@example.com",
        }),
        getAccessToken: async () => "access-token",
        createSession,
        upsertUser: async () => ({
          signedUp: false,
          role: "Member",
        }),
      }),
    ).rejects.toThrow("session failed");
  });
});
