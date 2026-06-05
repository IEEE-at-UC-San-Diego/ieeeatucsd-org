import { firebase, convex } from "./config.js";
import { toEpochMs, createEmptyResult } from "./utils.js";
import { findLogtoUserByEmail, ensureLogtoRoles, assignRoleToUser } from "./logto-client.js";
import type { MigrationResult, MigrationContext, UserMapping } from "./types.js";

export async function migrateUsers(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("users");

  const snapshot = await firebase.db.collection("users").get();
  console.log(`  Found ${snapshot.size} users in Firebase`);

  // Ensure Logto roles exist
  let roleMap: Map<string, string>;
  try {
    roleMap = await ensureLogtoRoles();
    console.log(`  Logto roles ready: ${Array.from(roleMap.keys()).join(", ")}`);
  } catch (error) {
    console.warn(`  ⚠️  Could not initialize Logto roles: ${error}`);
    roleMap = new Map();
  }

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const firebaseUid = doc.id;
      const email = data.email;

      if (!email) {
        result.failed++;
        result.errors.push({ id: firebaseUid, error: "No email field" });
        continue;
      }

      // Try to find matching Logto user
      let logtoId: string | undefined;
      try {
        const logtoUser = await findLogtoUserByEmail(email);
        if (logtoUser) {
          logtoId = logtoUser.id;
        }
      } catch {
        // Continue without Logto linking
      }

      // Map Firebase user role
      const validRoles = [
        "Member", "General Officer", "Executive Officer",
        "Member at Large", "Past Officer", "Sponsor", "Administrator",
      ];
      const role = validRoles.includes(data.role) ? data.role : "Member";

      // Map status
      const validStatuses = ["active", "inactive", "suspended"];
      const status = validStatuses.includes(data.status) ? data.status : "active";

      const convexData: Record<string, unknown> = {
        logtoId: logtoId || undefined,
        authUserId: firebaseUid,
        email,
        emailVisibility: data.emailVisibility ?? true,
        verified: data.verified ?? false,
        name: data.name || email.split("@")[0] || "Unknown",
        username: data.username || undefined,
        avatar: data.avatar || undefined,
        pid: data.pid || undefined,
        memberId: data.memberId || undefined,
        graduationYear: data.graduationYear || undefined,
        major: data.major || undefined,
        zelleInformation: data.zelleInformation || undefined,
        lastLogin: data.lastLogin ? toEpochMs(data.lastLogin) : undefined,
        notificationPreferences: data.notificationPreferences || {},
        displayPreferences: data.displayPreferences || {},
        accessibilitySettings: data.accessibilitySettings || {},
        resume: typeof data.resume === "string" ? data.resume : data.resume?.url || undefined,
        signedUp: data.signedUp ?? false,
        requestedEmail: data.requestedEmail ?? false,
        role,
        position: data.position || undefined,
        status,
        joinDate: data.joinDate ? toEpochMs(data.joinDate) : Date.now(),
        eventsAttended: data.eventsAttended || 0,
        points: data.points || 0,
        team: ["Internal", "Events", "Projects"].includes(data.team) ? data.team : undefined,
        invitedBy: data.invitedBy || undefined,
        inviteAccepted: data.inviteAccepted ? toEpochMs(data.inviteAccepted) : undefined,
        lastUpdated: data.lastUpdated ? toEpochMs(data.lastUpdated) : undefined,
        lastUpdatedBy: data.lastUpdatedBy || undefined,
        signInMethod: data.signInMethod || undefined,
        hasIEEEEmail: data.hasIEEEEmail || undefined,
        ieeeEmail: data.ieeeEmail || undefined,
        ieeeEmailCreatedAt: data.ieeeEmailCreatedAt ? toEpochMs(data.ieeeEmailCreatedAt) : undefined,
        sponsorTier: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"].includes(data.sponsorTier) ? data.sponsorTier : undefined,
        sponsorOrganization: data.sponsorOrganization || undefined,
        autoAssignedSponsor: data.autoAssignedSponsor || undefined,
      };

      // Remove undefined values
      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) {
          delete convexData[key];
        }
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert user: ${email} (Firebase UID: ${firebaseUid}, Logto: ${logtoId || "none"})`);
        result.skipped++;
      } else {
        const upsertResult = await (convex as any).mutation(
          "migrations:upsertUser" as any,
          { email, data: convexData },
        );

        const mapping: UserMapping = {
          firebaseUid,
          convexId: upsertResult.id,
          email,
          logtoId,
        };
        ctx.userMap.set(firebaseUid, mapping);

        if (upsertResult.action === "inserted") {
          result.inserted++;
        } else {
          result.updated++;
        }

        // Assign role in Logto if user has a Logto account
        if (logtoId && role !== "Member" && roleMap.has(role)) {
          const roleId = roleMap.get(role)!;
          await assignRoleToUser(logtoId, roleId);
        }
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        id: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
