import { firebase, convex } from "./config.js";
import { toEpochMs, createEmptyResult } from "./utils.js";
import { migrateFileUrl, migrateFileUrls } from "./storage.js";
import type { MigrationResult, MigrationContext } from "./types.js";

export async function migrateEventRequests(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("eventRequests");

  const snapshot = await firebase.db.collection("event_requests").get();
  console.log(`  Found ${snapshot.size} event requests in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const firebaseId = doc.id;

      // Map requestedUser Firebase UID
      const firebaseUserId = data.requestedUser || "";
      const userMapping = ctx.userMap.get(firebaseUserId);
      const requestedUser = userMapping?.logtoId || userMapping?.firebaseUid || firebaseUserId;

      const validStatuses = ["draft", "submitted", "pending", "completed", "approved", "declined", "needs_review"];
      const parsedStatus = validStatuses.includes(data.status) ? data.status : "submitted";
      // If a request was already published in Firebase, keep it in a published-equivalent
      // terminal status in Convex.
      const status =
        data.published === true && parsedStatus !== "declined"
          ? "completed"
          : parsedStatus;

      // Map invoices (with inline file migration)
      const invoices: any[] = [];
      if (Array.isArray(data.invoices)) {
        for (const inv of data.invoices) {
          const invoiceFile = inv.invoiceFile
            ? await migrateFileUrl(inv.invoiceFile, ctx.dryRun)
            : undefined;
          const additionalFiles = Array.isArray(inv.additionalFiles)
            ? await migrateFileUrls(inv.additionalFiles, ctx.dryRun)
            : [];
          invoices.push({
            id: inv.id || crypto.randomUUID(),
            vendor: inv.vendor || "",
            items: Array.isArray(inv.items)
              ? inv.items.map((item: any) => ({
                  description: item.description || "",
                  quantity: item.quantity || 1,
                  unitPrice: item.unitPrice || 0,
                  total: item.total || 0,
                }))
              : [],
            tax: inv.tax || 0,
            tip: inv.tip || 0,
            invoiceFile: invoiceFile || undefined,
            additionalFiles,
            subtotal: inv.subtotal || 0,
            total: inv.total || 0,
          });
        }
      }

      // Inline-migrate file arrays from Firebase Storage to Convex
      const roomBookingFiles = Array.isArray(data.roomBookingFiles)
        ? await migrateFileUrls(data.roomBookingFiles, ctx.dryRun)
        : [];
      const graphicsFiles = Array.isArray(data.graphicsFiles)
        ? await migrateFileUrls(data.graphicsFiles, ctx.dryRun)
        : undefined;

      const validEventTypes = ["social", "technical", "outreach", "professional", "projects", "other"];
      const validDepts = ["events", "projects", "internal", "other"];

      const convexData: Record<string, unknown> = {
        name: data.name || "Untitled Request",
        location: data.location || "",
        startDateTime: data.startDateTime ? toEpochMs(data.startDateTime) : Date.now(),
        endDateTime: data.endDateTime ? toEpochMs(data.endDateTime) : Date.now(),
        eventDescription: data.eventDescription || "",
        flyersNeeded: data.flyersNeeded ?? false,
        flyerType: Array.isArray(data.flyerType) ? data.flyerType : [],
        otherFlyerType: data.otherFlyerType || undefined,
        flyerAdvertisingStartDate: data.flyerAdvertisingStartDate ? toEpochMs(data.flyerAdvertisingStartDate) : undefined,
        flyerAdditionalRequests: data.flyerAdditionalRequests || undefined,
        flyersCompleted: data.flyersCompleted ?? false,
        photographyNeeded: data.photographyNeeded ?? false,
        requiredLogos: Array.isArray(data.requiredLogos) ? data.requiredLogos : [],
        otherLogos: Array.isArray(data.otherLogos) ? data.otherLogos : undefined,
        advertisingFormat: data.advertisingFormat || undefined,
        willOrHaveRoomBooking: data.willOrHaveRoomBooking ?? false,
        expectedAttendance: data.expectedAttendance || undefined,
        roomBookingFiles,
        asFundingRequired: data.asFundingRequired ?? false,
        foodDrinksBeingServed: data.foodDrinksBeingServed ?? false,
        invoices,
        needsGraphics: data.needsGraphics ?? false,
        needsAsFunding: data.needsAsFunding ?? false,
        status,
        declinedReason: data.declinedReason || undefined,
        reviewFeedback: data.reviewFeedback || undefined,
        requestedUser,
        isDraft: data.isDraft || undefined,
        eventType: validEventTypes.includes(data.eventType) ? data.eventType : undefined,
        department: validDepts.includes(data.department) ? data.department : undefined,
        graphicsCompleted: data.graphicsCompleted ?? undefined,
        graphicsFiles,
        published: data.published ?? undefined,
        createdAt: data.createdAt ? toEpochMs(data.createdAt) : (doc.createTime ? toEpochMs(doc.createTime) : undefined),
        submittedAt: data.submittedAt ? toEpochMs(data.submittedAt) : undefined,
      };

      // Map audit logs — Firebase stores "undefined" as a literal string in many fields
      if (Array.isArray(data.auditLogs)) {
        const validActions = ["created", "updated", "status_changed", "file_uploaded", "file_deleted", "graphics_updated", "published", "unpublished"];
        const validFileTypes = ["room_booking", "invoice", "logo", "graphics", "other"];

        convexData.auditLogs = data.auditLogs.map((log: any) => {
          // Sanitize changes — must be array of eventFieldChange or undefined
          let changes: any = undefined;
          if (Array.isArray(log.changes)) {
            changes = log.changes.map((c: any) => ({
              field: String(c.field || ""),
              fieldDisplayName: String(c.fieldDisplayName || ""),
              oldValue: c.oldValue?._seconds != null ? c.oldValue._seconds * 1000 : c.oldValue ?? null,
              newValue: c.newValue?._seconds != null ? c.newValue._seconds * 1000 : c.newValue ?? null,
              changeType: ["added", "updated", "removed"].includes(c.changeType) ? c.changeType : "updated",
            }));
          }

          // Sanitize fileChanges — must be array of eventFileChange or undefined
          let fileChanges: any = undefined;
          if (Array.isArray(log.fileChanges) && log.fileChanges.length > 0) {
            fileChanges = log.fileChanges.map((fc: any) => ({
              action: fc.action === "removed" ? "removed" : "added",
              fileName: String(fc.fileName || ""),
              fileUrl: typeof fc.fileUrl === "string" ? fc.fileUrl : undefined,
              fileType: validFileTypes.includes(fc.fileType) ? fc.fileType : "other",
            }));
          }

          // Helper: treat the literal string "undefined" as actual undefined
          const clean = (val: any) => (val === "undefined" || val === undefined || val === null) ? undefined : val;

          return {
            id: log.id || crypto.randomUUID(),
            eventRequestId: log.eventRequestId || firebaseId,
            action: validActions.includes(log.action) ? log.action : "updated",
            performedBy: log.performedBy || "",
            performedByName: clean(log.performedByName),
            timestamp: log.timestamp ? toEpochMs(log.timestamp) : Date.now(),
            changes,
            oldStatus: clean(log.oldStatus),
            newStatus: clean(log.newStatus),
            statusReason: clean(log.statusReason),
            fileChanges,
            metadata: clean(log.metadata),
          };
        });
      }

      // Remove undefined values
      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert event request: ${data.name}`);
        result.skipped++;
      } else {
        const upsertResult = await (convex as any).mutation(
          "migrations:upsertEventRequest" as any,
          { dedupKey: `${data.name}:${requestedUser}:${convexData.startDateTime}`, data: convexData },
        );

        if (upsertResult.action === "inserted") result.inserted++;
        else result.updated++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        id: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
