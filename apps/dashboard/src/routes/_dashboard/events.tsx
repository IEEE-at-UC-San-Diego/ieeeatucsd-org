import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Calendar, Clock, Download, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	DashboardPage,
	EmptyState,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import {
	CheckInModal,
	EventCard,
	EventDetailModal,
	type Event as EventType,
	getEventStatus,
	HappeningToday,
} from "@/components/events";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import {
	buildGoogleCalendarIcsUrl,
	buildGoogleCalendarSubscribeUrl,
} from "@/lib/calendarLinks";
import { prefetchQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/events")({
	loader: (ctx) => prefetchQuery(api.events.listPublished, undefined, ctx),
	component: EventsPage,
});

const PAST_EVENTS_PER_PAGE = 9;

function EventsPage() {
	const { logtoId } = useAuth();
	// listPublished is a public query with no auth args
	const events = useQuery(api.events.listPublished);
	const attendedEventIdsData = useAuthedQuery(
		api.events.getAttendedEventIds,
		logtoId ? { logtoId } : "skip",
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

	const liveEvents = useMemo(
		() =>
			(
				filteredEvents?.filter((e) => e.startDate <= now && e.endDate >= now) ??
				[]
			).sort((a, b) => a.startDate - b.startDate),
		[filteredEvents, now],
	);

	const upcomingEvents = useMemo(
		() =>
			(filteredEvents?.filter((e) => e.startDate > now) ?? []).sort(
				(a, b) => a.startDate - b.startDate,
			),
		[filteredEvents, now],
	);

	const pastEvents = useMemo(
		() =>
			(filteredEvents?.filter((e) => e.endDate < now) ?? []).sort(
				(a, b) => b.startDate - a.startDate,
			),
		[filteredEvents, now],
	);

	const pastTotalPages = Math.ceil(pastEvents.length / PAST_EVENTS_PER_PAGE);
	const paginatedPast = pastEvents.slice(
		(pastPage - 1) * PAST_EVENTS_PER_PAGE,
		pastPage * PAST_EVENTS_PER_PAGE,
	);

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
		const calendarId = events?.find(
			(event) => event.publicGoogleCalendarId,
		)?.publicGoogleCalendarId;
		if (!calendarId) return null;
		return {
			subscribeUrl: buildGoogleCalendarSubscribeUrl(calendarId),
			icsUrl: buildGoogleCalendarIcsUrl(calendarId),
		};
	}, [events]);

	return (
		<DashboardPage>
			{/* Header */}
			<PageHeader
				title="Events"
				description="Browse and check in to IEEE UCSD events."
				actions={
					publicCalendarMeta ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline">
									<Calendar /> Add to calendar
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem asChild>
									<a
										href={publicCalendarMeta.subscribeUrl}
										target="_blank"
										rel="noreferrer"
									>
										<ExternalLink /> Subscribe to public calendar
									</a>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<a
										href={publicCalendarMeta.icsUrl}
										target="_blank"
										rel="noreferrer"
									>
										<Download /> Add calendar via ICS
									</a>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : undefined
				}
			/>

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
				<Tabs
					value={activeTab}
					onValueChange={(value) => {
						setActiveTab(value as "upcoming" | "past");
						if (value === "past") setPastPage(1);
					}}
				>
					<TabsList>
						<TabsTrigger value="upcoming">
							Upcoming ({upcomingEvents.length})
						</TabsTrigger>
						<TabsTrigger value="past">Past ({pastEvents.length})</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{/* Events grid */}
			{!events ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Skeleton key={i} className="h-44 w-full rounded-md" />
					))}
				</div>
			) : activeTab === "upcoming" ? (
				upcomingEvents.length > 0 ? (
					<div
						className={`grid grid-cols-1 gap-3 ${upcomingEvents.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}
					>
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
					<EmptyState
						icon={<Calendar />}
						title="No upcoming events"
						description="Check back later for upcoming IEEE UCSD events."
					/>
				)
			) : paginatedPast.length > 0 ? (
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
					<Pagination
						currentPage={pastPage}
						totalPages={pastTotalPages}
						onPageChange={setPastPage}
					/>
				</div>
			) : (
				<div className="text-center py-16 text-muted-foreground">
					<Clock className="mx-auto h-10 w-10 mb-3 opacity-30" />
					<p className="text-sm font-medium">No past events</p>
					<p className="text-xs mt-1">Events you've missed will appear here.</p>
				</div>
			)}

			{/* Event Detail Modal */}
			<EventDetailModal
				event={selectedEvent}
				isOpen={isEventDetailOpen}
				onClose={() => setIsEventDetailOpen(false)}
				onCheckIn={
					selectedEvent && getEventStatus(selectedEvent) === "live"
						? handleCheckInFromDetail
						: undefined
				}
				userHasAttended={
					selectedEvent ? attendedEventIds.has(selectedEvent._id) : false
				}
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
		</DashboardPage>
	);
}
