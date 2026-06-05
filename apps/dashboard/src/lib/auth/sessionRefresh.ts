export interface ConvexSessionData {
  sessionToken: string;
  expiresAt: number;
}

interface RefreshSessionWithRetryInput {
  currentAccessToken: string | null;
  getLatestAccessToken: () => Promise<string | null | undefined>;
  mintSession: (accessToken: string) => Promise<ConvexSessionData>;
  maxAttempts?: number;
  baseDelayMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 750;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshSessionWithRetry({
  currentAccessToken,
  getLatestAccessToken,
  mintSession,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}: RefreshSessionWithRetryInput): Promise<{
  session: ConvexSessionData;
  accessToken: string;
}> {
  let tokenCandidate = currentAccessToken;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const latestToken = await getLatestAccessToken();
      if (latestToken) {
        tokenCandidate = latestToken;
      }
    } catch {
      // Continue with existing token if token refresh lookup fails transiently.
    }

    if (!tokenCandidate) {
      throw new Error("Missing access token for session refresh");
    }

    try {
      const session = await mintSession(tokenCandidate);
      return { session, accessToken: tokenCandidate };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * attempt);
      }
    }
  }

  throw (lastError ?? new Error("Failed to refresh session"));
}
