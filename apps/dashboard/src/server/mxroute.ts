export function getMXRouteConfig() {
  const loginKey = process.env.MXROUTE_LOGIN_KEY;
  const serverLogin = process.env.MXROUTE_SERVER_LOGIN;
  const serverUrl = process.env.MXROUTE_SERVER_URL;
  const emailQuota = process.env.MXROUTE_EMAIL_QUOTA || "200";
  const emailOutboundLimit = process.env.MXROUTE_EMAIL_OUTBOUND_LIMIT || "9600";
  const emailDomain = process.env.MXROUTE_EMAIL_DOMAIN;

  if (!loginKey || !serverLogin || !serverUrl || !emailDomain) {
    throw new Error("Missing MXRoute configuration");
  }

  let baseUrl = serverUrl;
  if (baseUrl.includes("/CMD_")) {
    baseUrl = baseUrl.split("/CMD_")[0];
  }
  baseUrl = baseUrl.replace(/\/$/, "");

  return {
    loginKey,
    serverLogin,
    baseUrl,
    emailQuota,
    emailOutboundLimit,
    emailDomain,
    authHeader: `Basic ${Buffer.from(`${serverLogin}:${loginKey}`).toString("base64")}`,
    emailApiUrl: `${baseUrl}/CMD_API_EMAIL_POP`,
  };
}

export async function createIEEEEmail(params: {
  username: string;
  password: string;
}) {
  const config = getMXRouteConfig();
  const cleanUsername = params.username.replace(/[^a-z0-9]/g, "");

  const formData = new URLSearchParams();
  formData.append("action", "create");
  formData.append("domain", config.emailDomain);
  formData.append("user", cleanUsername);
  formData.append("passwd", params.password);
  formData.append("passwd2", params.password);
  formData.append("quota", config.emailQuota);
  formData.append("limit", config.emailOutboundLimit);

  const response = await fetch(config.emailApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: config.authHeader,
    },
    body: formData,
  });

  const responseText = await response.text();

  if (responseText.includes("error=1") || !response.ok) {
    if (responseText.includes("already exists")) {
      throw new Error(
        `Email address ${cleanUsername}@${config.emailDomain} already exists.`,
      );
    }
    let errorMessage = "Failed to create email account";
    try {
      const errorParams = new URLSearchParams(responseText);
      if (errorParams.has("text")) {
        errorMessage = decodeURIComponent(errorParams.get("text") || "");
      }
    } catch {}
    throw new Error(errorMessage);
  }

  return {
    success: true,
    ieeeEmail: `${cleanUsername}@${config.emailDomain}`,
  };
}

export async function resetEmailPassword(params: {
  email: string;
  password: string;
}) {
  const config = getMXRouteConfig();
  const [username, domain] = params.email.split("@");
  if (!username || !domain) {
    throw new Error("Invalid email format");
  }
  if (domain.toLowerCase() !== config.emailDomain.toLowerCase()) {
    throw new Error(`Email must belong to @${config.emailDomain}`);
  }

  const formData = new URLSearchParams();
  formData.append("action", "modify");
  formData.append("domain", config.emailDomain);
  formData.append("user", username);
  formData.append("passwd", params.password);
  formData.append("passwd2", params.password);

  const response = await fetch(config.emailApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: config.authHeader,
    },
    body: formData,
  });

  const responseText = await response.text();

  if (responseText.includes("error=1") || !response.ok) {
    let errorMessage = "Failed to reset email password";
    try {
      const errorParams = new URLSearchParams(responseText);
      if (errorParams.has("text")) {
        errorMessage = decodeURIComponent(errorParams.get("text") || "");
      }
    } catch {}
    throw new Error(errorMessage);
  }

  return { success: true };
}

export async function checkEmailExists(email: string) {
  const config = getMXRouteConfig();
  const [username, domain] = email.split("@");
  if (!username || !domain) {
    return { exists: false };
  }
  if (domain.toLowerCase() !== config.emailDomain.toLowerCase()) {
    return { exists: false };
  }

  const formData = new URLSearchParams();
  formData.append("action", "list");
  formData.append("domain", config.emailDomain);

  const response = await fetch(config.emailApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: config.authHeader,
    },
    body: formData,
  });

  const responseText = await response.text();

  if (responseText.includes("error=1") || !response.ok) {
    return { exists: false };
  }

  const exists =
    responseText.includes(`${username}=`) ||
    responseText.includes(`"${username}"`);

  return { exists };
}
