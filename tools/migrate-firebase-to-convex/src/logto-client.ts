import { getLogtoConfig } from "./config.js";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getM2MToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const config = getLogtoConfig();
  const tokenEndpoint = `${config.endpoint}/oidc/token`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      resource: `https://default.logto.app/api`,
      scope: "all",
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Logto M2M token: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

async function logtoApi(path: string, options: RequestInit = {}): Promise<Response> {
  const config = getLogtoConfig();
  const token = await getM2MToken();

  return fetch(`${config.endpoint}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export async function findLogtoUserByEmail(email: string): Promise<{ id: string; name?: string } | null> {
  try {
    const params = new URLSearchParams([
      ["search.primaryEmail", email],
      ["mode.primaryEmail", "exact"],
    ]);
    const response = await logtoApi(`/users?${params.toString()}`);
    if (!response.ok) {
      console.warn(`  ⚠️  Logto user search failed for ${email}: ${response.status}`);
      return null;
    }

    const users = (await response.json()) as Array<{ id: string; primaryEmail?: string; name?: string }>;
    const match = users.find(
      (u) => u.primaryEmail?.toLowerCase() === email.toLowerCase(),
    );

    return match ? { id: match.id, name: match.name } : null;
  } catch (error) {
    console.warn(`  ⚠️  Logto user search error for ${email}:`, error);
    return null;
  }
}

export async function ensureLogtoRoles(): Promise<Map<string, string>> {
  const roleNames = [
    "Member",
    "General Officer",
    "Executive Officer",
    "Member at Large",
    "Past Officer",
    "Sponsor",
    "Administrator",
  ];

  const roleMap = new Map<string, string>();

  // Get existing roles
  const response = await logtoApi("/roles?page=1&page_size=100");
  if (!response.ok) {
    throw new Error(`Failed to list Logto roles: ${response.status}`);
  }

  const existingRoles = (await response.json()) as Array<{ id: string; name: string }>;
  for (const role of existingRoles) {
    roleMap.set(role.name, role.id);
  }

  // Create missing roles
  for (const roleName of roleNames) {
    if (!roleMap.has(roleName)) {
      console.log(`  Creating Logto role: ${roleName}`);
      const createResponse = await logtoApi("/roles", {
        method: "POST",
        body: JSON.stringify({
          name: roleName,
          description: `IEEE at UCSD - ${roleName}`,
          type: "User",
        }),
      });

      if (createResponse.ok) {
        const created = (await createResponse.json()) as { id: string; name: string };
        roleMap.set(created.name, created.id);
      } else {
        const text = await createResponse.text();
        console.warn(`  ⚠️  Failed to create role ${roleName}: ${createResponse.status} ${text}`);
      }
    }
  }

  return roleMap;
}

export async function assignRoleToUser(logtoUserId: string, roleId: string): Promise<boolean> {
  try {
    const response = await logtoApi(`/roles/${roleId}/users`, {
      method: "POST",
      body: JSON.stringify({ userIds: [logtoUserId] }),
    });

    if (response.ok || response.status === 409) {
      return true;
    }

    const text = await response.text();
    console.warn(`  ⚠️  Failed to assign role to user ${logtoUserId}: ${response.status} ${text}`);
    return false;
  } catch (error) {
    console.warn(`  ⚠️  Error assigning role:`, error);
    return false;
  }
}
