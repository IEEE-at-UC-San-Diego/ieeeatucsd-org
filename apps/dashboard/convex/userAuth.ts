import { anyApi } from "convex/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AuthLike } from "./logtoIdentity";
import { LogtoIdentity } from "./logtoIdentity";
import { hasOfficerAccess, requireCurrentUser } from "./permissions";
import type { AuthUpsertResult } from "./userProvisioning";
import { buildAuthUpsertResult } from "./userProvisioning";

export type VerifiedAuthUpsertArgs = {
  logtoId: string;
  email: string;
  name: string;
  avatar?: string;
  signInMethod?: string;
};

export type UpsertFromAuthArgs = {
  authToken?: string;
  name?: string;
  avatar?: string;
  signInMethod?: string;
};

export type GetByLogtoIdArgs = {
  logtoId: string;
  authToken: string;
  targetLogtoId?: string;
};

const OFFICER_VISIBLE_USER_FIELDS = [
  "_id",
  "logtoId",
  "name",
  "email",
  "role",
  "status",
  "signedUp",
  "avatar",
  "position",
  "team",
] as const;

/**
 * Authenticated user-directory operations. Identity fields written during
 * login come from a verified Logto/Convex identity, never from client args.
 */
export class UserAuth {
  static async upsertFromAuth<T>(
    ctx: AuthLike,
    args: UpsertFromAuthArgs,
    persist: (verified: VerifiedAuthUpsertArgs) => Promise<T>,
  ): Promise<T> {
    const identity = await LogtoIdentity.resolve(ctx, args.authToken);

    return persist({
      logtoId: identity.subject,
      email: identity.email,
      name: identity.name || args.name?.trim() || identity.subject,
      avatar: identity.picture || args.avatar,
      signInMethod: args.signInMethod,
    });
  }

  static async applyVerifiedAuthUpsert(
    ctx: MutationCtx,
    args: VerifiedAuthUpsertArgs,
  ) {
    const normalizedEmail = args.email.trim().toLowerCase();

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
  }

  static async getByLogtoId(ctx: QueryCtx, args: GetByLogtoIdArgs) {
    const caller = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const targetLogtoId = args.targetLogtoId ?? caller.logtoId;

    if (!targetLogtoId) {
      throw new Error("User not found in database");
    }

    if (caller.logtoId === targetLogtoId) {
      return caller;
    }

    if (!hasOfficerAccess(caller.role)) {
      throw new Error(
        "Insufficient permissions: cannot read another user's record",
      );
    }

    const target = await ctx.db
      .query("users")
      .withIndex("by_logtoId", (q) => q.eq("logtoId", targetLogtoId))
      .first();

    if (!target) return null;
    return UserAuth.toOfficerVisibleUser(target);
  }

  static toOfficerVisibleUser<T extends Record<string, unknown>>(user: T) {
    const visible: Record<string, unknown> = {};
    for (const field of OFFICER_VISIBLE_USER_FIELDS) {
      if (field in user) {
        visible[field] = user[field];
      }
    }
    return visible as Pick<T, Extract<keyof T, (typeof OFFICER_VISIBLE_USER_FIELDS)[number]>>;
  }
}

/**
 * Provision or refresh the signed-in Logto user.
 *
 * `authToken` must be a Logto ID token (JWT). Client-supplied logtoId/email
 * are not accepted — those fields are taken from Convex native auth or from
 * a JWKS-verified ID token.
 */
export const upsertFromAuth = action({
  args: {
    authToken: v.string(),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    signInMethod: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AuthUpsertResult> => {
    return await UserAuth.upsertFromAuth(ctx, args, (verified) =>
      ctx.runMutation(anyApi.userAuthWrite.applyVerifiedAuthUpsert, verified),
    );
  },
});
