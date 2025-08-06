import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Email creation request received");

    const requestBody = await request.json();
    console.log(
      "Request body:",
      JSON.stringify({
        userId: requestBody.userId,
        name: requestBody.name,
        email: requestBody.email,
        passwordProvided: !!requestBody.password,
      }),
    );

    const { userId, name, email, password } = requestBody;

    if (!userId || !name || !email || !password) {
      console.log("Missing required parameters");
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Missing required parameters (userId, name, email, password)",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Extract username from email (everything before the @ symbol)
    const emailUsername = email.split("@")[0].toLowerCase();
    console.log(`Email username extracted: ${emailUsername}`);

    // Remove any special characters that might cause issues
    const cleanUsername = emailUsername.replace(/[^a-z0-9]/g, "");
    console.log(`Cleaned username: ${cleanUsername}`);

    // Use the provided password
    const newPassword = password;
    console.log(`Using user-provided password`);

    // MXRoute DirectAdmin API credentials from environment variables
    const loginKey = import.meta.env.MXROUTE_LOGIN_KEY;
    const serverLogin = import.meta.env.MXROUTE_SERVER_LOGIN;
    const serverUrl = import.meta.env.MXROUTE_SERVER_URL;
    const emailQuota = import.meta.env.MXROUTE_EMAIL_QUOTA;
    const emailOutboundLimit = import.meta.env.MXROUTE_EMAIL_OUTBOUND_LIMIT;
    const emailDomain = import.meta.env.MXROUTE_EMAIL_DOMAIN;

    console.log(`Environment variables: 
      loginKey: ${loginKey ? "Set" : "Not set"}
      serverLogin: ${serverLogin ? "Set" : "Not set"}
      serverUrl: ${serverUrl ? "Set" : "Not set"}
      emailQuota: ${emailQuota || "Not set"}
      emailOutboundLimit: ${emailOutboundLimit || "Not set"}
      emailDomain: ${emailDomain || "Not set"}
    `);

    if (!loginKey || !serverLogin || !serverUrl || !emailDomain) {
      throw new Error("Missing MXRoute configuration");
    }

    // DirectAdmin API endpoint for creating email accounts
    let baseUrl = serverUrl;

    // If the URL contains a specific command, extract just the base URL
    if (baseUrl.includes("/CMD_")) {
      baseUrl = baseUrl.split("/CMD_")[0];
    }

    // Make sure there's no trailing slash
    baseUrl = baseUrl.replace(/\/$/, "");

    // Construct the email POP API URL
    const emailApiUrl = `${baseUrl}/CMD_API_EMAIL_POP`;

    console.log(`Creating email account: ${cleanUsername}@${emailDomain}`);
    console.log(`DirectAdmin API URL: ${emailApiUrl}`);

    // Create the email account via DirectAdmin API
    // According to DirectAdmin legacy API docs:
    // https://docs.directadmin.com/developer/api/legacy-api.html
    const formData = new URLSearchParams();
    formData.append("action", "create");
    formData.append("domain", emailDomain);
    formData.append("user", cleanUsername); // DirectAdmin uses 'user' for POP accounts
    formData.append("passwd", newPassword);
    formData.append("passwd2", newPassword);
    formData.append("quota", emailQuota || "200");
    formData.append("limit", emailOutboundLimit || "9600");

    // Log the form data being sent (without showing the actual password)
    console.log("Form data:");
    console.log(`  action: create`);
    console.log(`  domain: ${emailDomain}`);
    console.log(`  user: ${cleanUsername}`);
    console.log(`  passwd: ********`);
    console.log(`  passwd2: ********`);
    console.log(`  quota: ${emailQuota || "200"}`);
    console.log(`  limit: ${emailOutboundLimit || "9600"}`);

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
    console.log(`DirectAdmin response status: ${response.status}`);
    console.log(`DirectAdmin response: ${responseText}`);

    // DirectAdmin API returns "error=1" in the response text for errors
    if (responseText.includes("error=1") || !response.ok) {
      console.error("Error creating email account:", responseText);

      // Parse the error details if possible
      let errorMessage = "Failed to create email account";
      try {
        const errorParams = new URLSearchParams(responseText);
        if (errorParams.has("text")) {
          errorMessage = decodeURIComponent(errorParams.get("text") || "");
        }
        if (errorParams.has("details")) {
          const details = decodeURIComponent(errorParams.get("details") || "");
          errorMessage += `: ${details.replace(/<br>/g, " ")}`;
        }
      } catch (e) {
        console.error("Error parsing DirectAdmin error response:", e);
      }

      // If the error is because the email already exists
      if (responseText.includes("already exists")) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Email address ${cleanUsername}@${emailDomain} already exists. Please contact the webmaster for assistance.`,
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      throw new Error(errorMessage);
    }

    console.log("Email account created successfully");

    console.log("Sending notification to webmaster");
    await sendWebmasterNotification(
      userId,
      name,
      email,
      `${cleanUsername}@${emailDomain}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ieeeEmail: `${cleanUsername}@${emailDomain}`,
          message:
            "Email account created successfully with your chosen password.",
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in create-ieee-email:", error);
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

// Send notification to webmaster
async function sendWebmasterNotification(
  userId: string,
  name: string,
  email: string,
  ieeeEmail: string,
) {
  // In a real implementation, you would use an email service
  console.log(`
    To: webmaster@ieeeatucsd.org
    Subject: New IEEE Email Account Created
    
    A new IEEE email account has been created:
    
    User ID: ${userId}
    Name: ${name}
    Personal Email: ${email}
    IEEE Email: ${ieeeEmail}
    
    This is an automated notification.
  `);

  // In a production environment, replace with actual email sending code
  return true;
}
