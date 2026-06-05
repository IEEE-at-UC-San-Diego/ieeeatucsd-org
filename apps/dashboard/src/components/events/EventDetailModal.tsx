"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  MapPin,
  Users,
  Award,
  FileText,
  Eye,
  Download,
  UserCheck,
  CalendarPlus,
  ExternalLink,
} from "lucide-react";
import {
  Event,
  getEventStatus,
  formatEventDate,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
} from "./types";
import { downloadEventIcs } from "@/lib/calendarLinks";

interface EventDetailModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onCheckIn?: () => void;
  userHasAttended?: boolean;
  attendeeCount?: number;
  capacity?: number;
}

export function EventDetailModal({
  event,
  isOpen,
  onClose,
  onCheckIn,
  userHasAttended = false,
  attendeeCount = 0,
  capacity,
}: EventDetailModalProps) {
  if (!event) return null;

  const status = getEventStatus(event);
  const isLive = status === "live";
  const isUpcoming = status === "upcoming";

  const getFileType = (url: string) => {
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
    const isPdf = /\.pdf$/i.test(url);
    if (isPdf) return "PDF";
    if (isImage) return "Image";
    return "File";
  };

  const formatTimeRange = () => {
    const start = new Date(event.startDate).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const end = new Date(event.endDate).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${start} – ${end}`;
  };

  const handleDownloadIcs = () => {
    downloadEventIcs(
      {
        id: event.publicGoogleEventId || event._id,
        title: event.eventName,
        description: event.eventDescription,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
      },
      `${event.eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event"}.ics`,
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="space-y-3">
            <DialogTitle className="text-xl font-bold leading-tight pr-8">
              {event.eventName}
            </DialogTitle>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className={EVENT_TYPE_COLORS[event.eventType]}
              >
                {EVENT_TYPE_LABELS[event.eventType]}
              </Badge>

              {isLive && (
                <Badge className="bg-emerald-600 text-white border-emerald-600">
                  <span className="relative flex h-1.5 w-1.5 mr-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                  </span>
                  Live Now
                </Badge>
              )}
              {isUpcoming && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  Upcoming
                </Badge>
              )}
              {!isLive && !isUpcoming && (
                <Badge variant="secondary" className="text-muted-foreground">
                  Ended
                </Badge>
              )}

              {userHasAttended && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Attended
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">
            {/* Info strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">When</p>
                  <p className="text-sm font-medium text-foreground truncate">
                    {formatEventDate(event.startDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeRange()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Where</p>
                  <p className="text-sm font-medium text-foreground truncate">
                    {event.location}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5">
                <Award className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Points</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    {event.pointsToReward}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Attendance</p>
                  <p className="text-sm font-medium text-foreground tabular-nums">
                    {attendeeCount} checked in
                    {capacity ? ` / ${capacity}` : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Food note */}
            {event.hasFood && (
              <div className="flex items-center gap-2 text-sm text-foreground rounded-lg border px-3.5 py-2.5 bg-card">
                <span className="text-muted-foreground text-xs font-medium">Food will be provided at this event.</span>
              </div>
            )}

            {/* Description */}
            {event.eventDescription && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  About
                </p>
                <div className="rounded-lg border bg-card px-4 py-3">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {event.eventDescription}
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Add to Phone
              </p>
              <div className="flex flex-wrap gap-2">
                {event.publicGoogleEventUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(event.publicGoogleEventUrl!, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Open in Google Calendar
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadIcs}>
                  <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
                  Download ICS
                </Button>
              </div>
            </div>

            {/* Files */}
            {event.files && event.files.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Resources
                </p>
                <div className="space-y-1.5">
                  {event.files.map((fileUrl, index) => {
                    const fileType = getFileType(fileUrl);
                    return (
                      <div
                        key={index}
                        className="group/file flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => window.open(fileUrl, "_blank")}
                      >
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            Event File {index + 1}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fileType}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(fileUrl, "_blank");
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              const a = document.createElement("a");
                              a.href = fileUrl;
                              a.download = `Event_File_${index + 1}`;
                              a.click();
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {(isLive || isUpcoming) && !userHasAttended && onCheckIn && (
          <div className="border-t px-6 py-4 bg-card">
            <Button onClick={onCheckIn} className="w-full">
              <UserCheck className="w-4 h-4 mr-2" />
              Check In Now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
