import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const requestBody = await request.json();
    const { userId, email, adminUserId } = requestBody;

    if (!userId || !email || !adminUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required parameters (userId, email, adminUserId)",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Extract username and domain from email
    const emailParts = email.split("@");
    if (emailParts.length !== 2) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid email format",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const [username, domain] = emailParts;

    // MXRoute DirectAdmin API credentials from environment variables
    const loginKey = import.meta.env.MXROUTE_LOGIN_KEY;
    const serverLogin = import.meta.env.MXROUTE_SERVER_LOGIN;
    const serverUrl = import.meta.env.MXROUTE_SERVER_URL;

    if (!loginKey || !serverLogin || !serverUrl) {
      throw new Error("Missing MXRoute configuration");
    }

    // DirectAdmin API endpoint for managing email accounts
    let baseUrl = serverUrl;

    // If the URL contains a specific command, extract just the base URL
    if (baseUrl.includes("/CMD_")) {
      baseUrl = baseUrl.split("/CMD_")[0];
    }

    // Make sure there's no trailing slash
    baseUrl = baseUrl.replace(/\/$/, "");

    // Construct the email POP API URL
    const emailApiUrl = `${baseUrl}/CMD_API_EMAIL_POP`;

    // DirectAdmin doesn't have a direct "disable" function, so we'll set the quota to 0
    // This effectively disables the account by preventing new emails from being received
    const formData = new URLSearchParams();
    formData.append("action", "modify");
    formData.append("domain", domain);
    formData.append("user", username);
    formData.append("quota", "0"); // Set quota to 0 to disable
    const response = await fetch(emailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${serverLogin}:${loginKey}`).toString("base64")}`,
      },
      body: formData,
    });

    const responseText = await response.text();

    // DirectAdmin API returns "error=1" in the response text for errors
    if (responseText.includes("error=1") || !response.ok) {
      const errorMessage = responseText.includes("error=1")
        ? "Failed to disable email account. The account may not exist or there was a server error."
        : `HTTP error! status: ${response.status}`;

      return new Response(
        JSON.stringify({
          success: false,
          message: errorMessage,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email account ${email} has been disabled successfully.`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
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
