import { env } from "@/env";

const ROLE_NAMES = [
  "Member",
  "General Officer",
  "Executive Officer",
  "Member at Large",
  "Past Officer",
  "Sponsor",
  "Administrator",
] as const;

type AppRole = (typeof ROLE_NAMES)[number];

const MUTUALLY_EXCLUSIVE_OFFICER_ROLES: AppRole[] = [
  "General Officer",
  "Executive Officer",
  "Past Officer",
];

let cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig() {
  const endpoint = env.LOGTO_ENDPOINT || env.VITE_LOGTO_ENDPOINT;
  const appId = env.LOGTO_M2M_APP_ID;
  const appSecret = env.LOGTO_M2M_APP_SECRET;

  if (!endpoint) {
    throw new Error("Missing required env: LOGTO_ENDPOINT (or VITE_LOGTO_ENDPOINT)");
  }
  if (!appId) {
    throw new Error("Missing required env: LOGTO_M2M_APP_ID");
  }
  if (!appSecret) {
    throw new Error("Missing required env: LOGTO_M2M_APP_SECRET");
  }

  return { endpoint, appId, appSecret };
}

async function getM2MToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const { endpoint, appId, appSecret } = getConfig();
  const response = await fetch(`${endpoint}/oidc/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      resource: "https://default.logto.app/api",
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

async function logtoApi(path: string, options: RequestInit = {}) {
  const token = await getM2MToken();
  const { endpoint } = getConfig();

  return fetch(`${endpoint}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export async function findLogtoUserByEmail(email: string): Promise<{ id: string } | null> {
  const params = new URLSearchParams([
    ["search.primaryEmail", email],
    ["mode.primaryEmail", "exact"],
  ]);

  const response = await logtoApi(`/users?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to find Logto user by email: ${response.status} ${text}`);
  }

  const users = (await response.json()) as Array<{ id: string; primaryEmail?: string }>;
  const match = users.find(
    (user) => user.primaryEmail?.toLowerCase() === email.toLowerCase(),
  );

  return match ? { id: match.id } : null;
}

export async function ensureLogtoRoles() {
  const roleMap = new Map<string, string>();

  const listResponse = await logtoApi("/roles?page=1&page_size=100");
  if (!listResponse.ok) {
    const text = await listResponse.text();
    throw new Error(`Failed to list Logto roles: ${listResponse.status} ${text}`);
  }

  const existingRoles = (await listResponse.json()) as Array<{ id: string; name: string }>;
  for (const role of existingRoles) {
    roleMap.set(role.name, role.id);
  }

  for (const roleName of ROLE_NAMES) {
    if (roleMap.has(roleName)) continue;

    const createResponse = await logtoApi("/roles", {
      method: "POST",
      body: JSON.stringify({
        name: roleName,
        description: `IEEE at UCSD - ${roleName}`,
        type: "User",
      }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Failed to create Logto role ${roleName}: ${createResponse.status} ${text}`);
    }

    const createdRole = (await createResponse.json()) as { id: string; name: string };
    roleMap.set(createdRole.name, createdRole.id);
  }

  return roleMap;
}

export async function assignRoleToUser(logtoUserId: string, roleId: string) {
  const response = await logtoApi(`/roles/${roleId}/users`, {
    method: "POST",
    body: JSON.stringify({ userIds: [logtoUserId] }),
  });

  if (response.ok || response.status === 409) {
    return;
  }

  const text = await response.text();
  if (response.status === 422) {
    try {
      const data = JSON.parse(text) as { code?: string };
      if (data.code === "role.user_exists") {
        return;
      }
    } catch {
      // Fall through to throw below.
    }
  }

  throw new Error(`Failed to assign Logto role: ${response.status} ${text}`);
}

export async function removeRoleFromUser(logtoUserId: string, roleId: string) {
  const response = await logtoApi(`/roles/${roleId}/users/${logtoUserId}`, {
    method: "DELETE",
  });

  if (response.ok || response.status === 404) {
    return;
  }

  const text = await response.text();
  throw new Error(`Failed to remove Logto role: ${response.status} ${text}`);
}

export async function ensureRoleOnLogtoUser(logtoUserId: string, role: AppRole) {
  const roleMap = await ensureLogtoRoles();
  const roleId = roleMap.get(role);

  if (!roleId) {
    throw new Error(`Role '${role}' not found in Logto role map`);
  }

  await assignRoleToUser(logtoUserId, roleId);
}

export async function syncOfficerRolesOnLogtoUser(logtoUserId: string, newRole: AppRole) {
  const roleMap = await ensureLogtoRoles();

  const roleId = roleMap.get(newRole);
  if (!roleId) {
    throw new Error(`Role '${newRole}' not found in Logto role map`);
  }
  await assignRoleToUser(logtoUserId, roleId);

  const rolesToRemove = MUTUALLY_EXCLUSIVE_OFFICER_ROLES.filter((r) => r !== newRole);
  for (const roleName of rolesToRemove) {
    const staleRoleId = roleMap.get(roleName);
    if (staleRoleId) {
      try {
        await removeRoleFromUser(logtoUserId, staleRoleId);
      } catch {
        // Non-fatal: user may not have this role
      }
    }
  }
}

export function isSupportedRole(role: string): role is AppRole {
  return ROLE_NAMES.includes(role as AppRole);
}
