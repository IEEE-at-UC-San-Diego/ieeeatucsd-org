import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { userId, logtoApiEndpoint } = await request.json();

    if (!userId || !logtoApiEndpoint) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required parameters",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Get access token for Logto API
    const tokenResponse = await fetch(`${logtoApiEndpoint}/oidc/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: import.meta.env.LOGTO_APP_ID || "",
        client_secret: import.meta.env.LOGTO_APP_SECRET || "",
        scope: "all",
        resource: "https://default.logto.app/api",
        organization: "ieeeucsd",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user data from Logto
    const userResponse = await fetch(
      `${logtoApiEndpoint}/api/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user data from Logto");
    }

    const userData = await userResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: userData,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in get-logto-user:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
