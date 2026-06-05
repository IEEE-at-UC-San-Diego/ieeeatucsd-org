import { Calendar, Clock, MapPin, Award, UserCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Event, getEventStatus, formatEventDate, formatEventTime } from "./types";

interface EventCardProps {
  event: Event;
  isAttended?: boolean;
  isPast?: boolean;
  checkingIn?: boolean;
  onClick?: () => void;
  onCheckIn?: () => void;
}

export function EventCard({
  event,
  isAttended = false,
  isPast = false,
  checkingIn = false,
  onClick,
  onCheckIn,
}: EventCardProps) {
  const status = getEventStatus(event);
  const isLive = status === "live";
  const isUpcoming = status === "upcoming";

  const statusBadge = () => {
    if (isAttended) {
      return (
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <UserCheck className="w-3 h-3 mr-1" />
          Attended
        </Badge>
      );
    }
    if (isLive) {
      return (
        <Badge className="bg-emerald-600 text-white border-emerald-600">
          <span className="relative flex h-1.5 w-1.5 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
          Live
        </Badge>
      );
    }
    if (isUpcoming) {
      return (
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
          Upcoming
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        Ended
      </Badge>
    );
  };

  const actionButton = () => {
    if (isPast) return null;

    if (isAttended) {
      return (
        <Button variant="secondary" size="sm" disabled className="w-full text-xs">
          <UserCheck className="w-3.5 h-3.5 mr-1.5" />
          Checked In
        </Button>
      );
    }
    if (isLive) {
      return (
        <Button
          size="sm"
          className="w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onCheckIn?.();
          }}
          disabled={checkingIn}
        >
          {checkingIn ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Checking In...
            </>
          ) : (
            <>
              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
              Check In
            </>
          )}
        </Button>
      );
    }
    return (
      <Button variant="outline" size="sm" disabled className="w-full text-xs">
        Check-in Not Open
      </Button>
    );
  };

  const action = actionButton();

  return (
    <div
      className={`group rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${isPast ? "opacity-70 hover:opacity-100" : ""
        }`}
      onClick={onClick}
    >
      <div className="p-4 flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {event.eventName}
          </h3>
          <div className="shrink-0">{statusBadge()}</div>
        </div>

        {/* Meta */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{formatEventDate(event.startDate)}</span>
            <span className="text-border">·</span>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formatEventTime(event.startDate)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-foreground">
              {event.pointsToReward} pts
            </span>
            {event.hasFood && (
              <>
                <span className="text-border">·</span>
                <span className="text-foreground font-medium">Food provided</span>
              </>
            )}
          </div>
        </div>

        {/* Action */}
        {action && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
