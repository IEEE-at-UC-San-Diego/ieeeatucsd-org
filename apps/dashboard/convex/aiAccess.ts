import type { UserRole } from "./permissions";
import { hasAdminAccess, isAdmin } from "./permissions";
import { UserAuth } from "./userAuth";

/**
 * Officer AI table access.
 *
 * Tables that are not listed are denied. Admin-only tables follow
 * `hasAdminAccess`. `fundDeposits` stays readable to every officer, but only
 * Administrators see the full table — every other officer, including
 * Executive Officers, sees rows whose `depositedBy` is `logtoId ?? authUserId`,
 * matching `fundDeposits.listAll`. `users` stays officer-readable through
 * `projectAiRecord`, which drops payment and identity fields.
 */
const ADMIN_ONLY_AI_TABLES = [
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

const OFFICER_READABLE_AI_TABLES = [
  "users",
  "publicProfiles",
  "events",
  "attendees",
  "links",
  "constitutions",
  "constitutionAuditLogs",
  "fundRequests",
  "fundDeposits",
  "emailTemplates",
  "budgetConfigs",
  "budgetAdjustments",
] as const;

const AMOUNT_TABLES = [
  "reimbursements",
  "fundRequests",
  "fundDeposits",
  "budgetConfigs",
  "budgetAdjustments",
] as const;

const adminOnlyAiTables: ReadonlySet<string> = new Set(ADMIN_ONLY_AI_TABLES);
const officerReadableAiTables: ReadonlySet<string> = new Set(
  OFFICER_READABLE_AI_TABLES,
);
const amountTables: ReadonlySet<string> = new Set(AMOUNT_TABLES);

type ScopedRow = {
  depositedBy?: unknown;
  status?: unknown;
  amount?: unknown;
  totalAmount?: unknown;
};

export type BudgetDepartmentInput = {
  department: string;
  totalBudget: number;
  adjustments: number;
  approvedFundRequests: number;
  verifiedDeposits: number;
  approvedReimbursements: number;
};

export class AiAccess {
  static readonly adminOnlyTables = ADMIN_ONLY_AI_TABLES;
  static readonly officerReadableTables = OFFICER_READABLE_AI_TABLES;

  static canOfficerReadAiTable(role: UserRole, table: string): boolean {
    if (officerReadableAiTables.has(table)) return true;
    if (adminOnlyAiTables.has(table)) return hasAdminAccess(role);
    return false;
  }

  static namedSearchAccessError(
    role: UserRole,
    table: string | undefined,
    knownTables: readonly string[],
  ): string | null {
    if (table === undefined) return null;
    if (!knownTables.includes(table)) return `Unknown table: ${table}`;
    if (!AiAccess.canOfficerReadAiTable(role, table)) {
      return "Insufficient permissions";
    }
    return null;
  }

  static searchTables(
    role: UserRole,
    requestedTable: string | undefined,
    knownTables: readonly string[],
  ): { error: string; tables: string[] } | { error: null; tables: string[] } {
    const error = AiAccess.namedSearchAccessError(
      role,
      requestedTable,
      knownTables,
    );
    if (error) return { error, tables: [] };
    if (requestedTable) return { error: null, tables: [requestedTable] };
    return {
      error: null,
      tables: knownTables.filter((table) =>
        AiAccess.canOfficerReadAiTable(role, table),
      ),
    };
  }

  /** Full `fundDeposits` table, matching `fundDeposits.listAll`. */
  static readsFullFundDepositTable(role: UserRole): boolean {
    return isAdmin(role);
  }

  static actorId(user: {
    logtoId?: string | null;
    authUserId?: string | null;
  }): string {
    return user.logtoId ?? user.authUserId ?? "";
  }

  static canReadRecord(
    table: string,
    role: UserRole,
    actorId: string,
    record: object,
  ): boolean {
    if (!AiAccess.canOfficerReadAiTable(role, table)) return false;
    if (
      table === "fundDeposits" &&
      !AiAccess.readsFullFundDepositTable(role)
    ) {
      const depositedBy = (record as ScopedRow).depositedBy;
      return depositedBy === actorId;
    }
    return true;
  }

  static scopeRecords<T extends object>(
    table: string,
    role: UserRole,
    actorId: string,
    records: readonly T[],
  ): T[] {
    return records.filter((record) =>
      AiAccess.canReadRecord(table, role, actorId, record),
    );
  }

  static summarize(
    table: string,
    role: UserRole,
    actorId: string,
    docs: readonly object[],
  ): {
    totalCount: number;
    statusCounts?: Record<string, number>;
    totalAmount?: number;
  } {
    const visible = AiAccess.scopeRecords(table, role, actorId, docs);
    const statusCounts: Record<string, number> = {};
    let totalAmount = 0;
    let hasAmount = false;

    for (const row of visible) {
      const record = row as ScopedRow;
      if (typeof record.status === "string") {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
      }
      if (amountTables.has(table) && typeof record.amount === "number") {
        totalAmount += record.amount;
        hasAmount = true;
      }
      if (table === "reimbursements" && typeof record.totalAmount === "number") {
        totalAmount += record.totalAmount;
        hasAmount = true;
      }
    }

    return {
      totalCount: visible.length,
      ...(Object.keys(statusCounts).length > 0 ? { statusCounts } : {}),
      ...(hasAmount ? { totalAmount } : {}),
    };
  }

  static includeReimbursementTotals(role: UserRole): boolean {
    return hasAdminAccess(role);
  }

  static budgetDepartment(role: UserRole, input: BudgetDepartmentInput) {
    const includeReimbursements = AiAccess.includeReimbursementTotals(role);
    const approvedReimbursements = includeReimbursements
      ? input.approvedReimbursements
      : 0;

    return {
      department: input.department,
      totalBudget: input.totalBudget,
      adjustments: input.adjustments,
      approvedFundRequests: input.approvedFundRequests,
      verifiedDeposits: input.verifiedDeposits,
      ...(includeReimbursements ? { approvedReimbursements } : {}),
      remaining:
        input.totalBudget +
        input.adjustments +
        input.verifiedDeposits -
        input.approvedFundRequests -
        approvedReimbursements,
    };
  }

  static projectAiRecord(
    table: string,
    role: UserRole,
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    if (table === "users" && !hasAdminAccess(role)) {
      return UserAuth.toOfficerVisibleUser(record);
    }
    return record;
  }
}
