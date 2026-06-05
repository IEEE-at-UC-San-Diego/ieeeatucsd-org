import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Users,
  Presentation,
  Wrench,
  PartyPopper,
  Heart,
  MoreHorizontal,
  Calendar,
  MapPin,
  Trash2,
} from "lucide-react";

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

interface InternalEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    location: string;
    startDate: number;
    endDate: number;
    eventType: InternalEventType;
  }) => Promise<void>;
  onDelete?: (event: InternalEvent) => Promise<void>;
  editingEvent?: InternalEvent | null;
  initialDate?: Date | null;
}

const EVENT_TYPES: Array<{
  value: InternalEventType;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}> = [
  {
    value: "meeting",
    label: "Meeting",
    icon: Users,
    color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
    description: "Team meetings, planning sessions",
  },
  {
    value: "tabling",
    label: "Tabling",
    icon: Presentation,
    color: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
    description: "Recruitment, info booths",
  },
  {
    value: "workshop",
    label: "Workshop",
    icon: Wrench,
    color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100",
    description: "Technical workshops, tutorials",
  },
  {
    value: "social",
    label: "Social",
    icon: PartyPopper,
    color: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",
    description: "Social events, hangouts",
  },
  {
    value: "outreach",
    label: "Outreach",
    icon: Heart,
    color: "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100",
    description: "Community service, outreach",
  },
  {
    value: "other",
    label: "Other",
    icon: MoreHorizontal,
    color: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
    description: "Miscellaneous events",
  },
];

const defaultFormData = {
  name: "",
  description: "",
  location: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  eventType: "meeting" as InternalEventType,
};

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function InternalEventModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  editingEvent,
  initialDate,
}: InternalEventModalProps) {
  const [formData, setFormData] = useState(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingEvent) {
        const startDate = new Date(editingEvent.startDate);
        const endDate = new Date(editingEvent.endDate);
        setFormData({
          name: editingEvent.name,
          description: editingEvent.description || "",
          location: editingEvent.location,
          startDate: startDate.toISOString().split("T")[0],
          startTime: startDate.toTimeString().slice(0, 5),
          endDate: endDate.toISOString().split("T")[0],
          endTime: endDate.toTimeString().slice(0, 5),
          eventType: editingEvent.eventType,
        });
      } else {
        const selectedDate = initialDate ?? new Date();
        const dateString = formatDateForInput(selectedDate);
        setFormData({
          ...defaultFormData,
          startDate: dateString,
          endDate: dateString,
        });
      }
    }
  }, [isOpen, editingEvent, initialDate]);

  const handleSubmit = async () => {
    if (
      !formData.name ||
      !formData.location ||
      !formData.startDate ||
      !formData.startTime ||
      !formData.endDate ||
      !formData.endTime
    ) {
      return;
    }

    const startDateTime = new Date(
      `${formData.startDate}T${formData.startTime}`
    ).getTime();
    const endDateTime = new Date(
      `${formData.endDate}T${formData.endTime}`
    ).getTime();

    if (endDateTime <= startDateTime) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: formData.name,
        description: formData.description || undefined,
        location: formData.location,
        startDate: startDateTime,
        endDate: endDateTime,
        eventType: formData.eventType,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(editingEvent);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[min(96vw,700px)] max-w-[700px] p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="relative">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-lg font-semibold">
              {editingEvent ? "Edit Event" : "New Internal Event"}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Form */}
        <div className="px-5 pb-4 space-y-3">
          {/* Event Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Weekly Team Meeting"
              className="h-9 text-sm"
            />
          </div>

          {/* Event Type - 6 columns compact */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Type</Label>
            <div className="grid grid-cols-6 gap-1">
              {EVENT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = formData.eventType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, eventType: type.value })}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md border transition-all",
                      isSelected
                        ? type.color
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-500"
                    )}
                    title={type.label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-none">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs font-medium text-muted-foreground">
              Location
            </Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="EBU-1 Room 101"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          {/* Date & Time - Compact inline */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Date & Time</Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      startDate: e.target.value,
                      endDate: e.target.value,
                    })
                  }
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="h-9 w-36 min-w-[8.5rem] text-sm"
              />
              <span className="text-muted-foreground text-sm shrink-0">→</span>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="h-9 w-36 min-w-[8.5rem] text-sm"
              />
            </div>
          </div>

          {/* Description - Smaller */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium text-muted-foreground">
              Notes <span className="font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              rows={1}
              className="resize-none h-9 text-sm py-2"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center justify-end gap-2">
          {editingEvent && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 mr-auto h-8 px-2"
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                  Deleting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </span>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting || isDeleting}
            className="h-8"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              isDeleting ||
              !formData.name ||
              !formData.location ||
              !formData.startDate ||
              !formData.startTime
            }
            className="bg-[#00629B] hover:bg-[#004d7a] h-8 px-4"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5 text-sm">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </span>
            ) : editingEvent ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
