import { firebase, convex } from "./config.js";
import { toEpochMs, createEmptyResult } from "./utils.js";
import type { MigrationResult, MigrationContext } from "./types.js";

export async function migrateFundDeposits(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("fundDeposits");

  const snapshot = await firebase.db.collection("fundDeposits").get();
  console.log(`  Found ${snapshot.size} fund deposits in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const firebaseUserId = data.depositedBy || "";
      const userMapping = ctx.userMap.get(firebaseUserId);
      const depositedBy = userMapping?.logtoId || userMapping?.firebaseUid || firebaseUserId;

      // Map status: Firebase approved→verified, declined→rejected
      let status = "pending";
      if (data.status === "approved") status = "verified";
      else if (data.status === "declined") status = "rejected";
      else if (data.status === "pending") status = "pending";
      else if (data.status === "verified") status = "verified";
      else if (data.status === "rejected") status = "rejected";

      const depositDate = data.submittedAt
        ? toEpochMs(data.submittedAt)
        : Date.now();

      const convexData: Record<string, unknown> = {
        title: data.title || data.notes || "Fund Deposit",
        amount: data.amount || 0,
        source: data.source || "Firebase Migration",
        depositDate,
        description: data.description || data.notes || undefined,
        receiptUrl: data.receiptFile || undefined,
        depositedBy,
        verifiedBy: data.approvedBy || undefined,
        verifiedAt: data.approvedAt ? toEpochMs(data.approvedAt) : undefined,
        status,
        // Preserve original Firebase fields
        submittedAt: data.submittedAt ? toEpochMs(data.submittedAt) : undefined,
        notes: data.notes || undefined,
        receiptFiles: Array.isArray(data.receiptFiles) ? data.receiptFiles : undefined,
        approvedAt: data.approvedAt ? toEpochMs(data.approvedAt) : undefined,
        approvedBy: data.approvedBy || undefined,
      };

      // Map audit logs
      if (Array.isArray(data.auditLogs)) {
        convexData.auditLogs = data.auditLogs.map((l: any) => ({
          action: l.action || "",
          createdBy: l.createdBy || "",
          createdByName: l.createdByName || undefined,
          timestamp: l.timestamp ? toEpochMs(l.timestamp) : Date.now(),
          note: l.note || undefined,
        }));
      }

      // Remove undefined values
      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert fund deposit: ${convexData.title} ($${data.amount})`);
        result.skipped++;
      } else {
        const upsertResult = await (convex as any).mutation(
          "migrations:upsertFundDeposit" as any,
          { dedupKey: `${depositedBy}:${depositDate}:${data.amount}`, data: convexData },
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
