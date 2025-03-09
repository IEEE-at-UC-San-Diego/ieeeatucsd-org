import type { APIRoute } from "astro";

// Mark this endpoint as server-rendered, not static
export const prerender = false;

// Helper function to get Logto access token
async function getLogtoAccessToken(
  logtoTokenEndpoint: string,
  clientId: string,
  clientSecret: string,
  scope: string = "all",
): Promise<string | null> {
  try {
    console.log("Attempting to get access token from Logto");

    // Create Basic auth string
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      resource: "https://default.logto.app/api",
      scope: scope,
    });

    const response = await fetch(logtoTokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authString}`,
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token request error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("Network error fetching token:", error);
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Received change password request");

    // Parse request body
    const contentType = request.headers.get("content-type");
    const rawBody = await request.text();

    let data;
    if (contentType?.includes("application/json")) {
      data = JSON.parse(rawBody);
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      const formData = new URLSearchParams(rawBody);
      data = Object.fromEntries(formData.entries());
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unsupported content type. Please use JSON or form data.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Extract required parameters
    const {
      userId,
      newPassword,
      logtoAppId,
      logtoAppSecret,
      logtoTokenEndpoint,
      logtoApiEndpoint,
    } = data;

    // Validate required parameters
    const missingParams = [];
    if (!userId) missingParams.push("userId");
    if (!newPassword) missingParams.push("newPassword");
    if (!logtoAppId) missingParams.push("logtoAppId");
    if (!logtoAppSecret) missingParams.push("logtoAppSecret");
    if (!logtoTokenEndpoint) missingParams.push("logtoTokenEndpoint");
    if (!logtoApiEndpoint) missingParams.push("logtoApiEndpoint");

    if (missingParams.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Missing required parameters: ${missingParams.join(", ")}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get access token
    const accessToken = await getLogtoAccessToken(
      logtoTokenEndpoint,
      logtoAppId,
      logtoAppSecret,
    );

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to obtain access token from Logto",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Change password using Logto Management API
    const changePasswordResponse = await fetch(
      `${logtoApiEndpoint}/api/users/${userId}/password`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password: newPassword }),
      },
    );

    if (!changePasswordResponse.ok) {
      const errorData = await changePasswordResponse.json().catch(() => ({
        message: "Could not read error response",
      }));

      return new Response(
        JSON.stringify({
          success: false,
          message:
            errorData.message ||
            `Failed to change password: ${changePasswordResponse.status} ${changePasswordResponse.statusText}`,
        }),
        {
          status: changePasswordResponse.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password changed successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error in change-password API:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
