export function legacyDashboardRedirect(
  pathname: string,
  dashboardBase: string,
): string | null {
  if (pathname !== "/dashboard" && !pathname.startsWith("/dashboard/")) {
    return null;
  }

  const rest = pathname.slice("/dashboard".length);
  const path = rest.length === 0 ? "/" : rest;
  const base = dashboardBase.replace(/\/$/, "");
  return `${base}${path}`;
}
