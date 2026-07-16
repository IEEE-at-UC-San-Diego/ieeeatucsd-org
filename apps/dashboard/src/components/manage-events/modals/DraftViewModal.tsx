import { format } from "date-fns";
import {
	ArrowRight,
	Calendar,
	FileText,
	MapPin,
	Pencil,
	Trash2,
	User,
	Users,
} from "lucide-react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { formatDepartmentLabel, formatEventTypeLabel } from "../constants";
import { StatusBadge } from "../filters/StatusBadge";
import type { EventRequest } from "../types";

interface DraftViewModalProps {
	isOpen: boolean;
	onClose: () => void;
	event: EventRequest | null;
	onEdit?: (event: EventRequest) => void;
	onDelete?: (event: EventRequest) => void;
	onConvertToRequest?: (event: EventRequest) => void;
}

export function DraftViewModal({
	isOpen,
	onClose,
	event,
	onEdit,
	onDelete,
	onConvertToRequest,
}: DraftViewModalProps) {
	if (!event) return null;

	const formatDate = (timestamp: number) => {
		return format(new Date(timestamp), "MMMM d, yyyy");
	};

	const formatTime = (timestamp: number) => {
		return format(new Date(timestamp), "h:mm a");
	};

	const footer = (
		<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="w-full sm:w-auto sm:flex-1">
				{onConvertToRequest && (
					<Button
						variant="secondary"
						onClick={() => {
							if (onConvertToRequest) onConvertToRequest(event);
						}}
						className="h-11 w-full sm:h-9 sm:w-auto"
					>
						Convert to Event Request
						<ArrowRight className="h-4 w-4 ml-2" />
					</Button>
				)}
			</div>
			<div className="flex gap-2">
				{onEdit && (
					<Button
						variant="outline"
						className="h-11 flex-1 sm:h-9 sm:flex-none"
						onClick={() => onEdit(event)}
					>
						<Pencil className="h-4 w-4 mr-2" />
						Edit
					</Button>
				)}
				{onDelete && (
					<Button
						variant="outline"
						className="h-11 flex-1 sm:h-9 sm:flex-none text-destructive hover:bg-destructive/10 border-destructive/20"
						onClick={() => onDelete(event)}
					>
						<Trash2 className="h-4 w-4 mr-2" />
						Delete
					</Button>
				)}
				<Button onClick={onClose} className="h-11 flex-1 sm:h-9 sm:flex-none">
					Close
				</Button>
			</div>
		</div>
	);

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={event.eventName}
			variant="large-sheet"
			className="sm:max-w-3xl"
			footer={footer}
		>
			<div className="space-y-6">
				<div className="flex items-center gap-2">
					<StatusBadge status={event.status} />
					<span className="text-sm text-muted-foreground border-l pl-2 ml-1">
						{formatEventTypeLabel(event.eventType)}
					</span>
				</div>

				<div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
					<div className="space-y-1">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<Calendar className="h-4 w-4" />
							<span className="text-xs font-semibold uppercase tracking-wider">
								Date & Time
							</span>
						</div>
						<p className="font-medium">{formatDate(event.startDate)}</p>
						<p className="text-sm text-muted-foreground">
							{formatTime(event.startDate)} - {formatTime(event.endDate)}
						</p>
					</div>

					<div className="space-y-1">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<MapPin className="h-4 w-4" />
							<span className="text-xs font-semibold uppercase tracking-wider">
								Location
							</span>
						</div>
						<p className="font-medium">{event.location}</p>
					</div>

					<div className="space-y-1">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<Users className="h-4 w-4" />
							<span className="text-xs font-semibold uppercase tracking-wider">
								Expected Attendees
							</span>
						</div>
						<p className="font-medium">{event.estimatedAttendance || "N/A"}</p>
					</div>

					<div className="space-y-1">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<User className="h-4 w-4" />
							<span className="text-xs font-semibold uppercase tracking-wider">
								Organizer
							</span>
						</div>
						<p className="font-medium truncate" title={event.createdBy}>
							{event.createdBy}
						</p>
						<p className="text-xs text-muted-foreground">
							on {formatDate(event._creationTime)}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-6 pt-4 border-t">
					<div className="space-y-1">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<FileText className="h-4 w-4" />
							<span className="text-xs font-semibold uppercase tracking-wider">
								Event Code
							</span>
						</div>
						<p className="font-mono bg-muted/50 px-2 py-0.5 rounded text-sm w-fit">
							{event.eventCode}
						</p>
					</div>

					{event.department && (
						<div className="space-y-1">
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
								Department
							</span>
							<p className="font-medium">
								{formatDepartmentLabel(event.department)}
							</p>
						</div>
					)}
				</div>

				<div className="pt-4 border-t">
					<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
						Description
					</span>
					<div className="bg-muted/30 p-4 rounded-lg text-sm text-foreground whitespace-pre-wrap leading-relaxed border">
						{event.eventDescription || "No description provided."}
					</div>
				</div>

				<div className="bg-ds-blue-100 border border-ds-blue-100 rounded-md p-4">
					<h4 className="text-sm font-semibold text-ds-blue-1000 mb-2">
						Draft Event
					</h4>
					<p className="text-sm text-ds-blue-700">
						This is a draft event. You can edit the draft details or convert it
						to a full event request with additional requirements like room
						bookings, graphics, and funding.
					</p>
				</div>
			</div>
		</ResponsiveOverlay>
	);
}
