import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EventCalendar } from "@/components/manage-events/calendar/EventCalendar";
import { InternalEventModal } from "@/components/manage-events/modals/InternalEventModal";
import { OfficerCalendarEventModal } from "@/components/manage-events/modals/OfficerCalendarEventModal";
import type { EventRequest, EventStatus } from "@/components/manage-events/types";
import {
  getWeekLabelForDate,
  loadWeekLabelSettings,
  saveWeekLabelSettings,
  type WeekLabelSettings,
} from "@/components/manage-events/utils/weekLabels";
import { Button } from "@/components/ui/button";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { buildGoogleCalendarSubscribeUrl } from "@/lib/calendarLinks";

export const Route = createFileRoute("/_dashboard/officer-calendar")({
  component: OfficerCalendarPage,
});

type InternalEventType =
  | "meeting"
  | "tabling"
  | "workshop"
  | "social"
  | "outreach"
  | "other";

interface InternalEvent {
  _id: string;
  _creationTime: number;
  name: string;
  description?: string;
  location: string;
  startDate: number;
  endDate: number;
  eventType: InternalEventType;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
}

const internalEventTypeToStatus: Record<InternalEventType, EventStatus> = {
  meeting: "approved",
  tabling: "approved",
  workshop: "approved",
  social: "approved",
  outreach: "approved",
  other: "approved",
};

function OfficerCalendarPage() {
  const { logtoId, hasOfficerAccess } = usePermissions();

  const eventsData = useAuthedQuery(
    api.events.listAll,
    logtoId ? { logtoId } : "skip",
  );

  const internalEvents = useAuthedQuery(
    api.internalEvents.list,
    logtoId ? { logtoId } : "skip",
  );

  const createInternalEvent = useAuthedMutation(api.internalEvents.create);
  const updateInternalEvent = useAuthedMutation(api.internalEvents.update);
  const deleteInternalEvent = useAuthedMutation(api.internalEvents.remove);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<InternalEvent | null>(null);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<EventRequest | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const convexWeekLabelSettings = useAuthedQuery(
    api.weekLabelSettings.get,
    logtoId ? { logtoId } : "skip",
  );

  const weekLabelSettings = useMemo<WeekLabelSettings>(() => {
    if (!convexWeekLabelSettings) {
      return loadWeekLabelSettings();
    }
    saveWeekLabelSettings(convexWeekLabelSettings);
    return convexWeekLabelSettings;
  }, [convexWeekLabelSettings]);

  const calendarEvents = useMemo(() => {
    const events: EventRequest[] = [];

    if (eventsData) {
      for (const event of eventsData) {
        const eventWithCalendar = event as typeof event & {
          publicGoogleEventId?: string | null;
          publicGoogleEventUrl?: string | null;
          publicGoogleCalendarId?: string | null;
          publicGoogleCalendarSubscribeUrl?: string | null;
          publicGoogleCalendarIcsUrl?: string | null;
          privateGoogleEventId?: string | null;
          privateGoogleEventUrl?: string | null;
          privateGoogleCalendarId?: string | null;
          privateGoogleCalendarSubscribeUrl?: string | null;
          privateGoogleCalendarIcsUrl?: string | null;
        };
        if (event.published) {
          events.push({
            _id: event._id,
            _creationTime: event._creationTime,
            eventName: event.eventName || "Untitled",
            eventDescription: event.eventDescription || "",
            eventType: event.eventType as any,
            department: event.department as any,
            location: event.location || "TBD",
            startDate: event.startDate,
            endDate: event.endDate,
            eventCode: event.eventCode || "",
            hasFood: event.hasFood || false,
            needsFlyers: event.flyersNeeded || false,
            needsGraphics: event.needsGraphics || false,
            needsASFunding: event.needsAsFunding || false,
            estimatedAttendance: event.expectedAttendance || 0,
            status: "published" as EventStatus,
            files: event.files || [],
            invoices: [],
            createdBy: event.requestedUser || "",
            publicGoogleEventId: eventWithCalendar.publicGoogleEventId ?? null,
            publicGoogleEventUrl: eventWithCalendar.publicGoogleEventUrl ?? null,
            publicGoogleCalendarId: eventWithCalendar.publicGoogleCalendarId ?? null,
            publicGoogleCalendarSubscribeUrl: eventWithCalendar.publicGoogleCalendarSubscribeUrl ?? null,
            publicGoogleCalendarIcsUrl: eventWithCalendar.publicGoogleCalendarIcsUrl ?? null,
            privateGoogleEventId: eventWithCalendar.privateGoogleEventId ?? null,
            privateGoogleEventUrl: eventWithCalendar.privateGoogleEventUrl ?? null,
            privateGoogleCalendarId: eventWithCalendar.privateGoogleCalendarId ?? null,
            privateGoogleCalendarSubscribeUrl: eventWithCalendar.privateGoogleCalendarSubscribeUrl ?? null,
            privateGoogleCalendarIcsUrl: eventWithCalendar.privateGoogleCalendarIcsUrl ?? null,
          });
        }
      }
    }

    if (internalEvents) {
      for (const event of internalEvents) {
        events.push({
          _id: event._id,
          _creationTime: event._creationTime,
          eventName: event.name,
          eventDescription: event.description || "",
          eventType: event.eventType as any,
          department: "internal" as any,
          location: event.location,
          startDate: event.startDate,
          endDate: event.endDate,
          eventCode: "",
          hasFood: false,
          needsFlyers: false,
          needsGraphics: false,
          needsASFunding: false,
          estimatedAttendance: 0,
          status: internalEventTypeToStatus[event.eventType] || "approved",
          files: [],
          invoices: [],
          createdBy: event.createdBy,
          privateGoogleEventId: (event as any).privateGoogleEventId ?? null,
          privateGoogleEventUrl: (event as any).privateGoogleEventUrl ?? null,
          privateGoogleCalendarId: (event as any).privateGoogleCalendarId ?? null,
          privateGoogleCalendarSubscribeUrl: (event as any).privateGoogleCalendarSubscribeUrl ?? null,
          privateGoogleCalendarIcsUrl: (event as any).privateGoogleCalendarIcsUrl ?? null,
        });
      }
    }

    return events.sort((a, b) => a.startDate - b.startDate);
  }, [eventsData, internalEvents]);

  const handleSubmit = async (data: {
    name: string;
    description?: string;
    location: string;
    startDate: number;
    endDate: number;
    eventType: InternalEventType;
  }) => {
    if (!logtoId) return;

    if (editingEvent) {
      await updateInternalEvent({
        logtoId,
        id: editingEvent._id as any,
        ...data,
      });
      toast.success("Event updated successfully");
    } else {
      await createInternalEvent({
        logtoId,
        authToken: "",
        ...data,
      });
      toast.success("Event created successfully");
    }
    setEditingEvent(null);
  };

  const handleDelete = async (event: InternalEvent) => {
    if (!logtoId) return;
    await deleteInternalEvent({
      logtoId,
      id: event._id as any,
    });
    toast.success("Event deleted successfully");
    setEditingEvent(null);
  };

  const openCreateModal = (date?: Date | unknown) => {
    setEditingEvent(null);
    setSelectedDate(date instanceof Date ? date : null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: InternalEvent) => {
    setEditingEvent(event);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (event: EventRequest) => {
    setSelectedCalendarEvent(event);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setSelectedDate(null);
  };

  const officerCalendarId = useMemo(() => {
    const publishedCalendarId =
      ((eventsData?.find((event) => "privateGoogleCalendarId" in event) as
        | ({ privateGoogleCalendarId?: string | null } & Record<string, unknown>)
        | undefined)?.privateGoogleCalendarId ?? null);
    const internalCalendarId =
      ((internalEvents?.find((event) => "privateGoogleCalendarId" in event) as
        | ({ privateGoogleCalendarId?: string | null } & Record<string, unknown>)
        | undefined)?.privateGoogleCalendarId ?? null);
    return publishedCalendarId ?? internalCalendarId ?? null;
  }, [eventsData, internalEvents]);

  const isLoading = eventsData === undefined || internalEvents === undefined;

  if (!hasOfficerAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Officer Calendar</h1>
          <p className="text-muted-foreground">
            View published events and manage internal officer events
          </p>
        </div>
        <div className="flex gap-2">
          {officerCalendarId && (
            <Button variant="outline" asChild>
              <a
                href={buildGoogleCalendarSubscribeUrl(officerCalendarId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Subscribe Officer Calendar
              </a>
            </Button>
          )}
          <Button onClick={() => openCreateModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Internal Event
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <EventCalendar
          events={calendarEvents}
          onDateClick={(date) => openCreateModal(date)}
          onEventClick={handleEventClick}
          todayHighlightMode="background"
          getDayLabel={(date) => getWeekLabelForDate(date, weekLabelSettings)}
        />
      )}

      <InternalEventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        editingEvent={editingEvent}
        initialDate={selectedDate}
      />

      <OfficerCalendarEventModal
        isOpen={!!selectedCalendarEvent}
        onClose={() => setSelectedCalendarEvent(null)}
        event={selectedCalendarEvent}
        isInternalEvent={selectedCalendarEvent?.department === "internal"}
        onEditInternalEvent={() => {
          if (!selectedCalendarEvent || !internalEvents) return;
          const internalEvent = internalEvents.find((candidate) => candidate._id === selectedCalendarEvent._id);
          if (!internalEvent) return;
          setSelectedCalendarEvent(null);
          openEditModal(internalEvent);
        }}
        calendarId={officerCalendarId}
        calendarLabel="Officer Calendar"
      />
    </div>
  );
}
