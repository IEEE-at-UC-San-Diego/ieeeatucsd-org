import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { syncRecordStorage } from "./storageReferences";
import { v } from "convex/values";
import { requireAdminAccess } from "./permissions";
import {
  assertInvitationServerWriter,
  expiredInvitationFailure,
  transitionOfficerInvitation,
  type InvitationState,
} from "./officerInvitationTransition";

const publicInvitationFields = (invitation: any) => ({
  _id: invitation._id,
  name: invitation.name,
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

function invitationState(invitation: {
  status: InvitationState["status"];
  expiresAt: number;
  acceptedAt?: number;
  declinedAt?: number;
  role: string;
}): InvitationState {
  return {
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    declinedAt: invitation.declinedAt,
    role: invitation.role,
  };
}

function stampPatch(stamp: {
  status: InvitationState["status"];
  acceptedAt: number | undefined;
  declinedAt: number | undefined;
  grantRole: boolean;
}) {
  return {
    status: stamp.status,
    acceptedAt: stamp.acceptedAt,
    declinedAt: stamp.declinedAt,
    ...(stamp.grantRole
      ? {
          roleGranted: true,
          userCreatedOrUpdated: true,
          permissionsGranted: true,
          roleGrantedAt: stamp.acceptedAt,
        }
      : {}),
  };
}

async function grantInvitationRole(
  ctx: MutationCtx,
  invitation: Doc<"officerInvitations">,
  selectedPosition: string,
  now: number,
) {
  const normalizedEmail = invitation.email.trim().toLowerCase();
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .first();

  if (existingUser) {
    await ctx.db.patch(existingUser._id, {
      role: invitation.role,
      position: selectedPosition,
      lastUpdated: now,
      lastUpdatedBy: invitation.invitedBy,
    });
    await syncRecordStorage(ctx, "users", existingUser._id);
    return;
  }

  const userId = await ctx.db.insert("users", {
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
  await syncRecordStorage(ctx, "users", userId);
}

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("officerInvitations").collect();
  },
});

export const getByEmail = query({
  args: { logtoId: v.string(), authToken: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db
      .query("officerInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

export const get = query({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("officerInvitations") },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
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
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
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
    const invitation = await ctx.db.get(args.id);
    if (!invitation) throw new Error("Invitation not found");

    const now = Date.now();
    const result = transitionOfficerInvitation(
      invitationState(invitation),
      {
        type: "setStatus",
        status: args.status,
        grantRole: args.status === "accepted",
      },
      now,
    );
    if (result.stamp) {
      if (result.stamp.grantRole) {
        await grantInvitationRole(ctx, invitation, invitation.position, now);
      }
      await ctx.db.patch(args.id, stampPatch(result.stamp));
    }
    if (!result.ok) throw new Error(result.error ?? "Illegal invitation transition");
    return args.id;
  },
});

export const acceptPublic = mutation({
  args: {
    id: v.id("officerInvitations"),
    email: v.string(),
    selectedPosition: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const now = Date.now();
    const emailMatches =
      args.email.trim().toLowerCase() === invitation.email.trim().toLowerCase();
    const result = transitionOfficerInvitation(
      invitationState(invitation),
      { type: "accept", emailMatches },
      now,
    );
    const expired = expiredInvitationFailure(result);
    if (expired && result.stamp) {
      await ctx.db.patch(args.id, stampPatch(result.stamp));
      return expired;
    }
    if (!result.ok) {
      throw new Error(result.error ?? "Illegal invitation transition");
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

    await grantInvitationRole(ctx, invitation, selectedPosition, now);
    const stamp = result.stamp;
    if (!stamp) throw new Error("Illegal invitation transition");
    await ctx.db.patch(args.id, {
      ...stampPatch(stamp),
      position: selectedPosition,
    });

    return {
      ...publicInvitationFields(invitation),
      email: invitation.email,
      position: selectedPosition,
      status: "accepted" as const,
      acceptedAt: now,
      roleGranted: true,
      userCreatedOrUpdated: true,
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
    const now = Date.now();
    const result = transitionOfficerInvitation(
      invitationState(invitation),
      { type: "decline" },
      now,
    );
    const expired = expiredInvitationFailure(result);
    if (expired && result.stamp) {
      await ctx.db.patch(args.id, stampPatch(result.stamp));
      return expired;
    }
    if (!result.ok) throw new Error(result.error ?? "Illegal invitation transition");
    if (result.stamp) await ctx.db.patch(args.id, stampPatch(result.stamp));

    return {
      ...publicInvitationFields(invitation),
      status: "declined" as const,
      declinedAt: now,
    };
  },
});

export const recordAcceptanceSideEffects = mutation({
  args: {
    id: v.id("officerInvitations"),
    serverSecret: v.string(),
    onboardingEmailSent: v.optional(v.boolean()),
    roleGranted: v.optional(v.boolean()),
    userCreatedOrUpdated: v.optional(v.boolean()),
    googleGroupAssigned: v.optional(v.boolean()),
    googleGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInvitationServerWriter(args.serverSecret);
    const invitation = await ctx.db.get(args.id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const setsRoleFlags =
      args.roleGranted !== undefined ||
      args.userCreatedOrUpdated !== undefined ||
      args.roleGranted === true;
    const result = transitionOfficerInvitation(
      invitationState(invitation),
      { type: "recordSideEffects", setsRoleFlags },
      Date.now(),
    );
    if (!result.ok) throw new Error(result.error ?? "Illegal invitation transition");

    const now = Date.now();
    const updates: Record<string, unknown> = {};
    if (args.onboardingEmailSent !== undefined) {
      updates.onboardingEmailSent = args.onboardingEmailSent;
    }
    if (args.roleGranted !== undefined) {
      updates.roleGranted = args.roleGranted;
      updates.permissionsGranted = args.roleGranted;
      if (args.roleGranted) updates.roleGrantedAt = now;
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
    const invitation = await ctx.db.get(args.id);
    if (!invitation) throw new Error("Invitation not found");
    const now = Date.now();
    const result = transitionOfficerInvitation(
      invitationState(invitation),
      { type: "resend" },
      now,
    );
    if (result.stamp) await ctx.db.patch(args.id, stampPatch(result.stamp));
    if (!result.ok) throw new Error(result.error ?? "Illegal invitation transition");
    await ctx.db.patch(args.id, {
      resentAt: now,
      lastSentAt: now,
    });
    return args.id;
  },
});

export const expireOverdue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("officerInvitations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    let expired = 0;
    for (const invitation of pending) {
      const result = transitionOfficerInvitation(
        invitationState(invitation),
        { type: "expire" },
        now,
      );
      if (!result.ok || !result.stamp) continue;
      await ctx.db.patch(invitation._id, stampPatch(result.stamp));
      expired += 1;
    }
    return { expired };
  },
});
