import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	Calendar as CalendarIcon,
	FilePlus,
	List,
	Loader2,
	Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
} from "@/components/manage-events";
import {
	normalizeDepartment,
	normalizeEventType,
} from "@/components/manage-events/constants";
import {
	defaultWeekLabelSettings,
	getWeekLabelForDate,
	loadWeekLabelSettings,
	saveWeekLabelSettings,
	type WeekLabelSettings,
} from "@/components/manage-events/utils/weekLabels";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { sendNotification } from "@/lib/send-notification";

export const Route = createFileRoute("/_dashboard/manage-events")({
	component: ManageEventsPage,
});

// Map from unified Convex events table to EventRequest UI type
function mapEventToType(event: any): EventRequest {
	const status: EventRequest["status"] = event.published
		? "published"
		: event.status === "completed"
			? "published"
			: event.status || "draft";

	return {
		_id: event._id,
		_creationTime: event._creationTime,
		eventName: event.eventName || "Untitled Event",
		eventDescription: event.eventDescription || "",
		eventType: normalizeEventType(event.eventType),
		department: normalizeDepartment(event.department),
		location: event.location || "TBD",
		startDate: event.startDate || Date.now(),
		endDate: event.endDate || Date.now() + 3600000,
		eventCode: event.eventCode || "",
		hasFood: event.hasFood || event.foodDrinksBeingServed || false,
		needsFlyers: event.flyersNeeded || false,
		needsGraphics: event.needsGraphics || false,
		needsASFunding: event.needsAsFunding || event.asFundingRequired || false,
		estimatedAttendance: event.expectedAttendance || 0,
		status,
		files: event.files || [],
		invoices: (event.invoices || []).map((inv: any) => ({
			_id: inv.id || crypto.randomUUID(),
			vendor: inv.vendor || "Unknown",
			items: inv.items || [],
			tax: inv.tax || 0,
			tip: inv.tip || 0,
			invoiceFile: inv.invoiceFile,
			additionalFiles: inv.additionalFiles || [],
			subtotal: inv.subtotal || 0,
			total: inv.total || 0,
			amount: inv.total || 0,
			description: inv.items?.map((i: any) => i.description).join(", ") || "",
			fileUrl: inv.invoiceFile,
		})),
		createdBy:
			event.submitterName ||
			event.requestedUser ||
			event.createdBy ||
			"Unknown",
		requestedUser: event.requestedUser,
		_updatedAt: event._updatedAt,
		attendeeCount: event.attendeeCount || 0,
		attendees: event.attendees || [],
		willOrHaveRoomBooking: event.willOrHaveRoomBooking || false,
		roomBookingFiles: event.roomBookingFiles || [],
		foodDrinksBeingServed: event.foodDrinksBeingServed || false,
		asFundingRequired: event.asFundingRequired || false,
		flyerType: event.flyerType || [],
		otherFlyerType: event.otherFlyerType || "",
		flyerAdvertisingStartDate: event.flyerAdvertisingStartDate || 0,
		flyerAdditionalRequests: event.flyerAdditionalRequests || "",
		photographyNeeded: event.photographyNeeded || false,
		requiredLogos: event.requiredLogos || [],
		otherLogos: event.otherLogos || [],
		advertisingFormat: event.advertisingFormat || "",
		additionalSpecifications: event.additionalSpecifications || "",
		flyersCompleted: event.flyersCompleted || false,
		graphicsUploadNote: event.graphicsUploadNote || "",
	};
}

function ManageEventsPage() {
	const {
		hasOfficerAccess,
		hasAdminAccess,
		logtoId,
		user,
		getAuthHeaders,
		isLoading,
	} = usePermissions();
	const aiEnabled = user?.aiFeaturesEnabled !== false;

	// Single unified query — events and eventRequests are now one table
	const eventsData = useAuthedQuery(
		api.events.listAll,
		logtoId ? { logtoId } : "skip",
	);

	// Convex mutations (all unified under api.events)
	const createEvent = useAuthedMutation(api.events.create);
	const updateEvent = useAuthedMutation(api.events.update);
	const updateEventStatus = useAuthedMutation(api.events.updateStatus);
	const removeEvent = useAuthedMutation(api.events.remove);
	const updateWeekLabelSettingsMutation = useAuthedMutation(
		api.weekLabelSettings.update,
	);
	const convexWeekLabelSettings = useAuthedQuery(
		api.weekLabelSettings.get,
		logtoId ? { logtoId } : "skip",
	);

	// View mode state
	const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

	// Filters state
	const [filters, setFilters] = useState<EventFilters>({
		search: "",
		statuses: [],
		teamPreset: undefined,
	});

	// Sort state
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		field: "startDate",
		direction: "desc",
	});

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
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
		return (eventsData || []).map(mapEventToType);
	}, [eventsData]);

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
	}, [filteredEvents, sortConfig]);

	// Pagination
	const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);
	const paginatedEvents = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		return sortedEvents.slice(startIndex, startIndex + itemsPerPage);
	}, [sortedEvents, currentPage, itemsPerPage]);

	// Reset page on filter/sort change
	useMemo(() => {
		setCurrentPage(1);
	}, [filters, sortConfig]);

	// Loading state
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Permission check
	if (!hasOfficerAccess) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don't have permission to access this page.
			</div>
		);
	}

	// Sort handler
	const handleSort = (field: string) => {
		setSortConfig((prev) => ({
			field,
			direction:
				prev.field === field && prev.direction === "asc" ? "desc" : "asc",
		}));
	};

	// Create event handler
	const handleCreateRequest = async (data: EventFormData) => {
		if (!logtoId) return;
		setIsProcessing(true);
		try {
			await createEvent({
				logtoId,
				eventName: data.eventName,
				location: data.location,
				startDate: data.startDate,
				endDate: data.endDate,
				eventDescription: data.eventDescription,
				eventCode: data.eventCode,
				eventType: normalizeEventType(data.eventType),
				department: data.department,
				expectedAttendance: data.estimatedAttendance,
				flyersNeeded: data.needsFlyers,
				needsGraphics: data.needsGraphics,
				needsAsFunding: data.needsASFunding,
				invoices: data.invoices.map((inv) => ({
					id: inv._id,
					vendor: inv.vendor,
					items:
						inv.items.length > 0
							? inv.items
							: [
									{
										description: inv.description,
										quantity: 1,
										unitPrice: inv.amount,
										total: inv.amount,
									},
								],
					tax: inv.tax || 0,
					tip: inv.tip || 0,
					subtotal: inv.subtotal || inv.amount,
					total: inv.total || inv.amount,
					additionalFiles: inv.additionalFiles || ([] as string[]),
					invoiceFile: inv.invoiceFile,
				})),
				isDraft: false,
				flyersCompleted: data.flyersCompleted,
				photographyNeeded: data.photographyNeeded,
				requiredLogos: data.requiredLogos,
				otherFlyerType: data.otherFlyerType,
				flyerAdvertisingStartDate: data.flyerAdvertisingStartDate,
				flyerAdditionalRequests: data.flyerAdditionalRequests,
				advertisingFormat: data.advertisingFormat,
				otherLogos: data.otherLogos,
				asFundingRequired: data.asFundingRequired,
				flyerType: data.flyerType,
				willOrHaveRoomBooking: data.willOrHaveRoomBooking,
				roomBookingFiles: data.roomBookingFiles,
				foodDrinksBeingServed: data.foodDrinksBeingServed,
				additionalSpecifications: data.additionalSpecifications,
				graphicsUploadNote: data.graphicsUploadNote || undefined,
			});
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

			setIsWizardOpen(false);
		} catch (error: any) {
			toast.error(error.message || "Failed to submit event request");
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

			await updateEvent({
				logtoId,
				id: eventId,
				eventName: data.eventName,
				location: data.location,
				startDate: data.startDate,
				endDate: data.endDate,
				eventDescription: data.eventDescription,
				eventType: normalizeEventType(data.eventType),
				department: data.department,
				expectedAttendance: data.estimatedAttendance,
				flyersNeeded: data.needsFlyers,
				needsGraphics: data.needsGraphics,
				needsAsFunding: data.needsASFunding,
				hasFood: data.hasFood,
				eventCode: data.eventCode,
				invoices: data.invoices.map((inv) => ({
					id: inv._id,
					vendor: inv.vendor,
					items:
						inv.items.length > 0
							? inv.items
							: [
									{
										description: inv.description,
										quantity: 1,
										unitPrice: inv.amount,
										total: inv.amount,
									},
								],
					tax: inv.tax || 0,
					tip: inv.tip || 0,
					subtotal: inv.subtotal || inv.amount,
					total: inv.total || inv.amount,
					additionalFiles: inv.additionalFiles || [],
					invoiceFile: inv.invoiceFile,
				})),
				flyerType: data.flyerType,
				otherFlyerType: data.otherFlyerType,
				flyerAdvertisingStartDate: data.flyerAdvertisingStartDate,
				flyerAdditionalRequests: data.flyerAdditionalRequests,
				photographyNeeded: data.photographyNeeded,
				requiredLogos: data.requiredLogos,
				otherLogos: data.otherLogos,
				advertisingFormat: data.advertisingFormat,
				willOrHaveRoomBooking: data.willOrHaveRoomBooking,
				roomBookingFiles: data.roomBookingFiles,
				asFundingRequired: data.asFundingRequired,
				foodDrinksBeingServed: data.foodDrinksBeingServed,
				additionalSpecifications: data.additionalSpecifications,
				flyersCompleted: data.flyersCompleted,
				graphicsUploadNote: data.graphicsUploadNote || undefined,
			});

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

			setIsWizardOpen(false);
			setEditingRequest(null);
		} catch (error: any) {
			toast.error(error.message || "Failed to update event");
		} finally {
			setIsProcessing(false);
		}
	};

	// Delete handler
	const handleDelete = async (event: EventRequest) => {
		if (!logtoId) return;
		if (!confirm("Are you sure you want to delete this event?")) return;
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
			toast.error(error.message || "Failed to delete event");
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
			toast.error(error.message || "Failed to convert to draft");
		} finally {
			setIsProcessing(false);
		}
	};

	// Decline handler
	const handleDecline = async (event: EventRequest) => {
		if (!logtoId) return;
		const reason = prompt("Enter reason for declining:");
		if (!reason) return;
		setIsProcessing(true);
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

			setIsViewModalOpen(false);
		} catch (error: any) {
			toast.error(error.message || "Failed to decline event");
		} finally {
			setIsProcessing(false);
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

			if (newStatus === "published") {
				await updateEvent({
					logtoId,
					id: eventId,
					published: true,
				});
				await updateEventStatus({
					logtoId,
					id: eventId,
					status: "completed",
				});
			} else {
				await updateEventStatus({
					logtoId,
					id: eventId,
					status:
						newStatus === "needs_review" ? "needs_review" : (newStatus as any),
				});
				if (newStatus === "approved" || newStatus === "draft") {
					await updateEvent({
						logtoId,
						id: eventId,
						published: false,
					});
				}
			}

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
			toast.error(error.message || "Failed to update status");
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
			const eventId = event._id as any;
			await updateEvent({
				logtoId,
				id: eventId,
				published: shouldPublish,
			});
			if (shouldPublish) {
				await updateEventStatus({
					logtoId,
					id: eventId,
					status: "completed",
				});
			} else {
				await updateEventStatus({
					logtoId,
					id: eventId,
					status: "approved",
				});
			}
			toast.success(shouldPublish ? "Event published!" : "Event unpublished");
			setSelectedRequest((prev) =>
				prev && prev._id === event._id
					? { ...prev, status: shouldPublish ? "published" : "approved" }
					: prev,
			);
		} catch (error: any) {
			toast.error(error.message || "Failed to toggle publish");
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
			toast.error(error.message || "Failed to update graphics status");
		} finally {
			setIsProcessing(false);
		}
	};

	// Create draft handler
	const handleCreateDraft = async (data: Partial<EventRequest>) => {
		if (!logtoId) return;
		setIsProcessing(true);
		try {
			await createEvent({
				logtoId,
				eventName: data.eventName || "Draft Event",
				location: data.location || "TBD",
				startDate: data.startDate || Date.now(),
				endDate: data.endDate || Date.now() + 3600000,
				eventDescription: data.eventDescription || "",
				eventCode: data.eventCode || `EVENT-${Date.now()}`,
				eventType: normalizeEventType(
					(data.eventType as string | undefined) || "other",
				),
				department: normalizeDepartment(data.department),
				expectedAttendance: data.estimatedAttendance,
				isDraft: true,
				flyersNeeded: false,
				flyerType: [] as string[],
				flyersCompleted: false,
				photographyNeeded: false,
				requiredLogos: [] as string[],
				otherFlyerType: "",
				flyerAdvertisingStartDate: 0,
				flyerAdditionalRequests: "",
				advertisingFormat: "",
				otherLogos: [] as string[],
				willOrHaveRoomBooking: false,
				roomBookingFiles: [] as string[],
				asFundingRequired: false,
				foodDrinksBeingServed: false,
				invoices: [] as any[],
				needsGraphics: false,
				needsAsFunding: false,
				graphicsUploadNote: "",
			});
			toast.success("Draft event created!");
			setIsDraftModalOpen(false);
		} catch (error: any) {
			toast.error(error.message || "Failed to create draft");
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
			await updateEvent({
				logtoId,
				id: eventId,
				eventName: data.eventName || editingDraft.eventName,
				location: data.location || editingDraft.location,
				startDate: data.startDate || editingDraft.startDate,
				endDate: data.endDate || editingDraft.endDate,
				eventDescription:
					data.eventDescription || editingDraft.eventDescription,
				eventCode:
					data.eventCode || editingDraft.eventCode || `EVENT-${Date.now()}`,
				eventType: normalizeEventType(
					(data.eventType as string | undefined) || editingDraft.eventType,
				),
				department: normalizeDepartment(
					data.department || editingDraft.department,
				),
				expectedAttendance: data.estimatedAttendance,
				flyersNeeded: data.needsFlyers ?? false,
				needsGraphics: data.needsGraphics ?? false,
				needsAsFunding: data.needsASFunding ?? false,
				hasFood:
					data.hasFood ??
					data.foodDrinksBeingServed ??
					editingDraft.hasFood ??
					false,
				flyerType: data.flyerType || [],
				willOrHaveRoomBooking: data.willOrHaveRoomBooking ?? false,
				roomBookingFiles: data.roomBookingFiles || [],
				asFundingRequired: data.asFundingRequired ?? false,
				foodDrinksBeingServed: data.foodDrinksBeingServed ?? false,
				photographyNeeded: data.photographyNeeded ?? false,
				requiredLogos: data.requiredLogos || [],
				graphicsUploadNote:
					data.graphicsUploadNote || editingDraft.graphicsUploadNote || "",
			});
			toast.success("Draft updated successfully!");
			setIsDraftModalOpen(false);
			setEditingDraft(null);
		} catch (error: any) {
			toast.error(error.message || "Failed to update draft");
		} finally {
			setIsProcessing(false);
		}
	};

	// Clear filters handler
	const handleClearFilters = () => {
		setFilters({
			search: "",
			statuses: [],
			teamPreset: undefined,
		});
		setCurrentPage(1);
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
		<div className="p-4 sm:p-6 space-y-6 w-full max-w-7xl mx-auto overflow-x-hidden">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Manage Events</h1>
					<p className="text-muted-foreground">
						Review event requests and manage published events.
					</p>
				</div>
				<div className="flex gap-2">
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
					<Dialog
						open={isWeekSettingsOpen}
						onOpenChange={setIsWeekSettingsOpen}
					>
						<DialogTrigger asChild>
							<Button variant="outline">Week Label Settings</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-xl">
							<DialogHeader>
								<DialogTitle>Week Label Settings</DialogTitle>
							</DialogHeader>
							<p className="text-xs text-muted-foreground">
								Set quarter starts once. Labels apply to both Manage Events and
								Officer Calendar.
							</p>
							<p className="text-xs text-muted-foreground">
								Follow the UCSD calendar and put the date where it says __
								Quarter Begins and NOT the date that says instruction begins.
							</p>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
								<div className="space-y-1.5">
									<Label htmlFor="fall-week0-start" className="text-xs">
										Fall Week 0 Start
									</Label>
									<Input
										id="fall-week0-start"
										type="date"
										value={weekLabelSettings.fallWeek0Start}
										onChange={(e) =>
											updateWeekLabelSetting("fallWeek0Start", e.target.value)
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="winter-week1-start" className="text-xs">
										Winter Week 1 Start
									</Label>
									<Input
										id="winter-week1-start"
										type="date"
										value={weekLabelSettings.winterWeek1Start}
										onChange={(e) =>
											updateWeekLabelSetting("winterWeek1Start", e.target.value)
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="spring-week1-start" className="text-xs">
										Spring Week 1 Start
									</Label>
									<Input
										id="spring-week1-start"
										type="date"
										value={weekLabelSettings.springWeek1Start}
										onChange={(e) =>
											updateWeekLabelSetting("springWeek1Start", e.target.value)
										}
									/>
								</div>
							</div>
						</DialogContent>
					</Dialog>
					<Button onClick={() => setIsWizardOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Event Request
					</Button>
				</div>
			</div>

			{/* View Toggle */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => setViewMode("list")}
					className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
						viewMode === "list"
							? "bg-primary text-primary-foreground"
							: "bg-muted hover:bg-muted/80 text-muted-foreground"
					}`}
				>
					<List className="h-4 w-4" />
					Events List
				</button>
				<button
					type="button"
					onClick={() => setViewMode("calendar")}
					className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
						viewMode === "calendar"
							? "bg-primary text-primary-foreground"
							: "bg-muted hover:bg-muted/80 text-muted-foreground"
					}`}
				>
					<CalendarIcon className="h-4 w-4" />
					Event Planning
				</button>
			</div>

			{/* Filters */}
			<EventsFilters
				filters={filters}
				onFiltersChange={setFilters}
				onClearFilters={handleClearFilters}
			/>

			{/* Loading State */}
			{!eventsData && (
				<div className="space-y-4">
					<div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
					<div className="h-64 bg-gray-200 rounded animate-pulse" />
				</div>
			)}

			{/* Content */}
			{eventsData && (
				<>
					{viewMode === "list" ? (
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
								onPageChange: setCurrentPage,
							}}
						/>
					) : (
						<EventCalendar
							events={sortedEvents}
							onDateClick={handleCalendarDateClick}
							onEventClick={handleCalendarEventClick}
							getDayLabel={(date) =>
								getWeekLabelForDate(date, weekLabelSettings)
							}
						/>
					)}
				</>
			)}

			{/* Event Request Wizard Modal */}
			<EventRequestWizardModal
				isOpen={isWizardOpen}
				onClose={() => {
					setIsWizardOpen(false);
					setEditingRequest(null);
				}}
				onSubmit={editingRequest ? handleUpdateRequest : handleCreateRequest}
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

			{/* Processing Overlay */}
			{isProcessing && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 flex items-center gap-3">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>Processing...</span>
					</div>
				</div>
			)}
		</div>
	);
}
