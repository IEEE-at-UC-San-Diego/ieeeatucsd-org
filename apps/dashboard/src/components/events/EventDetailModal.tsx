"use client";

import {
	CalendarPlus,
	Download,
	ExternalLink,
	FileText,
	UserCheck,
} from "lucide-react";
import { DotLabel, type DotTone } from "@/components/dashboard/DotLabel";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { downloadEventIcs } from "@/lib/calendarLinks";
import { EVENT_TYPE_LABELS, type Event, getEventStatus } from "./types";

interface EventDetailModalProps {
	event: Event | null;
	isOpen: boolean;
	onClose: () => void;
	onCheckIn?: () => void;
	userHasAttended?: boolean;
	attendeeCount?: number;
	capacity?: number;
}

function DetailRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-baseline justify-between gap-6 px-4 py-3 text-sm">
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 text-right font-medium text-foreground">
				{children}
			</dd>
		</div>
	);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>
	);
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

	const statusTone: DotTone = userHasAttended
		? "green"
		: isLive
			? "green"
			: isUpcoming
				? "blue"
				: "gray";
	const statusLabel = userHasAttended
		? "Attended"
		: isLive
			? "Live now"
			: isUpcoming
				? "Upcoming"
				: "Ended";

	const getFileType = (url: string) => {
		if (/\.pdf$/i.test(url)) return "PDF";
		if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return "Image";
		return "File";
	};

	const dateLabel = new Date(event.startDate).toLocaleDateString(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	const formatTimeRange = () => {
		const opts: Intl.DateTimeFormatOptions = {
			hour: "numeric",
			minute: "2-digit",
		};
		const start = new Date(event.startDate).toLocaleTimeString([], opts);
		const end = new Date(event.endDate).toLocaleTimeString([], opts);
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

	const showCheckIn =
		(isLive || isUpcoming) && !userHasAttended && Boolean(onCheckIn);

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={event.eventName}
			description={
				<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
					<DotLabel tone={statusTone} className="text-sm">
						{statusLabel}
					</DotLabel>
					<span>{EVENT_TYPE_LABELS[event.eventType]}</span>
				</span>
			}
			variant="large-sheet"
			className="sm:max-w-xl"
			footer={
				showCheckIn ? (
					<Button onClick={onCheckIn} className="h-11 w-full sm:h-9">
						<UserCheck className="mr-2 h-4 w-4" />
						Check in
					</Button>
				) : undefined
			}
		>
			<div className="space-y-6 pb-2">
				<div>
					<p className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
						{dateLabel}
					</p>
					<p className="mt-1 text-base tabular-nums text-muted-foreground">
						{formatTimeRange()}
					</p>
				</div>

				<dl className="divide-y rounded-md border">
					<DetailRow label="Location">{event.location}</DetailRow>
					<DetailRow label="Points">
						<span className="tabular-nums">{event.pointsToReward}</span>
					</DetailRow>
					{event.hasFood && <DetailRow label="Food">Provided</DetailRow>}
					<DetailRow label="Checked in">
						<span className="tabular-nums">
							{attendeeCount}
							{capacity ? ` of ${capacity}` : ""}
						</span>
					</DetailRow>
				</dl>

				{event.eventDescription && (
					<section>
						<SectionTitle>About</SectionTitle>
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
							{event.eventDescription}
						</p>
					</section>
				)}

				<section>
					<SectionTitle>Add to calendar</SectionTitle>
					<div className="flex flex-wrap gap-2">
						{event.publicGoogleEventUrl && (
							<Button
								type="button"
								variant="outline"
								className="h-11 sm:h-9"
								onClick={() =>
									window.open(
										event.publicGoogleEventUrl!,
										"_blank",
										"noopener,noreferrer",
									)
								}
							>
								<ExternalLink className="mr-1.5 h-3.5 w-3.5" />
								Google Calendar
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							className="h-11 sm:h-9"
							onClick={handleDownloadIcs}
						>
							<CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
							Download .ics
						</Button>
					</div>
				</section>

				{event.files && event.files.length > 0 && (
					<section>
						<SectionTitle>Resources</SectionTitle>
						<ul className="divide-y rounded-md border">
							{event.files.map((fileUrl, index) => (
								<li
									key={fileUrl}
									className="flex items-center gap-3 px-4 py-2.5"
								>
									<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
									<a
										href={fileUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="min-w-0 flex-1 text-sm hover:underline"
									>
										<span className="font-medium">Event file {index + 1}</span>
										<span className="ml-2 text-muted-foreground">
											{getFileType(fileUrl)}
										</span>
									</a>
									<Button
										variant="ghost"
										size="icon"
										className="h-11 w-11 sm:h-9 sm:w-9"
										onClick={() => {
											const a = document.createElement("a");
											a.href = fileUrl;
											a.download = `Event_File_${index + 1}`;
											a.click();
										}}
										aria-label={`Download event file ${index + 1}`}
									>
										<Download className="h-3.5 w-3.5" />
									</Button>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</ResponsiveOverlay>
	);
}
