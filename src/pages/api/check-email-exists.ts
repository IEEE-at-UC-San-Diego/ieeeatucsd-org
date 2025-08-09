import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Email existence check request received");

    const requestBody = await request.json();
    console.log(
      "Request body:",
      JSON.stringify({
        email: requestBody.email,
      }),
    );

    const { email } = requestBody;

    if (!email) {
      console.log("Missing email address");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing email address",
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
    const [username, domain] = email.split("@");

    if (!username || !domain) {
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

    // MXRoute DirectAdmin API credentials from environment variables
    const loginKey = import.meta.env.MXROUTE_LOGIN_KEY;
    const serverLogin = import.meta.env.MXROUTE_SERVER_LOGIN;
    const serverUrl = import.meta.env.MXROUTE_SERVER_URL;

    if (!loginKey || !serverLogin || !serverUrl) {
      throw new Error("Missing MXRoute configuration");
    }

    // DirectAdmin API endpoint for listing email accounts
    let baseUrl = serverUrl;

    // If the URL contains a specific command, extract just the base URL
    if (baseUrl.includes("/CMD_")) {
      baseUrl = baseUrl.split("/CMD_")[0];
    }

    // Make sure there's no trailing slash
    baseUrl = baseUrl.replace(/\/$/, "");

    // Construct the email POP API URL for listing accounts
    const emailApiUrl = `${baseUrl}/CMD_API_EMAIL_POP`;

    console.log(`Checking if email exists: ${email}`);
    console.log(`DirectAdmin API URL: ${emailApiUrl}`);

    // Check if the email account exists by trying to list it
    const formData = new URLSearchParams();
    formData.append("action", "list");
    formData.append("domain", domain);

    console.log("Form data:");
    console.log(`  action: list`);
    console.log(`  domain: ${domain}`);

    console.log("Sending request to DirectAdmin API...");
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
      // If it's an error, we'll assume the email doesn't exist for safety
      return new Response(
        JSON.stringify({
          success: true,
          exists: false,
          message: "Unable to verify email existence, proceeding with creation",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Parse the response to check if the username exists
    // DirectAdmin returns email accounts in a specific format
    const emailExists =
      responseText.includes(`${username}=`) ||
      responseText.includes(`user=${username}`);

    console.log(
      `Email existence check result: ${emailExists ? "exists" : "does not exist"}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        exists: emailExists,
        message: emailExists
          ? `Email ${email} already exists`
          : `Email ${email} is available`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in check-email-exists:", error);

    // In case of error, return false for safety (allow creation attempt)
    return new Response(
      JSON.stringify({
        success: true,
        exists: false,
        message: "Unable to verify email existence, proceeding with creation",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
