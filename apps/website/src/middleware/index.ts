import type { APIContext } from "astro";
import { legacyDashboardRedirect } from "./legacy-dashboard-redirect";

export async function onRequest(
  context: APIContext,
  next: () => Promise<Response>,
) {
  const { url, redirect } = context;
  const dashboardBase =
    import.meta.env.PUBLIC_DASHBOARD_URL || "https://dashboard.ieeeatucsd.org";
  const target = legacyDashboardRedirect(url.pathname, dashboardBase);
  if (target) {
    return redirect(target, 301);
  }

  return next();
}
