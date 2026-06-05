import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiAuthMock = vi.fn();
const createConvexSessionTokenMock = vi.fn();
const isNativeAuthBridgeModeMock = vi.fn(() => false);

vi.mock("@/server/auth", () => ({
  requireApiAuth: requireApiAuthMock,
}));

vi.mock("@/server/convex-session", () => ({
  createConvexSessionToken: createConvexSessionTokenMock,
}));

vi.mock("@/lib/auth/mode", () => ({
  isNativeAuthBridgeMode: isNativeAuthBridgeModeMock,
  getAuthBridgeMode: () =>
    isNativeAuthBridgeModeMock() ? "native" : "legacy",
}));

describe("POST /api/auth/convex-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativeAuthBridgeModeMock.mockReturnValue(false);
  });

  it("mints a session for a valid but unprovisioned user", async () => {
    requireApiAuthMock.mockResolvedValue({
      logtoId: "logto|new-user",
      user: {},
    });
    createConvexSessionTokenMock.mockReturnValue({
      token: "session-token",
      payload: { exp: 1_700_000_000 },
    });

    const { handleConvexSession } = await import("./convex-session");
    const response = await handleConvexSession({
      request: new Request("http://localhost/api/auth/convex-session", {
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    });

    expect(response.status).toBe(200);
    expect(requireApiAuthMock).toHaveBeenCalledWith(expect.any(Request), {
      allowMissingBody: true,
      allowUnprovisionedUser: true,
    });
    expect(createConvexSessionTokenMock).toHaveBeenCalledWith({
      sub: "logto|new-user",
      role: undefined,
    });

    await expect(response.json()).resolves.toMatchObject({
      sessionToken: "session-token",
      expiresAt: 1_700_000_000_000,
      logtoId: "logto|new-user",
    });
  });

  it("returns unauthorized response when bearer token is missing or invalid", async () => {
    requireApiAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { handleConvexSession } = await import("./convex-session");
    const response = await handleConvexSession({
      request: new Request("http://localhost/api/auth/convex-session", {
        method: "POST",
      }),
    });

    expect(response.status).toBe(401);
    expect(createConvexSessionTokenMock).not.toHaveBeenCalled();
  });

  it("rejects legacy minting in native auth mode", async () => {
    isNativeAuthBridgeModeMock.mockReturnValue(true);

    const { handleConvexSession } = await import("./convex-session");
    const response = await handleConvexSession({
      request: new Request("http://localhost/api/auth/convex-session", {
        method: "POST",
      }),
    });

    expect(response.status).toBe(409);
    expect(requireApiAuthMock).not.toHaveBeenCalled();
    expect(createConvexSessionTokenMock).not.toHaveBeenCalled();
  });
});
