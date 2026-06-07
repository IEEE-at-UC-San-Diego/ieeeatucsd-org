import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync to google calendar",
  { hours: 1 }, // every hour
  internal.googleCalendar.scheduledSync,
);

crons.daily(
  "generate merch pickup windows",
  { hourUTC: 14, minuteUTC: 0 }, // 6:00 AM America/Los_Angeles (PST)
  internal.merch.pickupJobs.generateRollingWindows,
);

crons.daily(
  "process closed merch pickups",
  { hourUTC: 15, minuteUTC: 0 }, // 7:00 AM America/Los_Angeles (PST)
  internal.merch.pickupJobs.processClosedPickups,
);

crons.interval(
  "expire merch substitution proposals",
  { hours: 1 },
  internal.merch.substitutions.expire,
);

export default crons;
