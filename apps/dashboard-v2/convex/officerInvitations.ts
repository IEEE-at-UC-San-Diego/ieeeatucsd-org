import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess } from "./permissions";

const publicInvitationFields = (invitation: any) => ({
  _id: invitation._id,
  name: invitation.name,
  email: invitation.email,
  role: invitation.role,
  position: invitation.position,
  offeredPositions: invitation.offeredPositions,
  status: invitation.status,
  invitedAt: invitation.invitedAt,
  expiresAt: invitation.expiresAt,
  message: invitation.message,
  acceptanceDeadline: invitation.acceptanceDeadline,
  leaderName: invitation.leaderName,
});

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("officerInvitations").collect();
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("officerInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("officerInvitations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getPublic = query({
  args: { id: v.id("officerInvitations") },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.id);
    return invitation ? publicInvitationFields(invitation) : null;
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("Member"),
      v.literal("General Officer"),
      v.literal("Executive Officer"),
      v.literal("Member at Large"),
      v.literal("Past Officer"),
      v.literal("Sponsor"),
      v.literal("Administrator"),
    ),
    position: v.string(),
    offeredPositions: v.optional(v.array(v.string())),
    message: v.optional(v.string()),
    acceptanceDeadline: v.optional(v.string()),
    leaderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const now = Date.now();
    const { logtoId, authToken, ...data } = args;
    return await ctx.db.insert("officerInvitations", {
      ...data,
      email: data.email.trim().toLowerCase(),
      status: "pending",
      invitedBy: adminId,
      invitedAt: now,
      lastSentAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  },
});

export const updateStatus = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("officerInvitations"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const now = Date.now();
    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "accepted") updates.acceptedAt = now;
    if (args.status === "declined") updates.declinedAt = now;
    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const acceptPublic = mutation({
  args: {
    id: v.id("officerInvitations"),
    selectedPosition: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }
    if (invitation.status !== "pending") {
      throw new Error(`Invitation has already been ${invitation.status}`);
    }
    if (Date.now() > invitation.expiresAt) {
      await ctx.db.patch(args.id, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    const offeredPositions =
      invitation.offeredPositions && invitation.offeredPositions.length > 0
        ? invitation.offeredPositions
        : [invitation.position];
    if (offeredPositions.length > 1 && !args.selectedPosition?.trim()) {
      throw new Error("Please select one position to accept");
    }
    const selectedPosition = args.selectedPosition?.trim() || invitation.position;
    if (!offeredPositions.includes(selectedPosition)) {
      throw new Error("Selected position is not part of this invitation");
    }

    const now = Date.now();
    const normalizedEmail = invitation.email.trim().toLowerCase();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    let roleGranted = false;
    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        role: invitation.role,
        position: selectedPosition,
        lastUpdated: now,
        lastUpdatedBy: invitation.invitedBy,
      });
      roleGranted = true;
    } else {
      await ctx.db.insert("users", {
        email: normalizedEmail,
        emailVisibility: true,
        verified: true,
        name: invitation.name,
        role: invitation.role,
        position: selectedPosition,
        status: "active",
        signedUp: false,
        requestedEmail: false,
        joinDate: now,
        invitedBy: invitation.invitedBy,
        inviteAccepted: now,
        lastUpdated: now,
        lastUpdatedBy: invitation.invitedBy,
        notificationPreferences: {},
        displayPreferences: {},
        accessibilitySettings: {},
        eventsAttended: 0,
        points: 0,
      });
      roleGranted = true;
    }

    const updates: Record<string, unknown> = {
      status: "accepted",
      position: selectedPosition,
      acceptedAt: now,
      roleGranted,
      userCreatedOrUpdated: roleGranted,
      permissionsGranted: roleGranted,
    };
    if (roleGranted) {
      updates.roleGrantedAt = now;
    }
    await ctx.db.patch(args.id, updates);

    return {
      ...publicInvitationFields(invitation),
      position: selectedPosition,
      status: "accepted",
      acceptedAt: now,
      roleGranted,
      userCreatedOrUpdated: roleGranted,
    };
  },
});

export const declinePublic = mutation({
  args: { id: v.id("officerInvitations") },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }
    if (invitation.status !== "pending") {
      throw new Error(`Invitation has already been ${invitation.status}`);
    }
    if (Date.now() > invitation.expiresAt) {
      await ctx.db.patch(args.id, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "declined",
      declinedAt: now,
    });

    return {
      ...publicInvitationFields(invitation),
      status: "declined",
      declinedAt: now,
    };
  },
});

export const recordAcceptanceSideEffects = mutation({
  args: {
    id: v.id("officerInvitations"),
    onboardingEmailSent: v.optional(v.boolean()),
    roleGranted: v.optional(v.boolean()),
    userCreatedOrUpdated: v.optional(v.boolean()),
    googleGroupAssigned: v.optional(v.boolean()),
    googleGroup: v.optional(v.string()),
    logtoRoleGranted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {};
    if (args.onboardingEmailSent !== undefined) {
      updates.onboardingEmailSent = args.onboardingEmailSent;
    }
    if (args.roleGranted !== undefined) {
      updates.roleGranted = args.roleGranted;
      updates.permissionsGranted = args.roleGranted;
      if (args.roleGranted) {
        updates.roleGrantedAt = now;
      }
    }
    if (args.userCreatedOrUpdated !== undefined) {
      updates.userCreatedOrUpdated = args.userCreatedOrUpdated;
    }
    if (args.googleGroupAssigned !== undefined) {
      updates.googleGroupAssigned = args.googleGroupAssigned;
    }
    if (args.googleGroup !== undefined) {
      updates.googleGroup = args.googleGroup;
    }
    if (args.logtoRoleGranted !== undefined) {
      updates.logtoRoleGranted = args.logtoRoleGranted;
      if (args.logtoRoleGranted) {
        updates.logtoRoleGrantedAt = now;
      }
    }

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

export const updateGoogleGroup = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("officerInvitations"),
    googleGroupAssigned: v.boolean(),
    googleGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.id, {
      googleGroupAssigned: args.googleGroupAssigned,
      googleGroup: args.googleGroup,
    });
    return args.id;
  },
});

export const resend = mutation({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("officerInvitations") },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.id, {
      resentAt: Date.now(),
      lastSentAt: Date.now(),
    });
    return args.id;
  },
});
