import { describe, expect, it, vi } from "vitest";
import { refreshSessionWithRetry } from "./sessionRefresh";

describe("refreshSessionWithRetry", () => {
  it("uses the latest access token when available", async () => {
    const getLatestAccessToken = vi.fn(async () => "fresh-access-token");
    const mintSession = vi.fn(async (accessToken: string) => ({
      sessionToken: `session-for-${accessToken}`,
      expiresAt: Date.now() + 60_000,
    }));

    const result = await refreshSessionWithRetry({
      currentAccessToken: "stale-access-token",
      getLatestAccessToken,
      mintSession,
      baseDelayMs: 0,
    });

    expect(getLatestAccessToken).toHaveBeenCalled();
    expect(mintSession).toHaveBeenCalledWith("fresh-access-token");
    expect(result.accessToken).toBe("fresh-access-token");
  });

  it("retries transient mint failures and eventually succeeds", async () => {
    const getLatestAccessToken = vi.fn(async () => "stable-token");
    const mintSession = vi
      .fn<(_: string) => Promise<{ sessionToken: string; expiresAt: number }>>()
      .mockRejectedValueOnce(new Error("temporary failure 1"))
      .mockRejectedValueOnce(new Error("temporary failure 2"))
      .mockResolvedValueOnce({
        sessionToken: "session-token",
        expiresAt: Date.now() + 60_000,
      });

    const result = await refreshSessionWithRetry({
      currentAccessToken: "stable-token",
      getLatestAccessToken,
      mintSession,
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(mintSession).toHaveBeenCalledTimes(3);
    expect(result.session.sessionToken).toBe("session-token");
  });

  it("fails after exhausting retry budget", async () => {
    const getLatestAccessToken = vi.fn(async () => "stable-token");
    const mintSession = vi.fn(async () => {
      throw new Error("persistent failure");
    });

    await expect(
      refreshSessionWithRetry({
        currentAccessToken: "stable-token",
        getLatestAccessToken,
        mintSession,
        maxAttempts: 3,
        baseDelayMs: 0,
      }),
    ).rejects.toThrow("persistent failure");

    expect(mintSession).toHaveBeenCalledTimes(3);
  });
});
