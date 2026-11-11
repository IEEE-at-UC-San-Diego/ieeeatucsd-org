import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync to google calendar",
  { hours: 1 }, // every hour
  internal.googleCalendar.scheduledSync,
);

crons.interval(
  "index storage references",
  { minutes: 1 },
  internal.storageReferenceBackfill.backfillStorageReferences,
);

export default crons;
