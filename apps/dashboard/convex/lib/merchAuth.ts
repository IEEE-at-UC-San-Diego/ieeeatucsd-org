import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  requireAdminAccess,
  requireCurrentUser,
  requireOfficerAccess,
} from "../permissions";

type AuthContext = QueryCtx | MutationCtx;

export function assertActiveOnboarded(user: { signedUp: boolean; status: string }) {
  if (!user.signedUp || user.status !== "active") {
    throw new Error("An active, fully onboarded account is required");
  }
}

export async function requireMerchShopper(
  ctx: AuthContext,
  logtoId: string,
  authToken: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  assertMerchShopper(user);
  return user;
}

export function assertMerchShopper(user: {
  signedUp: boolean;
  status: string;
  role: string;
}) {
  assertActiveOnboarded(user);
  if (user.role === "Sponsor") {
    throw new Error("This account is not eligible to shop");
  }
}

export async function requireMerchManager(
  ctx: AuthContext,
  logtoId: string,
  authToken: string,
) {
  const user = await requireAdminAccess(ctx, logtoId, authToken);
  assertActiveOnboarded(user);
  return user;
}

export async function requireMerchFulfiller(
  ctx: AuthContext,
  logtoId: string,
  authToken: string,
) {
  const user = await requireOfficerAccess(ctx, logtoId, authToken);
  assertActiveOnboarded(user);
  return user;
}
