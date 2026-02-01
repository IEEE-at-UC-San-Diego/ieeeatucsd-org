import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@/integrations/convex/api";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useLogto } from "@logto/react";
import { useUserRoles } from "@/lib/user/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  MapPin,
  Clock,
  Award,
  Users,
  Search,
  UserCheck,
} from "lucide-react";
import { api as apiFunctions } from "@/convex/_generated/api";

export const Route = createFileRoute("/dashboard/events")({
  component: EventsPage,
  beforeLoad: () => {
    const { isAuthenticated } = useLogto();
    if (!isAuthenticated) {
      throw redirect({ to: "/signin" });
    }
  },
});

function EventsPage() {
  const { isAuthenticated } = useLogto();
  const { userId } = useUserRoles();

  const { data: events } = useQuery(apiFunctions.events.list, { onlyPublished: true });

  const { data: attendedEvents } = useQuery(
    apiFunctions.events.getUserAttendedEvents,
    userId && isAuthenticated ? { userId, onlyPublished: true } : "skip"
  );

  const [searchTerm, setSearchTerm] = React.useState("");

  // Get checked-in event IDs
  const checkedInEventIds = new Set(attendedEvents?.map((e) => e._id) || []);

  // Filter events
  const filteredEvents = events?.filter((event) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      event.eventName.toLowerCase().includes(searchLower) ||
      event.location.toLowerCase().includes(searchLower) ||
      event.eventDescription.toLowerCase().includes(searchLower)
    );
  });

  // Separate upcoming and past events
  const now = Date.now();
  const upcomingEvents = filteredEvents?.filter((event) => event.startDate > now) || [];
  const pastEvents = filteredEvents?.filter((event) => event.endDate < now) || [];

  // Check if event is currently active
  const isEventCurrentlyActive = (event: typeof events[0]) => {
    return now >= event.startDate && now <= event.endDate;
  };

  const isCheckedIn = (event: typeof events[0]) => {
    return checkedInEventIds.has(event._id);
  };

  const formatEventDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    };
  };

  const EventCard = ({ event, isPast = false }: { event: typeof events[0]; isPast?: boolean }) => {
    const isActive = isEventCurrentlyActive(event);
    const checkedIn = isCheckedIn(event);
    const { date, time } = formatEventDate(event.startDate);

    return (
      <Card className="w-full h-full border-none shadow-sm hover:shadow-md transition-all duration-200">
        <CardContent className="p-5 flex flex-col gap-4 justify-between h-full">
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-3">
              <h3 className="font-bold text-xl leading-tight line-clamp-2 text-gray-900">{event.eventName}</h3>
              <div className="flex-shrink-0">
                {event.hasFood && (
                  <Badge variant="secondary" className="mb-1">Food</Badge>
                )}
                {isPast ? (
                  <Badge variant={checkedIn ? "default" : "secondary"}>
                    {checkedIn ? "Attended" : "Missed"}
                  </Badge>
                ) : checkedIn ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <UserCheck size={12} />
                    Checked In
                  </Badge>
                ) : isActive ? (
                  <Badge variant="default" className="animate-pulse">Live</Badge>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar size={16} className="text-gray-400" />
                <span>{date}</span>
                <span className="text-gray-300">•</span>
                <Clock size={16} className="text-gray-400" />
                <span>{time}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin size={16} className="text-gray-400" />
                <span className="truncate">{event.location}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Award size={16} className="text-yellow-500" />
                <span className="font-medium text-gray-700">{event.pointsToReward} Points</span>
              </div>
            </div>
          </div>

          <div className="pt-2 mt-auto">
            {isPast ? (
              <Button fullWidth size="sm" variant="outline" disabled className="border-gray-200 text-gray-400">
                Event Ended
              </Button>
            ) : checkedIn ? (
              <Button fullWidth size="sm" variant="outline" disabled className="border-green-200 text-green-600 flex items-center gap-2">
                <UserCheck size={16} />
                Checked In
              </Button>
            ) : isActive ? (
              <Button
                fullWidth
                size="sm"
                className="shadow-sm font-semibold"
              >
                Check In Now
              </Button>
            ) : (
              <Button fullWidth size="sm" variant="outline" disabled className="border-gray-200 text-gray-400">
                Check-in Not Open
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500">Discover and check in to IEEE events</p>
        </div>

        {/* Search */}
        <div className="w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search events by name, location, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Today's Events */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const todaysEvents = filteredEvents?.filter((event) => {
            const eventDate = event.startDate;
            return eventDate >= today.getTime() && eventDate < tomorrow.getTime();
          });

          if (todaysEvents && todaysEvents.length > 0) {
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                    <UserCheck size={18} />
                  </div>
                  <h2 className="text-lg font-semibold">Happening Today</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todaysEvents.map((event) => (
                    <EventCard key={event._id} event={event} />
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Upcoming Events */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Upcoming Events
              {upcomingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-2">{upcomingEvents.length}</Badge>
              )}
            </h2>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-16">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">No upcoming events found</p>
              <p className="text-sm text-gray-400">Check back later for new events!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          )}
        </div>

        {/* Past Events */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Past Events
              {pastEvents.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pastEvents.length}</Badge>
              )}
            </h2>
          </div>
          {pastEvents.length === 0 ? (
            <div className="text-center py-16">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">No past events found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastEvents.map((event) => (
                <EventCard key={event._id} event={event} isPast />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
