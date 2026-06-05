import { format } from "date-fns";
import {
  MapPin,
  Calendar,
  Users,
  Pencil,
  Trash2,
  User,
  FileText,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../filters/StatusBadge";
import { formatEventTypeLabel, formatDepartmentLabel } from "../constants";
import type { EventRequest } from "../types";

interface DraftViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventRequest | null;
  onEdit?: (event: EventRequest) => void;
  onDelete?: (event: EventRequest) => void;
  onConvertToRequest?: (event: EventRequest) => void;
}

export function DraftViewModal({
  isOpen,
  onClose,
  event,
  onEdit,
  onDelete,
  onConvertToRequest,
}: DraftViewModalProps) {
  if (!event) return null;

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "MMMM d, yyyy");
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), "h:mm a");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {event.eventName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={event.status} />
                <span className="text-sm text-muted-foreground border-l pl-2 ml-1">
                  {formatEventTypeLabel(event.eventType)}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Date & Time</span>
              </div>
              <p className="font-medium">{formatDate(event.startDate)}</p>
              <p className="text-sm text-muted-foreground">
                {formatTime(event.startDate)} - {formatTime(event.endDate)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Location</span>
              </div>
              <p className="font-medium">{event.location}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Expected Attendees</span>
              </div>
              <p className="font-medium">{event.estimatedAttendance || "N/A"}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Organizer</span>
              </div>
              <p className="font-medium truncate" title={event.createdBy}>{event.createdBy}</p>
              <p className="text-xs text-muted-foreground">
                on {formatDate(event._creationTime)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Event Code</span>
              </div>
              <p className="font-mono bg-muted/50 px-2 py-0.5 rounded text-sm w-fit">{event.eventCode}</p>
            </div>

            {event.department && (
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Department</span>
                <p className="font-medium">{formatDepartmentLabel(event.department)}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Description</span>
            <div className="bg-muted/30 p-4 rounded-lg text-sm text-foreground whitespace-pre-wrap leading-relaxed border">
              {event.eventDescription || "No description provided."}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              Draft Event
            </h4>
            <p className="text-sm text-blue-700">
              This is a draft event. You can edit the draft details or convert it to a full event request with additional requirements like room bookings, graphics, and funding.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            {onConvertToRequest && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (onConvertToRequest) onConvertToRequest(event);
                }}
                className="w-full sm:w-auto"
              >
                Convert to Event Request
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="outline" onClick={() => onEdit(event)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 border-destructive/20"
                onClick={() => onDelete(event)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
