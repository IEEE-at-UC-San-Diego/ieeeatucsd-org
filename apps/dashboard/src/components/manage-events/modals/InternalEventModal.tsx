import {
	Calendar,
	Heart,
	MapPin,
	MoreHorizontal,
	PartyPopper,
	Presentation,
	Trash2,
	Users,
	Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InternalEventType =
	| "meeting"
	| "tabling"
	| "workshop"
	| "social"
	| "outreach"
	| "other";

interface InternalEvent {
	_id: string;
	_creationTime: number;
	name: string;
	description?: string;
	location: string;
	startDate: number;
	endDate: number;
	eventType: InternalEventType;
	createdBy: string;
	createdAt: number;
	updatedAt?: number;
	updatedBy?: string;
}

interface InternalEventModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: {
		name: string;
		description?: string;
		location: string;
		startDate: number;
		endDate: number;
		eventType: InternalEventType;
	}) => Promise<void>;
	onDelete?: (event: InternalEvent) => Promise<void>;
	editingEvent?: InternalEvent | null;
	initialDate?: Date | null;
}

const EVENT_TYPES: Array<{
	value: InternalEventType;
	label: string;
	icon: React.ElementType;
	color: string;
	description: string;
}> = [
	{
		value: "meeting",
		label: "Meeting",
		icon: Users,
		color:
			"bg-ds-blue-100 text-ds-blue-700 border-ds-blue-100 hover:bg-ds-blue-100",
		description: "Team meetings, planning sessions",
	},
	{
		value: "tabling",
		label: "Tabling",
		icon: Presentation,
		color:
			"bg-ds-green-100 text-ds-green-700 border-ds-green-100 hover:bg-ds-green-100",
		description: "Recruitment, info booths",
	},
	{
		value: "workshop",
		label: "Workshop",
		icon: Wrench,
		color:
			"bg-ds-amber-100 text-ds-amber-900 border-ds-amber-100 hover:bg-ds-amber-100",
		description: "Technical workshops, tutorials",
	},
	{
		value: "social",
		label: "Social",
		icon: PartyPopper,
		color:
			"bg-ds-pink-100 text-ds-pink-700 border-ds-pink-100 hover:bg-ds-blue-100",
		description: "Social events, hangouts",
	},
	{
		value: "outreach",
		label: "Outreach",
		icon: Heart,
		color:
			"bg-ds-red-100 text-ds-red-800 border-ds-red-100 hover:bg-ds-red-200",
		description: "Community service, outreach",
	},
	{
		value: "other",
		label: "Other",
		icon: MoreHorizontal,
		color: "bg-muted text-muted-foreground border-border hover:bg-muted",
		description: "Miscellaneous events",
	},
];

const defaultFormData = {
	name: "",
	description: "",
	location: "",
	startDate: "",
	startTime: "",
	endDate: "",
	endTime: "",
	eventType: "meeting" as InternalEventType,
};

function formatDateForInput(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function InternalEventModal({
	isOpen,
	onClose,
	onSubmit,
	onDelete,
	editingEvent,
	initialDate,
}: InternalEventModalProps) {
	const [formData, setFormData] = useState(defaultFormData);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		if (isOpen) {
			if (editingEvent) {
				const startDate = new Date(editingEvent.startDate);
				const endDate = new Date(editingEvent.endDate);
				setFormData({
					name: editingEvent.name,
					description: editingEvent.description || "",
					location: editingEvent.location,
					startDate: startDate.toISOString().split("T")[0],
					startTime: startDate.toTimeString().slice(0, 5),
					endDate: endDate.toISOString().split("T")[0],
					endTime: endDate.toTimeString().slice(0, 5),
					eventType: editingEvent.eventType,
				});
			} else {
				const selectedDate = initialDate ?? new Date();
				const dateString = formatDateForInput(selectedDate);
				setFormData({
					...defaultFormData,
					startDate: dateString,
					endDate: dateString,
				});
			}
		}
	}, [isOpen, editingEvent, initialDate]);

	const handleSubmit = async () => {
		if (
			!formData.name ||
			!formData.location ||
			!formData.startDate ||
			!formData.startTime ||
			!formData.endDate ||
			!formData.endTime
		) {
			return;
		}

		const startDateTime = new Date(
			`${formData.startDate}T${formData.startTime}`,
		).getTime();
		const endDateTime = new Date(
			`${formData.endDate}T${formData.endTime}`,
		).getTime();

		if (endDateTime <= startDateTime) {
			return;
		}

		setIsSubmitting(true);
		try {
			await onSubmit({
				name: formData.name,
				description: formData.description || undefined,
				location: formData.location,
				startDate: startDateTime,
				endDate: endDateTime,
				eventType: formData.eventType,
			});
			onClose();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!editingEvent || !onDelete) return;
		setIsDeleting(true);
		try {
			await onDelete(editingEvent);
			onClose();
		} finally {
			setIsDeleting(false);
		}
	};

	const footer = (
		<div className="flex w-full items-center justify-end gap-2">
			{editingEvent && onDelete && (
				<Button
					variant="ghost"
					onClick={handleDelete}
					disabled={isDeleting || isSubmitting}
					className="text-ds-red-800 hover:text-ds-red-800 hover:bg-ds-red-100 mr-auto h-11 px-2 sm:h-8"
				>
					{isDeleting ? (
						<span className="flex items-center gap-1.5 text-sm">
							<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ds-red-800 border-t-transparent" />
							Deleting...
						</span>
					) : (
						<span className="flex items-center gap-1.5 text-sm">
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</span>
					)}
				</Button>
			)}
			<Button
				variant="outline"
				onClick={onClose}
				disabled={isSubmitting || isDeleting}
				className="h-11 flex-1 sm:h-8 sm:flex-none"
			>
				Cancel
			</Button>
			<Button
				onClick={handleSubmit}
				disabled={
					isSubmitting ||
					isDeleting ||
					!formData.name ||
					!formData.location ||
					!formData.startDate ||
					!formData.startTime
				}
				className="bg-[#00629B] hover:bg-[#004d7a] h-11 flex-1 px-4 sm:h-8 sm:flex-none"
			>
				{isSubmitting ? (
					<span className="flex items-center gap-1.5 text-sm">
						<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
						Saving...
					</span>
				) : editingEvent ? (
					"Update"
				) : (
					"Create"
				)}
			</Button>
		</div>
	);

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={onClose}
			title={editingEvent ? "Edit Event" : "New Internal Event"}
			variant="fullscreen"
			className="sm:max-w-[700px]"
			footer={footer}
		>
			<div className="space-y-3">
				{/* Event Name */}
				<div className="space-y-1.5">
					<Label
						htmlFor="name"
						className="text-xs font-medium text-muted-foreground"
					>
						Name
					</Label>
					<Input
						id="name"
						value={formData.name}
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						placeholder="Weekly Team Meeting"
						className="h-9 text-sm"
					/>
				</div>

				{/* Event Type - 6 columns compact */}
				<div className="space-y-1.5">
					<Label className="text-xs font-medium text-muted-foreground">
						Type
					</Label>
					<div className="grid grid-cols-6 gap-1">
						{EVENT_TYPES.map((type) => {
							const Icon = type.icon;
							const isSelected = formData.eventType === type.value;
							return (
								<Button
									variant="outline"
									key={type.value}
									type="button"
									onClick={() =>
										setFormData({ ...formData, eventType: type.value })
									}
									className={cn(
										"flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md border transition-[background-color,border-color,color] duration-150 ease-[ease]",
										isSelected
											? type.color
											: "bg-background border-border hover:border-border text-muted-foreground",
									)}
									title={type.label}
								>
									<Icon className="h-4 w-4" />
									<span className="text-[10px] font-medium leading-none">
										{type.label}
									</span>
								</Button>
							);
						})}
					</div>
				</div>

				{/* Location */}
				<div className="space-y-1.5">
					<Label
						htmlFor="location"
						className="text-xs font-medium text-muted-foreground"
					>
						Location
					</Label>
					<div className="relative">
						<MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							id="location"
							value={formData.location}
							onChange={(e) =>
								setFormData({ ...formData, location: e.target.value })
							}
							placeholder="EBU-1 Room 101"
							className="h-9 pl-8 text-sm"
						/>
					</div>
				</div>

				{/* Date & Time - Compact inline */}
				<div className="space-y-1.5">
					<Label className="text-xs font-medium text-muted-foreground">
						Date & Time
					</Label>
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative flex-1">
							<Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
							<Input
								type="date"
								value={formData.startDate}
								onChange={(e) =>
									setFormData({
										...formData,
										startDate: e.target.value,
										endDate: e.target.value,
									})
								}
								className="h-9 pl-8 text-sm"
							/>
						</div>
						<Input
							type="time"
							value={formData.startTime}
							onChange={(e) =>
								setFormData({ ...formData, startTime: e.target.value })
							}
							className="h-9 w-36 min-w-[8.5rem] text-sm"
						/>
						<span className="text-muted-foreground text-sm shrink-0">→</span>
						<Input
							type="time"
							value={formData.endTime}
							onChange={(e) =>
								setFormData({ ...formData, endTime: e.target.value })
							}
							className="h-9 w-36 min-w-[8.5rem] text-sm"
						/>
					</div>
				</div>

				{/* Description - Smaller */}
				<div className="space-y-1.5">
					<Label
						htmlFor="description"
						className="text-xs font-medium text-muted-foreground"
					>
						Notes <span className="font-normal">(optional)</span>
					</Label>
					<Textarea
						id="description"
						value={formData.description}
						onChange={(e) =>
							setFormData({ ...formData, description: e.target.value })
						}
						placeholder="Additional details..."
						rows={1}
						className="resize-none h-9 text-sm py-2"
					/>
				</div>
			</div>
		</ResponsiveOverlay>
	);
}
