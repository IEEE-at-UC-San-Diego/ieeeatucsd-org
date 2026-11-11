import { EventPoints } from "@convex/eventPoints";
import { ArrowRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
	DEPARTMENT_OPTIONS,
	EVENT_TYPE_OPTIONS,
	normalizeDepartment,
	normalizeEventType,
} from "../constants";
import type { EventRequest } from "../types";
import {
	combineDateAndTime,
	formatDateShort,
	formatTimeShort,
	parseFlexibleDate,
	parseFlexibleTime,
} from "../utils/parseTime";

interface DraftEventModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: Partial<EventRequest>) => void;
	initialData?: Partial<EventRequest>;
	onConvertToRequest?: (data: Partial<EventRequest>) => void;
}

const defaultDraftData: Partial<EventRequest> = {
	eventName: "",
	eventDescription: "",
	eventType: "social",
	department: undefined,
	location: "TBD",
	startDate: Date.now() + 86400000,
	endDate: Date.now() + 90000000,
	eventCode: "",
	pointsToReward: EventPoints.DEFAULT,
	status: "draft",
	hasFood: false,
	needsFlyers: false,
	needsGraphics: false,
	needsASFunding: false,
	estimatedAttendance: 0,
	files: [],
	invoices: [],
	willOrHaveRoomBooking: false,
	foodDrinksBeingServed: false,
	asFundingRequired: false,
	photographyNeeded: false,
};

export function DraftEventModal({
	isOpen,
	onClose,
	onSubmit,
	initialData,
	onConvertToRequest,
}: DraftEventModalProps) {
	const formId = useId();
	const isEditing = !!initialData;
	const [formData, setFormData] = useState<Partial<EventRequest>>(
		initialData
			? { ...defaultDraftData, ...initialData }
			: { ...defaultDraftData },
	);

	const [dateText, setDateText] = useState("");
	const [startTimeText, setStartTimeText] = useState("");
	const [endTimeText, setEndTimeText] = useState("");
	const [dateError, setDateError] = useState("");
	const [startTimeError, setStartTimeError] = useState("");
	const [endTimeError, setEndTimeError] = useState("");
	const [isDirty, setIsDirty] = useState(false);
	const confirmDiscard = useUnsavedChangesGuard(isOpen && isDirty);

	const handleClose = async () => {
		if (!(await confirmDiscard())) return;
		setIsDirty(false);
		onClose();
	};

	// Sync when modal opens or initialData changes
	useEffect(() => {
		if (isOpen) {
			const data = initialData
				? {
						...defaultDraftData,
						...initialData,
						eventType: initialData.eventType
							? normalizeEventType(initialData.eventType)
							: defaultDraftData.eventType,
						department: normalizeDepartment(initialData.department),
					}
				: { ...defaultDraftData };
			setFormData(data);
			setDateText(formatDateShort(data.startDate || Date.now()));
			setStartTimeText(formatTimeShort(data.startDate || Date.now()));
			setEndTimeText(formatTimeShort(data.endDate || Date.now() + 3600000));
			setDateError("");
			setStartTimeError("");
			setEndTimeError("");
			setIsDirty(false);
		}
	}, [isOpen, initialData]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (formData.eventName?.trim()) {
			onSubmit({
				...formData,
				eventCode: formData.eventCode || `EVENT-${Date.now()}`,
			});
			if (!isEditing) {
				setFormData({ ...defaultDraftData });
			}
			setIsDirty(false);
			onClose();
		}
	};

	const updateField = (field: keyof EventRequest, value: unknown) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		setIsDirty(true);
	};

	const handleDateBlur = () => {
		setDateError("");
		const parsed = parseFlexibleDate(dateText);
		if (!parsed) {
			if (dateText.trim())
				setDateError("Invalid date. Enter it as mm/dd/yy, e.g., 11/05/26.");
			return;
		}
		const startTime = new Date(formData.startDate || Date.now());
		const endTime = new Date(formData.endDate || Date.now() + 3600000);
		const newStart = combineDateAndTime(parsed, {
			hours: startTime.getHours(),
			minutes: startTime.getMinutes(),
		});
		const newEnd = combineDateAndTime(parsed, {
			hours: endTime.getHours(),
			minutes: endTime.getMinutes(),
		});
		setFormData((prev) => ({ ...prev, startDate: newStart, endDate: newEnd }));
	};

	const handleStartTimeBlur = () => {
		setStartTimeError("");
		const parsed = parseFlexibleTime(startTimeText);
		if (!parsed) {
			if (startTimeText.trim())
				setStartTimeError(
					"Invalid time. Enter a time like 9am, 9:00am, or 14:00.",
				);
			return;
		}
		const newStart = combineDateAndTime(
			formData.startDate || Date.now(),
			parsed,
		);
		setFormData((prev) => ({ ...prev, startDate: newStart }));
		setStartTimeText(formatTimeShort(newStart));
	};

	const handleEndTimeBlur = () => {
		setEndTimeError("");
		const parsed = parseFlexibleTime(endTimeText);
		if (!parsed) {
			if (endTimeText.trim())
				setEndTimeError(
					"Invalid time. Enter a time like 2pm, 2:00pm, or 14:00.",
				);
			return;
		}
		const newEnd = combineDateAndTime(
			formData.endDate || formData.startDate || Date.now(),
			parsed,
		);
		setFormData((prev) => ({ ...prev, endDate: newEnd }));
		setEndTimeText(formatTimeShort(newEnd));
	};

	const footer = (
		<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="w-full sm:w-auto sm:flex-1">
				{isEditing && onConvertToRequest && (
					<Button
						type="button"
						variant="secondary"
						onClick={() => {
							onConvertToRequest({
								...formData,
								eventCode: formData.eventCode || `EVENT-${Date.now()}`,
							});
							setIsDirty(false);
							onClose();
						}}
						className="h-11 w-full sm:h-9 sm:w-auto"
					>
						Convert to Event Request
						<ArrowRight className="h-4 w-4 ml-2" />
					</Button>
				)}
			</div>
			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					className="h-11 flex-1 sm:h-9 sm:flex-none"
					onClick={handleClose}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					form={formId}
					className="h-11 flex-1 sm:h-9 sm:flex-none"
				>
					{isEditing ? "Save Draft" : "Create Draft"}
				</Button>
			</div>
		</div>
	);

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) void handleClose();
			}}
			title={isEditing ? "Edit Draft Event" : "Create Quick Draft"}
			variant="fullscreen"
			className="sm:max-w-2xl"
			footer={footer}
		>
			<form id={formId} onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor={`${formId}-draft-name`}>
						Event Name <span className="text-tone-danger">*</span>
					</Label>
					<Input
						id={`${formId}-draft-name`}
						value={formData.eventName}
						name="eventName"
						autoComplete="off"
						onChange={(e) => updateField("eventName", e.target.value)}
						placeholder="Enter event name…"
						required
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-draft-description`}>Description</Label>
					<Textarea
						id={`${formId}-draft-description`}
						value={formData.eventDescription}
						name="eventDescription"
						autoComplete="off"
						onChange={(e) => updateField("eventDescription", e.target.value)}
						placeholder="Brief description (optional)…"
						rows={3}
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${formId}-draft-type`}>Event Type</Label>
						<Select
							value={formData.eventType || ""}
							onValueChange={(value) => updateField("eventType", value)}
						>
							<SelectTrigger id={`${formId}-draft-type`}>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								{EVENT_TYPE_OPTIONS.map((type) => (
									<SelectItem key={type.value} value={type.value}>
										{type.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${formId}-draft-department`}>Department</Label>
						<Select
							value={formData.department || "none"}
							onValueChange={(value) =>
								updateField("department", value === "none" ? undefined : value)
							}
						>
							<SelectTrigger id={`${formId}-draft-department`}>
								<SelectValue placeholder="Select department" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Unspecified</SelectItem>
								{DEPARTMENT_OPTIONS.map((dept) => (
									<SelectItem key={dept.value} value={dept.value}>
										{dept.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-draft-location`}>Location</Label>
					<Input
						id={`${formId}-draft-location`}
						value={formData.location}
						name="location"
						autoComplete="off"
						onChange={(e) => updateField("location", e.target.value)}
						placeholder="e.g., Price Center East Ballroom"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-draft-date`}>Event Date</Label>
					<Input
						id={`${formId}-draft-date`}
						value={dateText}
						name="eventDate"
						autoComplete="off"
						onChange={(e) => {
							setDateText(e.target.value);
							setIsDirty(true);
						}}
						onBlur={handleDateBlur}
						placeholder="mm/dd/yy"
						aria-invalid={!!dateError}
						aria-describedby={
							dateError ? `${formId}-draft-date-error` : undefined
						}
					/>
					<output
						id={`${formId}-draft-date-error`}
						aria-live="polite"
						className="block text-xs text-tone-danger empty:hidden"
					>
						{dateError}
					</output>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${formId}-draft-start-time`}>Start Time</Label>
						<Input
							id={`${formId}-draft-start-time`}
							value={startTimeText}
							name="startTime"
							autoComplete="off"
							onChange={(e) => {
								setStartTimeText(e.target.value);
								setIsDirty(true);
							}}
							onBlur={handleStartTimeBlur}
							placeholder="e.g., 9am, 9:00 AM"
							aria-invalid={!!startTimeError}
							aria-describedby={
								startTimeError ? `${formId}-draft-start-time-error` : undefined
							}
						/>
						<output
							id={`${formId}-draft-start-time-error`}
							aria-live="polite"
							className="block text-xs text-tone-danger empty:hidden"
						>
							{startTimeError}
						</output>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${formId}-draft-end-time`}>End Time</Label>
						<Input
							id={`${formId}-draft-end-time`}
							value={endTimeText}
							name="endTime"
							autoComplete="off"
							onChange={(e) => {
								setEndTimeText(e.target.value);
								setIsDirty(true);
							}}
							onBlur={handleEndTimeBlur}
							placeholder="e.g., 2pm, 2:00 PM"
							aria-invalid={!!endTimeError}
							aria-describedby={
								endTimeError ? `${formId}-draft-end-time-error` : undefined
							}
						/>
						<output
							id={`${formId}-draft-end-time-error`}
							aria-live="polite"
							className="block text-xs text-tone-danger empty:hidden"
						>
							{endTimeError}
						</output>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${formId}-draft-eventcode`}>Event Code</Label>
						<Input
							id={`${formId}-draft-eventcode`}
							value={formData.eventCode}
							name="eventCode"
							autoComplete="off"
							spellCheck={false}
							translate="no"
							onChange={(e) => updateField("eventCode", e.target.value)}
							placeholder="e.g., TECH-WORKSHOP-2024"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${formId}-draft-attendance`}>
							Expected Attendance
						</Label>
						<Input
							id={`${formId}-draft-attendance`}
							name="estimatedAttendance"
							type="number"
							inputMode="numeric"
							autoComplete="off"
							min={0}
							value={formData.estimatedAttendance || ""}
							onChange={(e) =>
								updateField(
									"estimatedAttendance",
									e.target.value ? parseInt(e.target.value, 10) : 0,
								)
							}
							placeholder="e.g., 50"
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-draft-points`}>Points to Reward</Label>
					<Input
						id={`${formId}-draft-points`}
						name="pointsToReward"
						type="number"
						inputMode="numeric"
						autoComplete="off"
						min={0}
						step={1}
						value={
							Number.isFinite(formData.pointsToReward)
								? formData.pointsToReward
								: 0
						}
						onChange={(e) => {
							const parsed = EventPoints.tryParseInput(e.target.value);
							if (parsed === null) return;
							updateField("pointsToReward", parsed);
						}}
					/>
					<p className="text-xs text-muted-foreground">
						Points awarded to attendees when they check in.
					</p>
				</div>

				<div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
					<p>
						{isEditing
							? "Update your draft event. You can submit it for approval later through the full event request form."
							: "This will create a draft event. You can edit and submit it for approval later through the full event request form."}
					</p>
				</div>
			</form>
		</ResponsiveOverlay>
	);
}
