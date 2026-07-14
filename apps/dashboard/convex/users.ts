import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireAdminAccess,
  requireResumeDatabaseAccess,
  getCurrentUser,
} from "./permissions";
import {
  deleteResumeStorage,
  validateAndBuildResume,
} from "./resume";
import { buildAuthUpsertResult } from "./userProvisioning";
import { getPointAccountSnapshot } from "./lib/pointsLedger";

const FISCAL_YEAR_START_MONTH = 6; // July
const FISCAL_MONTH_LABELS = [
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
];

function getFiscalYearStartYear(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1;
}

function getFiscalYearRange(startYear: number) {
  return {
    start: Date.UTC(startYear, FISCAL_YEAR_START_MONTH, 1),
    end: Date.UTC(startYear + 1, FISCAL_YEAR_START_MONTH, 1),
  };
}

function toPercentChange(currentValue: number, previousValue: number) {
  if (previousValue === 0) {
    return null;
  }
  return ((currentValue - previousValue) / previousValue) * 100;
}

export function removeUndefinedFields<T extends Record<string, unknown>>(data: T) {
  const cleanedData: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanedData[key as keyof T] = value as T[keyof T];
    }
  }
  return cleanedData;
}

// Internal helper for profile mutations that receive auth context from the client.
export function buildSelfProfilePatch<
  T extends {
    logtoId: unknown;
    authToken: unknown;
    syncPublicProfile?: unknown;
  } & Record<string, unknown>,
>(args: T) {
  const { logtoId, authToken, syncPublicProfile, ...rest } = args;
  void logtoId;
  void authToken;
  void syncPublicProfile;
  return removeUndefinedFields(rest);
}

// Internal helper for admin profile mutations that receive auth context from the client.
export function buildAdminProfilePatch<
  T extends {
    logtoId: unknown;
    authToken: unknown;
    userId: unknown;
  } & Record<string, unknown>,
>(args: T) {
  const { logtoId, authToken, userId, ...rest } = args;
  void logtoId;
  void authToken;
  void userId;
  return removeUndefinedFields(rest);
}

export const getMe = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx, args.logtoId, args.authToken);
    if (!user) return null;

    const resumeUrl = user.resume
      ? ((await ctx.storage.getUrl(user.resume.storageId)) ?? undefined)
      : undefined;

    return { ...user, resumeUrl };
  },
});

export const getByLogtoId = query({
  args: { logtoId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_logtoId", (q) => q.eq("logtoId", args.logtoId))
      .first();
  },
});

export const getByEmailForAdmin = query({
  args: { logtoId: v.string(),
    authToken: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const getByIdForAdmin = query({
  args: { logtoId: v.string(),
    authToken: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.get(args.userId);
  },
});

export const getUserInfo = query({
  args: { logtoId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_logtoId", (q) => q.eq("logtoId", args.logtoId))
      .first();
    
    if (!user) return null;
    
    return {
      name: user.name,
      zelleInformation: user.zelleInformation,
      email: user.email,
    };
  },
});

export const upsertFromAuth = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    email: v.string(),
    name: v.string(),
    avatar: v.optional(v.string()),
    signInMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();

    // 1. Check if user already exists by logtoId
    const existing = await ctx.db
      .query("users")
      .withIndex("by_logtoId", (q) => q.eq("logtoId", args.logtoId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastLogin: Date.now(),
        ...(args.signInMethod && { signInMethod: args.signInMethod }),
        ...(args.avatar && { avatar: args.avatar }),
      });
      return buildAuthUpsertResult(
        existing._id,
        existing.signedUp ?? false,
        existing.role,
      );
    }

    // 2. If logtoId changed/re-created, relink by email instead of creating a duplicate.
    // This prevents a second onboarding account for the same email.
    const emailMatches: any[] = [];
    const seen = new Set<string>();
    const addCandidate = (candidate: any) => {
      if (!candidate || seen.has(candidate._id)) return;
      seen.add(candidate._id);
      emailMatches.push(candidate);
    };

    if (args.email) {
      const exactMatches = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .collect();
      for (const candidate of exactMatches) addCandidate(candidate);
    }

    if (normalizedEmail && normalizedEmail !== args.email) {
      const normalizedMatches = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .collect();
      for (const candidate of normalizedMatches) addCandidate(candidate);
    }

    if (emailMatches.length > 0) {
      const bestMatch = emailMatches.sort((a, b) => {
        const aSignedUp = a.signedUp ? 1 : 0;
        const bSignedUp = b.signedUp ? 1 : 0;
        if (aSignedUp !== bSignedUp) return bSignedUp - aSignedUp;

        const aLastLogin = a.lastLogin ?? 0;
        const bLastLogin = b.lastLogin ?? 0;
        return bLastLogin - aLastLogin;
      })[0];

      await ctx.db.patch(bestMatch._id, {
        logtoId: args.logtoId,
        email: normalizedEmail || args.email,
        lastLogin: Date.now(),
        ...(args.signInMethod && { signInMethod: args.signInMethod }),
        ...(args.avatar && { avatar: args.avatar }),
      });

      return buildAuthUpsertResult(
        bestMatch._id,
        bestMatch.signedUp ?? false,
        bestMatch.role,
      );
    }

    // 3. Brand new user — check for sponsor domain auto-assignment
    let role: string = "Member";
    let sponsorTier: string | undefined;
    let sponsorOrganization: string | undefined;
    let autoAssignedSponsor = false;

    if (normalizedEmail) {
      const emailDomain = "@" + normalizedEmail.split("@")[1]?.toLowerCase();
      const domainMatch = await ctx.db
        .query("sponsorDomains")
        .withIndex("by_domain", (q) => q.eq("domain", emailDomain))
        .first();

      if (domainMatch) {
        role = "Sponsor";
        sponsorTier = domainMatch.sponsorTier;
        sponsorOrganization = domainMatch.organizationName;
        autoAssignedSponsor = true;
      }
    }

    // Check for accepted officer invitations. Older invitations may have been
    // stored before email normalization, so check both forms.
    const invitationMatches: any[] = [];
    const addInvitation = (candidate: any) => {
      if (!candidate) return;
      if (invitationMatches.some((match) => match._id === candidate._id)) return;
      invitationMatches.push(candidate);
    };

    if (normalizedEmail) {
      addInvitation(
        await ctx.db
          .query("officerInvitations")
          .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
          .filter((q) => q.eq(q.field("status"), "accepted"))
          .first(),
      );
    }

    if (args.email && args.email !== normalizedEmail) {
      addInvitation(
        await ctx.db
          .query("officerInvitations")
          .withIndex("by_email", (q) => q.eq("email", args.email))
          .filter((q) => q.eq(q.field("status"), "accepted"))
          .first(),
      );
    }

    const acceptedInvitation = invitationMatches[0];

    if (acceptedInvitation && role === "Member") {
      role = acceptedInvitation.role;
    }

    const userId = await ctx.db.insert("users", {
      logtoId: args.logtoId,
      email: normalizedEmail || args.email,
      emailVisibility: true,
      verified: true,
      name: args.name,
      avatar: args.avatar,
      lastLogin: Date.now(),
      notificationPreferences: {},
      displayPreferences: {},
      accessibilitySettings: {},
      aiFeaturesEnabled: true,
      signedUp: false,
      requestedEmail: false,
      role: role as any,
      status: "active",
      joinDate: Date.now(),
      eventsAttended: 0,
      points: 0,
      signInMethod: args.signInMethod || "logto",
      ...(sponsorTier && { sponsorTier: sponsorTier as any }),
      ...(sponsorOrganization && { sponsorOrganization }),
      ...(autoAssignedSponsor && { autoAssignedSponsor }),
      ...(acceptedInvitation?.position && {
        position: acceptedInvitation.position,
      }),
      ...(acceptedInvitation && {
        invitedBy: acceptedInvitation.invitedBy,
        inviteAccepted: Date.now(),
      }),
    });

    return buildAuthUpsertResult(userId, false, role);
  },
});

export const completeOnboarding = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    pid: v.string(),
    major: v.string(),
    graduationYear: v.number(),
    memberId: v.optional(v.string()),
    zelleInformation: v.optional(v.string()),
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFileName: v.optional(v.string()),
    tosVersion: v.string(),
    privacyPolicyVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const now = Date.now();

    let resume;
    if (args.resumeStorageId) {
      resume = await validateAndBuildResume(
        ctx,
        args.resumeStorageId,
        args.resumeFileName ?? "resume.pdf",
      );
    }

    await ctx.db.patch(user._id, {
      pid: args.pid,
      major: args.major,
      graduationYear: args.graduationYear,
      signedUp: true,
      joinDate: now,
      tosAcceptedAt: now,
      tosVersion: args.tosVersion,
      privacyPolicyAcceptedAt: now,
      privacyPolicyVersion: args.privacyPolicyVersion,
      ...(args.memberId && { memberId: args.memberId }),
      ...(args.zelleInformation && { zelleInformation: args.zelleInformation }),
      ...(resume && { resume }),
    });

    // Create/update public profile
    const existingProfile = await ctx.db
      .query("publicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    const profileData = {
      userId: user._id,
      name: user.name,
      major: args.major,
      points: user.lifetimePointsEarned ?? user.points ?? 0,
      eventsAttended: user.eventsAttended || 0,
      position: user.position || user.role,
      graduationYear: args.graduationYear,
      joinDate: now,
    };

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, profileData);
    } else {
      await ctx.db.insert("publicProfiles", profileData);
    }

    return user._id;
  },
});

export const updateProfile = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    name: v.optional(v.string()),
    major: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    memberId: v.optional(v.string()),
    zelleInformation: v.optional(v.string()),
    avatar: v.optional(v.string()),
    pid: v.optional(v.string()),
    emailVisibility: v.optional(v.boolean()),
    notificationPreferences: v.optional(v.any()),
    displayPreferences: v.optional(v.any()),
    accessibilitySettings: v.optional(v.any()),
    aiFeaturesEnabled: v.optional(v.boolean()),
    syncPublicProfile: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const { syncPublicProfile = true } = args;
    const sanitizedUpdates = buildSelfProfilePatch(args);
    const updateData = {
      ...sanitizedUpdates,
      lastUpdated: Date.now(),
    };

    await ctx.db.patch(user._id, updateData);

    // Sync public profile if requested and name/major/graduationYear changed
    if (syncPublicProfile) {
      const existingProfile = await ctx.db
        .query("publicProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();

      const newName = typeof updateData.name === "string" ? updateData.name : user.name;
      const newMajor =
        typeof updateData.major === "string" ? updateData.major : user.major;
      const newGraduationYear =
        typeof updateData.graduationYear === "number"
          ? updateData.graduationYear
          : user.graduationYear;

      const profileData = {
        name: newName,
        major: newMajor,
        points: user.lifetimePointsEarned ?? user.points ?? 0,
        eventsAttended: user.eventsAttended || 0,
        position: user.position || user.role,
        graduationYear: newGraduationYear,
        joinDate: user.joinDate || user._creationTime,
      };

      if (existingProfile) {
        await ctx.db.patch(existingProfile._id, profileData);
      } else {
        await ctx.db.insert("publicProfiles", {
          ...profileData,
          userId: user._id,
        });
      }
    }

    return user._id;
  },
});

export const setIEEEEmail = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    ieeeEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(user._id, {
      hasIEEEEmail: true,
      ieeeEmail: args.ieeeEmail,
      ieeeEmailCreatedAt: Date.now(),
      lastUpdated: Date.now(),
    });
    return user._id;
  },
});

export const acceptPolicyUpdate = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    tosVersion: v.string(),
    privacyPolicyVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const now = Date.now();

    await ctx.db.patch(user._id, {
      tosAcceptedAt: now,
      tosVersion: args.tosVersion,
      privacyPolicyAcceptedAt: now,
      privacyPolicyVersion: args.privacyPolicyVersion,
    });

    return user._id;
  },
});

export const generateResumeUploadUrl = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setResume = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const resume = await validateAndBuildResume(
      ctx,
      args.storageId,
      args.fileName,
    );

    if (user.resume?.storageId) {
      await deleteResumeStorage(ctx, user.resume.storageId);
    }

    await ctx.db.patch(user._id, { resume, lastUpdated: Date.now() });
    return user._id;
  },
});

export const deleteResume = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);

    if (user.resume?.storageId) {
      await deleteResumeStorage(ctx, user.resume.storageId);
    }

    await ctx.db.patch(user._id, { resume: undefined, lastUpdated: Date.now() });
    return user._id;
  },
});

export const listResumes = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireResumeDatabaseAccess(ctx, args.logtoId, args.authToken);

    const users = await ctx.db.query("users").collect();
    const usersWithResumes = users.filter((u) => u.resume);

    return Promise.all(
      usersWithResumes.map(async (u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        major: u.major,
        graduationYear: u.graduationYear,
        role: u.role,
        position: u.position,
        resume: (await ctx.storage.getUrl(u.resume!.storageId)) ?? undefined,
        fileName: u.resume!.fileName,
      })),
    );
  },
});

export const list = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    paginationOpts: v.optional(v.object({
      cursor: v.optional(v.string()),
      numItems: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const users = await ctx.db.query("users").collect();
    const start = Math.max(
      0,
      Number.parseInt(args.paginationOpts?.cursor ?? "0", 10) || 0,
    );
    const count = Math.max(
      1,
      args.paginationOpts?.numItems ?? users.length,
    );
    return users.slice(start, start + count);
  },
});

export const updateRole = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
    role: v.union(
      v.literal("Member"),
      v.literal("General Officer"),
      v.literal("Executive Officer"),
      v.literal("Member at Large"),
      v.literal("Past Officer"),
      v.literal("Sponsor"),
      v.literal("Administrator"),
    ),
    position: v.optional(v.string()),
    team: v.optional(
      v.union(
        v.literal("Internal"),
        v.literal("Events"),
        v.literal("Projects"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("Target user not found");

    // Nuanced restrictions for Executive Officers (non-Admin)
    if (admin.role === "Executive Officer") {
      // Executive Officers cannot change Administrator users
      if (targetUser.role === "Administrator") {
        throw new Error("Executive Officers cannot modify Administrator accounts");
      }
      // Executive Officers cannot change their own role
      if (targetUser._id === admin._id) {
        throw new Error("Executive Officers cannot change their own role");
      }
      // Executive Officers cannot assign the Administrator role
      if (args.role === "Administrator") {
        throw new Error("Only Administrators can assign the Administrator role");
      }
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      ...(args.position !== undefined && { position: args.position }),
      ...(args.team !== undefined && { team: args.team }),
      lastUpdated: Date.now(),
      lastUpdatedBy: admin.logtoId,
    });

    return args.userId;
  },
});

export const createPlaceholder = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    position: v.optional(v.string()),
    team: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const normalizedEmail = args.email.trim().toLowerCase();
    const now = Date.now();

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      email: normalizedEmail,
      emailVisibility: true,
      verified: true,
      name: args.name,
      role: args.role as any,
      position: args.position,
      team: args.team as any,
      status: "active",
      signedUp: false,
      requestedEmail: false,
      joinDate: now,
      invitedBy: admin.logtoId ?? admin.authUserId ?? "",
      lastUpdated: now,
      lastUpdatedBy: admin.logtoId ?? admin.authUserId ?? "",
      notificationPreferences: {},
      displayPreferences: {},
      accessibilitySettings: {},
      eventsAttended: 0,
      points: 0,
    });
  },
});

export const updateStatus = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("suspended"),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);

    await ctx.db.patch(args.userId, {
      status: args.status,
      lastUpdated: Date.now(),
      lastUpdatedBy: admin.logtoId,
    });

    return args.userId;
  },
});

export const updateProfileForAdmin = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
    name: v.optional(v.string()),
    major: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    memberId: v.optional(v.string()),
    pid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("Target user not found");

    const sanitizedUpdates = buildAdminProfilePatch(args);
    const updateData = {
      ...sanitizedUpdates,
      lastUpdated: Date.now(),
      lastUpdatedBy: admin.logtoId,
    };

    await ctx.db.patch(args.userId, updateData);

    const existingProfile = await ctx.db
      .query("publicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const nextName =
      typeof updateData.name === "string" ? updateData.name : targetUser.name;
    const nextMajor =
      typeof updateData.major === "string" ? updateData.major : targetUser.major;
    const nextGraduationYear =
      typeof updateData.graduationYear === "number"
        ? updateData.graduationYear
        : targetUser.graduationYear;

    const profileData = {
      name: nextName,
      major: nextMajor,
      points: targetUser.lifetimePointsEarned ?? targetUser.points ?? 0,
      eventsAttended: targetUser.eventsAttended || 0,
      position: targetUser.position || targetUser.role,
      graduationYear: nextGraduationYear,
      joinDate: targetUser.joinDate || targetUser._creationTime,
    };

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, profileData);
    } else {
      await ctx.db.insert("publicProfiles", {
        ...profileData,
        userId: args.userId,
      });
    }

    return args.userId;
  },
});

export const deleteUser = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser._id === admin._id) {
      throw new Error("You cannot delete your own account");
    }

    if (
      admin.role === "Executive Officer" &&
      targetUser.role === "Administrator"
    ) {
      throw new Error("Executive Officers cannot delete Administrator accounts");
    }

    const [pointAccount, pointLedgerEntry, merchOrder] = await Promise.all([
      ctx.db
        .query("pointAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", targetUser._id))
        .first(),
      ctx.db
        .query("pointLedgerEntries")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", targetUser._id))
        .first(),
      ctx.db
        .query("merchOrders")
        .withIndex("by_owner_createdAt", (q) => q.eq("ownerId", targetUser._id))
        .first(),
    ]);
    if (pointAccount || pointLedgerEntry || merchOrder) {
      throw new Error(
        "Users with point history or merchandise orders cannot be deleted; suspend the account instead",
      );
    }

    // Delete the user's public profile if it exists
    const publicProfile = await ctx.db
      .query("publicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (publicProfile) {
      await ctx.db.delete(publicProfile._id);
    }

    // Delete the user
    await ctx.db.delete(args.userId);

    return { success: true, deletedUserId: args.userId };
  },
});

export const getOverviewData = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const [pointTotals, ledgerEntries] = await Promise.all([
      getPointAccountSnapshot(ctx, user._id),
      ctx.db
        .query("pointLedgerEntries")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    const pointsHistory = ledgerEntries.map((entry) => ({
      date: entry.createdAt,
      points: entry.lifetimeDelta,
      cumulative: entry.lifetimeEarnedAfter,
    }));

    // Get user's reimbursements
    const reimbursements = await ctx.db
      .query("reimbursements")
      .withIndex("by_submittedBy", (q) => q.eq("submittedBy", userId))
      .collect();

    // Build recent activity
    const activities: { type: string; title: string; description: string; date: number; points?: number }[] = [];

    for (const entry of ledgerEntries) {
      const titles = {
        opening_balance: "Opening Balance",
        event_reward: "Event Reward",
        purchase: "Merch Purchase",
        refund: "Points Refund",
        correction: "Points Correction",
        spendable_adjustment: "Spendable Points Adjustment",
      } as const;
      activities.push({
        type: entry.kind,
        title: titles[entry.kind],
        description: entry.reason || "Points account activity",
        date: entry.createdAt,
        points: entry.balanceDelta,
      });
    }

    for (const r of reimbursements) {
      activities.push({
        type: "reimbursement",
        title: `Reimbursement ${r.status === "approved" ? "Approved" : r.status === "paid" ? "Paid" : "Submitted"}`,
        description: r.title,
        date: r._creationTime,
      });
    }

    activities.sort((a, b) => b.date - a.date);

    // Get rank
    const allUsers = await ctx.db.query("users").collect();
    const activeUsers = allUsers
      .filter((u) => u.signedUp && u.status === "active")
      .sort(
        (a, b) =>
          (b.lifetimePointsEarned ?? b.points ?? 0) -
          (a.lifetimePointsEarned ?? a.points ?? 0),
      );
    const rank = activeUsers.findIndex((u) => u._id === user._id) + 1;

    return {
      user: {
        name: user.name,
        points: pointTotals.balance,
        lifetimePointsEarned: pointTotals.lifetimeEarned,
        eventsAttended: user.eventsAttended || 0,
        role: user.role,
        joinDate: user.joinDate,
        signedUp: user.signedUp,
      },
      rank,
      totalMembers: activeUsers.length,
      pointsHistory,
      recentActivity: activities.slice(0, 10),
      reimbursementStats: {
        submitted: reimbursements.length,
        approved: reimbursements.filter((r) => r.status === "approved" || r.status === "paid").length,
      },
    };
  },
});

export const getLeaderboard = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.signedUp && u.status === "active")
      .map((u) => ({
        _id: u._id,
        name: u.name,
        points: u.lifetimePointsEarned ?? u.points ?? 0,
        eventsAttended: u.eventsAttended || 0,
        major: u.major,
        graduationYear: u.graduationYear,
        avatar: u.avatar,
      }))
      .sort((a, b) => b.points - a.points);
  },
});

export const getExecutiveAnalytics = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    fiscalYearStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);

    const [events, attendees, users] = await Promise.all([
      ctx.db.query("events").collect(),
      ctx.db.query("attendees").collect(),
      ctx.db.query("users").collect(),
    ]);

    const recordedTimestamps: number[] = [
      ...events.map((event) => event.startDate),
      ...attendees.map((attendee) => attendee.timeCheckedIn),
      ...users.map((user) => user.joinDate),
    ].filter((timestamp) => Number.isFinite(timestamp));

    if (recordedTimestamps.length === 0) {
      recordedTimestamps.push(Date.now());
    }

    const earliestFiscalYear = getFiscalYearStartYear(
      Math.min(...recordedTimestamps),
    );
    const latestFiscalYear = getFiscalYearStartYear(
      Math.max(...recordedTimestamps),
    );

    const fiscalYears: number[] = [];
    for (let year = latestFiscalYear; year >= earliestFiscalYear; year -= 1) {
      fiscalYears.push(year);
    }

    const selectedFiscalYear =
      args.fiscalYearStart !== undefined &&
      fiscalYears.includes(args.fiscalYearStart)
        ? args.fiscalYearStart
        : fiscalYears[0];

    const currentRange = getFiscalYearRange(selectedFiscalYear);
    const previousRange = getFiscalYearRange(selectedFiscalYear - 1);

    const publishedEvents = events.filter((event) => event.published);

    const eventsInRange = publishedEvents.filter(
      (event) =>
        event.startDate >= currentRange.start && event.startDate < currentRange.end,
    );
    const previousEvents = publishedEvents.filter(
      (event) =>
        event.startDate >= previousRange.start &&
        event.startDate < previousRange.end,
    );

    const eventsInRangeIds = new Set(eventsInRange.map((event) => event._id));
    const previousEventsIds = new Set(previousEvents.map((event) => event._id));

    const attendeesInRange = attendees.filter((attendee) =>
      eventsInRangeIds.has(attendee.eventId),
    );
    const previousAttendees = attendees.filter((attendee) =>
      previousEventsIds.has(attendee.eventId),
    );

    const activeUsers = users.filter(
      (user) => user.signedUp && user.status === "active",
    );
    const newUsersInRange = activeUsers.filter(
      (user) =>
        user.joinDate >= currentRange.start && user.joinDate < currentRange.end,
    );
    const newUsersPreviousRange = activeUsers.filter(
      (user) =>
        user.joinDate >= previousRange.start && user.joinDate < previousRange.end,
    );

    const totalAttendees = attendeesInRange.length;
    const uniqueAttendees = new Set(attendeesInRange.map((a) => a.userId)).size;

    const monthlyTrend = FISCAL_MONTH_LABELS.map((label, index) => {
      const month = (FISCAL_YEAR_START_MONTH + index) % 12;
      const year = month >= FISCAL_YEAR_START_MONTH
        ? selectedFiscalYear
        : selectedFiscalYear + 1;
      const monthStart = Date.UTC(year, month, 1);
      const monthEnd = Date.UTC(year, month + 1, 1);

      const monthEvents = eventsInRange.filter(
        (event) =>
          event.startDate >= monthStart && event.startDate < monthEnd,
      );
      const monthEventIds = new Set(monthEvents.map((event) => event._id));
      const monthAttendees = attendeesInRange.filter((attendee) =>
        monthEventIds.has(attendee.eventId),
      );

      return {
        month: label,
        eventsHosted: monthEvents.length,
        attendees: monthAttendees.length,
        uniqueAttendees: new Set(monthAttendees.map((a) => a.userId)).size,
      };
    });

    const eventTypeBreakdown = [
      { key: "technical", label: "Technical" },
      { key: "professional", label: "Professional" },
      { key: "social", label: "Social" },
      { key: "projects", label: "Projects" },
      { key: "outreach", label: "Outreach" },
      { key: "other", label: "Other" },
    ].map(({ key, label }) => ({
      type: key,
      label,
      value: eventsInRange.filter((event) => event.eventType === key).length,
    }));

    const topEvents = eventsInRange
      .map((event) => {
        const attendeeCount = attendeesInRange.filter(
          (attendee) => attendee.eventId === event._id,
        ).length;
        return {
          eventId: event._id,
          name: event.eventName,
          eventType: event.eventType,
          date: event.startDate,
          attendees: attendeeCount,
        };
      })
      .sort((a, b) => b.attendees - a.attendees)
      .slice(0, 5);

    const attendeeCoverage =
      activeUsers.length > 0 ? (uniqueAttendees / activeUsers.length) * 100 : 0;

    return {
      fiscalYearOptions: fiscalYears.map((year) => ({
        startYear: year,
        label: `July ${year} - June ${year + 1}`,
      })),
      selectedFiscalYear,
      selectedFiscalYearLabel: `July ${selectedFiscalYear} - June ${selectedFiscalYear + 1}`,
      overview: {
        eventsHosted: eventsInRange.length,
        totalAttendees,
        uniqueAttendees,
        activeUsers: activeUsers.length,
        newUsers: newUsersInRange.length,
        avgAttendeesPerEvent:
          eventsInRange.length > 0 ? totalAttendees / eventsInRange.length : 0,
        attendeeCoverage,
      },
      comparisons: {
        eventsHosted: toPercentChange(eventsInRange.length, previousEvents.length),
        totalAttendees: toPercentChange(totalAttendees, previousAttendees.length),
        newUsers: toPercentChange(
          newUsersInRange.length,
          newUsersPreviousRange.length,
        ),
      },
      monthlyTrend,
      eventTypeBreakdown,
      topEvents,
    };
  },
});

export const getOfficerLeaderboard = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const users = await ctx.db.query("users").collect();

    const officers = users.filter(
      (u) =>
        u.status === "active" &&
        (u.role === "General Officer" ||
          u.role === "Executive Officer" ||
          u.role === "Administrator"),
    );

    // Group by team
    const teams: Record<string, typeof officers> = {
      Internal: [],
      Events: [],
      Projects: [],
      Unassigned: [],
    };

    for (const officer of officers) {
      const team = officer.team || "Unassigned";
      if (!teams[team]) teams[team] = [];
      teams[team].push(officer);
    }

    // Get attendance data for each officer
    const officerData = await Promise.all(
      officers.map(async (officer) => {
        const userId = officer.logtoId ?? officer.authUserId ?? "";
        const attendees = await ctx.db
          .query("attendees")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();
        return {
          _id: officer._id,
          name: officer.name,
          avatar: officer.avatar,
          role: officer.role,
          position: officer.position,
          team: officer.team || "Unassigned",
          points: officer.lifetimePointsEarned ?? officer.points ?? 0,
          eventsAttended: officer.eventsAttended || 0,
          totalAttendances: attendees.length,
        };
      }),
    );

    // Calculate team metrics
    const teamMetrics = Object.entries(teams)
      .filter(([_, members]) => members.length > 0)
      .map(([teamName, members]) => {
        const teamOfficerData = officerData.filter((o) => o.team === teamName);
        const totalAttendances = teamOfficerData.reduce((sum, o) => sum + o.totalAttendances, 0);
        const totalPoints = teamOfficerData.reduce((sum, o) => sum + o.points, 0);
        return {
          team: teamName,
          memberCount: members.length,
          totalAttendances,
          totalPoints,
          attendanceRate: members.length > 0 ? totalAttendances / members.length : 0,
          members: teamOfficerData.sort((a, b) => b.totalAttendances - a.totalAttendances),
        };
      })
      .sort((a, b) => b.attendanceRate - a.attendanceRate);

    return { teamMetrics, officers: officerData };
  },
});
