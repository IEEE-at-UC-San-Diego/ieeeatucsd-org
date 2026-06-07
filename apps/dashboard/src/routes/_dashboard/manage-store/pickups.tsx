import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/manage-store/pickups")({
	component: ManageStorePickupsPage,
});

const DAY_LABELS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

function formatDateTime(ms: number) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Los_Angeles",
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(ms));
}

function minutesToTimeInput(minutes: number) {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeInputToMinutes(value: string) {
	const [hours, minutes] = value.split(":").map(Number);
	return hours * 60 + minutes;
}

function laLocalInputToUtc(date: string, time: string) {
	const [year, month, day] = date.split("-").map(Number);
	const minutes = timeInputToMinutes(time);
	const hour = Math.floor(minutes / 60);
	const minute = minutes % 60;

	const guess = Date.UTC(year, month - 1, day, hour + 8, minute);
	const dateObj = new Date(guess);
	const utcDate = new Date(
		dateObj.toLocaleString("en-US", { timeZone: "UTC" }),
	);
	const laDate = new Date(
		dateObj.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
	);
	const offset = laDate.getTime() - utcDate.getTime();
	return Date.UTC(year, month - 1, day, hour, minute) - offset;
}

function ManageStorePickupsPage() {
	const { hasOfficerAccess, logtoId } = usePermissions();
	const pickupData = useAuthedQuery(
		api.merch.pickups.listPickupOptions,
		logtoId ? { logtoId } : "skip",
	);
	const upcomingEvents = useAuthedQuery(
		api.merch.pickups.listUpcomingEventsForPickup,
		logtoId ? { logtoId } : "skip",
	);

	const enableEventPickup = useAuthedMutation(
		api.merch.pickups.enableEventPickup,
	);
	const createProjectSpaceWindow = useAuthedMutation(
		api.merch.pickups.createProjectSpaceWindow,
	);
	const createRecurringSchedule = useAuthedMutation(
		api.merch.pickups.createRecurringSchedule,
	);
	const closePickupOption = useAuthedMutation(
		api.merch.pickups.closePickupOption,
	);

	const [selectedEventId, setSelectedEventId] = useState<Id<"events"> | "">("");
	const [eventCutoffType, setEventCutoffType] = useState<
		"relative" | "absolute"
	>("relative");
	const [eventCutoffValue, setEventCutoffValue] = useState("24");
	const [eventCapacity, setEventCapacity] = useState("");
	const [eventInstructions, setEventInstructions] = useState("");
	const [eventSaving, setEventSaving] = useState(false);

	const [windowDate, setWindowDate] = useState("");
	const [windowStartTime, setWindowStartTime] = useState("12:00");
	const [windowEndTime, setWindowEndTime] = useState("14:00");
	const [windowInstructions, setWindowInstructions] = useState(
		"Pick up at Project Space during the selected window.",
	);
	const [windowCapacity, setWindowCapacity] = useState("");
	const [windowSaving, setWindowSaving] = useState(false);

	const [scheduleDay, setScheduleDay] = useState("3");
	const [scheduleStartTime, setScheduleStartTime] = useState("12:00");
	const [scheduleEndTime, setScheduleEndTime] = useState("14:00");
	const [scheduleInstructions, setScheduleInstructions] = useState(
		"Weekly Project Space pickup window.",
	);
	const [scheduleCapacity, setScheduleCapacity] = useState("");
	const [scheduleCutoffHours, setScheduleCutoffHours] = useState("24");
	const [scheduleVisibilityWeeks, setScheduleVisibilityWeeks] = useState("4");
	const [scheduleSaving, setScheduleSaving] = useState(false);

	const [closingId, setClosingId] = useState<Id<"merchPickupOptions"> | null>(
		null,
	);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const handleEnableEvent = async () => {
		if (!selectedEventId) {
			toast.error("Select an event.");
			return;
		}
		setEventSaving(true);
		try {
			await enableEventPickup({
				eventId: selectedEventId as Id<"events">,
				enabled: true,
				cutoffType: eventCutoffType,
				cutoffValue: Number(eventCutoffValue),
				capacity: eventCapacity ? Number(eventCapacity) : undefined,
				instructions: eventInstructions.trim() || undefined,
			});
			toast.success("Event pickup enabled.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setEventSaving(false);
		}
	};

	const handleDisableEvent = async (eventId: Id<"events">) => {
		setEventSaving(true);
		try {
			await enableEventPickup({ eventId, enabled: false });
			toast.success("Event pickup disabled.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setEventSaving(false);
		}
	};

	const handleCreateWindow = async () => {
		if (!windowDate || !windowInstructions.trim()) {
			toast.error("Date and instructions are required.");
			return;
		}
		setWindowSaving(true);
		try {
			const windowStart = laLocalInputToUtc(windowDate, windowStartTime);
			const windowEnd = laLocalInputToUtc(windowDate, windowEndTime);
			await createProjectSpaceWindow({
				windowStart,
				windowEnd,
				instructions: windowInstructions.trim(),
				capacity: windowCapacity ? Number(windowCapacity) : undefined,
			});
			toast.success("Project Space window created.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setWindowSaving(false);
		}
	};

	const handleCreateSchedule = async () => {
		if (!scheduleInstructions.trim()) {
			toast.error("Instructions are required.");
			return;
		}
		setScheduleSaving(true);
		try {
			await createRecurringSchedule({
				dayOfWeek: Number(scheduleDay),
				startTimeMinutes: timeInputToMinutes(scheduleStartTime),
				endTimeMinutes: timeInputToMinutes(scheduleEndTime),
				instructions: scheduleInstructions.trim(),
				capacity: scheduleCapacity ? Number(scheduleCapacity) : undefined,
				cutoffHoursBefore: Number(scheduleCutoffHours),
				visibilityWeeks: Number(scheduleVisibilityWeeks),
			});
			toast.success("Recurring schedule created.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setScheduleSaving(false);
		}
	};

	const handleClose = async (pickupOptionId: Id<"merchPickupOptions">) => {
		setClosingId(pickupOptionId);
		try {
			await closePickupOption({ pickupOptionId });
			toast.success("Pickup option closed.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setClosingId(null);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-5xl mx-auto px-5 py-10 space-y-10">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px]">Pickups</h1>
					<p className="text-muted-foreground mt-1">
						Manage event and Project Space merch pickup windows. Times are
						entered in Pacific Time.
					</p>
				</div>

				<section className="rounded-xl border bg-white p-6 space-y-4">
					<h2 className="text-lg font-semibold">Event pickup</h2>
					{upcomingEvents === undefined ? (
						<Skeleton className="h-10 w-full" />
					) : (
						<div className="space-y-3">
							<div className="space-y-2">
								<Label>Upcoming published event</Label>
								<select
									className="w-full rounded-md border px-3 py-2 text-sm"
									value={selectedEventId}
									onChange={(e) => {
										const id = e.target.value as Id<"events"> | "";
										setSelectedEventId(id);
										const event = upcomingEvents.find(
											(item) => item._id === id,
										);
										if (event) {
											setEventCutoffType(event.merchPickupCutoffType);
											setEventCutoffValue(
												String(
													event.merchPickupCutoffAt ??
														(event.merchPickupCutoffType === "absolute"
															? ""
															: 24),
												),
											);
											setEventCapacity(
												event.merchPickupCapacity
													? String(event.merchPickupCapacity)
													: "",
											);
										}
									}}
								>
									<option value="">Choose an event...</option>
									{upcomingEvents.map((event) => (
										<option key={event._id} value={event._id}>
											{event.eventName} — {formatDateTime(event.startDate)}
											{event.merchPickupEnabled ? " (enabled)" : ""}
										</option>
									))}
								</select>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Cutoff type</Label>
									<select
										className="w-full rounded-md border px-3 py-2 text-sm"
										value={eventCutoffType}
										onChange={(e) =>
											setEventCutoffType(
												e.target.value as "relative" | "absolute",
											)
										}
									>
										<option value="relative">
											Relative (hours before start)
										</option>
										<option value="absolute">
											Absolute (UTC ms timestamp)
										</option>
									</select>
								</div>
								<div className="space-y-2">
									<Label>
										{eventCutoffType === "relative"
											? "Hours before event start"
											: "Cutoff UTC timestamp (ms)"}
									</Label>
									<Input
										type="number"
										value={eventCutoffValue}
										onChange={(e) => setEventCutoffValue(e.target.value)}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label>Order capacity (optional)</Label>
								<Input
									type="number"
									placeholder="Unlimited"
									value={eventCapacity}
									onChange={(e) => setEventCapacity(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Instructions (optional)</Label>
								<Textarea
									value={eventInstructions}
									onChange={(e) => setEventInstructions(e.target.value)}
									placeholder="Pick up at the event location during the event."
								/>
							</div>
							<Button onClick={handleEnableEvent} disabled={eventSaving}>
								{eventSaving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Enable event pickup"
								)}
							</Button>
						</div>
					)}
				</section>

				<section className="rounded-xl border bg-white p-6 space-y-4">
					<h2 className="text-lg font-semibold">
						One-time Project Space window
					</h2>
					<div className="grid gap-3 sm:grid-cols-3">
						<div className="space-y-2">
							<Label>Date (Pacific)</Label>
							<Input
								type="date"
								value={windowDate}
								onChange={(e) => setWindowDate(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Start time</Label>
							<Input
								type="time"
								value={windowStartTime}
								onChange={(e) => setWindowStartTime(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>End time</Label>
							<Input
								type="time"
								value={windowEndTime}
								onChange={(e) => setWindowEndTime(e.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label>Instructions</Label>
						<Textarea
							value={windowInstructions}
							onChange={(e) => setWindowInstructions(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label>Order capacity (optional)</Label>
						<Input
							type="number"
							placeholder="Unlimited"
							value={windowCapacity}
							onChange={(e) => setWindowCapacity(e.target.value)}
						/>
					</div>
					<Button onClick={handleCreateWindow} disabled={windowSaving}>
						{windowSaving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Create window"
						)}
					</Button>
				</section>

				<section className="rounded-xl border bg-white p-6 space-y-4">
					<h2 className="text-lg font-semibold">
						Recurring Project Space schedule
					</h2>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="space-y-2">
							<Label>Day of week</Label>
							<select
								className="w-full rounded-md border px-3 py-2 text-sm"
								value={scheduleDay}
								onChange={(e) => setScheduleDay(e.target.value)}
							>
								{DAY_LABELS.map((label, index) => (
									<option key={label} value={String(index)}>
										{label}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<Label>Visibility (weeks ahead)</Label>
							<Input
								type="number"
								value={scheduleVisibilityWeeks}
								onChange={(e) => setScheduleVisibilityWeeks(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Start time</Label>
							<Input
								type="time"
								value={scheduleStartTime}
								onChange={(e) => setScheduleStartTime(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>End time</Label>
							<Input
								type="time"
								value={scheduleEndTime}
								onChange={(e) => setScheduleEndTime(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Cutoff hours before window</Label>
							<Input
								type="number"
								value={scheduleCutoffHours}
								onChange={(e) => setScheduleCutoffHours(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Order capacity (optional)</Label>
							<Input
								type="number"
								placeholder="Unlimited"
								value={scheduleCapacity}
								onChange={(e) => setScheduleCapacity(e.target.value)}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label>Instructions</Label>
						<Textarea
							value={scheduleInstructions}
							onChange={(e) => setScheduleInstructions(e.target.value)}
						/>
					</div>
					<Button onClick={handleCreateSchedule} disabled={scheduleSaving}>
						{scheduleSaving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Create recurring schedule"
						)}
					</Button>
				</section>

				<section className="space-y-4">
					<h2 className="text-lg font-semibold">Active pickup options</h2>
					{pickupData === undefined ? (
						<Skeleton className="h-48 w-full" />
					) : pickupData.options.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No pickup options yet.
						</p>
					) : (
						<ul className="divide-y rounded-xl border bg-white">
							{pickupData.options.map((option) => (
								<li key={option._id} className="px-5 py-4 space-y-2">
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="font-medium">{option.label}</p>
											<p className="text-xs text-muted-foreground capitalize">
												{option.type.replace("_", " ")} ·{" "}
												{formatDateTime(option.windowStart)} –{" "}
												{formatDateTime(option.windowEnd)}
											</p>
											<p className="text-sm mt-1">{option.instructions}</p>
											<p className="text-xs text-muted-foreground mt-1">
												Cutoff: {formatDateTime(option.cutoffAt)} · Orders:{" "}
												{option.orderCount}
												{option.capacity !== undefined
													? ` / ${option.capacity}`
													: ""}
											</p>
										</div>
										<div className="flex flex-col items-end gap-2">
											<Badge
												variant={
													option.status === "active" ? "default" : "secondary"
												}
											>
												{option.status}
											</Badge>
											{option.status === "active" && (
												<Button
													size="sm"
													variant="outline"
													disabled={closingId === option._id}
													onClick={() => handleClose(option._id)}
												>
													{closingId === option._id ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														"Close"
													)}
												</Button>
											)}
											{option.type === "event" && option.eventId && (
												<Button
													size="sm"
													variant="ghost"
													className="text-xs"
													disabled={eventSaving}
													onClick={() =>
														handleDisableEvent(option.eventId as Id<"events">)
													}
												>
													Disable event
												</Button>
											)}
										</div>
									</div>
								</li>
							))}
						</ul>
					)}
				</section>

				{pickupData && pickupData.schedules.length > 0 && (
					<section className="space-y-3">
						<h2 className="text-lg font-semibold">Recurring schedules</h2>
						<ul className="divide-y rounded-xl border bg-white">
							{pickupData.schedules.map((schedule) => (
								<li key={schedule._id} className="px-5 py-4 text-sm">
									<p className="font-medium">
										{DAY_LABELS[schedule.dayOfWeek]} ·{" "}
										{minutesToTimeInput(schedule.startTimeMinutes)} –{" "}
										{minutesToTimeInput(schedule.endTimeMinutes)} PT
									</p>
									<p className="text-muted-foreground">
										{schedule.instructions}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										Cutoff {schedule.cutoffHoursBefore}h before · Visible{" "}
										{schedule.visibilityWeeks} weeks ·{" "}
										{schedule.active ? "Active" : "Inactive"}
									</p>
								</li>
							))}
						</ul>
					</section>
				)}
			</main>
		</div>
	);
}
