import type { QueryCtx, MutationCtx } from "./_generated/server";

export type UserRole =
  | "Member"
  | "General Officer"
  | "Executive Officer"
  | "Member at Large"
  | "Past Officer"
  | "Sponsor"
  | "Administrator";

export type SponsorTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

type SessionPayload = {
  sub: string;
  role?: UserRole;
  iat: number;
  exp: number;
  v: number;
};

type AuthContext = QueryCtx | MutationCtx;

let cachedKey:
  | {
      secret: string;
      key: CryptoKey;
    }
  | null = null;

function getSessionSecret() {
  const secret = process.env.CONVEX_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing CONVEX_SESSION_SECRET");
  }
  return secret;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSigningKey(secret: string) {
  if (cachedKey && cachedKey.secret === secret) {
    return cachedKey.key;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  cachedKey = { secret, key };
  return key;
}

async function signHex(input: string, secret: string) {
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return toHex(new Uint8Array(signature));
}

async function verifySessionToken(authToken: string): Promise<SessionPayload> {
  const parts = authToken.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid auth token format");
  }

  const [encodedPayload, signature] = parts;
  const secret = getSessionSecret();
  const expected = await signHex(encodedPayload, secret);
  if (expected !== signature) {
    throw new Error("Invalid auth token signature");
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(decodeURIComponent(encodedPayload)) as SessionPayload;
  } catch {
    throw new Error("Invalid auth token payload");
  }

  if (!payload.sub || !payload.iat || !payload.exp || payload.v !== 1) {
    throw new Error("Invalid auth token claims");
  }

  if (Date.now() >= payload.exp * 1000) {
    throw new Error("Auth token expired");
  }

  return payload;
}

async function getNativeIdentity(ctx: AuthContext) {
  try {
    return await ctx.auth.getUserIdentity();
  } catch {
    return null;
  }
}

/**
 * Get the current user document from the database using their Logto ID.
 *
 * The dashboard authenticates Convex calls with an app-minted HMAC bridge
 * token (`authToken`) that must match the explicit `logtoId`. If Convex has
 * a native OIDC identity (unused today; Logto defaults to ES384), that
 * subject is preferred and must still match `logtoId` when both are present.
 */
export async function getCurrentUser(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const nativeIdentity = await getNativeIdentity(ctx);
  const resolvedLogtoId = nativeIdentity?.subject ?? logtoId;

  if (!resolvedLogtoId) return null;

  if (nativeIdentity?.subject) {
    if (logtoId && nativeIdentity.subject !== logtoId) {
      throw new Error("Auth token subject mismatch");
    }
  } else {
    if (!authToken) {
      throw new Error("Missing auth token");
    }

    const claims = await verifySessionToken(authToken);
    if (claims.sub !== resolvedLogtoId) {
      throw new Error("Auth token subject mismatch");
    }
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_logtoId", (q) => q.eq("logtoId", resolvedLogtoId))
    .first();

  return user;
}

/**
 * Require the current user to exist in the database.
 */
export async function requireCurrentUser(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await getCurrentUser(ctx, logtoId, authToken);
  if (!user) {
    throw new Error("User not found in database");
  }
  return user;
}

// --- Role check helpers ---

export function isAdmin(role: UserRole): boolean {
  return role === "Administrator";
}

export function isExecutiveOfficer(role: UserRole): boolean {
  return role === "Executive Officer";
}

export function isGeneralOfficer(role: UserRole): boolean {
  return role === "General Officer";
}

export function isSponsor(role: UserRole): boolean {
  return role === "Sponsor";
}

/**
 * Admin access: Administrators and Executive Officers
 */
export function hasAdminAccess(role: UserRole): boolean {
  return isAdmin(role) || isExecutiveOfficer(role);
}

/**
 * Officer access: Administrators, Executive Officers, and General Officers
 */
export function hasOfficerAccess(role: UserRole): boolean {
  return hasAdminAccess(role) || isGeneralOfficer(role);
}

/**
 * Vice Chair Operations title as stored on `users.position`.
 */
export function isVcoPosition(position?: string | null): boolean {
  if (!position) return false;
  const normalized = position.trim().toLowerCase();
  return (
    normalized === "vco" ||
    normalized === "vice chair operations" ||
    normalized.includes("vice chair operations")
  );
}

/**
 * VCO pipeline view: Administrators, Executive Officers, or an officer
 * whose position is Vice Chair Operations.
 */
export function hasVcoViewAccess(
  role: UserRole,
  position?: string | null,
): boolean {
  return hasAdminAccess(role) || (hasOfficerAccess(role) && isVcoPosition(position));
}

/**
 * Fields writable only through `events.updateVcoPipeline`.
 * `events.update` / `events.create` do not accept these.
 */
export const VCO_PIPELINE_EDIT_FIELDS = [
  "dateTbd",
  "finId",
  "funded",
  "tresOwner",
  "progAppDoneAt",
  "progAppDoneBy",
  "tresStartDoneAt",
  "tresStartDoneBy",
  "tresFinishDoneAt",
  "tresFinishDoneBy",
] as const;

export type VcoPipelineEditField = (typeof VCO_PIPELINE_EDIT_FIELDS)[number];

/**
 * Same gate as viewing the VCO pipeline: only VCO-titled officers,
 * Executive Officers, and Administrators may edit pipeline fields
 * (funded, FIN-ID, T-Res owner, and phase done timestamps).
 */
export function canEditVcoPipelineFields(
  role: UserRole,
  position?: string | null,
): boolean {
  return hasVcoViewAccess(role, position);
}

/**
 * Check if user can access the resume database (Bronze sponsors cannot)
 */
export function canAccessResumeDatabase(
  role: UserRole,
  sponsorTier?: SponsorTier | null,
): boolean {
  if (isAdmin(role)) return true;
  if (isSponsor(role) && sponsorTier === "Bronze") return false;
  if (isSponsor(role)) return true;
  return false;
}

// --- Permission enforcement helpers for Convex functions ---

/**
 * Require the current user to have at least officer access.
 */
export async function requireOfficerAccess(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (!hasOfficerAccess(user.role)) {
    throw new Error("Insufficient permissions: officer access required");
  }
  return user;
}

/**
 * Require the current user to have admin access (Admin or Executive Officer).
 */
export async function requireAdminAccess(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (!hasAdminAccess(user.role)) {
    throw new Error("Insufficient permissions: admin access required");
  }
  return user;
}

/**
 * Require VCO pipeline access (admin/exec, or VCO by position).
 */
export async function requireVcoViewAccess(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (!hasVcoViewAccess(user.role, user.position)) {
    throw new Error("Insufficient permissions: VCO or admin access required");
  }
  return user;
}

/**
 * Require the current user to be an Administrator.
 */
export async function requireAdmin(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (!isAdmin(user.role)) {
    throw new Error("Insufficient permissions: administrator access required");
  }
  return user;
}

/**
 * Require access to the sponsor resume database (admin or non-Bronze sponsor).
 */
export async function requireResumeDatabaseAccess(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (!canAccessResumeDatabase(user.role, user.sponsorTier)) {
    throw new Error("Insufficient permissions: resume database access required");
  }
  return user;
}

/**
 * Require the current user to be a Sponsor.
 */
export async function requireSponsor(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (!isSponsor(user.role) && !isAdmin(user.role)) {
    throw new Error("Insufficient permissions: sponsor access required");
  }
  return user;
}

/**
 * Check if the current user owns a resource or has admin access.
 */
export async function requireOwnerOrAdmin(
  ctx: AuthContext,
  logtoId: string,
  authToken: string,
  ownerId: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (user.logtoId !== ownerId && !hasAdminAccess(user.role)) {
    throw new Error("Insufficient permissions: not the owner or admin");
  }
  return user;
}
