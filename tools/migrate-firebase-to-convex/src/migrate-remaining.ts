import { firebase, convex } from "./config.js";
import { toEpochMs, createEmptyResult } from "./utils.js";
import type { MigrationResult, MigrationContext } from "./types.js";

// ─── Links ───────────────────────────────────────────────────────────────────

export async function migrateLinks(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("links");
  const snapshot = await firebase.db.collection("links").get();
  console.log(`  Found ${snapshot.size} links in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const firebaseUserId = data.createdBy || "";
      const userMapping = ctx.userMap.get(firebaseUserId);
      const createdBy = userMapping?.logtoId || userMapping?.firebaseUid || firebaseUserId;

      const convexData: Record<string, unknown> = {
        url: data.url || "",
        title: data.title || "Untitled Link",
        category: data.category || "general",
        description: data.description || undefined,
        iconUrl: data.iconUrl || undefined,
        shortUrl: data.shortUrl || undefined,
        publishDate: data.publishDate ? toEpochMs(data.publishDate) : undefined,
        expireDate: data.expireDate ? toEpochMs(data.expireDate) : undefined,
        createdAt: data.createdAt ? toEpochMs(data.createdAt) : (doc.createTime ? toEpochMs(doc.createTime) : undefined),
        createdBy,
        lastModified: data.lastModified ? toEpochMs(data.lastModified) : undefined,
        lastModifiedBy: data.lastModifiedBy || undefined,
        order: data.order || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert link: ${data.title}`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertLink" as any, {
          dedupKey: `${data.url}:${data.title}`,
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Constitutions ───────────────────────────────────────────────────────────

export async function migrateConstitutions(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("constitutions");
  const snapshot = await firebase.db.collection("constitutions").get();
  console.log(`  Found ${snapshot.size} constitutions in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const firebaseId = doc.id;

      const validStatuses = ["draft", "published", "archived"];
      const status = validStatuses.includes(data.status) ? data.status : "draft";

      // Fetch sections subcollection
      const sectionsSnapshot = await firebase.db
        .collection("constitutions").doc(firebaseId)
        .collection("sections").orderBy("order").get();

      const sections = sectionsSnapshot.docs.map((sDoc: any) => {
        const s = sDoc.data();
        return {
          id: sDoc.id,
          type: s.type || "section",
          title: s.title || "",
          content: s.content || "",
          order: s.order || 0,
          parentId: s.parentId || undefined,
          articleNumber: s.articleNumber || undefined,
          sectionNumber: s.sectionNumber || undefined,
          subsectionLetter: s.subsectionLetter || undefined,
          amendmentNumber: s.amendmentNumber || undefined,
          createdAt: s.createdAt ? toEpochMs(s.createdAt) : Date.now(),
          lastModified: s.lastModified ? toEpochMs(s.lastModified) : Date.now(),
          lastModifiedBy: s.lastModifiedBy || "",
        };
      });

      // Also handle inline sections array from Firebase
      if (sections.length === 0 && Array.isArray(data.sections)) {
        for (const s of data.sections) {
          sections.push({
            id: s.id || crypto.randomUUID(),
            type: s.type || "section",
            title: s.title || "",
            content: s.content || "",
            order: s.order || 0,
            parentId: s.parentId || undefined,
            articleNumber: s.articleNumber || undefined,
            sectionNumber: s.sectionNumber || undefined,
            subsectionLetter: s.subsectionLetter || undefined,
            amendmentNumber: s.amendmentNumber || undefined,
            createdAt: s.createdAt ? toEpochMs(s.createdAt) : Date.now(),
            lastModified: s.lastModified ? toEpochMs(s.lastModified) : Date.now(),
            lastModifiedBy: s.lastModifiedBy || "",
          });
        }
      }

      const convexData: Record<string, unknown> = {
        title: data.title || "Untitled Constitution",
        organizationName: data.organizationName || "IEEE at UCSD",
        sections,
        version: data.version || 1,
        status,
        lastModifiedBy: data.lastModifiedBy || "",
        createdAt: data.createdAt ? toEpochMs(data.createdAt) : (doc.createTime ? toEpochMs(doc.createTime) : undefined),
        lastModified: data.lastModified ? toEpochMs(data.lastModified) : undefined,
        collaborators: Array.isArray(data.collaborators) ? data.collaborators : [],
        isTemplate: data.isTemplate || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert constitution: ${data.title} (${sections.length} sections)`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertConstitution" as any, {
          dedupKey: `${data.title}:${data.organizationName}`,
          data: convexData,
        });

        ctx.constitutionMap.set(firebaseId, {
          firebaseId,
          convexId: r.id,
          title: data.title || "",
        });

        if (r.action === "inserted") result.inserted++;
        else result.updated++;

        // Migrate audit logs subcollection
        const auditSnapshot = await firebase.db
          .collection("constitutions").doc(firebaseId)
          .collection("auditLog").get();

        if (!auditSnapshot.empty) {
          const entries = auditSnapshot.docs.map((aDoc: any) => {
            const a = aDoc.data();
            return {
              id: aDoc.id,
              constitutionId: firebaseId,
              sectionId: a.sectionId || undefined,
              changeType: a.changeType || "update",
              changeDescription: a.changeDescription || "",
              beforeValue: a.beforeValue || undefined,
              afterValue: a.afterValue || undefined,
              userId: a.userId || "",
              userName: a.userName || "",
              timestamp: a.timestamp ? toEpochMs(a.timestamp) : Date.now(),
            };
          });

          await (convex as any).mutation("migrations:upsertConstitutionAuditLog" as any, {
            constitutionId: r.id,
            data: {
              constitutionId: r.id,
              entries,
              totalEntries: entries.length,
            },
          });
        }
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Officer Invitations ─────────────────────────────────────────────────────

export async function migrateOfficerInvitations(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("officerInvitations");
  const snapshot = await firebase.db.collection("officerInvitations").get();
  console.log(`  Found ${snapshot.size} officer invitations in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const validRoles = ["Member", "General Officer", "Executive Officer", "Member at Large", "Past Officer", "Sponsor", "Administrator"];
      const role = validRoles.includes(data.role) ? data.role : "Member";

      const validStatuses = ["pending", "accepted", "declined", "expired"];
      const status = validStatuses.includes(data.status) ? data.status : "pending";

      const invitedAt = data.invitedAt ? toEpochMs(data.invitedAt) : Date.now();

      const convexData: Record<string, unknown> = {
        name: data.name || "",
        email: data.email || "",
        role,
        position: data.position || "",
        status,
        invitedBy: data.invitedBy || "",
        invitedAt,
        acceptedAt: data.acceptedAt ? toEpochMs(data.acceptedAt) : undefined,
        declinedAt: data.declinedAt ? toEpochMs(data.declinedAt) : undefined,
        expiresAt: data.expiresAt ? toEpochMs(data.expiresAt) : invitedAt + 30 * 24 * 60 * 60 * 1000,
        message: data.message || undefined,
        acceptanceDeadline: data.acceptanceDeadline || undefined,
        leaderName: data.leaderName || undefined,
        googleGroupAssigned: data.googleGroupAssigned || undefined,
        googleGroup: data.googleGroup || undefined,
        permissionsGranted: data.permissionsGranted || undefined,
        onboardingEmailSent: data.onboardingEmailSent || undefined,
        resentAt: data.resentAt ? toEpochMs(data.resentAt) : undefined,
        lastSentAt: data.lastSentAt ? toEpochMs(data.lastSentAt) : undefined,
        roleGranted: data.roleGranted || undefined,
        roleGrantedAt: data.roleGrantedAt ? toEpochMs(data.roleGrantedAt) : undefined,
        userCreatedOrUpdated: data.userCreatedOrUpdated || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert officer invitation: ${data.email} (${role})`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertOfficerInvitation" as any, {
          dedupKey: `${data.email}:${invitedAt}`,
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Sponsor Domains ─────────────────────────────────────────────────────────

export async function migrateSponsorDomains(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("sponsorDomains");
  const snapshot = await firebase.db.collection("sponsorDomains").get();
  console.log(`  Found ${snapshot.size} sponsor domains in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const validTiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
      const sponsorTier = validTiers.includes(data.sponsorTier) ? data.sponsorTier : "Bronze";

      const convexData: Record<string, unknown> = {
        domain: data.domain || "",
        organizationName: data.organizationName || "",
        sponsorTier,
        createdAt: data.createdAt ? toEpochMs(data.createdAt) : (doc.createTime ? toEpochMs(doc.createTime) : undefined),
        createdBy: data.createdBy || "",
        lastModified: data.lastModified ? toEpochMs(data.lastModified) : undefined,
        lastModifiedBy: data.lastModifiedBy || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert sponsor domain: ${data.domain}`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertSponsorDomain" as any, {
          domain: data.domain || "",
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Organization Settings ───────────────────────────────────────────────────

export async function migrateOrgSettings(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("organizationSettings");
  const snapshot = await firebase.db.collection("organizationSettings").get();
  console.log(`  Found ${snapshot.size} organization settings in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const convexData: Record<string, unknown> = {
        googleSheetsContactListUrl: data.googleSheetsContactListUrl || undefined,
        updatedBy: data.updatedBy || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert org settings: ${doc.id}`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertOrgSettings" as any, {
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function migrateNotifications(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("notifications");
  const snapshot = await firebase.db.collection("notifications").get();
  console.log(`  Found ${snapshot.size} notifications in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      // Map userId
      const firebaseUserId = data.userId || "";
      const userMapping = ctx.userMap.get(firebaseUserId);
      const userId = userMapping?.logtoId || userMapping?.firebaseUid || firebaseUserId;

      const convexData: Record<string, unknown> = {
        userId,
        type: data.type || "general",
        title: data.title || "",
        message: data.message || "",
        data: data.data || undefined,
        read: data.read ?? false,
        createdAt: data.createdAt ? toEpochMs(data.createdAt) : (doc.createTime ? toEpochMs(doc.createTime) : undefined),
        expiresAt: data.expiresAt ? toEpochMs(data.expiresAt) : undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert notification: ${data.title}`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertNotification" as any, {
          dedupKey: `${userId}:${data.title}:${data.message}`,
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Google Group Assignments ────────────────────────────────────────────────

export async function migrateGoogleGroupAssignments(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("googleGroupAssignments");
  const snapshot = await firebase.db.collection("googleGroupAssignments").get();
  console.log(`  Found ${snapshot.size} google group assignments in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const assignedAt = data.assignedAt ? toEpochMs(data.assignedAt) : Date.now();

      const convexData: Record<string, unknown> = {
        email: data.email || "",
        googleGroup: data.googleGroup || "",
        role: data.role || undefined,
        assignedAt,
        success: data.success ?? true,
        error: data.error || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert google group assignment: ${data.email} → ${data.googleGroup}`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertGoogleGroupAssignment" as any, {
          dedupKey: `${data.email}:${data.googleGroup}:${assignedAt}`,
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Direct Onboardings ─────────────────────────────────────────────────────

export async function migrateDirectOnboardings(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("directOnboardings");
  const snapshot = await firebase.db.collection("directOnboardings").get();
  console.log(`  Found ${snapshot.size} direct onboardings in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const onboardedAt = data.onboardedAt ? toEpochMs(data.onboardedAt) : Date.now();

      const convexData: Record<string, unknown> = {
        name: data.name || "",
        email: data.email || "",
        role: data.role || "Member",
        position: data.position || "",
        team: data.team || undefined,
        onboardedBy: data.onboardedBy || "",
        onboardedAt,
        emailSent: data.emailSent ?? false,
        googleGroupAssigned: data.googleGroupAssigned ?? false,
        googleGroup: data.googleGroup || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert direct onboarding: ${data.name} (${data.email})`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertDirectOnboarding" as any, {
          dedupKey: `${data.email}:${onboardedAt}`,
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function migrateInvites(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("invites");
  const snapshot = await firebase.db.collection("invites").get();
  console.log(`  Found ${snapshot.size} invites in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const invitedAt = data.invitedAt ? toEpochMs(data.invitedAt) : Date.now();

      const validStatuses = ["pending", "accepted", "declined"];
      const status = validStatuses.includes(data.status) ? data.status : "pending";

      const convexData: Record<string, unknown> = {
        name: data.name || "",
        email: data.email || "",
        role: data.role || "Member",
        position: data.position || undefined,
        message: data.message || undefined,
        invitedBy: data.invitedBy || data.createdBy || "",
        invitedAt,
        status,
        acceptedAt: data.acceptedAt ? toEpochMs(data.acceptedAt) : undefined,
        acceptedBy: data.acceptedBy || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert invite: ${data.email}`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertInvite" as any, {
          dedupKey: `${data.email}:${invitedAt}`,
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

// ─── Public Profiles (rebuild from migrated users) ───────────────────────────

export async function migratePublicProfiles(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("publicProfiles");

  console.log(`  Rebuilding public profiles from ${ctx.userMap.size} migrated users`);

  for (const [, mapping] of ctx.userMap) {
    try {
      // We need to read the user from Convex to get full data
      const user = await (convex as any).mutation("migrations:getUserByEmail" as any, {
        email: mapping.email,
      });

      if (!user || !user.signedUp) continue;

      const convexData: Record<string, unknown> = {
        userId: mapping.convexId,
        name: user.name || "",
        major: user.major || undefined,
        points: user.points || 0,
        eventsAttended: user.eventsAttended || 0,
        position: user.position || undefined,
        graduationYear: user.graduationYear || undefined,
        joinDate: user.joinDate || undefined,
      };

      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert public profile for: ${user.name}`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertPublicProfile" as any, {
          userId: mapping.convexId,
          data: convexData,
        });
        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        id: mapping.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
