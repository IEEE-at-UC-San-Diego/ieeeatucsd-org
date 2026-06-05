import { firebase, convex } from "./config.js";
import { toEpochMs, createEmptyResult } from "./utils.js";
import { migrateFileUrl } from "./storage.js";
import type { MigrationResult, MigrationContext } from "./types.js";

export async function migrateFundRequests(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("fundRequests");

  // Try both collection names (fundRequests is primary, fund_requests is legacy)
  let snapshot = await firebase.db.collection("fundRequests").get();
  if (snapshot.empty) {
    snapshot = await firebase.db.collection("fund_requests").get();
  }
  console.log(`  Found ${snapshot.size} fund requests in Firebase`);

  const validCategories = ["event", "travel", "equipment", "software", "other", "general", "projects"];
  const validDepts = ["events", "projects", "internal", "other"];
  const validStatuses = ["draft", "submitted", "needs_info", "approved", "denied", "completed"];
  const validActions = ["created", "updated", "submitted", "approved", "denied", "info_requested", "info_provided", "completed"];

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const firebaseId = doc.id;

      // Map audit logs
      const auditLogs: any[] = [];
      if (Array.isArray(data.auditLogs)) {
        for (const log of data.auditLogs) {
          auditLogs.push({
            id: log.id || crypto.randomUUID(),
            action: validActions.includes(log.action) ? log.action : "updated",
            performedBy: log.performedBy || "",
            performedByName: log.performedByName || undefined,
            timestamp: log.timestamp ? toEpochMs(log.timestamp) : Date.now(),
            notes: log.notes || undefined,
            previousStatus: log.previousStatus || undefined,
            newStatus: log.newStatus || undefined,
          });
        }
      }

      // Map vendor links
      const vendorLinks: any[] = [];
      if (Array.isArray(data.vendorLinks)) {
        for (const vl of data.vendorLinks) {
          vendorLinks.push({
            id: vl.id || crypto.randomUUID(),
            url: vl.url || "",
            itemName: vl.itemName || undefined,
            quantity: vl.quantity || undefined,
          });
        }
      }

      // Map attachments (inline-migrate files from Firebase Storage)
      const attachments: any[] = [];
      if (Array.isArray(data.attachments)) {
        for (const att of data.attachments) {
          const url = att.url
            ? await migrateFileUrl(att.url, ctx.dryRun)
            : att.url;
          attachments.push({
            id: att.id || crypto.randomUUID(),
            url: url || "",
            name: att.name || "unknown",
            size: att.size || 0,
            type: att.type || "application/octet-stream",
            uploadedAt: att.uploadedAt ? toEpochMs(att.uploadedAt) : Date.now(),
          });
        }
      }

      const requestedBy = data.submittedBy || data.requestedBy || "";

      const convexData: Record<string, unknown> = {
        title: data.title || "Untitled Fund Request",
        purpose: data.purpose || "",
        amount: data.amount || 0,
        category: validCategories.includes(data.category) ? data.category : "other",
        department: validDepts.includes(data.department) ? data.department : "other",
        status: validStatuses.includes(data.status) ? data.status : "submitted",
        requestedBy,
        submittedBy: data.submittedBy || requestedBy,
        submittedByName: data.submittedByName || undefined,
        submittedByEmail: data.submittedByEmail || undefined,
        submittedAt: data.submittedAt ? toEpochMs(data.submittedAt) : undefined,
        notes: data.notes || undefined,
        reviewNotes: data.reviewNotes || undefined,
        infoRequestNotes: data.infoRequestNotes || undefined,
        infoResponseNotes: data.infoResponseNotes || undefined,
        vendorLinks: vendorLinks.length > 0 ? vendorLinks : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        auditLogs: auditLogs.length > 0 ? auditLogs : undefined,
        createdAt: data.createdAt ? toEpochMs(data.createdAt) : Date.now(),
        updatedAt: data.updatedAt ? toEpochMs(data.updatedAt) : Date.now(),
      };

      // Remove undefined fields
      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert fund request: ${data.title} (${firebaseId})`);
        result.skipped++;
      } else {
        const r = await (convex as any).mutation("migrations:upsertFundRequest" as any, {
          dedupKey: `${requestedBy}:${data.title}:${data.amount}`,
          data: convexData,
        });

        if (r.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
      console.error(`    ❌ Failed to migrate fund request ${doc.id}:`, error instanceof Error ? error.message : error);
    }
  }

  return result;
}
