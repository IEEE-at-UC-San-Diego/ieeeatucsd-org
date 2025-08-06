import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Email update request received");

    const requestBody = await request.json();
    console.log(
      "Request body:",
      JSON.stringify({
        userId: requestBody.userId,
        currentEmail: requestBody.currentEmail,
        newAlias: requestBody.newAlias,
        adminUserId: requestBody.adminUserId,
      }),
    );

    const { userId, currentEmail, newAlias, adminUserId } = requestBody;

    if (!userId || !currentEmail || !newAlias || !adminUserId) {
      console.log("Missing required parameters");
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Missing required parameters (userId, currentEmail, newAlias, adminUserId)",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Validate the new alias format
    const aliasRegex = /^[a-zA-Z0-9._-]+$/;
    if (!aliasRegex.test(newAlias)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid alias format. Only letters, numbers, dots, hyphens, and underscores are allowed.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Extract domain from current email
    const emailParts = currentEmail.split('@');
    if (emailParts.length !== 2) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid current email format",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const [currentAlias, domain] = emailParts;
    const newEmail = `${newAlias}@${domain}`;

    // MXRoute DirectAdmin API credentials from environment variables
    const loginKey = import.meta.env.MXROUTE_LOGIN_KEY;
    const serverLogin = import.meta.env.MXROUTE_SERVER_LOGIN;
    const serverUrl = import.meta.env.MXROUTE_SERVER_URL;

    console.log(`Environment variables: 
      loginKey: ${loginKey ? "Set" : "Not set"}
      serverLogin: ${serverLogin ? "Set" : "Not set"}
      serverUrl: ${serverUrl ? "Set" : "Not set"}
    `);

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

    // First, check if the new email already exists
    const checkEmailUrl = `${baseUrl}/CMD_API_EMAIL_POP`;
    const checkFormData = new URLSearchParams();
    checkFormData.append("action", "list");
    checkFormData.append("domain", domain);

    console.log(`Checking if new email exists: ${newEmail}`);
    const checkResponse = await fetch(checkEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${serverLogin}:${loginKey}`).toString("base64")}`,
      },
      body: checkFormData,
    });

    const checkResponseText = await checkResponse.text();
    console.log(`Check response: ${checkResponseText}`);

    // Check if the new alias already exists
    if (checkResponseText.includes(`${newAlias}=`) || checkResponseText.includes(`user=${newAlias}`)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Email address ${newEmail} already exists. Please choose a different alias.`,
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Get current email account details to preserve password and settings
    const emailApiUrl = `${baseUrl}/CMD_API_EMAIL_POP`;
    
    // Since DirectAdmin doesn't have a direct rename function, we need to:
    // 1. Get the current account details
    // 2. Create a new account with the new alias
    // 3. Delete the old account
    
    // For now, we'll return an error indicating this operation requires manual intervention
    // In a production environment, you might want to implement a more complex solution
    // that involves backing up emails, creating new account, and restoring emails
    
    return new Response(
      JSON.stringify({
        success: false,
        message: "Email alias updates require manual intervention. Please contact the webmaster to change your email alias.",
      }),
      {
        status: 501,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

  } catch (error) {
    console.error("Error in update-ieee-email:", error);
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
