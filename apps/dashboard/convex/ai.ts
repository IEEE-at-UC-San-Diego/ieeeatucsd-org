import { query, type QueryCtx } from "./_generated/server";
import type { TableNames } from "./_generated/dataModel";
import { v } from "convex/values";
import { AiAccess } from "./aiAccess";
import { requireOfficerAccess, type UserRole } from "./permissions";

const ALL_TABLES = [
  "users",
  "publicProfiles",
  "events",
  "attendees",
  "reimbursements",
  "links",
  "constitutions",
  "constitutionAuditLogs",
  "officerInvitations",
  "sponsorDomains",
  "fundRequests",
  "fundDeposits",
  "logs",
  "organizationSettings",
  "emailTemplates",
  "notifications",
  "googleGroupAssignments",
  "directOnboardings",
  "invites",
  "budgetConfigs",
  "budgetAdjustments",
] as const;

type TableName = (typeof ALL_TABLES)[number];

function aiTableAccessError(role: UserRole, table: string): string | null {
  return AiAccess.namedSearchAccessError(role, table, ALL_TABLES);
}

async function loadVisibleDocs(
  ctx: QueryCtx,
  tableName: TableName,
  role: UserRole,
  actorId: string,
  limit: number,
): Promise<any[]> {
  // Same row scope as fundDeposits.listAll. Query the owner's index so a
  // capped scan cannot mix in other officers' deposits.
  if (
    tableName === "fundDeposits" &&
    !AiAccess.readsFullFundDepositTable(role)
  ) {
    return await ctx.db
      .query("fundDeposits")
      .withIndex("by_depositedBy", (q) => q.eq("depositedBy", actorId))
      .take(limit);
  }

  return await ctx.db.query(tableName).take(limit);
}

type OfficerUser = {
  _id: string | { toString(): string };
  logtoId?: string;
  name: string;
  email: string;
  role: string;
  position?: string;
  team?: string;
  status: string;
  sponsorTier?: string;
  points?: number;
  eventsAttended?: number;
  joinDate: number;
  lastLogin?: number;
};

const MAX_DOCS_PER_TABLE = 300;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const MAX_STRING_LENGTH = 500;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function tokenize(queryText: string) {
  return Array.from(
    new Set(
      normalize(queryText)
        .split(/\s+/)
        .map((part) => part.replace(/[^\w@.-]/g, ""))
        .filter((part) => part.length >= 2),
    ),
  );
}

function asSearchText(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (depth >= 2) return "";
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => asSearchText(item, depth + 1))
      .join(" ");
  }

  if (typeof value === "object") {
    if (depth >= 2) return "";
    return Object.entries(value)
      .slice(0, MAX_OBJECT_KEYS)
      .map(([key, item]) => `${key} ${asSearchText(item, depth + 1)}`)
      .join(" ");
  }

  return "";
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    if (depth >= 2) return [`[truncated ${value.length} items]`];
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2) return { _truncated: true };
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of entries) {
      sanitized[key] = sanitizeValue(item, depth + 1);
    }
    return sanitized;
  }

  return String(value);
}

function scoreDocument(searchText: string, normalizedQuery: string, tokens: string[]) {
  if (!searchText) return 0;
  const normalizedDoc = normalize(searchText);

  let score = 0;
  if (normalizedDoc.includes(normalizedQuery)) score += 12;

  for (const token of tokens) {
    if (normalizedDoc.includes(token)) score += 2;
  }

  return score;
}

function buildSnippet(searchText: string, normalizedQuery: string) {
  const normalizedDoc = normalize(searchText);
  const matchIndex = normalizedDoc.indexOf(normalizedQuery);
  if (matchIndex < 0) return searchText.slice(0, 240);

  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(searchText.length, matchIndex + normalizedQuery.length + 160);
  return searchText.slice(start, end).trim();
}

function toCurrentUserContext(user: OfficerUser) {
  return {
    id: String(user._id),
    logtoId: user.logtoId,
    name: user.name,
    email: user.email,
    role: user.role,
    position: user.position,
    team: user.team,
    status: user.status,
    sponsorTier: user.sponsorTier,
    points: user.points ?? 0,
    eventsAttended: user.eventsAttended ?? 0,
    joinDate: user.joinDate,
    lastLogin: user.lastLogin,
  };
}

const TABLES_WITH_STATUS = [
  "users",
  "events",
  "reimbursements",
  "officerInvitations",
  "fundRequests",
  "fundDeposits",
  "constitutions",
  "invites",
] as const;

export const getRecordById = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    table: v.string(),
    recordId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const tableError = aiTableAccessError(user.role, args.table);
    if (tableError) return { error: tableError, record: null };

    const tableName = args.table as TableName;
    // The id itself names the table. Ignore ids that do not belong to the
    // requested table so an officer cannot read a user or reimbursement by
    // labeling it as an officer-readable table.
    const recordId = ctx.db.normalizeId(tableName as TableNames, args.recordId);
    if (!recordId) return { error: "Invalid record ID", record: null };

    const doc = await ctx.db.get(recordId);
    if (!doc) return { error: "Record not found", record: null };
    if (
      !AiAccess.canReadRecord(
        tableName,
        user.role,
        AiAccess.actorId(user),
        doc,
      )
    ) {
      return { error: "Insufficient permissions", record: null };
    }
    return {
      error: null,
      record: sanitizeValue(AiAccess.projectAiRecord(tableName, user.role, doc)),
    };
  },
});

export const listRecords = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    table: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const tableError = aiTableAccessError(user.role, args.table);
    if (tableError) return { error: tableError, records: [], total: 0 };

    const limit = clamp(args.limit ?? 25, 1, 100);
    const tableName = args.table as TableName;
    const actorId = AiAccess.actorId(user);

    let docs: any[];
    if (
      tableName === "fundDeposits" &&
      !AiAccess.readsFullFundDepositTable(user.role)
    ) {
      const owned = ctx.db
        .query("fundDeposits")
        .withIndex("by_depositedBy", (q) => q.eq("depositedBy", actorId));
      docs = args.status
        ? await owned
            .filter((q) => q.eq(q.field("status"), args.status))
            .take(limit)
        : await owned.order("desc").take(limit);
    } else if (
      args.status &&
      (TABLES_WITH_STATUS as readonly string[]).includes(tableName)
    ) {
      docs = await (ctx.db.query(tableName) as any)
        .withIndex("by_status", (q: any) => q.eq("status", args.status))
        .take(limit);
    } else {
      docs = await ctx.db.query(tableName).order("desc").take(limit);
    }

    const visible = AiAccess.scopeRecords(
      tableName,
      user.role,
      actorId,
      docs,
    );

    return {
      error: null,
      records: visible.map((doc) =>
        sanitizeValue(AiAccess.projectAiRecord(tableName, user.role, doc)),
      ),
      total: visible.length,
    };
  },
});

export const getStatistics = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const tableError = aiTableAccessError(user.role, args.table);
    if (tableError) return { error: tableError };

    const tableName = args.table as TableName;
    const actorId = AiAccess.actorId(user);
    const docs = await loadVisibleDocs(
      ctx,
      tableName,
      user.role,
      actorId,
      MAX_DOCS_PER_TABLE,
    );
    const summary = AiAccess.summarize(tableName, user.role, actorId, docs);

    return {
      error: null,
      table: tableName,
      ...summary,
    };
  },
});

export const getUserByNameOrEmail = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);

    const term = args.searchTerm.toLowerCase().trim();
    if (!term) return { error: "Empty search term", users: [] };

    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email")
      .take(MAX_DOCS_PER_TABLE);

    const matches = byEmail.filter((u) => {
      const nameMatch = u.name?.toLowerCase().includes(term);
      const emailMatch = u.email?.toLowerCase().includes(term);
      return nameMatch || emailMatch;
    });

    return {
      error: null,
      users: matches.slice(0, 20).map((u) =>
        sanitizeValue(AiAccess.projectAiRecord("users", user.role, u)),
      ),
    };
  },
});

export const getBudgetOverview = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const includeReimbursements = AiAccess.includeReimbursementTotals(
      user.role,
    );

    const configs = await ctx.db.query("budgetConfigs").take(100);
    const adjustments = await ctx.db.query("budgetAdjustments").take(500);
    const fundRequests = await ctx.db
      .query("fundRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(500);
    const deposits = await ctx.db
      .query("fundDeposits")
      .withIndex("by_status", (q) => q.eq("status", "verified"))
      .take(500);
    const reimbursements = includeReimbursements
      ? await ctx.db.query("reimbursements").take(500)
      : [];

    const departments = ["events", "projects", "internal", "other"] as const;
    const overview = departments.map((dept) => {
      const config = configs.find((c) => c.department === dept);
      const deptAdjustments = adjustments
        .filter((a) => a.department === dept)
        .reduce((sum, a) => sum + a.amount, 0);
      const deptApproved = fundRequests
        .filter((f) => f.department === dept)
        .reduce((sum, f) => sum + f.amount, 0);
      const deptDeposits = deposits
        .filter((d: any) => d.source === dept || d.department === dept)
        .reduce((sum, d) => sum + d.amount, 0);
      const deptReimbursements = reimbursements
        .filter((r) => r.department === dept && (r.status === "approved" || r.status === "paid"))
        .reduce((sum, r) => sum + r.totalAmount, 0);

      return AiAccess.budgetDepartment(user.role, {
        department: dept,
        totalBudget: config?.totalBudget ?? 0,
        adjustments: deptAdjustments,
        approvedFundRequests: deptApproved,
        verifiedDeposits: deptDeposits,
        approvedReimbursements: deptReimbursements,
      });
    });

    if (args.department) {
      const filtered = overview.find((o) => o.department === args.department);
      return { error: null, departments: filtered ? [filtered] : [] };
    }

    return { error: null, departments: overview };
  },
});

export const searchEverything = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
    table: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const actorId = AiAccess.actorId(user);
    const currentUser = toCurrentUserContext(user);
    const currentServerTimeMs = Date.now();
    const normalizedQuery = normalize(args.query);
    const tokens = tokenize(args.query);
    const limit = clamp(args.limit ?? 25, 1, 60);
    const selection = AiAccess.searchTables(user.role, args.table, ALL_TABLES);

    if (selection.error) {
      return {
        error: selection.error,
        currentServerTimeMs,
        currentUser,
        userRole: user.role,
        query: args.query,
        scannedTables: [],
        scannedCountByTable: {},
        totalMatches: 0,
        results: [],
      };
    }

    const selectedTables = selection.tables as TableName[];

    if (!normalizedQuery || selectedTables.length === 0) {
      return {
        error: null,
        currentServerTimeMs,
        currentUser,
        userRole: user.role,
        query: args.query,
        scannedTables: selectedTables,
        scannedCountByTable: {},
        totalMatches: 0,
        results: [],
      };
    }

    const scannedCountByTable: Record<string, number> = {};
    const results: Array<{
      table: TableName;
      score: number;
      id: string;
      createdAt: number;
      snippet: string;
      record: unknown;
    }> = [];

    for (const tableName of selectedTables) {
      const docs = AiAccess.scopeRecords(
        tableName,
        user.role,
        actorId,
        await loadVisibleDocs(
          ctx,
          tableName,
          user.role,
          actorId,
          MAX_DOCS_PER_TABLE,
        ),
      );
      scannedCountByTable[tableName] = docs.length;

      for (const doc of docs) {
        const visible = AiAccess.projectAiRecord(
          tableName,
          user.role,
          doc as Record<string, unknown>,
        );
        const searchText = `${tableName} ${asSearchText(visible)}`;
        const score = scoreDocument(searchText, normalizedQuery, tokens);
        if (score <= 0) continue;

        results.push({
          table: tableName,
          score,
          id: String((doc as { _id: string })._id),
          createdAt: (doc as { _creationTime: number })._creationTime ?? 0,
          snippet: buildSnippet(searchText, normalizedQuery),
          record: sanitizeValue(visible),
        });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt - a.createdAt;
    });

    return {
      error: null,
      currentServerTimeMs,
      currentUser,
      userRole: user.role,
      query: args.query,
      scannedTables: selectedTables,
      scannedCountByTable,
      totalMatches: results.length,
      results: results.slice(0, limit),
    };
  },
});
