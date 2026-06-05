import { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
} from "date-fns";
import type { EventRequest, EventStatus } from "../types";

interface EventCalendarProps {
  events: EventRequest[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: EventRequest) => void;
  todayHighlightMode?: "text" | "background";
  getDayLabel?: (date: Date) => string | null;
}

const statusColors: Record<EventStatus, string> = {
  draft: "bg-gray-400",
  submitted: "bg-indigo-400",
  pending: "bg-yellow-400",
  needs_review: "bg-orange-400",
  approved: "bg-green-400",
  declined: "bg-red-400",
  published: "bg-pink-400",
};

const statusBgColors: Record<EventStatus, string> = {
  draft: "bg-gray-100 hover:bg-gray-200",
  submitted: "bg-indigo-50 hover:bg-indigo-100",
  pending: "bg-yellow-50 hover:bg-yellow-100",
  needs_review: "bg-orange-50 hover:bg-orange-100",
  approved: "bg-green-50 hover:bg-green-100",
  declined: "bg-red-50 hover:bg-red-100",
  published: "bg-pink-50 hover:bg-pink-100",
};

const legendItems: { status: EventStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "submitted", label: "Submitted" },
  { status: "pending", label: "Pending" },
  { status: "needs_review", label: "Needs Review" },
  { status: "approved", label: "Approved" },
  { status: "declined", label: "Declined" },
  { status: "published", label: "Published" },
];

export function EventCalendar({
  events,
  onDateClick,
  onEventClick,
  todayHighlightMode = "text",
  getDayLabel,
}: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) => {
    return events.filter((event) =>
      isSameDay(new Date(event.startDate), day)
    );
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="w-20" />
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {weekDays.map((day) => (
          <div
            key={day}
            className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-600"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const isSunday = getDay(day) === 0;
          const sundayWeekLabel = isSunday ? getDayLabel?.(day) : null;
          const isFinalsWeekLabel = sundayWeekLabel?.includes("Finals") ?? false;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] p-2 cursor-pointer transition-colors ${
                isTodayDate && todayHighlightMode === "background"
                  ? "bg-blue-100 border border-blue-300 hover:bg-blue-100"
                  : "bg-white hover:bg-gray-50"
              } ${!isCurrentMonth ? "opacity-50" : ""}`}
              onClick={() => onDateClick?.(day)}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="min-w-0">
                  <span
                    className={`text-sm font-medium ${
                      isTodayDate && todayHighlightMode === "text"
                        ? "text-blue-600"
                        : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {sundayWeekLabel && (
                    <div className="mt-1">
                      <div
                        className={`rounded-md px-2 py-1 ${
                          isFinalsWeekLabel
                            ? "border border-red-300 bg-red-700/85"
                            : "border border-blue-200 bg-blue-500/85"
                        }`}
                      >
                        <span
                          className={`block truncate text-[10px] font-semibold tracking-normal ${
                            isFinalsWeekLabel ? "text-red-50" : "text-blue-50"
                          }`}
                        >
                          {sundayWeekLabel}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {isTodayDate && (
                  <span className={`text-xs font-medium ${todayHighlightMode === "background" ? "text-blue-700" : "text-blue-600"}`}>
                    Today
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event._id}
                    className={`w-full text-left text-xs px-2 py-1 rounded truncate transition-all ${
                      statusBgColors[event.status]
                    } ${
                      hoveredEvent === event._id
                        ? "ring-2 ring-offset-1 ring-gray-300"
                        : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    onMouseEnter={() => setHoveredEvent(event._id)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    title={event.eventName}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-1 ${
                        statusColors[event.status]
                      }`}
                    />
                    {event.eventName}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 px-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t bg-gray-50/50">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Info className="h-4 w-4" />
            <span className="font-medium">Status:</span>
          </div>
          {legendItems.map((item) => (
            <div
              key={item.status}
              className="flex items-center gap-1.5 text-xs text-gray-600"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${statusColors[item.status]}`}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
