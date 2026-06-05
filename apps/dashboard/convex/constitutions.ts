import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess, requireOfficerAccess } from "./permissions";

const constitutionSectionType = v.union(
  v.literal("preamble"),
  v.literal("article"),
  v.literal("section"),
  v.literal("subsection"),
  v.literal("amendment"),
);

const documentSectionInput = v.object({
  id: v.string(),
  type: constitutionSectionType,
  title: v.string(),
  content: v.string(),
  order: v.number(),
  parentId: v.optional(v.string()),
});

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("constitutions").collect();
  },
});

export const get = query({
  args: { id: v.id("constitutions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByTitle = query({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("constitutions")
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();
  },
});

export const getPublished = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("constitutions")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .first();
  },
});

export const getSections = query({
  args: { constitutionId: v.id("constitutions") },
  handler: async (ctx, args) => {
    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) return [];
    return constitution.sections || [];
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    title: v.string(),
    organizationName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    return await ctx.db.insert("constitutions", {
      title: args.title,
      organizationName: args.organizationName,
      sections: [],
      version: 1,
      status: "draft",
      lastModifiedBy: userId,
      collaborators: [userId],
      isTemplate: false,
    });
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("constitutions"),
    title: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    sections: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const { id, logtoId, authToken, ...updates } = args;
    const cleanUpdates: Record<string, unknown> = {
      lastModifiedBy: userId,
    };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

// Section operations
export const addSection = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
    type: constitutionSectionType,
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    parentId: v.optional(v.string()),
    articleNumber: v.optional(v.number()),
    sectionNumber: v.optional(v.number()),
    subsectionLetter: v.optional(v.string()),
    amendmentNumber: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;

    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) {
      throw new Error("Constitution not found");
    }

    const section = {
      id: crypto.randomUUID(),
      type: args.type,
      title: args.title ?? "",
      content: args.content ?? "",
      order: args.order,
      parentId: args.parentId,
      articleNumber: args.articleNumber,
      sectionNumber: args.sectionNumber,
      subsectionLetter: args.subsectionLetter,
      amendmentNumber: args.amendmentNumber,
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastModifiedBy: userId,
    };

    const updatedSections = [...(constitution.sections || []), section];

    // Create audit entry
    await createAuditEntryInternal(ctx, {
      constitutionId: args.constitutionId,
      sectionId: section.id,
      changeType: "create",
      changeDescription: `Created ${section.type}: ${section.title || "Untitled"}`,
      afterValue: section,
      userId,
      userName: user?.name || user?.email || "Unknown User",
    });

    await ctx.db.patch(args.constitutionId, { sections: updatedSections });
    return section;
  },
});

export const updateSection = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
    sectionId: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    order: v.optional(v.number()),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;

    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) {
      throw new Error("Constitution not found");
    }

    const section = constitution.sections?.find((s: any) => s.id === args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    const cleanUpdates: Record<string, unknown> = {};
    if (args.title !== undefined) cleanUpdates.title = args.title;
    if (args.content !== undefined) cleanUpdates.content = args.content;
    if (args.order !== undefined) cleanUpdates.order = args.order;
    if (args.parentId !== undefined) cleanUpdates.parentId = args.parentId;

    const updatedSection = {
      ...section,
      ...cleanUpdates,
      lastModified: Date.now(),
      lastModifiedBy: userId,
    };

    const updatedSections = constitution.sections?.map((s: any) =>
      s.id === args.sectionId ? updatedSection : s
    );

    // Create audit entry
    await createAuditEntryInternal(ctx, {
      constitutionId: args.constitutionId,
      sectionId: args.sectionId,
      changeType: "update",
      changeDescription: `Updated ${section.type}: ${section.title || "Untitled"}`,
      beforeValue: section,
      afterValue: updatedSection,
      userId,
      userName: user?.name || user?.email || "Unknown User",
    });

    await ctx.db.patch(args.constitutionId, { sections: updatedSections });
    return updatedSection;
  },
});

export const deleteSection = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
    sectionId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;

    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) {
      throw new Error("Constitution not found");
    }

    const section = constitution.sections?.find((s: any) => s.id === args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    const updatedSections = constitution.sections?.filter((s: any) => s.id !== args.sectionId);

    // Create audit entry
    await createAuditEntryInternal(ctx, {
      constitutionId: args.constitutionId,
      sectionId: args.sectionId,
      changeType: "delete",
      changeDescription: `Deleted ${section.type}: ${section.title || "Untitled"}`,
      beforeValue: section,
      userId,
      userName: user?.name || user?.email || "Unknown User",
    });

    await ctx.db.patch(args.constitutionId, { sections: updatedSections });

    // Also delete child sections recursively
    if (updatedSections) {
      const sectionIdsToDelete = new Set([args.sectionId]);
      let foundNew = true;
      while (foundNew) {
        foundNew = false;
        for (const s of updatedSections) {
          if (s.parentId && sectionIdsToDelete.has(s.parentId) && !sectionIdsToDelete.has(s.id)) {
            sectionIdsToDelete.add(s.id);
            foundNew = true;
          }
        }
      }

      const finalSections = updatedSections.filter((s: any) => !sectionIdsToDelete.has(s.id));
      await ctx.db.patch(args.constitutionId, { sections: finalSections });
    }

    return { success: true };
  },
});

export const reorderSection = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
    sectionId: v.string(),
    newOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;

    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) {
      throw new Error("Constitution not found");
    }

    const section = constitution.sections?.find((s: any) => s.id === args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    const updatedSections = constitution.sections?.map((s: any) => {
      if (s.id === args.sectionId) {
        return { ...s, order: args.newOrder, lastModified: Date.now(), lastModifiedBy: userId };
      }
      return s;
    });

    await ctx.db.patch(args.constitutionId, { sections: updatedSections });

    // Create audit entry
    await createAuditEntryInternal(ctx, {
      constitutionId: args.constitutionId,
      sectionId: args.sectionId,
      changeType: "reorder",
      changeDescription: `Reordered ${section.type}: ${section.title || "Untitled"}`,
      beforeValue: section,
      afterValue: { ...section, order: args.newOrder },
      userId,
      userName: user?.name || user?.email || "Unknown User",
    });

    return { success: true };
  },
});

function validateParentRelationship(
  sectionType: string,
  parentType: string | undefined,
): boolean {
  if (sectionType === "preamble" || sectionType === "article" || sectionType === "amendment") {
    return parentType === undefined;
  }

  if (sectionType === "section") {
    return parentType === undefined || parentType === "article";
  }

  if (sectionType === "subsection") {
    return (
      parentType === undefined || parentType === "section" || parentType === "subsection"
    );
  }

  return false;
}

function hasParentCycle(
  sectionId: string,
  parentById: Map<string, string | undefined>,
): boolean {
  const seen = new Set<string>([sectionId]);
  let currentParentId = parentById.get(sectionId);

  while (currentParentId) {
    if (seen.has(currentParentId)) {
      return true;
    }
    seen.add(currentParentId);
    currentParentId = parentById.get(currentParentId);
  }

  return false;
}

export const syncDocumentSections = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
    sections: v.array(documentSectionInput),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;

    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) {
      throw new Error("Constitution not found");
    }

    const incomingSections = args.sections;
    const seenIds = new Set<string>();
    for (const section of incomingSections) {
      if (seenIds.has(section.id)) {
        throw new Error(`Duplicate section ID detected: ${section.id}`);
      }
      seenIds.add(section.id);
    }

    const incomingById = new Map<string, (typeof incomingSections)[number]>();
    for (const section of incomingSections) {
      incomingById.set(section.id, section);
    }

    for (const section of incomingSections) {
      if (!section.parentId) {
        if (!validateParentRelationship(section.type, undefined)) {
          throw new Error(`Invalid top-level section type: ${section.type}`);
        }
        continue;
      }

      const parent = incomingById.get(section.parentId);
      if (!parent) {
        throw new Error(`Parent section does not exist: ${section.parentId}`);
      }

      if (!validateParentRelationship(section.type, parent.type)) {
        throw new Error(
          `Invalid parent/type relationship: ${section.type} cannot be child of ${parent.type}`,
        );
      }
    }

    const parentById = new Map<string, string | undefined>();
    for (const section of incomingSections) {
      parentById.set(section.id, section.parentId);
    }

    for (const section of incomingSections) {
      if (hasParentCycle(section.id, parentById)) {
        throw new Error(`Detected cyclic parent relationship at section ${section.id}`);
      }
    }

    const existingSections = constitution.sections || [];
    const existingById = new Map<string, any>();
    for (const section of existingSections) {
      existingById.set(section.id, section);
    }

    const now = Date.now();
    const nextSections = incomingSections.map((section) => {
      const existing = existingById.get(section.id);
      return {
        id: section.id,
        type: section.type,
        title: section.title,
        content: section.content,
        order: section.order,
        parentId: section.parentId,
        articleNumber: existing?.articleNumber,
        sectionNumber: existing?.sectionNumber,
        subsectionLetter: existing?.subsectionLetter,
        amendmentNumber: existing?.amendmentNumber,
        createdAt: existing?.createdAt ?? now,
        lastModified: now,
        lastModifiedBy: userId,
      };
    });

    const createdSections = nextSections.filter((section) => !existingById.has(section.id));
    const deletedSections = existingSections.filter((section: any) => !incomingById.has(section.id));

    let updated = 0;
    let reordered = 0;
    for (const section of nextSections) {
      const previous = existingById.get(section.id);
      if (!previous) continue;

      const isReordered =
        previous.order !== section.order || previous.parentId !== section.parentId;
      const isUpdated =
        previous.type !== section.type ||
        previous.title !== section.title ||
        previous.content !== section.content;

      if (isUpdated) {
        updated += 1;
      }
      if (isReordered) {
        reordered += 1;
      }
    }

    await ctx.db.patch(args.constitutionId, {
      sections: nextSections,
      lastModifiedBy: userId,
    });

    const summaryDescription =
      `Synced document structure (${createdSections.length} created, ${updated} updated, ${deletedSections.length} deleted, ${reordered} reordered)`;

    await createAuditEntryInternal(ctx, {
      constitutionId: args.constitutionId,
      changeType: "update",
      changeDescription: summaryDescription,
      beforeValue: { sectionCount: existingSections.length },
      afterValue: { sectionCount: nextSections.length },
      userId,
      userName: user?.name || user?.email || "Unknown User",
    });

    const totalSectionChanges =
      createdSections.length + deletedSections.length + updated + reordered;
    if (totalSectionChanges <= 20) {
      for (const section of createdSections) {
        await createAuditEntryInternal(ctx, {
          constitutionId: args.constitutionId,
          sectionId: section.id,
          changeType: "create",
          changeDescription: `Created ${section.type}: ${section.title || "Untitled"}`,
          afterValue: section,
          userId,
          userName: user?.name || user?.email || "Unknown User",
        });
      }

      for (const section of deletedSections) {
        await createAuditEntryInternal(ctx, {
          constitutionId: args.constitutionId,
          sectionId: section.id,
          changeType: "delete",
          changeDescription: `Deleted ${section.type}: ${section.title || "Untitled"}`,
          beforeValue: section,
          userId,
          userName: user?.name || user?.email || "Unknown User",
        });
      }

      for (const section of nextSections) {
        const previous = existingById.get(section.id);
        if (!previous) continue;

        const isReordered =
          previous.order !== section.order || previous.parentId !== section.parentId;
        const isUpdated =
          previous.type !== section.type ||
          previous.title !== section.title ||
          previous.content !== section.content;

        if (isUpdated) {
          await createAuditEntryInternal(ctx, {
            constitutionId: args.constitutionId,
            sectionId: section.id,
            changeType: "update",
            changeDescription: `Updated ${section.type}: ${section.title || "Untitled"}`,
            beforeValue: previous,
            afterValue: section,
            userId,
            userName: user?.name || user?.email || "Unknown User",
          });
          continue;
        }

        if (isReordered) {
          await createAuditEntryInternal(ctx, {
            constitutionId: args.constitutionId,
            sectionId: section.id,
            changeType: "reorder",
            changeDescription: `Reordered ${section.type}: ${section.title || "Untitled"}`,
            beforeValue: previous,
            afterValue: section,
            userId,
            userName: user?.name || user?.email || "Unknown User",
          });
        }
      }
    }

    return {
      created: createdSections.length,
      updated,
      deleted: deletedSections.length,
      reordered,
      total: nextSections.length,
    };
  },
});

type VersionSnapshotSource = "manual" | "auto_backup";

async function getNextVersionNumber(
  ctx: any,
  constitutionId: any,
): Promise<number> {
  const latestVersion = await ctx.db
    .query("constitutionVersions")
    .withIndex("by_constitutionId_versionNumber", (q: any) =>
      q.eq("constitutionId", constitutionId)
    )
    .order("desc")
    .first();

  return (latestVersion?.versionNumber ?? 0) + 1;
}

async function createVersionSnapshotInternal(
  ctx: any,
  args: {
    constitutionId: any;
    source: VersionSnapshotSource;
    note?: string;
    restoredFromVersionNumber?: number;
    createdBy: string;
    createdByName: string;
    constitutionSnapshot: {
      title: string;
      organizationName: string;
      status: "draft" | "published" | "archived";
      sections: any[];
    };
  },
) {
  const versionNumber = await getNextVersionNumber(ctx, args.constitutionId);
  const label = `V${versionNumber}`;
  const now = Date.now();
  const cleanNote = args.note?.trim();

  const versionId = await ctx.db.insert("constitutionVersions", {
    constitutionId: args.constitutionId,
    versionNumber,
    label,
    note: cleanNote ? cleanNote : undefined,
    source: args.source,
    snapshotTitle: args.constitutionSnapshot.title,
    snapshotOrganizationName: args.constitutionSnapshot.organizationName,
    snapshotStatus: args.constitutionSnapshot.status,
    snapshotSections: args.constitutionSnapshot.sections,
    createdBy: args.createdBy,
    createdByName: args.createdByName,
    createdAt: now,
    restoredFromVersionNumber: args.restoredFromVersionNumber,
  });

  return {
    versionId,
    versionNumber,
    label,
  };
}

export const listVersions = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);

    const versions = await ctx.db
      .query("constitutionVersions")
      .withIndex("by_constitutionId_createdAt", (q: any) =>
        q.eq("constitutionId", args.constitutionId)
      )
      .order("desc")
      .collect();

    return versions.map((version) => ({
      _id: version._id,
      constitutionId: version.constitutionId,
      versionNumber: version.versionNumber,
      label: version.label,
      note: version.note,
      source: version.source,
      createdBy: version.createdBy,
      createdByName: version.createdByName,
      createdAt: version.createdAt,
      restoredFromVersionNumber: version.restoredFromVersionNumber,
    }));
  },
});

export const saveVersion = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;
    const userName = user?.name || user?.email || adminUser.name || "Unknown User";

    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) {
      throw new Error("Constitution not found");
    }

    const snapshot = await createVersionSnapshotInternal(ctx, {
      constitutionId: args.constitutionId,
      source: "manual",
      note: args.note,
      createdBy: userId,
      createdByName: userName,
      constitutionSnapshot: {
        title: constitution.title,
        organizationName: constitution.organizationName,
        status: constitution.status,
        sections: constitution.sections || [],
      },
    });

    await ctx.db.patch(args.constitutionId, {
      version: snapshot.versionNumber,
      lastModifiedBy: userId,
      lastModified: Date.now(),
    });

    return snapshot;
  },
});

export const restoreVersion = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    constitutionId: v.id("constitutions"),
    versionId: v.id("constitutionVersions"),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;
    const userName = user?.name || user?.email || adminUser.name || "Unknown User";

    const constitution = await ctx.db.get(args.constitutionId);
    if (!constitution) {
      throw new Error("Constitution not found");
    }

    const targetVersion = await ctx.db.get(args.versionId);
    if (!targetVersion) {
      throw new Error("Target version not found");
    }
    if (targetVersion.constitutionId !== args.constitutionId) {
      throw new Error("Version does not belong to this constitution");
    }

    const backupSnapshot = await createVersionSnapshotInternal(ctx, {
      constitutionId: args.constitutionId,
      source: "auto_backup",
      note: `Auto backup before restoring ${targetVersion.label}`,
      restoredFromVersionNumber: targetVersion.versionNumber,
      createdBy: userId,
      createdByName: userName,
      constitutionSnapshot: {
        title: constitution.title,
        organizationName: constitution.organizationName,
        status: constitution.status,
        sections: constitution.sections || [],
      },
    });

    await ctx.db.patch(args.constitutionId, {
      title: targetVersion.snapshotTitle,
      organizationName: targetVersion.snapshotOrganizationName,
      status: targetVersion.snapshotStatus,
      sections: targetVersion.snapshotSections,
      version: targetVersion.versionNumber,
      lastModifiedBy: userId,
      lastModified: Date.now(),
    });

    await createAuditEntryInternal(ctx, {
      constitutionId: args.constitutionId,
      changeType: "update",
      changeDescription: `Restored constitution to ${targetVersion.label} (auto backup created as ${backupSnapshot.label})`,
      beforeValue: {
        title: `Current version: V${constitution.version}`,
        version: constitution.version,
        sectionCount: constitution.sections?.length ?? 0,
      },
      afterValue: {
        title: `Restored to ${targetVersion.label} (backup ${backupSnapshot.label})`,
        version: targetVersion.versionNumber,
        sectionCount: targetVersion.snapshotSections?.length ?? 0,
      },
      userId,
      userName,
    });

    return {
      restoredVersionNumber: targetVersion.versionNumber,
      backupVersionNumber: backupSnapshot.versionNumber,
    };
  },
});

// Maximum number of audit entries to keep per constitution (prevents 1 MiB limit)
const MAX_AUDIT_ENTRIES = 200;

/**
 * Strips HTML tags from a string, returning plain text.
 */
function stripHtmlTags(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Truncates a value for audit storage — strips HTML from `content` fields
 * and truncates to avoid blowing past Convex's 1 MiB document size limit.
 */
function truncateAuditValue(value: any): any {
  if (!value || typeof value !== "object") return value;
  const truncated = { ...value };
  if (typeof truncated.content === "string") {
    truncated.content = stripHtmlTags(truncated.content);
    if (truncated.content.length > 500) {
      truncated.content = truncated.content.slice(0, 500) + "… (truncated)";
    }
  }
  return truncated;
}

/**
 * Builds a concise human-readable summary of what changed.
 */
function buildChangeSummary(
  changeType: string,
  beforeValue: any,
  afterValue: any,
): string {
  const sectionType = afterValue?.type || beforeValue?.type || "section";
  const sectionTitle = afterValue?.title || beforeValue?.title || "Untitled";

  if (changeType === "create") return `Created ${sectionType}: "${sectionTitle}"`;
  if (changeType === "delete") return `Deleted ${sectionType}: "${sectionTitle}"`;
  if (changeType === "reorder") return `Reordered ${sectionType}: "${sectionTitle}"`;

  const parts: string[] = [];
  if (beforeValue?.title !== afterValue?.title) {
    parts.push(`Title: "${beforeValue?.title || ""}" → "${afterValue?.title || ""}"`);
  }
  if (beforeValue?.content !== afterValue?.content) {
    parts.push("Content updated");
  }
  return parts.length > 0 ? parts.join(", ") : `Updated ${sectionType}: "${sectionTitle}"`;
}

// Audit log operations
async function createAuditEntryInternal(
  ctx: any,
  args: {
    constitutionId: any;
    sectionId?: string;
    changeType: "create" | "update" | "delete" | "reorder";
    changeDescription: string;
    beforeValue?: any;
    afterValue?: any;
    userId: string;
    userName: string;
  },
) {
  const auditLog = await ctx.db
    .query("constitutionAuditLogs")
    .withIndex("by_constitutionId", (q: any) => q.eq("constitutionId", args.constitutionId))
    .first();

  const truncatedBefore = truncateAuditValue(args.beforeValue);
  const truncatedAfter = truncateAuditValue(args.afterValue);

  const entry = {
    id: crypto.randomUUID(),
    constitutionId: args.constitutionId,
    sectionId: args.sectionId,
    changeType: args.changeType,
    changeDescription: args.changeDescription,
    changeSummary: buildChangeSummary(args.changeType, truncatedBefore, truncatedAfter),
    beforeValue: truncatedBefore,
    afterValue: truncatedAfter,
    userId: args.userId,
    userName: args.userName,
    timestamp: Date.now(),
  };

  if (auditLog) {
    // Truncate existing entries' beforeValue/afterValue to reclaim space from old bloated entries
    const existingEntries = (auditLog.entries || []).map((e: any) => ({
      ...e,
      beforeValue: truncateAuditValue(e.beforeValue),
      afterValue: truncateAuditValue(e.afterValue),
    }));
    // Cap entries to prevent document from exceeding Convex size limit
    const newEntries = [entry, ...existingEntries].slice(0, MAX_AUDIT_ENTRIES);
    try {
      await ctx.db.patch(auditLog._id, {
        entries: newEntries,
        totalEntries: (auditLog.totalEntries || 0) + 1,
      });
    } catch {
      // If still too large, aggressively trim to just the newest 50 entries
      const trimmedEntries = [entry, ...existingEntries].slice(0, 50).map((e: any) => ({
        ...e,
        beforeValue: undefined,
        afterValue: undefined,
      }));
      await ctx.db.patch(auditLog._id, {
        entries: trimmedEntries,
        totalEntries: (auditLog.totalEntries || 0) + 1,
      });
    }
  } else {
    await ctx.db.insert("constitutionAuditLogs", {
      constitutionId: args.constitutionId,
      entries: [entry],
      totalEntries: 1,
    });
  }
}

export const getAuditLog = query({
  args: { constitutionId: v.id("constitutions") },
  handler: async (ctx, args) => {
    const auditLog = await ctx.db
      .query("constitutionAuditLogs")
      .withIndex("by_constitutionId", (q: any) => q.eq("constitutionId", args.constitutionId))
      .first();
    return auditLog?.entries || [];
  },
});

// Get default constitution
export const getDefault = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    
    return await ctx.db
      .query("constitutions")
      .filter((q) => q.eq(q.field("title"), "IEEE at UC San Diego Constitution"))
      .first();
  },
});

// Ensure default constitution exists
export const ensureDefaultConstitution = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    
    const existing = await ctx.db
      .query("constitutions")
      .filter((q) => q.eq(q.field("title"), "IEEE at UC San Diego Constitution"))
      .first();

    if (existing) {
      return existing;
    }

    // Create default constitution
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject || args.logtoId;

    return await ctx.db.insert("constitutions", {
      title: "IEEE at UC San Diego Constitution",
      organizationName: "IEEE at UC San Diego",
      sections: [],
      version: 1,
      status: "draft",
      lastModifiedBy: userId,
      collaborators: [userId],
      isTemplate: false,
    });
  },
});
