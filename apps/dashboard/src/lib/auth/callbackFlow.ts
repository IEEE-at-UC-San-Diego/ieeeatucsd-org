export interface CallbackUser {
  signedUp: boolean;
  role: string;
}

export interface CallbackClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface FinalizeSignInDeps {
  getIdTokenClaims?: () => Promise<CallbackClaims | null | undefined>;
  getAccessToken?: () => Promise<string | null | undefined>;
  createSession: (accessToken: string) => Promise<{ sessionToken: string }>;
  upsertUser: (args: {
    logtoId: string;
    authToken: string;
    email: string;
    name: string;
    avatar?: string;
    signInMethod: string;
  }) => Promise<CallbackUser>;
}

export function getPostSignInRedirectPath(signedUp: boolean, role: string) {
  return !signedUp && role !== "Sponsor" ? "/get-started" : "/overview";
}

export async function finalizeSignInAndGetRedirect({
  getIdTokenClaims,
  getAccessToken,
  createSession,
  upsertUser,
}: FinalizeSignInDeps) {
  const claims = await getIdTokenClaims?.();
  if (!claims?.sub) {
    throw new Error("Missing user claims");
  }

  const accessToken = await getAccessToken?.();
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const session = await createSession(accessToken);
  const user = await upsertUser({
    logtoId: claims.sub,
    authToken: session.sessionToken,
    email: claims.email || "",
    name: claims.name || claims.sub,
    avatar: claims.picture,
    signInMethod: "logto",
  });

  return getPostSignInRedirectPath(user.signedUp, user.role);
}
