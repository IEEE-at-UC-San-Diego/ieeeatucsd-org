export const INVITATION_EXPIRED = "Invitation has expired";

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export type InvitationState = {
  status: InvitationStatus;
  expiresAt: number;
  acceptedAt?: number;
  declinedAt?: number;
  role: string;
};

export type InvitationStamp = {
  status: InvitationStatus;
  acceptedAt: number | undefined;
  declinedAt: number | undefined;
  grantRole: boolean;
  role: string;
};

export type InvitationTransitionResult = {
  ok: boolean;
  error?: string;
  stamp?: InvitationStamp;
};

export type InvitationAction =
  | { type: "accept"; emailMatches: boolean }
  | { type: "decline" }
  | { type: "expire" }
  | { type: "resend" }
  | { type: "applyAccepted" }
  | { type: "setStatus"; status: InvitationStatus; grantRole: boolean }
  | { type: "recordSideEffects"; setsRoleFlags: boolean };

function stamp(
  state: InvitationState,
  status: InvitationStatus,
  acceptedAt: number | undefined,
  declinedAt: number | undefined,
  grantRole: boolean,
): InvitationStamp {
  if (acceptedAt !== undefined && declinedAt !== undefined) {
    throw new Error("An invitation cannot keep both acceptance and decline times");
  }
  return {
    status,
    acceptedAt,
    declinedAt,
    grantRole,
    role: state.role,
  };
}

function acceptedStamp(state: InvitationState, now: number): InvitationStamp {
  return stamp(state, "accepted", now, undefined, true);
}

function declinedStamp(state: InvitationState, now: number): InvitationStamp {
  return stamp(state, "declined", undefined, now, false);
}

function expiredStamp(state: InvitationState): InvitationStamp {
  return stamp(state, "expired", undefined, undefined, false);
}

function clockExpired(state: InvitationState, now: number) {
  return state.status === "pending" && now > state.expiresAt;
}

function expiredResult(state: InvitationState): InvitationTransitionResult {
  return { ok: false, error: INVITATION_EXPIRED, stamp: expiredStamp(state) };
}

function fail(error: string): InvitationTransitionResult {
  return { ok: false, error };
}

export function assertInvitationServerWriter(provided: string | undefined) {
  const expected = process.env.CONVEX_SESSION_SECRET;
  if (!expected || provided !== expected) {
    throw new Error("Unauthorized");
  }
}

export function transitionOfficerInvitation(
  state: InvitationState,
  action: InvitationAction,
  now: number,
): InvitationTransitionResult {
  switch (action.type) {
    case "accept": {
      if (!action.emailMatches) {
        return fail("Invitation email does not match");
      }
      if (clockExpired(state, now)) return expiredResult(state);
      if (state.status !== "pending") {
        return fail(`Invitation has already been ${state.status}`);
      }
      return { ok: true, stamp: acceptedStamp(state, now) };
    }
    case "decline": {
      if (clockExpired(state, now)) return expiredResult(state);
      if (state.status !== "pending") {
        return fail(`Invitation has already been ${state.status}`);
      }
      return { ok: true, stamp: declinedStamp(state, now) };
    }
    case "expire": {
      if (state.status !== "pending") {
        return fail(`Invitation has already been ${state.status}`);
      }
      return { ok: true, stamp: expiredStamp(state) };
    }
    case "resend": {
      if (clockExpired(state, now)) return expiredResult(state);
      if (state.status !== "pending") {
        return fail("Resend is only available for a pending invitation");
      }
      return { ok: true };
    }
    case "applyAccepted": {
      if (state.status !== "accepted") {
        return fail("Only an accepted invitation grants a role at sign-in");
      }
      return {
        ok: true,
        stamp: stamp(
          state,
          "accepted",
          state.acceptedAt ?? now,
          undefined,
          true,
        ),
      };
    }
    case "setStatus": {
      if (clockExpired(state, now) && action.status !== "expired") {
        return expiredResult(state);
      }
      if (action.status === "accepted" && !action.grantRole) {
        return fail("Cannot mark an invitation accepted without granting the role");
      }
      if (state.status === "accepted" && action.status === "pending") {
        return fail("Cannot move an accepted invitation back to pending");
      }
      if (state.status === action.status) {
        if (action.status === "accepted") {
          return {
            ok: true,
            stamp: stamp(
              state,
              "accepted",
              state.acceptedAt ?? now,
              undefined,
              true,
            ),
          };
        }
        if (action.status === "declined") {
          return {
            ok: true,
            stamp: stamp(
              state,
              "declined",
              undefined,
              state.declinedAt ?? now,
              false,
            ),
          };
        }
        return {
          ok: true,
          stamp: stamp(state, action.status, undefined, undefined, false),
        };
      }
      if (state.status === "pending" && action.status === "accepted") {
        return { ok: true, stamp: acceptedStamp(state, now) };
      }
      if (state.status === "pending" && action.status === "declined") {
        return { ok: true, stamp: declinedStamp(state, now) };
      }
      if (state.status === "pending" && action.status === "expired") {
        return { ok: true, stamp: expiredStamp(state) };
      }
      if (state.status === "declined" && action.status === "accepted") {
        return { ok: true, stamp: acceptedStamp(state, now) };
      }
      return fail(
        `Cannot move an invitation from ${state.status} to ${action.status}`,
      );
    }
    case "recordSideEffects": {
      if (action.setsRoleFlags && state.status !== "accepted") {
        return fail("Role flags can only be recorded on an accepted invitation");
      }
      if (state.status !== "accepted") {
        return fail("Acceptance side effects require an accepted invitation");
      }
      return { ok: true };
    }
    default: {
      const unreachable: never = action;
      return fail(`Unknown invitation action: ${JSON.stringify(unreachable)}`);
    }
  }
}
