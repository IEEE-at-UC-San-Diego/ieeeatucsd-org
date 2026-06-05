import type { APIContext } from "astro";

export async function onRequest(
  context: APIContext,
  next: () => Promise<Response>,
) {
  const { url, redirect } = context;
  const path = url.pathname;

  // Legacy Dashboard Redirect
  if (path.startsWith("/dashboard")) {
    const newPath = path.replace(/^\/dashboard/, "") || "/";
    // In development, might want to redirect to the local dashboard port if running?
    // But for production fidelity and per user request "dashboard.ieeeatucsd.org", we'll check env or just hardcode for now.
    // User requested "redirect it accordingly", implying the new subdomain.

    // We can use an environment variable or default to the production domain.
    const dashboardDomain =
      import.meta.env.PUBLIC_DASHBOARD_URL ||
      "https://dashboard.ieeeatucsd.org";

    // Remove leading slash from newPath if domain doesn't have trailing slash?
    // Usually URLs match well. path.replace strips /dashboard. newPath starts with / or is /.
    // dashboardDomain likely doesn't have trailing slash.

    return redirect(`${dashboardDomain}${newPath}`, 301);
  }

  return next();
}
