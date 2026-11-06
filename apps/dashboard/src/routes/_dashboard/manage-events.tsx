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
import { useEffect, useId, useMemo, useRef, useState } from "react";
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
	FileManagerModal,
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

	// Modal states
	const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(
		null,
	);
	const [isWizardOpen, setIsWizardOpen] = useState(false);
	const [isViewModalOpen, setIsViewModalOpen] = useState(false);
	const [isDraftViewModalOpen, setIsDraftViewModalOpen] = useState(false);
	const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
	const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
	const [isWeekSettingsOpen, setIsWeekSettingsOpen] = useState(false);
	const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
	const [editingRequest, setEditingRequest] = useState<EventRequest | null>(
		null,
	);
	const [editingDraft, setEditingDraft] = useState<EventRequest | null>(null);
	const [draftDate, setDraftDate] = useState<Date | null>(null);
	const [weekLabelSettings, setWeekLabelSettings] = useState<WeekLabelSettings>(
		() => loadWeekLabelSettings(),
	);
	const hasHydratedWeekSettings = useRef(false);

	// Loading state
	const [isProcessing, setIsProcessing] = useState(false);

	const [decliningEvent, setDecliningEvent] = useState<EventRequest | null>(
		null,
	);
	const [declineReason, setDeclineReason] = useState("");
	const [declineError, setDeclineError] = useState("");
	const [isDeclining, setIsDeclining] = useState(false);

	useEffect(() => {
		const immersive =
			isWizardOpen ||
			isDraftModalOpen ||
			isViewModalOpen ||
			isDraftViewModalOpen ||
			isFileManagerOpen;
		setHideTabBar(immersive);
		return () => setHideTabBar(false);
	}, [
		isWizardOpen,
		isDraftModalOpen,
		isViewModalOpen,
		isDraftViewModalOpen,
		isFileManagerOpen,
		setHideTabBar,
	]);

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
		setIsProcessing(true);
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
			setIsProcessing(false);
		}
	};

	const handleSaveRequest = async (data: EventFormData) => {
		if (!logtoId || !editingRequest) return;
		setIsProcessing(true);
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
			setIsProcessing(false);
		}
	};

	// Update event handler
	const handleUpdateRequest = async (data: EventFormData) => {
		if (!logtoId || !editingRequest) return;
		setIsProcessing(true);
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
			setIsProcessing(false);
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
		setIsProcessing(true);
		try {
			await removeEvent({
				logtoId,
				id: event._id as any,
			});
			toast.success("Event deleted successfully!");
			setIsViewModalOpen(false);
			setSelectedRequest(null);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to delete event. Check your connection and try again.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	// Convert to draft handler
	const handleConvertToDraft = async (event: EventRequest) => {
		if (!logtoId) return;
		setIsProcessing(true);
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
			setIsProcessing(false);
		}
	};

	// Decline handler
	const handleDecline = (event: EventRequest) => {
		if (!logtoId) return;
		setDeclineReason("");
		setDeclineError("");
		setDecliningEvent(event);
	};

	const closeDeclineDialog = () => {
		if (isDeclining) return;
		setDecliningEvent(null);
	};

	const submitDecline = async () => {
		const event = decliningEvent;
		if (!logtoId || !event) return;
		const reason = declineReason;
		if (!reason) {
			setDeclineError("Enter a reason so the requester knows what to change.");
			return;
		}
		setDeclineError("");
		setIsDeclining(true);
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

			setDecliningEvent(null);
			setIsViewModalOpen(false);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to decline event. Check your connection and try again.",
			);
		} finally {
			setIsDeclining(false);
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
		setIsProcessing(true);
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
			setSelectedRequest((prev) =>
				prev && prev._id === event._id ? { ...prev, status: newStatus } : prev,
			);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update status. Check your connection and try again.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	// Toggle publish handler
	const handleTogglePublish = async (
		event: EventRequest,
		shouldPublish: boolean,
	) => {
		if (!logtoId) return;
		setIsProcessing(true);
		try {
			await updateEventStatus({
				logtoId,
				id: event._id as any,
				status: shouldPublish ? "completed" : "approved",
			});
			toast.success(shouldPublish ? "Event published!" : "Event unpublished");
			setSelectedRequest((prev) =>
				prev && prev._id === event._id
					? { ...prev, status: shouldPublish ? "published" : "approved" }
					: prev,
			);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to toggle publish. Check your connection and try again.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleUpdateGraphics = async (
		event: EventRequest,
		updates: { flyersCompleted: boolean; graphicsUploadNote?: string },
	) => {
		if (!logtoId) return;
		setIsProcessing(true);
		try {
			await updateEvent({
				logtoId,
				id: event._id as any,
				flyersCompleted: updates.flyersCompleted,
				graphicsUploadNote: updates.graphicsUploadNote,
			});
			setSelectedRequest((prev) =>
				prev && prev._id === event._id ? { ...prev, ...updates } : prev,
			);
			toast.success("Graphics status updated");
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update graphics status. Check your connection and try again.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	// Create draft handler
	const handleCreateDraft = async (data: Partial<EventRequest>) => {
		if (!logtoId) return;
		setIsProcessing(true);
		try {
			await createEvent(EventRequestMapping.toDraftCreateArgs(logtoId, data));
			toast.success("Draft event created!");
			setIsDraftModalOpen(false);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to create draft. Check your connection and try again.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	// Calendar date click handler
	const handleCalendarDateClick = (date: Date) => {
		setEditingDraft(null);
		setDraftDate(date);
		setIsDraftModalOpen(true);
	};

	// Event click handler for calendar
	const handleCalendarEventClick = (event: EventRequest) => {
		setSelectedRequest(event);
		if (event.status === "draft") {
			setIsDraftViewModalOpen(true);
		} else {
			setIsViewModalOpen(true);
		}
	};

	// Edit handler from view modal
	const handleEditFromView = (event: EventRequest) => {
		setIsViewModalOpen(false);
		if (event.status === "draft") {
			setEditingDraft(event);
			setIsDraftModalOpen(true);
		} else {
			setEditingRequest(event);
			setIsWizardOpen(true);
		}
	};

	// Update draft handler
	const handleUpdateDraft = async (data: Partial<EventRequest>) => {
		if (!logtoId || !editingDraft) return;
		setIsProcessing(true);
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
			setIsDraftModalOpen(false);
			setEditingDraft(null);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update draft. Check your connection and try again.",
			);
		} finally {
			setIsProcessing(false);
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
							<Button onClick={() => setIsCreateSheetOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Create Event
							</Button>
						) : (
							<>
								<Button
									variant="outline"
									onClick={() => {
										setDraftDate(null);
										setIsDraftModalOpen(true);
									}}
								>
									<FilePlus className="h-4 w-4 mr-2" />
									Quick Draft
								</Button>
								<Button onClick={() => setIsWizardOpen(true)}>
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
								<DropdownMenuItem onSelect={() => setIsWeekSettingsOpen(true)}>
									Week Label Settings
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<ResponsiveOverlay
							open={isWeekSettingsOpen}
							onOpenChange={setIsWeekSettingsOpen}
							title="Week Label Settings"
							description="Set quarter starts once. Labels apply to both Manage Events and Officer Calendar."
							variant="large-sheet"
							className="sm:max-w-xl"
							footer={
								<Button
									className="h-11 w-full sm:h-9 sm:w-auto"
									onClick={() => setIsWeekSettingsOpen(false)}
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
				open={isCreateSheetOpen}
				onOpenChange={setIsCreateSheetOpen}
				title="Create Event"
				variant="sheet"
			>
				<div className="space-y-2 pb-2">
					<Button
						variant="outline"
						className="h-12 w-full justify-start gap-3"
						onClick={() => {
							setIsCreateSheetOpen(false);
							setIsWizardOpen(true);
						}}
					>
						<Plus className="size-4" />
						New Event Request
					</Button>
					<Button
						variant="outline"
						className="h-12 w-full justify-start gap-3"
						onClick={() => {
							setIsCreateSheetOpen(false);
							setDraftDate(null);
							setIsDraftModalOpen(true);
						}}
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
						onView={(event) => {
							setSelectedRequest(event);
							if (event.status === "draft") {
								setIsDraftViewModalOpen(true);
							} else {
								setIsViewModalOpen(true);
							}
						}}
						onEdit={(event) => {
							if (event.status === "draft") {
								setEditingDraft(event);
								setIsDraftModalOpen(true);
							} else {
								setEditingRequest(event);
								setIsWizardOpen(true);
							}
						}}
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
						onView={(event) => {
							setSelectedRequest(event);
							if (event.status === "draft") {
								setIsDraftViewModalOpen(true);
							} else {
								setIsViewModalOpen(true);
							}
						}}
						onPipelineChange={handleVcoPipelineChange}
					/>
				) : (
					<EventCalendar
						events={sortedEvents}
						onDateClick={handleCalendarDateClick}
						onEventClick={handleCalendarEventClick}
						getDayLabel={(date) => getWeekLabelForDate(date, weekLabelSettings)}
					/>
				))}

			{/* Event Request Wizard Modal */}
			<EventRequestWizardModal
				isOpen={isWizardOpen}
				onClose={() => {
					setIsWizardOpen(false);
					setEditingRequest(null);
				}}
				onSubmit={editingRequest ? handleUpdateRequest : handleCreateRequest}
				onSave={editingRequest ? handleSaveRequest : undefined}
				initialData={editingRequest || undefined}
				aiEnabled={aiEnabled}
			/>

			{/* Event View Modal */}
			<EventViewModal
				isOpen={isViewModalOpen}
				onClose={() => {
					setIsViewModalOpen(false);
					setSelectedRequest(null);
				}}
				event={selectedRequest}
				onEdit={handleEditFromView}
				onDelete={handleDelete}
				onDecline={hasAdminAccess ? handleDecline : undefined}
				onStatusChange={hasAdminAccess ? handleStatusChange : undefined}
				onTogglePublish={hasAdminAccess ? handleTogglePublish : undefined}
				canManageStatus={hasAdminAccess}
				onUpdateGraphics={handleUpdateGraphics}
			/>

			{/* Draft View Modal */}
			<DraftViewModal
				isOpen={isDraftViewModalOpen}
				onClose={() => {
					setIsDraftViewModalOpen(false);
					setSelectedRequest(null);
				}}
				event={selectedRequest}
				onEdit={(event) => {
					setIsDraftViewModalOpen(false);
					setEditingDraft(event);
					setIsDraftModalOpen(true);
				}}
				onDelete={handleDelete}
				onConvertToRequest={(event) => {
					setIsDraftViewModalOpen(false);
					setSelectedRequest(null);
					setEditingRequest({
						...event,
						status: "draft",
					} as EventRequest);
					setIsWizardOpen(true);
				}}
			/>

			{/* Draft Event Modal */}
			<DraftEventModal
				isOpen={isDraftModalOpen}
				onClose={() => {
					setIsDraftModalOpen(false);
					setEditingDraft(null);
					setDraftDate(null);
				}}
				onSubmit={editingDraft ? handleUpdateDraft : handleCreateDraft}
				initialData={
					editingDraft ||
					(draftDate
						? {
								startDate: draftDate.getTime(),
								endDate: draftDate.getTime() + 3600000,
							}
						: undefined)
				}
				onConvertToRequest={(data) => {
					setIsDraftModalOpen(false);
					setEditingDraft(null);
					setDraftDate(null);
					// Open wizard with draft data prefilled
					setEditingRequest({
						...data,
						_id: editingDraft?._id,
						_creationTime: editingDraft?._creationTime || Date.now(),
						status: "draft",
						createdBy: editingDraft?.createdBy || "Unknown",
					} as EventRequest);
					setIsWizardOpen(true);
				}}
			/>

			{/* File Manager Modal */}
			{selectedRequest && (
				<FileManagerModal
					isOpen={isFileManagerOpen}
					onClose={() => setIsFileManagerOpen(false)}
					eventId={selectedRequest._id}
					files={[]}
					onUpload={() => {}}
					onDelete={() => {}}
				/>
			)}

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
								value={declineReason}
								onChange={(e) => {
									setDeclineReason(e.target.value);
									if (declineError) setDeclineError("");
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
			{isProcessing && (
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
