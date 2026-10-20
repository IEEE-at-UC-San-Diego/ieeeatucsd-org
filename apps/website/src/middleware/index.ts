import type { APIContext } from "astro";

export async function onRequest(
  context: APIContext,
  next: () => Promise<Response>,
) {
  const { url, redirect } = context;
  const path = url.pathname;

  // Legacy `/dashboard/*` paths → dashboard subdomain (e.g. ieeeatucsd.org/dashboard → dashboard.ieeeatucsd.org/)
  if (path.startsWith("/dashboard")) {
    const newPath = path.replace(/^\/dashboard/, "") || "/";
    const dashboardDomain = (
      import.meta.env.PUBLIC_DASHBOARD_URL || "https://dashboard.ieeeatucsd.org"
    ).replace(/\/$/, "");

    return redirect(`${dashboardDomain}${newPath}`, 301);
  }

  return next();
}
