import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	parseFlexibleTime,
	parseFlexibleDate,
	formatDateShort,
	formatTimeShort,
	combineDateAndTime,
} from "../utils/parseTime";
import type { EventRequest } from "../types";
import {
	DEPARTMENT_OPTIONS,
	EVENT_TYPE_OPTIONS,
	normalizeDepartment,
	normalizeEventType,
} from "../constants";

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
			onClose();
		}
	};

	const updateField = (field: keyof EventRequest, value: unknown) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleDateBlur = () => {
		setDateError("");
		const parsed = parseFlexibleDate(dateText);
		if (!parsed) {
			if (dateText.trim()) setDateError("Invalid date. Use mm/dd/yy format.");
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
				setStartTimeError("Invalid time. Try 9am, 9:00am, 14:00, etc.");
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
				setEndTimeError("Invalid time. Try 2pm, 2:00pm, 14:00, etc.");
			return;
		}
		const newEnd = combineDateAndTime(
			formData.endDate || formData.startDate || Date.now(),
			parsed,
		);
		setFormData((prev) => ({ ...prev, endDate: newEnd }));
		setEndTimeText(formatTimeShort(newEnd));
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-2xl overflow-hidden">
				<div className="flex max-h-[90vh] min-h-0 flex-col">
					<DialogHeader className="shrink-0">
						<DialogTitle>
							{isEditing ? "Edit Draft Event" : "Create Quick Draft"}
						</DialogTitle>
					</DialogHeader>

					<form
						onSubmit={handleSubmit}
						className="mt-4 flex min-h-0 flex-1 flex-col"
					>
						<div className="flex-1 space-y-4 overflow-y-auto pr-1">
							<div className="space-y-2">
								<Label htmlFor="draft-name">
									Event Name <span className="text-red-500">*</span>
								</Label>
								<Input
									id="draft-name"
									value={formData.eventName}
									onChange={(e) => updateField("eventName", e.target.value)}
									placeholder="Enter event name"
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="draft-description">Description</Label>
								<Textarea
									id="draft-description"
									value={formData.eventDescription}
									onChange={(e) =>
										updateField("eventDescription", e.target.value)
									}
									placeholder="Brief description (optional)"
									rows={3}
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="draft-type">Event Type</Label>
									<Select
										value={formData.eventType || ""}
										onValueChange={(value) => updateField("eventType", value)}
									>
										<SelectTrigger id="draft-type">
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
									<Label htmlFor="draft-department">Department</Label>
									<Select
										value={formData.department || "none"}
										onValueChange={(value) =>
											updateField(
												"department",
												value === "none" ? undefined : value,
											)
										}
									>
										<SelectTrigger id="draft-department">
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
								<Label htmlFor="draft-location">Location</Label>
								<Input
									id="draft-location"
									value={formData.location}
									onChange={(e) => updateField("location", e.target.value)}
									placeholder="e.g., Price Center East Ballroom"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="draft-date">Event Date</Label>
								<Input
									id="draft-date"
									value={dateText}
									onChange={(e) => setDateText(e.target.value)}
									onBlur={handleDateBlur}
									placeholder="mm/dd/yy"
								/>
								{dateError && (
									<p className="text-xs text-red-500">{dateError}</p>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="draft-start-time">Start Time</Label>
									<Input
										id="draft-start-time"
										value={startTimeText}
										onChange={(e) => setStartTimeText(e.target.value)}
										onBlur={handleStartTimeBlur}
										placeholder="e.g., 9am, 9:00 AM"
									/>
									{startTimeError && (
										<p className="text-xs text-red-500">{startTimeError}</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="draft-end-time">End Time</Label>
									<Input
										id="draft-end-time"
										value={endTimeText}
										onChange={(e) => setEndTimeText(e.target.value)}
										onBlur={handleEndTimeBlur}
										placeholder="e.g., 2pm, 2:00 PM"
									/>
									{endTimeError && (
										<p className="text-xs text-red-500">{endTimeError}</p>
									)}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="draft-eventcode">Event Code</Label>
									<Input
										id="draft-eventcode"
										value={formData.eventCode}
										onChange={(e) => updateField("eventCode", e.target.value)}
										placeholder="e.g., TECH-WORKSHOP-2024"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="draft-attendance">Expected Attendance</Label>
									<Input
										id="draft-attendance"
										type="number"
										min={0}
										value={formData.estimatedAttendance || ""}
										onChange={(e) =>
											updateField(
												"estimatedAttendance",
												e.target.value ? parseInt(e.target.value) : 0,
											)
										}
										placeholder="e.g., 50"
									/>
								</div>
							</div>

							<div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
								<p>
									{isEditing
										? "Update your draft event. You can submit it for approval later through the full event request form."
										: "This will create a draft event. You can edit and submit it for approval later through the full event request form."}
								</p>
							</div>
						</div>

						<DialogFooter className="mt-4 flex shrink-0 flex-col gap-2 sm:flex-row">
							<div className="flex-1">
								{isEditing && onConvertToRequest && (
									<Button
										type="button"
										variant="secondary"
										onClick={() => {
											onConvertToRequest({
												...formData,
												eventCode: formData.eventCode || `EVENT-${Date.now()}`,
											});
											onClose();
										}}
										className="w-full sm:w-auto"
									>
										Convert to Event Request
										<ArrowRight className="h-4 w-4 ml-2" />
									</Button>
								)}
							</div>
							<div className="flex gap-2">
								<Button type="button" variant="outline" onClick={onClose}>
									Cancel
								</Button>
								<Button type="submit">
									{isEditing ? "Save Draft" : "Create Draft"}
								</Button>
							</div>
						</DialogFooter>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
