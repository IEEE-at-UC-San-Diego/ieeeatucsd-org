import { ConvexError } from "convex/values";

export function getEventTimeRangeError(startDate: number, endDate: number): string | null {
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) {
    return "Start and end time must be valid dates.";
  }

  if (endDate <= startDate) {
    return "End time must be after start time.";
  }

  return null;
}

export function assertValidEventTimeRange(startDate: number, endDate: number): void {
  const error = getEventTimeRangeError(startDate, endDate);
  if (error) {
    throw new ConvexError(error);
  }
}
