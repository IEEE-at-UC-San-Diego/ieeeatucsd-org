import type { APIContext } from "astro";
import { adminAuth } from "../firebase/server";
import { db } from "../pages/api/set-session";

export async function onRequest(
  context: APIContext,
  next: () => Promise<Response>,
) {
  const { url, cookies, redirect } = context;
  const path = url.pathname;

  if (path.startsWith("/api/") || path.startsWith("/signin") || path.startsWith("/signout")) {
    return next();
  }

  // Legacy Redirect: /dashboard/* -> /*
  if (path.startsWith("/dashboard")) {
    const newPath = path.replace(/^\/dashboard/, "") || "/";
    return redirect(newPath);
  }

  // Auth Protection for all other routes
  const session = cookies.get("session")?.value;

  if (!session) {
    return redirect("/signin");
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);

    if (path !== "/get-started") {
      const userRef = db.doc(`users/${decoded.uid}`);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const data = userSnap.data();
        const isSponsor = data?.role === "Sponsor";
        // Sponsors bypass the getting started page
        if (data && !data.signedUp && !isSponsor) {
          return redirect("/get-started");
        }
      }
    }

    return next();
  } catch (error) {
    cookies.delete("session", { path: "/" });
    return redirect("/signin");
  }
}
