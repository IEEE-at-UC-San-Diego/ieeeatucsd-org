import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	getDay,
	isSameDay,
	isSameMonth,
	isToday,
	startOfMonth,
	startOfWeek,
	subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventRequest, EventStatus } from "../types";

interface EventCalendarProps {
	events: EventRequest[];
	onDateClick?: (date: Date) => void;
	onEventClick?: (event: EventRequest) => void;
	todayHighlightMode?: "text" | "background";
	getDayLabel?: (date: Date) => string | null;
}

const statusColors: Record<EventStatus, string> = {
	draft: "bg-ds-gray-600",
	submitted: "bg-indigo-400",
	pending: "bg-yellow-400",
	needs_review: "bg-orange-400",
	approved: "bg-green-400",
	declined: "bg-red-400",
	published: "bg-pink-400",
};

const statusBgColors: Record<EventStatus, string> = {
	draft: "bg-muted hover:bg-ds-gray-300",
	submitted: "bg-ds-purple-100 hover:bg-ds-purple-100",
	pending: "bg-ds-amber-100 hover:bg-ds-amber-100",
	needs_review: "bg-ds-amber-100 hover:bg-ds-amber-100",
	approved: "bg-ds-green-100 hover:bg-ds-green-100",
	declined: "bg-ds-red-100 hover:bg-ds-red-100",
	published: "bg-ds-pink-100 hover:bg-ds-blue-100",
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
		return events.filter((event) => isSameDay(new Date(event.startDate), day));
	};

	const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
	const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
	const goToToday = () => setCurrentMonth(new Date());

	const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	return (
		<div className="bg-background rounded-md border overflow-hidden">
			<div className="p-4 border-b flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={goToPreviousMonth}>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button variant="outline" size="sm" onClick={goToNextMonth}>
						<ChevronRight className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="sm" onClick={goToToday}>
						Today
					</Button>
				</div>
				<h2 className="text-lg font-semibold text-foreground">
					{format(currentMonth, "MMMM yyyy")}
				</h2>
				<div className="w-20" />
			</div>

			<div className="grid grid-cols-7 gap-px bg-muted">
				{weekDays.map((day) => (
					<div
						key={day}
						className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground"
					>
						{day}
					</div>
				))}
			</div>

			<div className="grid grid-cols-7 gap-px bg-muted">
				{days.map((day) => {
					const dayEvents = getEventsForDay(day);
					const isCurrentMonth = isSameMonth(day, currentMonth);
					const isTodayDate = isToday(day);
					const isSunday = getDay(day) === 0;
					const sundayWeekLabel = isSunday ? getDayLabel?.(day) : null;
					const isFinalsWeekLabel =
						sundayWeekLabel?.includes("Finals") ?? false;

					return (
						<div
							key={day.toISOString()}
							className={`min-h-[100px] p-2 cursor-pointer transition-colors ${
								isTodayDate && todayHighlightMode === "background"
									? "bg-ds-blue-100 border border-ds-blue-400 hover:bg-ds-blue-100"
									: "bg-background hover:bg-muted"
							} ${!isCurrentMonth ? "opacity-50" : ""}`}
							onClick={() => onDateClick?.(day)}
						>
							<div className="flex items-start justify-between mb-1">
								<div className="min-w-0">
									<span
										className={`text-sm font-medium ${
											isTodayDate && todayHighlightMode === "text"
												? "text-ds-blue-700"
												: "text-foreground"
										}`}
									>
										{format(day, "d")}
									</span>
									{sundayWeekLabel && (
										<div className="mt-1">
											<div
												className={`rounded-md px-2 py-1 ${
													isFinalsWeekLabel
														? "border border-ds-red-400 bg-red-700/85"
														: "border border-ds-blue-100 bg-ds-blue-1000/85"
												}`}
											>
												<span
													className={`block truncate text-[10px] font-semibold tracking-normal ${
														isFinalsWeekLabel
															? "text-ds-red-100"
															: "text-blue-50"
													}`}
												>
													{sundayWeekLabel}
												</span>
											</div>
										</div>
									)}
								</div>
								{isTodayDate && (
									<span
										className={`text-xs font-medium ${todayHighlightMode === "background" ? "text-ds-blue-700" : "text-ds-blue-700"}`}
									>
										Today
									</span>
								)}
							</div>

							<div className="space-y-1">
								{dayEvents.slice(0, 3).map((event) => (
									<Button
										variant="ghost"
										key={event._id}
										className={`w-full text-left text-xs px-2 py-1 rounded truncate transition-shadow duration-150 ease-[ease] ${
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
									</Button>
								))}
								{dayEvents.length > 3 && (
									<div className="text-xs text-muted-foreground px-2">
										+{dayEvents.length - 3} more
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>

			<div className="p-4 border-t bg-muted/50">
				<div className="flex items-center gap-4 flex-wrap">
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<Info className="h-4 w-4" />
						<span className="font-medium">Status:</span>
					</div>
					{legendItems.map((item) => (
						<div
							key={item.status}
							className="flex items-center gap-1.5 text-xs text-muted-foreground"
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
