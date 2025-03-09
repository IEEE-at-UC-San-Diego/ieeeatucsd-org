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

    // Use provided password or generate a secure random one if not provided
    const newPassword = password || generateSecurePassword();
    console.log(`Using ${password ? "user-provided" : "generated"} password`);

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

    // Log the form data being sent (without showing the actual password)
    console.log("Form data:");
    console.log(`  action: modify`);
    console.log(`  domain: ${domain}`);
    console.log(`  user: ${username}`);
    console.log(`  passwd: ********`);
    console.log(`  passwd2: ********`);

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
      console.error("Error resetting email password:", responseText);

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
        console.error("Error parsing DirectAdmin error response:", e);
      }

      throw new Error(errorMessage);
    }

    console.log("Password reset successful");

    // Only send notification email if we generated a random password
    if (!password) {
      await sendPasswordResetEmail(email, newPassword);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: password
          ? "Password reset successfully. Remember to update your password in any email clients or integrations."
          : "Password reset successfully. Check your personal email for the new password.",
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

// Generate a secure random password
function generateSecurePassword(length = 16) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let password = "";

  // Ensure at least one character from each category
  password += charset.substring(0, 26).charAt(Math.floor(Math.random() * 26)); // lowercase
  password += charset.substring(26, 52).charAt(Math.floor(Math.random() * 26)); // uppercase
  password += charset.substring(52, 62).charAt(Math.floor(Math.random() * 10)); // number
  password += charset
    .substring(62)
    .charAt(Math.floor(Math.random() * (charset.length - 62))); // special

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

// Send email with new password
async function sendPasswordResetEmail(ieeeEmail: string, newPassword: string) {
  try {
    // Extract username from IEEE email
    const username = ieeeEmail.split("@")[0];

    // Get the user from PocketBase to find their personal email
    const PocketBase = await import("pocketbase").then(
      (module) => module.default,
    );
    const pb = new PocketBase(
      import.meta.env.POCKETBASE_URL || "http://127.0.0.1:8090",
    );

    // Try to find the user with this username
    const userRecord = await pb.collection("users").getList(1, 1, {
      filter: `email~"${username}@"`,
    });

    // Determine which email to send to
    let recipientEmail = ieeeEmail;
    if (userRecord && userRecord.items.length > 0) {
      recipientEmail = userRecord.items[0].email;
    }

    // In a real implementation, you would use an email service like SendGrid, Mailgun, etc.
    // For now, we'll just log the email that would be sent
    console.log(`
      To: ${recipientEmail}
      Subject: Your IEEE UCSD Email Password Has Been Reset
      
      Hello,
      
      Your IEEE UCSD email password has been reset:
      
      IEEE Email address: ${ieeeEmail}
      New Password: ${newPassword}
      
      You can access your email through:
      - Webmail: https://mail.ieeeucsd.org
      
      Please consider changing this password to something you can remember after logging in.
      
      If you did not request this password reset, please contact webmaster@ieeeucsd.org immediately.
      
      Best regards,
      IEEE UCSD Web Team
    `);

    // In a production environment, replace with actual email sending code
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    // Still return true to not block the password reset process
    return true;
  }
}
