import { DotLabel, type DotTone } from "@/components/dashboard/DotLabel";
import type { EventStatus } from "../types";

interface StatusBadgeProps {
	status: EventStatus;
	className?: string;
}

const statusTones: Record<EventStatus, DotTone> = {
	draft: "gray",
	submitted: "purple",
	pending: "amber",
	needs_review: "amber",
	approved: "green",
	declined: "red",
	published: "blue",
};

const statusLabels: Record<EventStatus, string> = {
	draft: "Draft",
	submitted: "Submitted",
	pending: "Pending",
	needs_review: "Needs Review",
	approved: "Approved",
	declined: "Declined",
	published: "Published",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
	return (
		<DotLabel tone={statusTones[status]} className={className}>
			{statusLabels[status]}
		</DotLabel>
	);
}
