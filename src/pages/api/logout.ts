import type { APIRoute } from "astro";

// Mark this endpoint as server-rendered, not static
export const prerender = false;

export const GET: APIRoute = async ({ request, redirect }) => {
  try {
    // Get the Logto endpoint and client ID from environment variables
    const logtoEndpoint = import.meta.env.LOGTO_ENDPOINT;
    const clientId = import.meta.env.LOGTO_POCKETBASE_APP_ID;

    if (!logtoEndpoint) {
      throw new Error("LOGTO_ENDPOINT environment variable is not set");
    }

    if (!clientId) {
      throw new Error(
        "LOGTO_POCKETBASE_APP_ID environment variable is not set",
      );
    }

    // Get the current origin to use as the redirect URL
    const url = new URL(request.url);
    const origin = url.origin;

    // Construct the redirect URL (back to dashboard)
    const redirectUrl = `${origin}/dashboard`;

    // Log the redirect URL for debugging
    console.log(`Setting post-logout redirect to: ${redirectUrl}`);
    console.log(`Using client ID: ${clientId}`);

    // Make a POST request to the Logto session end endpoint with the redirect in the body
    const logoutUrl = `${logtoEndpoint}/oidc/session/end`;
    
    console.log(`Using Logto endpoint: ${logtoEndpoint}`);
    console.log(`Full logout URL: ${logoutUrl}`);

    try {
      // Try to make a POST request with the redirect in the body and client ID
      const response = await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          post_logout_redirect_uri: redirectUrl,
          client_id: clientId,
        }),
        redirect: "manual", // Don't automatically follow redirects
      });

      // If we get a redirect response, follow it
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (location) {
          console.log(`Received redirect to: ${location}`);
          return redirect(location);
        }
      }

      // If POST doesn't work, fall back to the query parameter approach
      console.log(
        "POST request didn't result in expected redirect, falling back to GET",
      );
      return redirect(
        `${logoutUrl}?post_logout_redirect_uri=${encodeURIComponent(redirectUrl)}&client_id=${encodeURIComponent(clientId)}`,
      );
    } catch (fetchError) {
      console.error("Error making POST request to Logto:", fetchError);
      // Fall back to the query parameter approach
      return redirect(
        `${logoutUrl}?post_logout_redirect_uri=${encodeURIComponent(redirectUrl)}&client_id=${encodeURIComponent(clientId)}`,
      );
    }
  } catch (error) {
    console.error("Error in logout API:", error);

    // If there's an error, redirect to dashboard anyway
    return redirect("/dashboard");
  }
};

export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete('session', { path: '/' });
  return redirect('/dashboard/signin');
};
