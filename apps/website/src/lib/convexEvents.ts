import { ConvexHttpClient } from "convex/browser";

export interface PublishedConvexEvent {
  _id: string;
  eventName: string;
  eventDescription: string;
  eventCode?: string;
  location: string;
  files?: string[];
  pointsToReward?: number;
  startDate: number;
  endDate: number;
  published: boolean;
  eventType:
    "social" | "technical" | "outreach" | "professional" | "projects" | "other";
  hasFood?: boolean;
  attendeeCount?: number;
  publicGoogleEventId?: string | null;
  publicGoogleEventUrl?: string | null;
  publicGoogleCalendarId?: string | null;
  publicGoogleCalendarSubscribeUrl?: string | null;
  publicGoogleCalendarIcsUrl?: string | null;
}

export async function fetchPublishedEventsFromConvex(): Promise<
  PublishedConvexEvent[]
> {
  const convexUrl =
    process.env.CONVEX_SELF_HOSTED_URL ||
    import.meta.env.CONVEX_SELF_HOSTED_URL;
  if (!convexUrl) {
    console.warn(
      "CONVEX_SELF_HOSTED_URL is not configured for website events.",
    );
    return [];
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const events = await client.query("events:listPublished" as any, {});
    if (!Array.isArray(events)) return [];

    return events.filter(
      (event) => event && typeof event === "object",
    ) as PublishedConvexEvent[];
  } catch (error) {
    console.error("Failed to fetch published events from Convex:", error);
    return [];
  }
}
