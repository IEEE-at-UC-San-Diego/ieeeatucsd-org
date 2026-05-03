import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import {
  Calendar,
  Clock,
  Search,
  ExternalLink,
  Download,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  EventCard,
  EventDetailModal,
  CheckInModal,
  HappeningToday,
  getEventStatus,
  type Event as EventType,
} from "@/components/events";
import {
  buildGoogleCalendarIcsUrl,
  buildGoogleCalendarSubscribeUrl,
} from "@/lib/calendarLinks";

export const Route = createFileRoute("/_dashboard/events")({
  component: EventsPage,
});

const PAST_EVENTS_PER_PAGE = 9;

function EventsPage() {
  const { logtoId } = useAuth();
  // listPublished is a public query with no auth args
  const events = useQuery(api.events.listPublished);
  const attendedEventIdsData = useAuthedQuery(
    api.events.getAttendedEventIds,
    logtoId ? { logtoId } : "skip"
  );
  const checkIn = useAuthedMutation(api.events.checkIn);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [pastPage, setPastPage] = useState(1);

  // Modal states
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInEvent, setCheckInEvent] = useState<EventType | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const now = Date.now();

  // Get user's attended event IDs
  const attendedEventIds = useMemo(() => {
    if (!attendedEventIdsData) return new Set<string>();
    return new Set(attendedEventIdsData);
  }, [attendedEventIdsData]);

  const filteredEvents = useMemo(() => {
    return events?.filter(
      (e) =>
        e.eventName.toLowerCase().includes(search.toLowerCase()) ||
        e.location.toLowerCase().includes(search.toLowerCase()),
    );
  }, [events, search]);

  const liveEvents = useMemo(() =>
    (filteredEvents?.filter((e) => e.startDate <= now && e.endDate >= now) ?? []).sort((a, b) => a.startDate - b.startDate),
    [filteredEvents, now],
  );

  const upcomingEvents = useMemo(() =>
    (filteredEvents?.filter((e) => e.startDate > now) ?? []).sort((a, b) => a.startDate - b.startDate),
    [filteredEvents, now],
  );

  const pastEvents = useMemo(() =>
    (filteredEvents?.filter((e) => e.endDate < now) ?? []).sort((a, b) => b.startDate - a.startDate),
    [filteredEvents, now],
  );

  const pastTotalPages = Math.ceil(pastEvents.length / PAST_EVENTS_PER_PAGE);
  const paginatedPast = pastEvents.slice((pastPage - 1) * PAST_EVENTS_PER_PAGE, pastPage * PAST_EVENTS_PER_PAGE);

  const handleEventClick = (event: EventType) => {
    setSelectedEvent(event);
    setIsEventDetailOpen(true);
  };

  const handleCheckInClick = (event: EventType) => {
    setCheckInEvent(event);
    setIsCheckInModalOpen(true);
  };

  const handleCheckInSubmit = async (code: string, foodPreference?: string) => {
    if (!logtoId) return;
    setIsCheckingIn(true);
    try {
      const result = await checkIn({
        logtoId,
        eventId: checkInEvent?._id as any,
        eventCode: code,
        food: foodPreference || "none",
      });
      toast.success(
        `Checked in successfully! You earned ${result.points} points.`,
      );
      setIsCheckInModalOpen(false);
      setCheckInEvent(null);
    } catch (error: any) {
      const msg = error?.data ?? error?.message ?? "Failed to check in";
      toast.error(typeof msg === "string" ? msg : "Failed to check in");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckInFromDetail = () => {
    if (selectedEvent) {
      setIsEventDetailOpen(false);
      setCheckInEvent(selectedEvent);
      setIsCheckInModalOpen(true);
    }
  };

  // Convert Convex event to EventType
  const toEventType = (event: any): EventType => ({
    _id: event._id,
    eventName: event.eventName,
    eventDescription: event.eventDescription,
    eventCode: event.eventCode,
    location: event.location,
    files: event.files || [],
    pointsToReward: event.pointsToReward,
    startDate: event.startDate,
    endDate: event.endDate,
    published: event.published,
    eventType: event.eventType,
    hasFood: event.hasFood,
    attendeeCount: event.attendeeCount,
    publicGoogleEventId: event.publicGoogleEventId,
    publicGoogleEventUrl: event.publicGoogleEventUrl,
    publicGoogleCalendarId: event.publicGoogleCalendarId,
    publicGoogleCalendarSubscribeUrl: event.publicGoogleCalendarSubscribeUrl,
    publicGoogleCalendarIcsUrl: event.publicGoogleCalendarIcsUrl,
  });

  const publicCalendarMeta = useMemo(() => {
    const calendarId = events?.find((event) => event.publicGoogleCalendarId)?.publicGoogleCalendarId;
    if (!calendarId) return null;
    return {
      subscribeUrl: buildGoogleCalendarSubscribeUrl(calendarId),
      icsUrl: buildGoogleCalendarIcsUrl(calendarId),
    };
  }, [events]);

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and check in to IEEE UCSD events.
        </p>
        {publicCalendarMeta && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={publicCalendarMeta.subscribeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Subscribe to Public Calendar
            </a>
            <a
              href={publicCalendarMeta.icsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Add Calendar via ICS
            </a>
          </div>
        )}
      </div>

      {/* Happening Today */}
      {liveEvents.length > 0 && (
        <HappeningToday
          events={liveEvents.map(toEventType)}
          onEventClick={handleEventClick}
          onCheckIn={handleCheckInClick}
          checkedInEventIds={attendedEventIds}
          checkingInEventId={isCheckingIn ? checkInEvent?._id || null : null}
        />
      )}

      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex rounded-lg border bg-card p-0.5">
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === "upcoming"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming ({upcomingEvents.length})
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === "past"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
            onClick={() => { setActiveTab("past"); setPastPage(1); }}
          >
            Past ({pastEvents.length})
          </button>
        </div>
      </div>

      {/* Events grid */}
      {!events ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : activeTab === "upcoming" ? (
        upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event._id}
                event={toEventType(event)}
                isAttended={attendedEventIds.has(event._id)}
                isPast={false}
                checkingIn={isCheckingIn && checkInEvent?._id === event._id}
                onClick={() => handleEventClick(toEventType(event))}
                onCheckIn={() => handleCheckInClick(toEventType(event))}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No upcoming events</p>
            <p className="text-xs mt-1">Check back later for upcoming events.</p>
          </div>
        )
      ) : (
        paginatedPast.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedPast.map((event) => (
                <EventCard
                  key={event._id}
                  event={toEventType(event)}
                  isAttended={attendedEventIds.has(event._id)}
                  isPast={true}
                  onClick={() => handleEventClick(toEventType(event))}
                />
              ))}
            </div>
            <Pagination currentPage={pastPage} totalPages={pastTotalPages} onPageChange={setPastPage} />
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No past events</p>
            <p className="text-xs mt-1">Events you've missed will appear here.</p>
          </div>
        )
      )}

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={isEventDetailOpen}
        onClose={() => setIsEventDetailOpen(false)}
        onCheckIn={selectedEvent && getEventStatus(selectedEvent) === "live" ? handleCheckInFromDetail : undefined}
        userHasAttended={selectedEvent ? attendedEventIds.has(selectedEvent._id) : false}
        attendeeCount={selectedEvent?.attendeeCount ?? 0}
      />

      {/* Check In Modal */}
      <CheckInModal
        isOpen={isCheckInModalOpen}
        onClose={() => {
          setIsCheckInModalOpen(false);
          setCheckInEvent(null);
        }}
        onSubmit={handleCheckInSubmit}
        eventHasFood={checkInEvent?.hasFood || false}
        eventName={checkInEvent?.eventName}
        isSubmitting={isCheckingIn}
      />
    </div>
  );
}
