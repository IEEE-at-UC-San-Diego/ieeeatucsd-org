import type { UserRole } from "./permissions";
import { hasAdminAccess } from "./permissions";
import { UserAuth } from "./userAuth";

/**
 * Tables whose own queries are admin-only (or per-user). Officer AI reads must
 * not bypass those gates. `users` stays officer-readable, but only through
 * `projectAiRecord`, which drops payment and identity fields.
 */
export const ADMIN_ONLY_AI_TABLES = [
  "reimbursements",
  "officerInvitations",
  "sponsorDomains",
  "logs",
  "organizationSettings",
  "googleGroupAssignments",
  "directOnboardings",
  "notifications",
  "invites",
] as const;

const adminOnlyAiTables: ReadonlySet<string> = new Set(ADMIN_ONLY_AI_TABLES);

export function canOfficerReadAiTable(role: UserRole, table: string): boolean {
  if (!adminOnlyAiTables.has(table)) return true;
  return hasAdminAccess(role);
}

export function projectAiRecord(
  table: string,
  role: UserRole,
  record: Record<string, unknown>,
): Record<string, unknown> {
  if (table === "users" && !hasAdminAccess(role)) {
    return UserAuth.toOfficerVisibleUser(record);
  }
  return record;
}
