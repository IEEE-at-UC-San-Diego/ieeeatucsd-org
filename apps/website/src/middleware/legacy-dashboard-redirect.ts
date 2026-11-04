export function legacyDashboardRedirect(
  pathname: string,
  dashboardBase: string,
): string | null {
  if (!pathname.startsWith("/dashboard")) {
    return null;
  }

  const newPath = pathname.replace(/^\/dashboard/, "") || "/";
  const dashboardDomain = dashboardBase.replace(/\/$/, "");
  return `${dashboardDomain}${newPath}`;
}
