interface DashboardUser {
  signedUp?: boolean;
  role?: string;
}

interface DashboardRedirectInput {
  isAuthResolved: boolean;
  isAuthenticated: boolean;
  user: DashboardUser | null;
  pathname: string;
}

export function resolveDashboardRedirect({
  isAuthResolved,
  isAuthenticated,
  user,
  pathname,
}: DashboardRedirectInput): "/signin" | "/get-started" | "/overview" | null {
  if (!isAuthResolved) return null;
  if (!isAuthenticated) return "/signin";
  if (!user) return "/signin";
  if (!user.signedUp && user.role !== "Sponsor" && pathname !== "/get-started") {
    return "/get-started";
  }
  if (user.signedUp && pathname === "/get-started") {
    return "/overview";
  }
  return null;
}
