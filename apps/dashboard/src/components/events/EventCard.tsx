import { Loader2, UserCheck } from "lucide-react";
import { DotLabel } from "@/components/dashboard/DotLabel";
import { Button } from "@/components/ui/button";
import {
	type Event,
	formatEventDate,
	formatEventTime,
	getEventStatus,
} from "./types";

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
		if (isAttended) return <DotLabel tone="green">Attended</DotLabel>;
		if (isLive) return <DotLabel tone="green">Live</DotLabel>;
		if (isUpcoming) return <DotLabel tone="blue">Upcoming</DotLabel>;
		return <DotLabel tone="gray">Ended</DotLabel>;
	};

	const actionButton = () => {
		if (isPast) return null;

		if (isAttended) {
			return (
				<Button
					variant="secondary"
					size="sm"
					disabled
					className="w-full text-xs"
				>
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
			<p className="text-xs text-muted-foreground">
				Check-in opens when the event begins.
			</p>
		);
	};

	const action = actionButton();

	return (
		<div
			className={`group rounded-md border bg-card transition-colors hover:bg-muted/40 cursor-pointer ${
				isPast ? "opacity-70 hover:opacity-100" : ""
			}`}
			onClick={onClick}
		>
			<div className="flex h-full flex-col gap-3 p-4">
				<div className="flex items-start justify-between gap-3">
					<h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-[-0.01em] text-foreground">
						{event.eventName}
					</h3>
					<div className="shrink-0 pt-0.5">{statusBadge()}</div>
				</div>

				<div className="flex-1 space-y-0.5 text-sm text-muted-foreground">
					<p className="tabular-nums">
						{formatEventDate(event.startDate)} ·{" "}
						{formatEventTime(event.startDate)}
					</p>
					<p className="truncate">{event.location}</p>
					<p>
						<span className="font-medium text-foreground">
							{event.pointsToReward} pts
						</span>
						{event.hasFood && " · Food provided"}
					</p>
				</div>

				{action && (
					<div className="pt-1" onClick={(e) => e.stopPropagation()}>
						{action}
					</div>
				)}
			</div>
		</div>
	);
}
