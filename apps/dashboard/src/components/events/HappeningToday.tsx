import { EventCard } from "./EventCard";
import { Event } from "./types";

interface HappeningTodayProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  onCheckIn?: (event: Event) => void;
  checkedInEventIds?: Set<string>;
  checkingInEventId?: string | null;
}

export function HappeningToday({
  events,
  onEventClick,
  onCheckIn,
  checkedInEventIds = new Set(),
  checkingInEventId,
}: HappeningTodayProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Happening Now
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.map((event) => (
          <EventCard
            key={event._id}
            event={event}
            isAttended={checkedInEventIds.has(event._id)}
            checkingIn={checkingInEventId === event._id}
            onClick={() => onEventClick?.(event)}
            onCheckIn={() => onCheckIn?.(event)}
          />
        ))}
      </div>
    </div>
  );
}
