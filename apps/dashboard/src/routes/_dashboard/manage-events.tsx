import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	Calendar as CalendarIcon,
	ClipboardList,
	FilePlus,
	List,
	Loader2,
	MoreHorizontal,
	Plus,
} from "lucide-react";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import {
	DraftEventModal,
	DraftViewModal,
	EventCalendar,
	type EventFilters,
	type EventFormData,
	type EventRequest,
	EventRequestWizardModal,
	type EventStatus,
	EventsDataTable,
	EventsFilters,
	EventViewModal,
	type SortConfig,
	type VcoPipelinePatch,
	VcoPipelineView,
} from "@/components/manage-events";
import { EventRequestMapping } from "@/components/manage-events/EventRequestMapping";
import {
	defaultWeekLabelSettings,
	getWeekLabelForDate,
	loadWeekLabelSettings,
	saveWeekLabelSettings,
	type WeekLabelSettings,
} from "@/components/manage-events/utils/weekLabels";
import { ResponsiveOverlay, useMobileShell } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import {
	type DeclineDialog,
	declineDialogClosed,
	isImmersiveSurface,
	noSurface,
	type PendingAction,
	transitionDeclineDialog,
	transitionSurface,
} from "@/lib/manage-events/manageEventsSurface";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";
import { sendNotification } from "@/lib/send-notification";

const searchSchema = z.object({
	view: z.enum(["list", "calendar", "vco"]).catch("list"),
	q: z.string().catch(""),
	statuses: z
		.array(
			z.enum([
				"draft",
				"submitted",
				"pending",
				"needs_review",
				"approved",
				"declined",
				"published",
			]),
		)
		.catch([]),
	team: z
		.enum(["for_events", "for_internal", "for_operations"])
		.optional()
		.catch(undefined),
	sort: z.enum(["eventName", "status", "startDate"]).catch("startDate"),
	dir: z.enum(["asc", "desc"]).catch("desc"),
	page: z.number().int().min(1).catch(1),
	vq: z.string().catch(""),
	flagged: z.boolean().catch(false),
	quarter: z.boolean().catch(false),
});

type ManageEventsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_dashboard/manage-events")({
	validateSearch: searchSchema,
	loader: (ctx) => prefetchAuthedQuery(api.events.listAll, undefined, ctx),
	component: ManageEventsPage,
});

function ManageEventsPage() {
	const formId = useId();
	const {
		hasOfficerAccess,
		hasAdminAccess,
		canViewVcoPipeline,
		logtoId,
		user,
		getAuthHeaders,
		isLoading,
	} = usePermissions();
	const isMobile = useIsMobile();
	const { setHideTabBar } = useMobileShell();
	const aiEnabled = user?.aiFeaturesEnabled !== false;
	const confirmAction = useConfirm();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const setSearch = (patch: Partial<ManageEventsSearch>) =>
		navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

	// Single unified query — events and eventRequests are now one table
	const eventsData = useAuthedQuery(
		api.events.listAll,
		logtoId ? { logtoId } : "skip",
	);
	const cachedEventsDataRef = useRef<{
		logtoId: string;
		events: NonNullable<typeof eventsData>;
	} | null>(null);

	if (eventsData !== undefined && logtoId) {
		cachedEventsDataRef.current = {
			logtoId,
			events: eventsData,
		};
	}

	// A refreshed auth token briefly creates a new Convex subscription. Keep the
	// resolved data mounted during that handoff so calendar and modal state survive.
	const stableEventsData =
		eventsData ??
		(cachedEventsDataRef.current?.logtoId === logtoId
			? cachedEventsDataRef.current.events
			: undefined);

	// Convex mutations (all unified under api.events)
	const createEvent = useAuthedMutation(api.events.create);
	const updateEvent = useAuthedMutation(api.events.update);
	const updateVcoPipeline = useAuthedMutation(api.events.updateVcoPipeline);
	const updateEventStatus = useAuthedMutation(api.events.updateStatus);
	const removeEvent = useAuthedMutation(api.events.remove);
	const updateWeekLabelSettingsMutation = useAuthedMutation(
		api.weekLabelSettings.update,
	);
	const convexWeekLabelSettings = useAuthedQuery(
		api.weekLabelSettings.get,
		logtoId ? { logtoId } : "skip",
	);

	const viewMode = search.view;
	const filters: EventFilters = useMemo(
		() => ({
			search: search.q,
			statuses: search.statuses,
			teamPreset: search.team,
		}),
		[search.q, search.statuses, search.team],
	);
	const sortConfig: SortConfig = { field: search.sort, direction: search.dir };
	const itemsPerPage = 10;

	const [surface, dispatchSurface] = useReducer(transitionSurface, noSurface);
	const wizardTarget = surface.kind === "wizard" ? surface.target : null;
	const editingRequest =
		wizardTarget?.type === "existing" ? wizardTarget.request : null;
	const wizardInitialData =
		wizardTarget?.type === "existing"
			? wizardTarget.request
			: wizardTarget?.prefill;
	const editingDraft = surface.kind === "draftEdit" ? surface.draft : null;
	const draftInitialData = useMemo((): Partial<EventRequest> | undefined => {
		if (surface.kind === "draftEdit") return surface.draft;
		if (surface.kind === "draftCreate" && surface.date) {
			return {
				startDate: surface.date.getTime(),
				endDate: surface.date.getTime() + 3600000,
			};
		}
		return undefined;
	}, [surface]);
	const [weekLabelSettings, setWeekLabelSettings] = useState<WeekLabelSettings>(
		() => loadWeekLabelSettings(),
	);
	const hasHydratedWeekSettings = useRef(false);

	const [pendingAction, setPendingAction] = useState<PendingAction | null>(
		null,
	);
	const beginPendingAction = (action: PendingAction) => {
		setPendingAction(action);
		return () =>
			setPendingAction((current) => (current === action ? null : current));
	};

	const [declineDialog, setDeclineDialog] =
		useState<DeclineDialog>(declineDialogClosed);
	const decliningEvent =
		declineDialog.status === "closed" ? null : declineDialog.event;
	const isDeclining = declineDialog.status === "submitting";
	const declineError =
		declineDialog.status === "open" ? (declineDialog.error ?? "") : "";

	const immersive = isImmersiveSurface(surface);
	useEffect(() => {
		setHideTabBar(immersive);
		return () => setHideTabBar(false);
	}, [immersive, setHideTabBar]);

	useEffect(() => {
		if (!convexWeekLabelSettings || hasHydratedWeekSettings.current) return;
		hasHydratedWeekSettings.current = true;

		const convexHasValues = Object.values(convexWeekLabelSettings).some(
			Boolean,
		);
		if (convexHasValues) {
			setWeekLabelSettings(convexWeekLabelSettings);
			saveWeekLabelSettings(convexWeekLabelSettings);
			return;
		}

		const localSettings = loadWeekLabelSettings();
		const localHasValues = Object.values(localSettings).some(Boolean);
		if (localHasValues) {
			setWeekLabelSettings(localSettings);
			void updateWeekLabelSettingsMutation(localSettings);
			return;
		}

		setWeekLabelSettings(defaultWeekLabelSettings);
	}, [convexWeekLabelSettings, updateWeekLabelSettingsMutation]);

	// Transform data to EventRequest type — single query, no merge needed
	const allEvents: EventRequest[] = useMemo(() => {
		return (stableEventsData || []).map((event) =>
			EventRequestMapping.fromDocument(event as Record<string, unknown>),
		);
	}, [stableEventsData]);

	// Filter events
	const filteredEvents = useMemo(() => {
		return allEvents.filter((event) => {
			// Search filter
			const searchMatch =
				!filters.search ||
				event.eventName.toLowerCase().includes(filters.search.toLowerCase()) ||
				event.eventDescription
					.toLowerCase()
					.includes(filters.search.toLowerCase()) ||
				event.location.toLowerCase().includes(filters.search.toLowerCase());

			// Status multi-select filter
			const statusMatch =
				!filters.statuses || filters.statuses.length === 0
					? true
					: filters.statuses.includes(event.status);

			// Team presets
			let teamPresetMatch = true;
			if (filters.teamPreset === "for_internal") {
				const hasMarketingNeed = Boolean(
					event.needsGraphics || event.needsFlyers || event.photographyNeeded,
				);
				teamPresetMatch =
					(event.status === "approved" || event.status === "published") &&
					hasMarketingNeed;
			} else if (filters.teamPreset === "for_operations") {
				teamPresetMatch = ["submitted", "pending", "needs_review"].includes(
					event.status,
				);
			}

			return searchMatch && statusMatch && teamPresetMatch;
		});
	}, [allEvents, filters]);

	// Sort events
	const sortedEvents = useMemo(() => {
		return [...filteredEvents].sort((a, b) => {
			const aValue = a[sortConfig.field as keyof EventRequest];
			const bValue = b[sortConfig.field as keyof EventRequest];

			if (
				aValue === undefined ||
				aValue === null ||
				bValue === undefined ||
				bValue === null
			)
				return 0;

			const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
			return sortConfig.direction === "asc" ? comparison : -comparison;
		});
	}, [filteredEvents, sortConfig.field, sortConfig.direction]);

	// Pagination
	const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);
	const currentPage = Math.min(search.page, Math.max(totalPages, 1));
	const paginatedEvents = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		return sortedEvents.slice(startIndex, startIndex + itemsPerPage);
	}, [sortedEvents, currentPage]);

	// Loading state
	if (isLoading) {
		return (
			<output
				aria-live="polite"
				className="flex items-center justify-center min-h-[60vh]"
			>
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<span className="sr-only">Loading…</span>
			</output>
		);
	}

	// Permission check
	if (!hasOfficerAccess) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don’t have permission to access this page. Ask an administrator for
				officer access.
			</div>
		);
	}

	// Sort handler
	const handleSort = (field: string) => {
		const nextField = searchSchema.shape.sort.parse(field);
		setSearch({
			sort: nextField,
			dir: search.sort === nextField && search.dir === "asc" ? "desc" : "asc",
		});
	};

	// Create event handler
	const handleCreateRequest = async (data: EventFormData) => {
		if (!logtoId) return;
		const endPendingAction = beginPendingAction("createRequest");
		try {
			await createEvent(EventRequestMapping.toCreateArgs(logtoId, data));
			toast.success("Event request submitted successfully!");

			// Fire-and-forget email notification
			if (logtoId) {
				sendNotification(getAuthHeaders(), "event_request_submitted", {
					eventRequestId: "(new)",
					name: data.eventName,
					location: data.location,
					startDateTime: data.startDate,
					endDateTime: data.endDate,
					eventDescription: data.eventDescription,
					department: data.department,
					expectedAttendance: data.estimatedAttendance,
					needsGraphics: data.needsGraphics,
					needsAsFunding: data.needsASFunding,
					flyersNeeded: data.needsFlyers,
					photographyNeeded: data.photographyNeeded,
					submitterName: user?.name || "Unknown",
					submitterEmail: user?.email || "",
				});
			}
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to submit event request. Check your connection and try again.",
			);
			throw error;
		} finally {
			endPendingAction();
		}
	};

	const handleSaveRequest = async (data: EventFormData) => {
		if (!logtoId || !editingRequest) return;
		const endPendingAction = beginPendingAction("saveRequest");
		try {
			await updateEvent(
				EventRequestMapping.toUpdateArgs(logtoId, editingRequest._id, data),
			);
			toast.success("Event saved successfully!");
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to save event. Check your connection and try again.",
			);
			throw error;
		} finally {
			endPendingAction();
		}
	};

	// Update event handler
	const handleUpdateRequest = async (data: EventFormData) => {
		if (!logtoId || !editingRequest) return;
		const endPendingAction = beginPendingAction("updateRequest");
		try {
			const convertingDraft = editingRequest.status === "draft";
			const eventId = editingRequest._id as any;

			await updateEvent(
				EventRequestMapping.toUpdateArgs(logtoId, editingRequest._id, data),
			);

			if (convertingDraft) {
				await updateEventStatus({
					logtoId,
					id: eventId,
					status: "submitted",
				});
				toast.success("Event request submitted successfully!");

				sendNotification(getAuthHeaders(), "event_request_submitted", {
					eventRequestId: editingRequest._id,
					name: data.eventName,
					location: data.location,
					startDateTime: data.startDate,
					endDateTime: data.endDate,
					eventDescription: data.eventDescription,
					department: data.department,
					expectedAttendance: data.estimatedAttendance,
					needsGraphics: data.needsGraphics,
					needsAsFunding: data.needsASFunding,
					flyersNeeded: data.needsFlyers,
					photographyNeeded: data.photographyNeeded,
					submitterName: user?.name || "Unknown",
					submitterEmail: user?.email || "",
				});
			} else {
				toast.success("Event updated successfully!");
			}
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update event. Check your connection and try again.",
			);
			throw error;
		} finally {
			endPendingAction();
		}
	};

	// Delete handler
	const handleDelete = async (event: EventRequest) => {
		if (!logtoId) return;
		if (
			!(await confirmAction({
				title: "Delete Event?",
				description: `“${event.eventName}” will be permanently deleted. This can’t be undone.`,
				confirmLabel: "Delete Event",
				destructive: true,
			}))
		)
			return;
		const endPendingAction = beginPendingAction("delete");
		try {
			await removeEvent({
				logtoId,
				id: event._id as any,
			});
			toast.success("Event deleted successfully!");
			dispatchSurface({ type: "eventDismissed", eventId: event._id });
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to delete event. Check your connection and try again.",
			);
		} finally {
			endPendingAction();
		}
	};

	// Convert to draft handler
	const handleConvertToDraft = async (event: EventRequest) => {
		if (!logtoId) return;
		const endPendingAction = beginPendingAction("convertToDraft");
		try {
			await updateEventStatus({
				logtoId,
				id: event._id as any,
				status: "draft",
			});
			toast.success("Event converted to draft!");
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to convert to draft. Check your connection and try again.",
			);
		} finally {
			endPendingAction();
		}
	};

	// Decline handler
	const handleDecline = (event: EventRequest) => {
		if (!logtoId) return;
		setDeclineDialog((current) =>
			transitionDeclineDialog(current, { type: "open", event }),
		);
	};

	const closeDeclineDialog = () => {
		setDeclineDialog((current) =>
			transitionDeclineDialog(current, { type: "close" }),
		);
	};

	const submitDecline = async () => {
		if (!logtoId) return;
		const next = transitionDeclineDialog(declineDialog, { type: "submit" });
		setDeclineDialog(next);
		if (next.status !== "submitting") return;
		const { event, reason } = next;
		try {
			await updateEventStatus({
				logtoId,
				id: event._id as any,
				status: "declined",
				declinedReason: reason,
			});
			toast.success("Event declined");

			sendNotification(getAuthHeaders(), "event_request_status_changed", {
				eventRequestId: event._id,
				name: event.eventName,
				location: event.location,
				startDateTime: event.startDate,
				newStatus: "declined",
				previousStatus: event.status,
				declinedReason: reason,
				changedByName: user?.name || "Admin",
				requestedUser: event.requestedUser,
			});

			setDeclineDialog((current) =>
				transitionDeclineDialog(current, { type: "succeeded" }),
			);
			dispatchSurface({ type: "eventDismissed", eventId: event._id });
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to decline event. Check your connection and try again.",
			);
			setDeclineDialog((current) =>
				transitionDeclineDialog(current, { type: "failed" }),
			);
		}
	};

	// Status change handler (from EventViewModal dropdown)
	const handleStatusChange = async (
		event: EventRequest,
		newStatus: EventStatus,
	) => {
		if (!logtoId) return;
		if (newStatus === "declined") {
			handleDecline(event);
			return;
		}
		const endPendingAction = beginPendingAction("statusChange");
		try {
			const eventId = event._id as any;

			await updateEventStatus({
				logtoId,
				id: eventId,
				status:
					newStatus === "published"
						? "completed"
						: newStatus === "needs_review"
							? "needs_review"
							: (newStatus as any),
			});

			toast.success(`Status updated to ${newStatus.replace("_", " ")}`);

			sendNotification(getAuthHeaders(), "event_request_status_changed", {
				eventRequestId: event._id,
				name: event.eventName,
				location: event.location,
				startDateTime: event.startDate,
				newStatus,
				previousStatus: event.status,
				changedByName: user?.name || "Admin",
				requestedUser: event.requestedUser,
			});

			// Update local state so the modal reflects the change
			dispatchSurface({
				type: "patchEvent",
				eventId: event._id,
				patch: { status: newStatus },
			});
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update status. Check your connection and try again.",
			);
		} finally {
			endPendingAction();
		}
	};

	// Toggle publish handler
	const handleTogglePublish = async (
		event: EventRequest,
		shouldPublish: boolean,
	) => {
		if (!logtoId) return;
		const endPendingAction = beginPendingAction("togglePublish");
		try {
			await updateEventStatus({
				logtoId,
				id: event._id as any,
				status: shouldPublish ? "completed" : "approved",
			});
			toast.success(shouldPublish ? "Event published!" : "Event unpublished");
			dispatchSurface({
				type: "patchEvent",
				eventId: event._id,
				patch: { status: shouldPublish ? "published" : "approved" },
			});
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to toggle publish. Check your connection and try again.",
			);
		} finally {
			endPendingAction();
		}
	};

	const handleUpdateGraphics = async (
		event: EventRequest,
		updates: { flyersCompleted: boolean; graphicsUploadNote?: string },
	) => {
		if (!logtoId) return;
		const endPendingAction = beginPendingAction("updateGraphics");
		try {
			await updateEvent({
				logtoId,
				id: event._id as any,
				flyersCompleted: updates.flyersCompleted,
				graphicsUploadNote: updates.graphicsUploadNote,
			});
			dispatchSurface({
				type: "patchEvent",
				eventId: event._id,
				patch: updates,
			});
			toast.success("Graphics status updated");
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update graphics status. Check your connection and try again.",
			);
		} finally {
			endPendingAction();
		}
	};

	// Create draft handler
	const handleCreateDraft = async (data: Partial<EventRequest>) => {
		if (!logtoId) return;
		const endPendingAction = beginPendingAction("createDraft");
		try {
			await createEvent(EventRequestMapping.toDraftCreateArgs(logtoId, data));
			toast.success("Draft event created!");
			dispatchSurface({ type: "close", kind: "draftCreate" });
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to create draft. Check your connection and try again.",
			);
		} finally {
			endPendingAction();
		}
	};

	const viewEvent = (event: EventRequest) => {
		dispatchSurface({ type: "view", event });
	};

	const editEvent = (event: EventRequest) => {
		dispatchSurface({ type: "edit", event });
	};

	// Update draft handler
	const handleUpdateDraft = async (data: Partial<EventRequest>) => {
		if (!logtoId || !editingDraft) return;
		const endPendingAction = beginPendingAction("updateDraft");
		try {
			const eventId = editingDraft._id as any;
			await updateEvent(
				EventRequestMapping.toDraftUpdateArgs(
					logtoId,
					eventId,
					data,
					editingDraft,
				),
			);
			toast.success("Draft updated successfully!");
			dispatchSurface({ type: "close", kind: "draftEdit" });
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update draft. Check your connection and try again.",
			);
		} finally {
			endPendingAction();
		}
	};

	// Clear filters handler
	const handleVcoPipelineChange = async (
		event: EventRequest,
		patch: VcoPipelinePatch,
	) => {
		if (!logtoId) return;
		try {
			await updateVcoPipeline({
				logtoId,
				id: event._id as never,
				...patch,
			});
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update pipeline fields. Check your connection and try again.",
			);
		}
	};

	const handleFiltersChange = (next: EventFilters) => {
		setSearch({
			q: next.search,
			statuses: next.statuses ?? [],
			team: next.teamPreset,
			page: 1,
		});
	};

	const handleClearFilters = () => {
		setSearch({ q: "", statuses: [], team: undefined, page: 1 });
	};

	const updateWeekLabelSetting = (
		field: keyof WeekLabelSettings,
		value: string,
	) => {
		setWeekLabelSettings((prev) => {
			const next = {
				...prev,
				[field]: value,
			};
			saveWeekLabelSettings(next);
			void updateWeekLabelSettingsMutation(next);
			return next;
		});
	};

	return (
		<DashboardPage width="wide" className="overflow-x-hidden">
			{/* Header */}
			<PageHeader
				title="Manage Events"
				description="Review event requests and manage published events."
				actions={
					<>
						{isMobile ? (
							<Button
								onClick={() => dispatchSurface({ type: "openCreateSheet" })}
							>
								<Plus className="h-4 w-4 mr-2" />
								Create Event
							</Button>
						) : (
							<>
								<Button
									variant="outline"
									onClick={() =>
										dispatchSurface({ type: "newDraft", date: null })
									}
								>
									<FilePlus className="h-4 w-4 mr-2" />
									Quick Draft
								</Button>
								<Button onClick={() => dispatchSurface({ type: "newRequest" })}>
									<Plus className="h-4 w-4 mr-2" />
									New Event Request
								</Button>
							</>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" aria-label="Event settings">
									<MoreHorizontal />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() => dispatchSurface({ type: "openWeekSettings" })}
								>
									Week Label Settings
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<ResponsiveOverlay
							open={surface.kind === "weekSettings"}
							onOpenChange={(open) =>
								dispatchSurface(
									open
										? { type: "openWeekSettings" }
										: { type: "close", kind: "weekSettings" },
								)
							}
							title="Week Label Settings"
							description="Set quarter starts once. Labels apply to both Manage Events and Officer Calendar."
							variant="large-sheet"
							className="sm:max-w-xl"
							footer={
								<Button
									className="h-11 w-full sm:h-9 sm:w-auto"
									onClick={() =>
										dispatchSurface({ type: "close", kind: "weekSettings" })
									}
								>
									Done
								</Button>
							}
						>
							<p className="mb-4 text-xs text-muted-foreground">
								Follow the UCSD calendar and put the date where it says __
								Quarter Begins and NOT the date that says instruction begins.
							</p>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
								<div className="space-y-1.5">
									<Label
										htmlFor={`${formId}-fall-week0-start`}
										className="text-xs"
									>
										Fall Week 0 Start
									</Label>
									<Input
										id={`${formId}-fall-week0-start`}
										name="fallWeek0Start"
										type="date"
										autoComplete="off"
										className="h-11 text-base sm:h-9 sm:text-sm"
										value={weekLabelSettings.fallWeek0Start}
										onChange={(e) =>
											updateWeekLabelSetting("fallWeek0Start", e.target.value)
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label
										htmlFor={`${formId}-winter-week1-start`}
										className="text-xs"
									>
										Winter Week 1 Start
									</Label>
									<Input
										id={`${formId}-winter-week1-start`}
										name="winterWeek1Start"
										type="date"
										autoComplete="off"
										className="h-11 text-base sm:h-9 sm:text-sm"
										value={weekLabelSettings.winterWeek1Start}
										onChange={(e) =>
											updateWeekLabelSetting("winterWeek1Start", e.target.value)
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label
										htmlFor={`${formId}-spring-week1-start`}
										className="text-xs"
									>
										Spring Week 1 Start
									</Label>
									<Input
										id={`${formId}-spring-week1-start`}
										name="springWeek1Start"
										type="date"
										autoComplete="off"
										className="h-11 text-base sm:h-9 sm:text-sm"
										value={weekLabelSettings.springWeek1Start}
										onChange={(e) =>
											updateWeekLabelSetting("springWeek1Start", e.target.value)
										}
									/>
								</div>
							</div>
						</ResponsiveOverlay>
					</>
				}
			/>

			{/* Mobile create action sheet */}
			<ResponsiveOverlay
				open={surface.kind === "createSheet"}
				onOpenChange={(open) =>
					dispatchSurface(
						open
							? { type: "openCreateSheet" }
							: { type: "close", kind: "createSheet" },
					)
				}
				title="Create Event"
				variant="sheet"
			>
				<div className="space-y-2 pb-2">
					<Button
						variant="outline"
						className="h-12 w-full justify-start gap-3"
						onClick={() => dispatchSurface({ type: "newRequest" })}
					>
						<Plus className="size-4" />
						New Event Request
					</Button>
					<Button
						variant="outline"
						className="h-12 w-full justify-start gap-3"
						onClick={() => dispatchSurface({ type: "newDraft", date: null })}
					>
						<FilePlus className="size-4" />
						Quick Draft
					</Button>
				</div>
			</ResponsiveOverlay>

			{/* View Toggle */}
			<Tabs
				value={viewMode}
				onValueChange={(value) =>
					setSearch({ view: value as ManageEventsSearch["view"] })
				}
			>
				<TabsList>
					<TabsTrigger value="list" className="gap-2 px-4">
						<List className="h-4 w-4" />
						Events List
					</TabsTrigger>
					<TabsTrigger value="calendar" className="gap-2 px-4">
						<CalendarIcon className="h-4 w-4" />
						Event Planning
					</TabsTrigger>
					{canViewVcoPipeline && (
						<TabsTrigger value="vco" className="gap-2 px-4">
							<ClipboardList className="h-4 w-4" />
							VCO Pipeline
						</TabsTrigger>
					)}
				</TabsList>
			</Tabs>

			{/* Filters */}
			{viewMode !== "vco" && (
				<EventsFilters
					filters={filters}
					onFiltersChange={handleFiltersChange}
					onClearFilters={handleClearFilters}
				/>
			)}

			{/* Loading State */}
			{!stableEventsData && (
				<output aria-live="polite" className="block space-y-4">
					<span className="sr-only">Loading events…</span>
					<div className="h-8 w-48 bg-muted rounded animate-pulse" />
					<div className="h-64 bg-muted rounded animate-pulse" />
				</output>
			)}

			{/* Content */}
			{stableEventsData &&
				(viewMode === "list" ? (
					<EventsDataTable
						events={paginatedEvents}
						sortConfig={sortConfig}
						onSort={handleSort}
						onView={viewEvent}
						onEdit={editEvent}
						onDelete={handleDelete}
						onConvertToDraft={handleConvertToDraft}
						pagination={{
							currentPage,
							totalPages,
							totalItems: sortedEvents.length,
							onPageChange: (page) => setSearch({ page }),
						}}
					/>
				) : viewMode === "vco" && canViewVcoPipeline ? (
					<VcoPipelineView
						events={allEvents}
						weekLabelSettings={weekLabelSettings}
						onView={viewEvent}
						onPipelineChange={handleVcoPipelineChange}
					/>
				) : (
					<EventCalendar
						events={sortedEvents}
						onDateClick={(date) => dispatchSurface({ type: "newDraft", date })}
						onEventClick={viewEvent}
						getDayLabel={(date) => getWeekLabelForDate(date, weekLabelSettings)}
					/>
				))}

			{/* Event Request Wizard Modal */}
			<EventRequestWizardModal
				isOpen={surface.kind === "wizard"}
				onClose={() => dispatchSurface({ type: "close", kind: "wizard" })}
				onSubmit={editingRequest ? handleUpdateRequest : handleCreateRequest}
				onSave={editingRequest ? handleSaveRequest : undefined}
				initialData={wizardInitialData}
				aiEnabled={aiEnabled}
			/>

			{/* Event View Modal */}
			<EventViewModal
				isOpen={surface.kind === "view"}
				onClose={() => dispatchSurface({ type: "close", kind: "view" })}
				event={surface.kind === "view" ? surface.request : null}
				onEdit={editEvent}
				onDelete={handleDelete}
				onDecline={hasAdminAccess ? handleDecline : undefined}
				onStatusChange={hasAdminAccess ? handleStatusChange : undefined}
				onTogglePublish={hasAdminAccess ? handleTogglePublish : undefined}
				canManageStatus={hasAdminAccess}
				onUpdateGraphics={handleUpdateGraphics}
			/>

			{/* Draft View Modal */}
			<DraftViewModal
				isOpen={surface.kind === "draftView"}
				onClose={() => dispatchSurface({ type: "close", kind: "draftView" })}
				event={surface.kind === "draftView" ? surface.draft : null}
				onEdit={editEvent}
				onDelete={handleDelete}
				onConvertToRequest={(event) => {
					dispatchSurface({
						type: "convertToRequest",
						request: {
							...event,
							status: "draft",
						} as EventRequest,
					});
				}}
			/>

			{/* Draft Event Modal */}
			<DraftEventModal
				isOpen={surface.kind === "draftCreate" || surface.kind === "draftEdit"}
				onClose={() =>
					dispatchSurface({
						type: "close",
						kind: editingDraft ? "draftEdit" : "draftCreate",
					})
				}
				onSubmit={editingDraft ? handleUpdateDraft : handleCreateDraft}
				initialData={draftInitialData}
				onConvertToRequest={(data) => {
					if (!editingDraft) {
						dispatchSurface({
							type: "newRequest",
							prefill: { ...data, status: "draft" },
						});
						return;
					}
					dispatchSurface({
						type: "convertToRequest",
						request: {
							...editingDraft,
							...data,
							_id: editingDraft._id,
							status: "draft",
						},
					});
				}}
			/>

			<Dialog
				open={!!decliningEvent}
				onOpenChange={(open) => {
					if (!open) closeDeclineDialog();
				}}
			>
				<DialogContent className="sm:max-w-md">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void submitDecline();
						}}
						className="space-y-4"
					>
						<DialogHeader>
							<DialogTitle className="text-balance">Decline Event?</DialogTitle>
							<DialogDescription>
								{decliningEvent
									? `“${decliningEvent.eventName}” will be declined and the requester will be notified with your reason.`
									: null}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-2">
							<Label htmlFor={`${formId}-decline-reason`}>
								Reason for Declining
							</Label>
							<Textarea
								id={`${formId}-decline-reason`}
								name="declineReason"
								autoComplete="off"
								rows={4}
								value={
									declineDialog.status === "closed" ? "" : declineDialog.reason
								}
								onChange={(e) => {
									const reason = e.target.value;
									setDeclineDialog((current) =>
										transitionDeclineDialog(current, {
											type: "editReason",
											reason,
										}),
									);
								}}
								placeholder="Explain why this event is being declined…"
								aria-invalid={!!declineError}
								aria-describedby={
									declineError ? `${formId}-decline-reason-error` : undefined
								}
								disabled={isDeclining}
							/>
							<output
								id={`${formId}-decline-reason-error`}
								aria-live="polite"
								className="block text-xs text-destructive empty:hidden"
							>
								{declineError}
							</output>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={closeDeclineDialog}
								disabled={isDeclining}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="destructive"
								disabled={isDeclining}
							>
								{isDeclining ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : null}
								{isDeclining ? "Declining…" : "Decline Event"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Processing Overlay */}
			{pendingAction && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<output
						aria-live="polite"
						className="bg-background rounded-lg p-6 flex items-center gap-3"
					>
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>Processing…</span>
					</output>
				</div>
			)}
		</DashboardPage>
	);
}
