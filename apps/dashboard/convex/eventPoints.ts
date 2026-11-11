import { ConvexError } from "convex/values";

/**
 * Check-in reward points stored on an event as `pointsToReward`.
 *
 * Officers set this when creating or editing an event. Attendance check-in
 * copies the persisted value onto the attendee record.
 */
export class EventPoints {
  static readonly DEFAULT = 0;

  static getError(value: unknown): string | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return "Points to reward must be a non-negative integer.";
      }
      if (value < 0) {
        return "Points to reward cannot be negative.";
      }
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") {
        return null;
      }
      if (!/^\d+$/.test(trimmed)) {
        return "Points to reward must be a non-negative integer.";
      }
      return null;
    }

    return "Points to reward must be a non-negative integer.";
  }

  static assertValid(value: unknown): void {
    const error = EventPoints.getError(value);
    if (error) {
      throw new ConvexError(error);
    }
  }

  static fromUnknown(value: unknown): number {
    EventPoints.assertValid(value);
    if (value === undefined || value === null || value === "") {
      return EventPoints.DEFAULT;
    }
    if (typeof value === "number") {
      return value;
    }
    return Number.parseInt((value as string).trim(), 10);
  }

  static tryParseInput(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") {
      return EventPoints.DEFAULT;
    }
    if (EventPoints.getError(trimmed)) {
      return null;
    }
    return Number.parseInt(trimmed, 10);
  }

  static parseInput(value: string): number {
    const parsed = EventPoints.tryParseInput(value);
    if (parsed === null) {
      EventPoints.assertValid(value);
    }
    return parsed ?? EventPoints.DEFAULT;
  }

  static fromDocument(event: { pointsToReward?: number | null }): number {
    return EventPoints.fromUnknown(event.pointsToReward);
  }
}
