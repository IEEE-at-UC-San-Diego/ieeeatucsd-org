import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { userId, username, logtoApiEndpoint, profile } =
      await request.json();

    if (!userId || !username || !logtoApiEndpoint) {
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

    // Update user data in Logto
    const updateResponse = await fetch(
      `${logtoApiEndpoint}/api/users/${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          profile,
        }),
      },
    );

    if (!updateResponse.ok) {
      throw new Error("Failed to update user data in Logto");
    }

    const updatedData = await updateResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedData,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in update-logto-user:", error);
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
