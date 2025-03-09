import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { userId, name, email } = await request.json();

    if (!userId || !name || !email) {
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

    // Extract username from email (everything before the @ symbol)
    const emailUsername = email.split("@")[0].toLowerCase();

    // Remove any special characters that might cause issues
    const cleanUsername = emailUsername.replace(/[^a-z0-9]/g, "");

    // Generate a secure random password
    const password = generateSecurePassword();

    // MXRoute DirectAdmin API credentials from environment variables
    const loginKey = import.meta.env.MXROUTE_LOGIN_KEY;
    const serverLogin = import.meta.env.MXROUTE_SERVER_LOGIN;
    const serverUrl = import.meta.env.MXROUTE_SERVER_URL;
    const emailQuota = import.meta.env.MXROUTE_EMAIL_QUOTA;
    const emailOutboundLimit = import.meta.env.MXROUTE_EMAIL_OUTBOUND_LIMIT;
    const emailDomain = import.meta.env.MXROUTE_EMAIL_DOMAIN;

    if (!loginKey || !serverLogin || !serverUrl || !emailDomain) {
      throw new Error("Missing MXRoute configuration");
    }

    // DirectAdmin API endpoint for creating email accounts
    // According to the documentation: https://docs.directadmin.com/developer/api/legacy-api.html
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
    formData.append("passwd", password);
    formData.append("passwd2", password);
    formData.append("quota", emailQuota || "200");
    formData.append("limit", emailOutboundLimit || "9600");

    // Log the form data being sent
    console.log("Form data:");
    formData.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    const response = await fetch(emailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${serverLogin}:${loginKey}`).toString("base64")}`,
      },
      body: formData,
    });

    const responseText = await response.text();
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

    // Send notification email to the user with their new email credentials
    await sendCredentialsEmail(
      email,
      `${cleanUsername}@${emailDomain}`,
      password,
    );

    // Send notification to webmaster
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
            "Email account created successfully. Check your email for login details.",
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

// Send email with credentials to the user
async function sendCredentialsEmail(
  userEmail: string,
  ieeeEmail: string,
  password: string,
) {
  // In a real implementation, you would use an email service like SendGrid, Mailgun, etc.
  // For now, we'll just log the email that would be sent
  console.log(`
    To: ${userEmail}
    Subject: Your IEEE UCSD Email Account
    
    Hello,
    
    Your IEEE UCSD email account has been created:
    
    Email address: ${ieeeEmail}
    Password: ${password}
    
    You can access your email through:
    - Webmail: https://heracles.mxrouting.net:2096/
    - IMAP/SMTP settings can be found at: https://mxroute.com/setup/
    
    Please change your password after your first login.
    
    If you have any questions, please contact webmaster@ieeeucsd.org.
    
    Best regards,
    IEEE UCSD Web Team
  `);

  // In a production environment, replace with actual email sending code
  return true;
}

// Send notification to webmaster
async function sendWebmasterNotification(
  userId: string,
  name: string,
  email: string,
  ieeeEmail: string,
) {
  // In a real implementation, you would use an email service
  console.log(`
    To: webmaster@ieeeucsd.org
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
