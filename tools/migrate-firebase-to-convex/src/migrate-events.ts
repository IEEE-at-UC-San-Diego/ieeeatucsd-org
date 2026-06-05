import { firebase, convex } from "./config.js";
import { toEpochMs, createEmptyResult } from "./utils.js";
import type { MigrationResult, MigrationContext } from "./types.js";

export async function migrateEvents(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("events");

  const snapshot = await firebase.db.collection("events").get();
  console.log(`  Found ${snapshot.size} events in Firebase`);

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const firebaseId = doc.id;
      const eventCode = data.eventCode || `migrated_${firebaseId}`;

      const validEventTypes = ["social", "technical", "outreach", "professional", "projects", "other"];
      const eventType = validEventTypes.includes(data.eventType) ? data.eventType : "other";

      const convexData: Record<string, unknown> = {
        eventName: data.eventName || "Untitled Event",
        eventDescription: data.eventDescription || "",
        eventCode,
        location: data.location || "",
        files: Array.isArray(data.files) ? data.files : [],
        pointsToReward: data.pointsToReward || 0,
        startDate: data.startDate ? toEpochMs(data.startDate) : Date.now(),
        endDate: data.endDate ? toEpochMs(data.endDate) : Date.now(),
        published: data.published ?? false,
        eventType,
        hasFood: data.hasFood ?? false,
        createdAt: data.createdAt ? toEpochMs(data.createdAt) : (doc.createTime ? toEpochMs(doc.createTime) : undefined),
      };

      // Remove undefined values
      for (const key of Object.keys(convexData)) {
        if (convexData[key] === undefined) delete convexData[key];
      }

      if (ctx.dryRun) {
        console.log(`    [DRY RUN] Would upsert event: ${data.eventName} (code: ${eventCode})`);
        result.skipped++;
      } else {
        const upsertResult = await (convex as any).mutation(
          "migrations:upsertEvent" as any,
          { eventCode, data: convexData },
        );

        ctx.eventMap.set(firebaseId, {
          firebaseId,
          convexId: upsertResult.id,
          eventCode,
        });

        if (upsertResult.action === "inserted") {
          result.inserted++;
        } else {
          result.updated++;
        }
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

export async function migrateAttendees(ctx: MigrationContext): Promise<MigrationResult> {
  const result = createEmptyResult("attendees");

  const eventsSnapshot = await firebase.db.collection("events").get();
  console.log(`  Checking attendees across ${eventsSnapshot.size} events`);

  for (const eventDoc of eventsSnapshot.docs) {
    const firebaseEventId = eventDoc.id;
    const eventMapping = ctx.eventMap.get(firebaseEventId);

    if (!eventMapping) {
      continue;
    }

    const attendeesSnapshot = await firebase.db
      .collection("events")
      .doc(firebaseEventId)
      .collection("attendees")
      .get();

    for (const attendeeDoc of attendeesSnapshot.docs) {
      try {
        const data = attendeeDoc.data();
        const firebaseUserId = data.userId || attendeeDoc.id;

        // Map Firebase UID to the appropriate user identifier
        const userMapping = ctx.userMap.get(firebaseUserId);
        const userId = userMapping?.logtoId || userMapping?.firebaseUid || firebaseUserId;

        const convexData: Record<string, unknown> = {
          eventId: eventMapping.convexId,
          userId,
          timeCheckedIn: data.timeCheckedIn ? toEpochMs(data.timeCheckedIn) : Date.now(),
          food: data.food || "none",
          pointsEarned: data.pointsEarned || 0,
        };

        if (ctx.dryRun) {
          console.log(`    [DRY RUN] Would upsert attendee: ${userId} for event ${eventMapping.eventCode}`);
          result.skipped++;
        } else {
          const upsertResult = await (convex as any).mutation(
            "migrations:upsertAttendee" as any,
            {
              eventId: eventMapping.convexId,
              userId,
              data: convexData,
            },
          );

          if (upsertResult.action === "inserted") {
            result.inserted++;
          } else {
            result.updated++;
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: `${firebaseEventId}/${attendeeDoc.id}`,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return result;
}
