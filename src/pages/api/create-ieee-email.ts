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

    if (!userId || !name || !email) {
      console.log("Missing required parameters");
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
    console.log(`Email username extracted: ${emailUsername}`);

    // Remove any special characters that might cause issues
    const cleanUsername = emailUsername.replace(/[^a-z0-9]/g, "");
    console.log(`Cleaned username: ${cleanUsername}`);

    // Use provided password or generate a secure random one if not provided
    const newPassword = password || generateSecurePassword();
    console.log(`Using ${password ? "user-provided" : "generated"} password`);

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

    // Only send notification email if we generated a random password
    if (!password) {
      console.log("Sending credentials email to user");
      await sendCredentialsEmail(
        email,
        `${cleanUsername}@${emailDomain}`,
        newPassword,
      );
    }

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
          message: password
            ? "Email account created successfully with your chosen password."
            : "Email account created successfully. Check your email for login details.",
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
    
    ===== Setting Up Your IEEE Email in Gmail =====
    
    --- First Step: Set Up Sending From Your IEEE Email ---
    1. Go to settings (gear icon) → Accounts and Import
    2. In the section that says "Send mail as:", select "Reply from the same address the message was sent to"
    3. In that same section, select "Add another email address"
    4. For the Name, put your actual name or department name (e.g. IEEEUCSD Webmaster)
    5. For the Email address, put ${ieeeEmail}
    6. Make sure the "Treat as an alias" button is selected. Go to the next step
    7. For the SMTP Server, put mail.ieeeucsd.org
    8. For the username, put in your FULL ieeeucsd email address (${ieeeEmail})
    9. For the password, put in the email's password (provided above)
    10. For the port, put in 587
    11. Make sure you select "Secured connection with TLS"
    12. Go back to mail.ieeeucsd.org and verify the email that Google has sent you
    
    --- Second Step: Set Up Receiving Your IEEE Email ---
    1. Go to settings (gear icon) → Accounts and Import
    2. In the section that says "Check mail from other accounts:", select "Add a mail account"
    3. Put in ${ieeeEmail} and hit next
    4. Make sure "Import emails from my other account (POP3)" is selected, then hit next
    5. For the username, put in ${ieeeEmail}
    6. For the password, put in your password (provided above)
    7. For the POP Server, put in mail.ieeeucsd.org
    8. For the Port, put in 995
    9. Select "Leave a copy of retrieved message on the server"
    10. Select "Always use a secure connection (SSL) when retrieving mail"
    11. Select "Label incoming messages"
    12. Then hit "Add Account"
    
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
