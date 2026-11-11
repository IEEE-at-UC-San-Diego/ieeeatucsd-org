import { EventPoints } from "@convex/eventPoints";
import { AlertTriangle, FileText, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	FileDropTarget,
	pasteShortcutHint,
} from "@/components/ui/file-drop-target";
import { filesForPicker } from "@/components/ui/filesForPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	combineDateAndTime,
	formatDateShort,
	formatTimeShort,
	parseFlexibleDate,
	parseFlexibleTime,
} from "../utils/parseTime";

interface LogisticsSectionProps {
	data: {
		location: string;
		startDate: number;
		endDate: number;
		eventCode: string;
		pointsToReward: number;
		hasFood: boolean;
		willOrHaveRoomBooking: boolean;
		roomBookingFiles: string[];
		foodDrinksBeingServed: boolean;
	};
	onChange: (data: Partial<LogisticsSectionProps["data"]>) => void;
	onUploadRoomBooking?: (files: File[]) => void;
}

export function LogisticsSection({
	data,
	onChange,
	onUploadRoomBooking,
}: LogisticsSectionProps) {
	const [dateText, setDateText] = useState(formatDateShort(data.startDate));
	const [startTimeText, setStartTimeText] = useState(
		formatTimeShort(data.startDate),
	);
	const [endTimeText, setEndTimeText] = useState(formatTimeShort(data.endDate));
	const [dateError, setDateError] = useState("");
	const [startTimeError, setStartTimeError] = useState("");
	const [endTimeError, setEndTimeError] = useState("");
	const confirm = useConfirm();
	const foodQuestionId = useId();
	const formId = useId();
	const roomLock = useRef(false);
	const [roomUploadPending, setRoomUploadPending] = useState(false);
	const [roomPickerMessage, setRoomPickerMessage] = useState<string | null>(
		null,
	);
	const timeRangeError =
		Number.isFinite(data.startDate) &&
		Number.isFinite(data.endDate) &&
		data.endDate <= data.startDate
			? "End time must be after start time."
			: "";

	const handleDateBlur = () => {
		setDateError("");
		const parsed = parseFlexibleDate(dateText);
		if (!parsed) {
			if (dateText.trim()) setDateError("Invalid date. Use mm/dd/yy format.");
			return;
		}
		// Preserve existing times
		const startTime = new Date(data.startDate);
		const endTime = new Date(data.endDate);
		const newStart = combineDateAndTime(parsed, {
			hours: startTime.getHours(),
			minutes: startTime.getMinutes(),
		});
		const newEnd = combineDateAndTime(parsed, {
			hours: endTime.getHours(),
			minutes: endTime.getMinutes(),
		});
		onChange({ startDate: newStart, endDate: newEnd });
	};

	const handleStartTimeBlur = () => {
		setStartTimeError("");
		const parsed = parseFlexibleTime(startTimeText);
		if (!parsed) {
			if (startTimeText.trim())
				setStartTimeError("Invalid time. Try 9am, 9:00am, 14:00, etc.");
			return;
		}
		const newStart = combineDateAndTime(data.startDate, parsed);
		onChange({ startDate: newStart });
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
		const newEnd = combineDateAndTime(data.endDate || data.startDate, parsed);
		onChange({ endDate: newEnd });
		setEndTimeText(formatTimeShort(newEnd));
	};

	const onRoomFiles = (list: FileList | null) => {
		if (roomLock.current || !onUploadRoomBooking) return;
		const decision = filesForPicker(list, {
			accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx",
			multiple: true,
			typeMessage: "Use a PDF, JPG, PNG, DOC, or DOCX file.",
		});
		setRoomPickerMessage(decision.message);
		if (decision.files.length === 0) return;
		roomLock.current = true;
		setRoomUploadPending(true);
		void Promise.resolve()
			.then(() => onUploadRoomBooking(decision.files))
			.finally(() => {
				roomLock.current = false;
				setRoomUploadPending(false);
			});
	};

	const removeRoomBookingFile = async (index: number) => {
		if (
			!(await confirm({
				title: "Remove File?",
				description: "This removes the room booking file from this request.",
				confirmLabel: "Remove File",
				destructive: true,
			}))
		)
			return;
		const updated = data.roomBookingFiles.filter((_, i) => i !== index);
		onChange({ roomBookingFiles: updated });
	};

	return (
		<div className="space-y-6">
			<div className="grid gap-6">
				<div className="space-y-2">
					<Label htmlFor={`${formId}-location`}>
						Location <span className="text-tone-danger">*</span>
					</Label>
					<Input
						id={`${formId}-location`}
						name="location"
						autoComplete="off"
						value={data.location}
						onChange={(e) => onChange({ location: e.target.value })}
						placeholder="e.g., Price Center East Ballroom"
						required
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-eventDate`}>
						Event Date <span className="text-tone-danger">*</span>
					</Label>
					<Input
						id={`${formId}-eventDate`}
						name="eventDate"
						autoComplete="off"
						inputMode="numeric"
						value={dateText}
						onChange={(e) => setDateText(e.target.value)}
						onBlur={handleDateBlur}
						placeholder="mm/dd/yy"
						aria-invalid={dateError ? true : undefined}
					/>
					<output
						aria-live="polite"
						className="block text-xs text-tone-danger empty:hidden"
					>
						{dateError}
					</output>
					<p className="text-xs text-muted-foreground">
						Type in mm/dd/yy format (e.g., 02/14/26)
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${formId}-startTime`}>
							Start Time <span className="text-tone-danger">*</span>
						</Label>
						<Input
							id={`${formId}-startTime`}
							name="startTime"
							autoComplete="off"
							value={startTimeText}
							onChange={(e) => setStartTimeText(e.target.value)}
							onBlur={handleStartTimeBlur}
							placeholder="e.g., 9am, 9:00 AM, 14:00"
							aria-invalid={startTimeError ? true : undefined}
						/>
						<output
							aria-live="polite"
							className="block text-xs text-tone-danger empty:hidden"
						>
							{startTimeError}
						</output>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${formId}-endTime`}>
							End Time <span className="text-tone-danger">*</span>
						</Label>
						<Input
							id={`${formId}-endTime`}
							name="endTime"
							autoComplete="off"
							value={endTimeText}
							onChange={(e) => setEndTimeText(e.target.value)}
							onBlur={handleEndTimeBlur}
							placeholder="e.g., 2pm, 2:00 PM, 17:00"
							aria-invalid={endTimeError || timeRangeError ? true : undefined}
						/>
						<output
							aria-live="polite"
							className="block text-xs text-tone-danger empty:hidden"
						>
							{endTimeError}
						</output>
					</div>
				</div>
				<output
					aria-live="polite"
					className="block text-xs text-tone-danger empty:hidden"
				>
					{timeRangeError}
				</output>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-eventCode`}>
						Event Code <span className="text-tone-danger">*</span>
					</Label>
					<Input
						id={`${formId}-eventCode`}
						name="eventCode"
						autoComplete="off"
						spellCheck={false}
						value={data.eventCode}
						onChange={(e) => onChange({ eventCode: e.target.value })}
						placeholder="e.g., TECH-WORKSHOP-2024"
						required
					/>
					<p className="text-xs text-muted-foreground">
						Used for check-in and tracking attendance.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-pointsToReward`}>Points to Reward</Label>
					<Input
						id={`${formId}-pointsToReward`}
						name="pointsToReward"
						autoComplete="off"
						type="number"
						inputMode="numeric"
						min={0}
						step={1}
						value={
							Number.isFinite(data.pointsToReward) ? data.pointsToReward : 0
						}
						onChange={(e) => {
							const parsed = EventPoints.tryParseInput(e.target.value);
							if (parsed === null) return;
							onChange({ pointsToReward: parsed });
						}}
					/>
					<p className="text-xs text-muted-foreground">
						Points awarded to attendees when they check in.
					</p>
				</div>

				<div className="space-y-4 pt-4 border-t">
					<div className="flex items-start space-x-3">
						<Checkbox
							id={`${formId}-willOrHaveRoomBooking`}
							checked={data.willOrHaveRoomBooking}
							onCheckedChange={(checked) =>
								onChange({ willOrHaveRoomBooking: checked as boolean })
							}
						/>
						<div className="space-y-1">
							<Label
								htmlFor={`${formId}-willOrHaveRoomBooking`}
								className="cursor-pointer"
							>
								Room booking secured or in progress
							</Label>
							<p className="text-xs text-muted-foreground">
								Check this if you have or will have a room booking for this
								event. Room bookings should be secured before submitting.
							</p>
						</div>
					</div>

					{data.willOrHaveRoomBooking && (
						<div className="ml-7 space-y-3 p-4 border rounded-lg bg-muted/50">
							<Label className="text-xs font-medium">Room Booking Files</Label>
							{data.roomBookingFiles.length > 0 && (
								<div className="space-y-2">
									{data.roomBookingFiles.map((file, idx) => {
										const fileName =
											file.split("/").pop()?.split("?")[0] || `File ${idx + 1}`;
										return (
											<div
												key={idx}
												className="flex items-center justify-between p-2 border rounded-lg text-sm"
											>
												<div className="flex min-w-0 items-center gap-2">
													<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
													<span className="truncate max-w-50">{fileName}</span>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0"
													onClick={() => removeRoomBookingFile(idx)}
													aria-label={`Remove ${fileName}`}
												>
													<X className="h-3.5 w-3.5" />
												</Button>
											</div>
										);
									})}
								</div>
							)}
							<FileDropTarget
								disabled={roomUploadPending}
								acceptPaste
								onFiles={onRoomFiles}
								className="rounded-lg"
							>
								<label className="flex min-h-11 items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-ds-blue-600 hover:bg-ds-blue-100/50 transition-[background-color,border-color,opacity] duration-150 ease-[ease] motion-reduce:transition-none">
									<Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
									<span className="text-center text-sm text-muted-foreground">
										Upload room booking confirmation, or drop files here
										<span className="mt-1 block text-xs">
											{pasteShortcutHint}
										</span>
									</span>
									<input
										type="file"
										name="roomBookingFiles"
										aria-label="Room booking files"
										accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
										multiple
										disabled={roomUploadPending}
										className="sr-only"
										onChange={(e) => {
											onRoomFiles(e.target.files);
											e.target.value = "";
										}}
									/>
								</label>
							</FileDropTarget>
							{roomPickerMessage && (
								<output
									aria-live="polite"
									className="block text-xs text-tone-warning"
								>
									{roomPickerMessage}
								</output>
							)}
							{roomUploadPending && (
								<output
									aria-live="polite"
									className="block text-xs text-muted-foreground"
								>
									Uploading room booking files…
								</output>
							)}
						</div>
					)}

					<div className="space-y-3 pt-2">
						<Label id={foodQuestionId} className="text-sm font-medium">
							Will you be serving food or drinks at this event?{" "}
							<span className="text-tone-danger">*</span>
						</Label>
						<RadioGroup
							name="foodDrinksBeingServed"
							aria-labelledby={foodQuestionId}
							value={data.foodDrinksBeingServed ? "yes" : "no"}
							onValueChange={(val) => {
								const isYes = val === "yes";
								onChange({ foodDrinksBeingServed: isYes, hasFood: isYes });
							}}
							className="space-y-2"
						>
							<div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted transition-colors">
								<RadioGroupItem value="yes" id={`${formId}-food-yes`} />
								<Label
									htmlFor={`${formId}-food-yes`}
									className="cursor-pointer flex-1"
								>
									Yes, we will serve food or drinks
								</Label>
							</div>
							<div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted transition-colors">
								<RadioGroupItem value="no" id={`${formId}-food-no`} />
								<Label
									htmlFor={`${formId}-food-no`}
									className="cursor-pointer flex-1"
								>
									No food or drinks will be served
								</Label>
							</div>
						</RadioGroup>
						{data.foodDrinksBeingServed && (
							<div className="bg-ds-amber-100 border border-ds-amber-100 rounded-lg p-3">
								<div className="flex items-start gap-2">
									<AlertTriangle className="h-4 w-4 text-tone-warning mt-0.5 shrink-0" />
									<p className="text-xs text-tone-warning">
										<strong>Important:</strong> If serving food/drinks, you may
										need AS funding and must follow university guidelines. All
										food must be from approved AS vendors. Home-cooked food is
										not permitted unless approved by VC Operations.
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
