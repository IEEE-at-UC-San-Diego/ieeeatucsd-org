import { format } from "date-fns";
import { Calendar, Clock3, ExternalLink, MapPin, Pencil } from "lucide-react";
import type { EventRequest } from "@/components/manage-events/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	buildGoogleCalendarSubscribeUrl,
	downloadEventIcs,
} from "@/lib/calendarLinks";

interface OfficerCalendarEventModalProps {
	isOpen: boolean;
	onClose: () => void;
	event: EventRequest | null;
	isInternalEvent: boolean;
	onEditInternalEvent?: () => void;
	calendarId?: string | null;
	calendarLabel?: string;
}

export function OfficerCalendarEventModal({
	isOpen,
	onClose,
	event,
	isInternalEvent,
	onEditInternalEvent,
	calendarId,
	calendarLabel = "Calendar",
}: OfficerCalendarEventModalProps) {
	if (!event) return null;

	const startDate = new Date(event.startDate);
	const endDate = new Date(event.endDate);
	const eventGoogleUrl =
		event.privateGoogleEventUrl || event.publicGoogleEventUrl || undefined;
	const subscribeUrl = calendarId
		? buildGoogleCalendarSubscribeUrl(calendarId)
		: null;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-xl border border-border bg-background text-foreground shadow-xl">
				<DialogHeader className="space-y-3">
					<div className="flex items-start justify-between gap-2">
						<DialogTitle className="text-2xl font-black tracking-tight leading-tight text-foreground">
							{event.eventName}
						</DialogTitle>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							className={
								isInternalEvent
									? "border-amber-300 bg-ds-amber-100 text-ds-amber-900"
									: "border-ds-blue-400 bg-ds-blue-100 text-ds-blue-1000"
							}
						>
							{isInternalEvent ? "Internal Event" : "Published Event"}
						</Badge>
						<Badge variant="outline" className="border-border text-foreground">
							{event.status}
						</Badge>
					</div>
				</DialogHeader>

				<div className="space-y-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="rounded-md border border-border bg-muted px-3 py-2.5">
							<div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
								<Calendar className="h-3.5 w-3.5" />
								Date
							</div>
							<p className="mt-1 text-sm text-foreground">
								{format(startDate, "EEEE, MMMM d, yyyy")}
							</p>
						</div>
						<div className="rounded-md border border-border bg-muted px-3 py-2.5">
							<div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
								<Clock3 className="h-3.5 w-3.5" />
								Time
							</div>
							<p className="mt-1 text-sm text-foreground">
								{format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
							</p>
						</div>
					</div>

					<div className="rounded-md border border-border bg-muted px-3 py-2.5">
						<div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
							<MapPin className="h-3.5 w-3.5" />
							Location
						</div>
						<p className="mt-1 text-sm text-foreground">
							{event.location || "TBD"}
						</p>
					</div>

					{event.eventDescription && (
						<div className="rounded-md border border-border bg-muted px-3 py-2.5">
							<p className="text-muted-foreground text-xs uppercase tracking-wide">
								Details
							</p>
							<p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
								{event.eventDescription}
							</p>
						</div>
					)}

					<div className="rounded-md border border-border bg-muted px-3 py-3 space-y-2">
						<p className="text-muted-foreground text-xs uppercase tracking-wide">
							Add to Calendar
						</p>
						<div className="flex flex-wrap gap-2">
							{subscribeUrl && (
								<Button size="sm" variant="outline" asChild>
									<a href={subscribeUrl} target="_blank" rel="noreferrer">
										<ExternalLink className="h-3.5 w-3.5 mr-1.5" />
										Subscribe {calendarLabel}
									</a>
								</Button>
							)}
							{eventGoogleUrl && (
								<Button size="sm" variant="outline" asChild>
									<a href={eventGoogleUrl} target="_blank" rel="noreferrer">
										<ExternalLink className="h-3.5 w-3.5 mr-1.5" />
										Open This Event
									</a>
								</Button>
							)}
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									downloadEventIcs(
										{
											id:
												event.privateGoogleEventId ||
												event.publicGoogleEventId ||
												event._id,
											title: event.eventName,
											description: event.eventDescription,
											location: event.location,
											startDate: event.startDate,
											endDate: event.endDate,
										},
										`${event.eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event"}.ics`,
									)
								}
							>
								<Calendar className="h-3.5 w-3.5 mr-1.5" />
								Download Event ICS
							</Button>
						</div>
					</div>
				</div>

				{isInternalEvent && onEditInternalEvent && (
					<div className="pt-2">
						<Button onClick={onEditInternalEvent} className="w-full">
							<Pencil className="h-4 w-4 mr-1.5" />
							Edit Internal Event
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
