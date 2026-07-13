import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync to google calendar",
  { hours: 1 }, // every hour
  internal.googleCalendar.scheduledSync,
);

crons.daily(
  "clean abandoned merch image uploads",
  { hourUTC: 11, minuteUTC: 20 },
  internal.merchCatalog.cleanupOrphanImageUploads,
);

crons.interval(
  "process merch notification outbox",
  { minutes: 2 },
  internal.merchNotifications.scheduledProcess,
);

export default crons;
