import { google } from "googleapis";
import type { Auth } from "googleapis";

const GOOGLE_GROUP_MAP: Record<string, string> = {
  "Executive Officer": "executiveofficers@ieeeatucsd.org",
  "Administrator": "executiveofficers@ieeeatucsd.org",
  "General Officer": "generalofficers@ieeeatucsd.org",
  "Past Officer": "pastofficers@ieeeatucsd.org",
};

const ALL_GOOGLE_GROUPS = [
  "executiveofficers@ieeeatucsd.org",
  "generalofficers@ieeeatucsd.org",
  "pastofficers@ieeeatucsd.org",
];

function getConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL || "admin@ieeeatucsd.org";

  if (!clientEmail) {
    throw new Error("Missing required env: GOOGLE_CLIENT_EMAIL");
  }
  if (!privateKey) {
    throw new Error("Missing required env: GOOGLE_PRIVATE_KEY");
  }

  return { clientEmail, privateKey, adminEmail };
}

let cachedAuth: Auth.GoogleAuth | null = null;

async function getAuth() {
  if (cachedAuth) return cachedAuth;
  const { clientEmail, privateKey, adminEmail } = getConfig();

  cachedAuth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.group",
      "https://www.googleapis.com/auth/admin.directory.group.member",
    ],
    clientOptions: {
      subject: adminEmail,
    },
  });

  return cachedAuth;
}

export function getGoogleGroupForRole(role: string): string | null {
  return GOOGLE_GROUP_MAP[role] || null;
}

export function getGoogleGroupSyncPlan(role: string) {
  const targetGroup = getGoogleGroupForRole(role);
  return {
    targetGroup,
    groupsToRemove: ALL_GOOGLE_GROUPS.filter((group) => group !== targetGroup),
  };
}

export async function addMemberToGroup(email: string, googleGroup: string) {
  const auth = await getAuth();
  const admin = google.admin({ version: "directory_v1", auth });

  try {
    await admin.members.insert({
      groupKey: googleGroup,
      requestBody: {
        email,
        role: "MEMBER",
      },
    });
  } catch (error: any) {
    if (error.code === 409 || error.message?.includes("already exists")) {
      return;
    }
    throw error;
  }
}

export async function removeMemberFromGroup(email: string, googleGroup: string) {
  const auth = await getAuth();
  const admin = google.admin({ version: "directory_v1", auth });

  try {
    await admin.members.delete({
      groupKey: googleGroup,
      memberKey: email,
    });
  } catch (error: any) {
    if (error.code === 404 || error.message?.includes("404") || error.message?.includes("Not Found")) {
      return;
    }
    throw error;
  }
}

export async function syncGoogleGroupsForRole(
  email: string,
  newRole: string,
): Promise<Array<{ group: string; added?: boolean; removed?: boolean; error?: string }>> {
  const results: Array<{ group: string; added?: boolean; removed?: boolean; error?: string }> = [];
  const { targetGroup, groupsToRemove } = getGoogleGroupSyncPlan(newRole);

  if (targetGroup) {
    try {
      await addMemberToGroup(email, targetGroup);
      results.push({ group: targetGroup, added: true });
    } catch (error) {
      results.push({
        group: targetGroup,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  for (const group of groupsToRemove) {
    try {
      await removeMemberFromGroup(email, group);
      results.push({ group, removed: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (!msg.includes("404") && !msg.includes("Not Found")) {
        results.push({ group, error: msg });
      }
    }
  }

  return results;
}
