import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "../types";

interface StatusBadgeProps {
	status: EventStatus;
	className?: string;
}

const statusStyles: Record<EventStatus, string> = {
	draft: "bg-muted text-foreground border-border",
	submitted: "bg-ds-purple-100 text-tone-purple border-ds-purple-100",
	pending: "bg-ds-amber-100 text-tone-warning border-ds-amber-100",
	needs_review: "bg-ds-amber-100 text-tone-warning border-ds-amber-100",
	approved: "bg-ds-green-100 text-tone-success border-ds-green-100",
	declined: "bg-ds-red-100 text-tone-danger border-ds-red-100",
	published: "bg-ds-pink-100 text-tone-pink border-ds-pink-100",
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
		<Badge
			variant="outline"
			className={`text-xs font-medium capitalize ${statusStyles[status]} ${className || ""}`}
		>
			{statusLabels[status]}
		</Badge>
	);
}
