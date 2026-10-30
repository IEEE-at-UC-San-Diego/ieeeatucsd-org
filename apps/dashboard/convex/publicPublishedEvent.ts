export type PublicEventType =
  | "social"
  | "technical"
  | "outreach"
  | "professional"
  | "projects"
  | "other";

export type PublicCalendarMeta = {
  publicGoogleEventId: string | null;
  publicGoogleEventUrl: string | null;
  publicGoogleCalendarId: string | null;
  publicGoogleCalendarSubscribeUrl: string | null;
  publicGoogleCalendarIcsUrl: string | null;
};

export type PublicPublishedEventSource = {
  _id: string;
  eventName: string;
  eventDescription: string;
  eventCode?: string;
  location: string;
  files?: string[];
  pointsToReward?: number;
  startDate: number;
  endDate: number;
  published?: boolean;
  eventType?: PublicEventType;
  hasFood?: boolean;
};

export type PublicPublishedEventView = PublicPublishedEventSource &
  PublicCalendarMeta & {
    attendeeCount: number;
  };

/**
 * Public listing shape for published events.
 *
 * `events.listPublished` is unauthenticated (website + member Events page),
 * so internal request/VCO fields must not ride along on the document spread.
 */
export class PublicPublishedEvent {
  /**
   * Fields safe to show without event-request or VCO funding access.
   * `listPublished`, `events.get`, and `events.getByCode` all use this set.
   */
  static publicFields(
    event: PublicPublishedEventSource,
  ): PublicPublishedEventSource {
    return {
      _id: event._id,
      eventName: event.eventName,
      eventDescription: event.eventDescription,
      eventCode: event.eventCode,
      location: event.location,
      files: event.files,
      pointsToReward: event.pointsToReward,
      startDate: event.startDate,
      endDate: event.endDate,
      published: event.published,
      eventType: event.eventType,
      hasFood: event.hasFood,
    };
  }

  static fromDocument(
    event: PublicPublishedEventSource,
    extras: PublicCalendarMeta & { attendeeCount: number },
  ): PublicPublishedEventView {
    return {
      ...PublicPublishedEvent.publicFields(event),
      attendeeCount: extras.attendeeCount,
      publicGoogleEventId: extras.publicGoogleEventId,
      publicGoogleEventUrl: extras.publicGoogleEventUrl,
      publicGoogleCalendarId: extras.publicGoogleCalendarId,
      publicGoogleCalendarSubscribeUrl: extras.publicGoogleCalendarSubscribeUrl,
      publicGoogleCalendarIcsUrl: extras.publicGoogleCalendarIcsUrl,
    };
  }
}
