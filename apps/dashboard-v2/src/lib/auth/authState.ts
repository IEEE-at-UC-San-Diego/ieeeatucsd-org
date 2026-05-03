interface ResolveAuthStateInput {
  logtoLoading: boolean;
  isAuthenticated: boolean;
  logtoId: string | null;
  accessToken: string | null;
  convexSessionToken: string | null;
  convexUser: unknown;
  isProvisioningUser: boolean;
  hasProvisioningAttempt: boolean;
  authFailureReason: string | null;
}

export function resolveAuthState({
  logtoLoading,
  isAuthenticated,
  logtoId,
  accessToken,
  convexSessionToken,
  convexUser,
  isProvisioningUser,
  hasProvisioningAttempt,
  authFailureReason,
}: ResolveAuthStateInput) {
  if (authFailureReason) {
    return {
      isAuthResolved: true,
      isLoading: false,
    };
  }

  // Logto often reports isAuthenticated=false while it is still loading the
  // session from storage (new tab, hard refresh). If we treat that as "signed
  // out and resolved", dashboard routes redirect to /signin and then overview.
  if (logtoLoading && !isAuthenticated) {
    return {
      isAuthResolved: false,
      isLoading: true,
    };
  }

  if (!isAuthenticated) {
    return {
      isAuthResolved: true,
      isLoading: false,
    };
  }

  const hasCoreSession = !!logtoId && !!accessToken && !!convexSessionToken;
  if (!hasCoreSession) {
    return {
      isAuthResolved: false,
      isLoading: true,
    };
  }

  const isAuthResolved =
    convexUser !== undefined &&
    !(convexUser === null && isProvisioningUser) &&
    !(convexUser === null && !hasProvisioningAttempt);

  return {
    isAuthResolved,
    isLoading: !isAuthResolved,
  };
}

interface ShouldAttemptProvisioningInput {
  isAuthenticated: boolean;
  logtoId: string | null;
  convexSessionToken: string | null;
  convexUser: unknown;
  lastProvisioningAttemptLogtoId: string | null;
}

export function shouldAttemptProvisioning({
  isAuthenticated,
  logtoId,
  convexSessionToken,
  convexUser,
  lastProvisioningAttemptLogtoId,
}: ShouldAttemptProvisioningInput) {
  if (!isAuthenticated || !logtoId || !convexSessionToken) return false;
  if (convexUser !== null) return false;
  return lastProvisioningAttemptLogtoId !== logtoId;
}
