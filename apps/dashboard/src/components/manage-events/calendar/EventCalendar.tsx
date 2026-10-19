import {
	addDays,
	addMonths,
	eachDayOfInterval,
	endOfDay,
	endOfMonth,
	endOfWeek,
	format,
	getDay,
	isSameDay,
	isSameMonth,
	isToday,
	isWithinInterval,
	startOfDay,
	startOfMonth,
	startOfWeek,
	subDays,
	subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { EventRequest, EventStatus } from "../types";

type CalendarView = "month" | "day" | "agenda";

interface EventCalendarProps {
	events: EventRequest[];
	onDateClick?: (date: Date) => void;
	onEventClick?: (event: EventRequest) => void;
	todayHighlightMode?: "text" | "background";
	getDayLabel?: (date: Date) => string | null;
	/** Override initial view; mobile defaults to agenda. */
	defaultView?: CalendarView;
}

const statusColors: Record<EventStatus, string> = {
	draft: "bg-ds-gray-600",
	submitted: "bg-ds-purple-600",
	pending: "bg-ds-amber-600",
	needs_review: "bg-ds-amber-700",
	approved: "bg-ds-green-600",
	declined: "bg-ds-red-600",
	published: "bg-ds-blue-700",
};

const statusBgColors: Record<EventStatus, string> = {
	draft: "bg-muted hover:bg-ds-gray-200",
	submitted: "bg-ds-purple-100/70 hover:bg-ds-purple-100",
	pending: "bg-ds-amber-100/70 hover:bg-ds-amber-100",
	needs_review: "bg-ds-amber-100/70 hover:bg-ds-amber-100",
	approved: "bg-ds-green-100/70 hover:bg-ds-green-100",
	declined: "bg-ds-red-100/70 hover:bg-ds-red-100",
	published: "bg-ds-blue-100/70 hover:bg-ds-blue-100",
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
	defaultView,
}: EventCalendarProps) {
	const isMobile = useIsMobile();
	const [view, setView] = useState<CalendarView>(
		defaultView ?? (isMobile ? "agenda" : "month"),
	);
	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [selectedDay, setSelectedDay] = useState(new Date());

	useEffect(() => {
		if (defaultView) return;
		setView(isMobile ? "agenda" : "month");
	}, [isMobile, defaultView]);

	const monthStart = startOfMonth(currentMonth);
	const monthEnd = endOfMonth(monthStart);
	const calendarStart = startOfWeek(monthStart);
	const calendarEnd = endOfWeek(monthEnd);
	const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

	const getEventsForDay = (day: Date) => {
		return events.filter((event) => isSameDay(new Date(event.startDate), day));
	};

	const agendaDays = useMemo(() => {
		const start = startOfDay(selectedDay);
		return Array.from({ length: 14 }, (_, i) => addDays(start, i));
	}, [selectedDay]);

	const agendaEvents = useMemo(() => {
		const start = startOfDay(selectedDay);
		const end = endOfDay(addDays(start, 13));
		return events
			.filter((event) =>
				isWithinInterval(new Date(event.startDate), { start, end }),
			)
			.sort((a, b) => a.startDate - b.startDate);
	}, [events, selectedDay]);

	const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
	const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
	const goToToday = () => {
		const today = new Date();
		setCurrentMonth(today);
		setSelectedDay(today);
	};

	const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const dayEvents = getEventsForDay(selectedDay);

	return (
		<div className="overflow-hidden rounded-md border bg-background">
			<div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<h2 className="min-w-[10.5rem] text-xl font-semibold tracking-[-0.02em] text-foreground">
						{view === "month" ? (
							<>
								{format(currentMonth, "MMMM")}{" "}
								<span className="font-normal text-muted-foreground">
									{format(currentMonth, "yyyy")}
								</span>
							</>
						) : (
							format(selectedDay, "EEE, MMM d")
						)}
					</h2>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="size-11 md:size-8"
							onClick={() => {
								if (view === "month") goToPreviousMonth();
								else
									setSelectedDay(subDays(selectedDay, view === "day" ? 1 : 7));
							}}
							aria-label="Previous"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-11 md:h-8"
							onClick={goToToday}
						>
							Today
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-11 md:size-8"
							onClick={() => {
								if (view === "month") goToNextMonth();
								else
									setSelectedDay(addDays(selectedDay, view === "day" ? 1 : 7));
							}}
							aria-label="Next"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
				<Tabs
					value={view}
					onValueChange={(value) => setView(value as CalendarView)}
				>
					<TabsList>
						{(["agenda", "day", "month"] as const).map((mode) => (
							<TabsTrigger key={mode} value={mode} className="px-4 capitalize">
								{mode}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>

			{view === "agenda" && (
				<div className="divide-y">
					{/* Day chips */}
					<div className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 py-3">
						{agendaDays.map((day) => {
							const count = getEventsForDay(day).length;
							const active = isSameDay(day, selectedDay);
							return (
								<button
									key={day.toISOString()}
									type="button"
									onClick={() => setSelectedDay(day)}
									className={cn(
										"motion-press flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-md border px-2 py-1.5 text-xs",
										active
											? "border-ieee-blue bg-ds-blue-100 text-tone-info"
											: "border-border bg-background text-foreground",
										isToday(day) && !active && "border-ds-blue-400",
									)}
								>
									<span className="font-medium">{format(day, "EEE")}</span>
									<span className="text-sm tabular-nums">
										{format(day, "d")}
									</span>
									{count > 0 && (
										<span className="mt-0.5 h-1 w-1 rounded-full bg-ieee-blue" />
									)}
								</button>
							);
						})}
					</div>

					{agendaEvents.length === 0 ? (
						<div className="px-4 py-10 text-center text-sm text-muted-foreground">
							No events in the next two weeks from{" "}
							{format(selectedDay, "MMM d")}.
						</div>
					) : (
						<ul>
							{agendaDays.map((day) => {
								const dayItems = getEventsForDay(day);
								if (dayItems.length === 0) return null;
								return (
									<li key={day.toISOString()} className="border-t">
										<div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
											{format(day, "EEEE, MMM d")}
											{isToday(day) ? " · Today" : ""}
										</div>
										<ul className="divide-y">
											{dayItems.map((event) => (
												<li key={event._id}>
													<button
														type="button"
														className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
														onClick={() => onEventClick?.(event)}
													>
														<span
															className={cn(
																"h-2.5 w-2.5 shrink-0 rounded-full",
																statusColors[event.status],
															)}
														/>
														<div className="min-w-0 flex-1">
															<p className="truncate text-sm font-medium">
																{event.eventName}
															</p>
															<p className="truncate text-xs text-muted-foreground">
																{format(new Date(event.startDate), "h:mm a")}
																{event.location ? ` · ${event.location}` : ""}
															</p>
														</div>
													</button>
												</li>
											))}
										</ul>
									</li>
								);
							})}
						</ul>
					)}

					<div className="border-t p-3">
						<Button
							variant="outline"
							className="h-11 w-full"
							onClick={() => onDateClick?.(selectedDay)}
						>
							Add event on {format(selectedDay, "MMM d")}
						</Button>
					</div>
				</div>
			)}

			{view === "day" && (
				<div className="divide-y">
					<div className="flex items-center justify-between px-4 py-3">
						<p className="text-sm text-muted-foreground">
							{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
						</p>
						<Button
							variant="outline"
							size="sm"
							className="h-11"
							onClick={() => onDateClick?.(selectedDay)}
						>
							Add
						</Button>
					</div>
					{dayEvents.length === 0 ? (
						<div className="px-4 py-12 text-center text-sm text-muted-foreground">
							Nothing scheduled for this day.
						</div>
					) : (
						<ul className="divide-y">
							{dayEvents.map((event) => (
								<li key={event._id}>
									<button
										type="button"
										className={cn(
											"flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60",
											statusBgColors[event.status],
										)}
										onClick={() => onEventClick?.(event)}
									>
										<span
											className={cn(
												"h-2.5 w-2.5 shrink-0 rounded-full",
												statusColors[event.status],
											)}
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">
												{event.eventName}
											</p>
											<p className="truncate text-xs text-muted-foreground">
												{format(new Date(event.startDate), "h:mm a")}
												{event.location ? ` · ${event.location}` : ""}
											</p>
										</div>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{view === "month" && (
				<>
					<div className="grid grid-cols-7 border-b">
						{weekDays.map((day) => (
							<div
								key={day}
								className="px-3 py-2 text-xs font-medium text-muted-foreground"
							>
								{day}
							</div>
						))}
					</div>

					<div className="grid grid-cols-7">
						{days.map((day, index) => {
							const dayEventList = getEventsForDay(day);
							const isCurrentMonth = isSameMonth(day, currentMonth);
							const isTodayDate = isToday(day);
							const isSunday = getDay(day) === 0;
							const sundayWeekLabel = isSunday ? getDayLabel?.(day) : null;
							const isFinalsWeekLabel =
								sundayWeekLabel?.includes("Finals") ?? false;
							const isLastRow = index >= days.length - 7;

							return (
								<div
									key={day.toISOString()}
									className={cn(
										"min-h-[84px] min-w-0 cursor-pointer overflow-hidden border-r p-1.5 transition-colors last:border-r-0 md:min-h-[116px]",
										index % 7 === 6 && "border-r-0",
										!isLastRow && "border-b",
										isTodayDate && todayHighlightMode === "background"
											? "bg-ds-blue-100/40 hover:bg-ds-blue-100/60"
											: "hover:bg-muted/50",
									)}
									onClick={() => {
										setSelectedDay(day);
										onDateClick?.(day);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setSelectedDay(day);
											onDateClick?.(day);
										}
									}}
									role="button"
									tabIndex={0}
									aria-label={format(day, "EEEE, MMMM d")}
								>
									<div className="mb-1 flex items-center justify-between gap-1 px-0.5">
										<span
											className={cn(
												"inline-flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
												isTodayDate
													? "bg-ds-blue-700 font-semibold text-on-accent"
													: isCurrentMonth
														? "font-medium text-foreground"
														: "text-muted-foreground/60",
											)}
										>
											{format(day, "d")}
										</span>
										{sundayWeekLabel && (
											<span
												className={cn(
													"truncate text-[11px] font-medium",
													isFinalsWeekLabel
														? "text-tone-danger"
														: "text-muted-foreground",
												)}
											>
												{sundayWeekLabel}
											</span>
										)}
									</div>

									<div
										className={cn(
											"min-w-0 space-y-0.5",
											!isCurrentMonth && "opacity-55",
										)}
									>
										{dayEventList.slice(0, 3).map((event) => (
											<button
												type="button"
												key={event._id}
												className={cn(
													"flex h-auto w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-[4px] px-1.5 py-0.5 text-left text-xs transition-colors",
													statusBgColors[event.status],
												)}
												onClick={(e) => {
													e.stopPropagation();
													onEventClick?.(event);
												}}
												title={event.eventName}
											>
												<span
													className={cn(
														"size-1.5 shrink-0 rounded-full",
														statusColors[event.status],
													)}
												/>
												<span className="min-w-0 truncate font-medium">
													{event.eventName}
												</span>
											</button>
										))}
										{dayEventList.length > 3 && (
											<div className="truncate px-1.5 text-xs text-muted-foreground">
												+{dayEventList.length - 3} more
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>

					<div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3">
						{legendItems.map((item) => (
							<div
								key={item.status}
								className="flex items-center gap-1.5 text-xs text-muted-foreground"
							>
								<span
									className={cn(
										"size-1.5 rounded-full",
										statusColors[item.status],
									)}
								/>
								<span>{item.label}</span>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
