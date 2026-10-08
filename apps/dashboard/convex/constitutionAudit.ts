export type AuditActor = {
  userId: string;
  userName: string;
};

type AuditActorUser = {
  logtoId?: string | null;
  authUserId?: string | null;
  name?: string | null;
  email?: string | null;
};

/**
 * Resolves the display identity stored on constitution audit entries and
 * version snapshots.
 *
 * The dashboard authenticates Convex with an app-minted bridge token by default
 * (`VITE_CONVEX_AUTH_STRATEGY=bridge`). In that mode `ctx.auth.getUserIdentity()`
 * returns null, so the bridge-authenticated database user record returned by
 * `requireAdminAccess` is the only reliable source for the actor's name/email.
 */
export function resolveAuditActor(
  user: AuditActorUser | null | undefined,
  fallbackLogtoId: string,
): AuditActor {
  const userId = user?.logtoId ?? user?.authUserId ?? fallbackLogtoId;
  const userName = user?.name?.trim() || user?.email?.trim() || "Unknown User";

  return { userId, userName };
}

export type AuditableEntry = {
  userId?: string | null;
  userName?: string | null;
  [key: string]: unknown;
};

/**
 * True when an audit entry has no usable actor name. Covers entries written
 * before the actor name was captured reliably, which stored the literal
 * "Unknown User" fallback.
 */
export function hasUnknownUserName(userName?: string | null): boolean {
  return !userName || userName.trim() === "" || userName === "Unknown User";
}

/**
 * Overlays resolved display names onto entries that only have an actor id.
 * Entries that already carry a real name are left untouched so historical
 * names are preserved.
 */
export function applyResolvedAuditUserNames(
  entries: AuditableEntry[],
  nameByUserId: Map<string, string>,
): AuditableEntry[] {
  if (nameByUserId.size === 0) return entries;

  return entries.map((entry) => {
    if (!hasUnknownUserName(entry.userName)) return entry;
    if (!entry.userId) return entry;

    const name = nameByUserId.get(entry.userId);
    return name ? { ...entry, userName: name } : entry;
  });
}
