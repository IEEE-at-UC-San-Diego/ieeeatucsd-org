import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Password reset request received");

    const requestBody = await request.json();
    console.log(
      "Request body:",
      JSON.stringify({
        email: requestBody.email,
        passwordProvided: !!requestBody.password,
      }),
    );

    const { email, password } = requestBody;

    if (!email || !password) {
      console.log("Missing email address or password");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing email address or password",
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
    console.log(`Email parsed: username=${username}, domain=${domain}`);

    if (!username || !domain) {
      console.log("Invalid email format");
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

    // Use the provided password
    const newPassword = password;

    // MXRoute DirectAdmin API credentials from environment variables
    const loginKey = import.meta.env.MXROUTE_LOGIN_KEY;
    const serverLogin = import.meta.env.MXROUTE_SERVER_LOGIN;
    const serverUrl = import.meta.env.MXROUTE_SERVER_URL;

    if (!loginKey || !serverLogin || !serverUrl) {
      throw new Error("Missing MXRoute configuration");
    }

    // DirectAdmin API endpoint for changing email password
    let baseUrl = serverUrl;

    // If the URL contains a specific command, extract just the base URL
    if (baseUrl.includes("/CMD_")) {
      baseUrl = baseUrl.split("/CMD_")[0];
    }

    // Make sure there's no trailing slash
    baseUrl = baseUrl.replace(/\/$/, "");

    // Construct the email POP API URL
    const emailApiUrl = `${baseUrl}/CMD_API_EMAIL_POP`;

    console.log(`Resetting password for email: ${email}`);
    console.log(`DirectAdmin API URL: ${emailApiUrl}`);

    // Create the form data for password reset
    const formData = new URLSearchParams();
    formData.append("action", "modify");
    formData.append("domain", domain);
    formData.append("user", username);
    formData.append("passwd", newPassword);
    formData.append("passwd2", newPassword);

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
      // Parse the error details if possible
      let errorMessage = "Failed to reset email password";
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
        // Error parsing DirectAdmin error response
      }

      throw new Error(errorMessage);
    }

    console.log("Password reset successful");

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Password reset successfully. Remember to update your password in any email clients or integrations.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in reset-email-password:", error);
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
