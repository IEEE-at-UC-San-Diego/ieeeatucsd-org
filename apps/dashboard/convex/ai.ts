import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireOfficerAccess } from "./permissions";

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

const TABLES_WITH_AMOUNT = [
  "reimbursements",
  "fundRequests",
  "fundDeposits",
  "budgetConfigs",
  "budgetAdjustments",
] as const;

export const getRecordById = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    table: v.string(),
    recordId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);

    if (!ALL_TABLES.includes(args.table as TableName)) {
      return { error: `Unknown table: ${args.table}`, record: null };
    }

    try {
      const doc = await ctx.db.get(args.recordId as any);
      if (!doc) return { error: "Record not found", record: null };
      return { error: null, record: sanitizeValue(doc) };
    } catch {
      return { error: "Invalid record ID", record: null };
    }
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
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);

    if (!ALL_TABLES.includes(args.table as TableName)) {
      return { error: `Unknown table: ${args.table}`, records: [], total: 0 };
    }

    const limit = clamp(args.limit ?? 25, 1, 100);
    const tableName = args.table as TableName;

    let docs: any[];
    if (
      args.status &&
      (TABLES_WITH_STATUS as readonly string[]).includes(tableName)
    ) {
      docs = await (ctx.db.query(tableName) as any)
        .withIndex("by_status", (q: any) => q.eq("status", args.status))
        .take(limit);
    } else {
      docs = await ctx.db.query(tableName).order("desc").take(limit);
    }

    return {
      error: null,
      records: docs.map((doc: any) => sanitizeValue(doc)),
      total: docs.length,
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
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);

    if (!ALL_TABLES.includes(args.table as TableName)) {
      return { error: `Unknown table: ${args.table}` };
    }

    const tableName = args.table as TableName;
    const docs = await ctx.db.query(tableName).take(MAX_DOCS_PER_TABLE);
    const totalCount = docs.length;

    const statusCounts: Record<string, number> = {};
    let totalAmount = 0;
    let hasAmount = false;

    for (const doc of docs) {
      const record = doc as Record<string, unknown>;
      if (typeof record.status === "string") {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
      }
      if (
        (TABLES_WITH_AMOUNT as readonly string[]).includes(tableName) &&
        typeof record.amount === "number"
      ) {
        totalAmount += record.amount;
        hasAmount = true;
      }
      if (
        tableName === "reimbursements" &&
        typeof record.totalAmount === "number"
      ) {
        totalAmount += record.totalAmount;
        hasAmount = true;
      }
    }

    return {
      error: null,
      table: tableName,
      totalCount,
      statusCounts: Object.keys(statusCounts).length > 0 ? statusCounts : undefined,
      totalAmount: hasAmount ? totalAmount : undefined,
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
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);

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
      users: matches.slice(0, 20).map((u) => sanitizeValue(u)),
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
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);

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
    const reimbursements = await ctx.db
      .query("reimbursements")
      .take(500);

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

      return {
        department: dept,
        totalBudget: config?.totalBudget ?? 0,
        adjustments: deptAdjustments,
        approvedFundRequests: deptApproved,
        verifiedDeposits: deptDeposits,
        approvedReimbursements: deptReimbursements,
        remaining:
          (config?.totalBudget ?? 0) +
          deptAdjustments +
          deptDeposits -
          deptApproved -
          deptReimbursements,
      };
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
    const currentUser = toCurrentUserContext(user);
    const currentServerTimeMs = Date.now();
    const normalizedQuery = normalize(args.query);
    const tokens = tokenize(args.query);
    const limit = clamp(args.limit ?? 25, 1, 60);

    const selectedTables: TableName[] = args.table
      ? ALL_TABLES.includes(args.table as TableName)
        ? [args.table as TableName]
        : []
      : [...ALL_TABLES];

    if (!normalizedQuery || selectedTables.length === 0) {
      return {
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
      const docs = await ctx.db.query(tableName).take(MAX_DOCS_PER_TABLE);
      scannedCountByTable[tableName] = docs.length;

      for (const doc of docs) {
        const searchText = `${tableName} ${asSearchText(doc)}`;
        const score = scoreDocument(searchText, normalizedQuery, tokens);
        if (score <= 0) continue;

        results.push({
          table: tableName,
          score,
          id: String((doc as { _id: string })._id),
          createdAt: (doc as { _creationTime: number })._creationTime ?? 0,
          snippet: buildSnippet(searchText, normalizedQuery),
          record: sanitizeValue(doc),
        });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt - a.createdAt;
    });

    return {
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
