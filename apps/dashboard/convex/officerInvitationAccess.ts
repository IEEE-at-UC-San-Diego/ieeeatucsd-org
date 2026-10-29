import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { LogtoIdentity } from "./logtoIdentity";
import { requireCurrentUser } from "./permissions";

export type InvitationCallerArgs = {
  logtoId: string;
  authToken: string;
};

export type InvitationCaller = {
  email: string;
  subject: string;
  source: "native" | "session";
};

export type PublicInvitationView = {
  _id: Id<"officerInvitations">;
  name: string;
  email: string;
  role: string;
  position: string;
  offeredPositions?: string[];
  status: string;
  invitedAt: number;
  expiresAt: number;
  message?: string;
  acceptanceDeadline?: string;
  leaderName?: string;
};

type InvitationDoc = {
  _id: Id<"officerInvitations">;
  name: string;
  email: string;
  role: string;
  position: string;
  offeredPositions?: string[];
  status: string;
  invitedBy: string;
  invitedAt: number;
  expiresAt: number;
  message?: string;
  acceptanceDeadline?: string;
  leaderName?: string;
};

/**
 * Identity + email binding for officer invitation accept/decline.
 *
 * Anyone who only knows an invitation `_id` used to be able to grant the
 * invited role. Callers must now prove a session/HMAC or Convex identity
 * whose verified email matches the invitation.
 */
export class OfficerInvitationAccess {
  static readonly AUTH_REQUIRED = "Authentication required";
  static readonly EMAIL_MISMATCH =
    "Invitation email does not match authenticated user";

  static normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  static emailsMatch(
    left?: string | null,
    right?: string | null,
  ): boolean {
    if (!left || !right) return false;
    return (
      OfficerInvitationAccess.normalizeEmail(left) ===
      OfficerInvitationAccess.normalizeEmail(right)
    );
  }

  static callerEmailFromAuth(input: {
    claimsEmail?: string | null;
    userEmail?: string | null;
  }) {
    const fromClaims = input.claimsEmail?.trim();
    if (fromClaims) {
      return OfficerInvitationAccess.normalizeEmail(fromClaims);
    }
    const fromUser = input.userEmail?.trim();
    if (fromUser) {
      return OfficerInvitationAccess.normalizeEmail(fromUser);
    }
    return "";
  }

  static publicInvitationFields(invitation: InvitationDoc): PublicInvitationView {
    return {
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
    };
  }

  static async requireMatchingCaller(
    ctx: MutationCtx,
    args: InvitationCallerArgs,
    invitationEmail: string,
  ): Promise<InvitationCaller> {
    if (!args.logtoId.trim() || !args.authToken.trim()) {
      throw new Error(OfficerInvitationAccess.AUTH_REQUIRED);
    }

    const native = await LogtoIdentity.fromConvexAuth(ctx);
    if (native) {
      if (native.subject !== args.logtoId) {
        throw new Error("Auth token subject mismatch");
      }
      if (!OfficerInvitationAccess.emailsMatch(native.email, invitationEmail)) {
        throw new Error(OfficerInvitationAccess.EMAIL_MISMATCH);
      }
      return {
        email: OfficerInvitationAccess.normalizeEmail(native.email),
        subject: native.subject,
        source: "native",
      };
    }

    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    if (!OfficerInvitationAccess.emailsMatch(user.email, invitationEmail)) {
      throw new Error(OfficerInvitationAccess.EMAIL_MISMATCH);
    }

    return {
      email: OfficerInvitationAccess.normalizeEmail(user.email),
      subject: user.logtoId ?? args.logtoId,
      source: "session",
    };
  }

  static async accept(
    ctx: MutationCtx,
    args: InvitationCallerArgs & {
      id: Id<"officerInvitations">;
      selectedPosition?: string;
    },
  ) {
    if (!args.logtoId.trim() || !args.authToken.trim()) {
      throw new Error(OfficerInvitationAccess.AUTH_REQUIRED);
    }

    const invitation = await ctx.db.get(args.id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await OfficerInvitationAccess.requireMatchingCaller(
      ctx,
      args,
      invitation.email,
    );

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
    const normalizedEmail = OfficerInvitationAccess.normalizeEmail(
      invitation.email,
    );
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
      ...OfficerInvitationAccess.publicInvitationFields(invitation),
      position: selectedPosition,
      status: "accepted",
      acceptedAt: now,
      roleGranted,
      userCreatedOrUpdated: roleGranted,
    };
  }

  static async decline(
    ctx: MutationCtx,
    args: InvitationCallerArgs & { id: Id<"officerInvitations"> },
  ) {
    if (!args.logtoId.trim() || !args.authToken.trim()) {
      throw new Error(OfficerInvitationAccess.AUTH_REQUIRED);
    }

    const invitation = await ctx.db.get(args.id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await OfficerInvitationAccess.requireMatchingCaller(
      ctx,
      args,
      invitation.email,
    );

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
      ...OfficerInvitationAccess.publicInvitationFields(invitation),
      status: "declined",
      declinedAt: now,
    };
  }
}
