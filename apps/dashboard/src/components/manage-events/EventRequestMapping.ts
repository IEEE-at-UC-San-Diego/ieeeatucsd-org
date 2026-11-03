import { EventPoints } from "@convex/eventPoints";
import { normalizeDepartment, normalizeEventType } from "./constants";
import type { EventFormData, EventRequest } from "./types";

type InvoiceInput = {
	id: string;
	vendor: string;
	items: Array<{
		description: string;
		quantity: number;
		unitPrice: number;
		total: number;
	}>;
	tax: number;
	tip: number;
	subtotal: number;
	total: number;
	additionalFiles: string[];
	invoiceFile?: string;
};

export class EventRequestMapping {
	static readonly defaultFormData: EventFormData = {
		eventName: "",
		eventDescription: "",
		eventType: "",
		department: undefined,
		location: "",
		startDate: Date.now(),
		endDate: Date.now() + 3600000,
		eventCode: "",
		pointsToReward: EventPoints.DEFAULT,
		hasFood: false,
		needsFlyers: false,
		needsGraphics: false,
		needsASFunding: false,
		estimatedAttendance: 0,
		files: [],
		invoices: [],
		willOrHaveRoomBooking: false,
		roomBookingFiles: [],
		foodDrinksBeingServed: false,
		asFundingRequired: false,
		flyerType: [],
		otherFlyerType: "",
		flyerAdvertisingStartDate: 0,
		flyerAdditionalRequests: "",
		photographyNeeded: false,
		requiredLogos: [],
		otherLogos: [],
		advertisingFormat: "",
		additionalSpecifications: "",
		flyersCompleted: false,
		graphicsUploadNote: "",
	};

	static fromDocument(event: Record<string, unknown>): EventRequest {
		const status: EventRequest["status"] = event.published
			? "published"
			: event.status === "completed"
				? "published"
				: ((event.status as EventRequest["status"] | undefined) ?? "draft");

		const invoices = Array.isArray(event.invoices) ? event.invoices : [];

		return {
			_id: String(event._id ?? ""),
			_creationTime: Number(event._creationTime ?? Date.now()),
			createdAt:
				typeof event.createdAt === "number" ? event.createdAt : undefined,
			eventName: String(event.eventName || "Untitled Event"),
			eventDescription: String(event.eventDescription || ""),
			eventType: normalizeEventType(event.eventType as string | undefined),
			department: normalizeDepartment(event.department as string | undefined),
			location: String(event.location || "TBD"),
			startDate: Number(event.startDate || Date.now()),
			endDate: Number(event.endDate || Date.now() + 3600000),
			eventCode: String(event.eventCode || ""),
			pointsToReward: EventPoints.getError(event.pointsToReward)
				? EventPoints.DEFAULT
				: EventPoints.fromUnknown(event.pointsToReward),
			hasFood: Boolean(event.hasFood || event.foodDrinksBeingServed),
			needsFlyers: Boolean(event.flyersNeeded),
			needsGraphics: Boolean(event.needsGraphics),
			needsASFunding: Boolean(event.needsAsFunding || event.asFundingRequired),
			estimatedAttendance: Number(event.expectedAttendance || 0),
			status,
			files: Array.isArray(event.files) ? (event.files as string[]) : [],
			invoices: invoices.map((inv: Record<string, unknown>) => ({
				_id: String(inv.id || crypto.randomUUID()),
				vendor: String(inv.vendor || "Unknown"),
				items: Array.isArray(inv.items) ? (inv.items as never[]) : [],
				tax: Number(inv.tax || 0),
				tip: Number(inv.tip || 0),
				invoiceFile:
					typeof inv.invoiceFile === "string" ? inv.invoiceFile : undefined,
				additionalFiles: Array.isArray(inv.additionalFiles)
					? (inv.additionalFiles as string[])
					: [],
				subtotal: Number(inv.subtotal || 0),
				total: Number(inv.total || 0),
				amount: Number(inv.total || 0),
				description: Array.isArray(inv.items)
					? (inv.items as Array<{ description?: string }>)
							.map((item) => item.description)
							.join(", ")
					: "",
				fileUrl:
					typeof inv.invoiceFile === "string" ? inv.invoiceFile : undefined,
			})),
			createdBy: String(
				event.submitterName ||
					event.requestedUser ||
					event.createdBy ||
					"Unknown",
			),
			requestedUser:
				typeof event.requestedUser === "string"
					? event.requestedUser
					: undefined,
			_updatedAt:
				typeof event._updatedAt === "number" ? event._updatedAt : undefined,
			attendeeCount: Number(event.attendeeCount || 0),
			attendees: Array.isArray(event.attendees)
				? (event.attendees as EventRequest["attendees"])
				: [],
			willOrHaveRoomBooking: Boolean(event.willOrHaveRoomBooking),
			roomBookingFiles: Array.isArray(event.roomBookingFiles)
				? (event.roomBookingFiles as string[])
				: [],
			foodDrinksBeingServed: Boolean(event.foodDrinksBeingServed),
			asFundingRequired: Boolean(event.asFundingRequired),
			flyerType: Array.isArray(event.flyerType)
				? (event.flyerType as string[])
				: [],
			otherFlyerType: String(event.otherFlyerType || ""),
			flyerAdvertisingStartDate: Number(event.flyerAdvertisingStartDate || 0),
			flyerAdditionalRequests: String(event.flyerAdditionalRequests || ""),
			photographyNeeded: Boolean(event.photographyNeeded),
			requiredLogos: Array.isArray(event.requiredLogos)
				? (event.requiredLogos as string[])
				: [],
			otherLogos: Array.isArray(event.otherLogos)
				? (event.otherLogos as string[])
				: [],
			advertisingFormat: String(event.advertisingFormat || ""),
			additionalSpecifications: String(event.additionalSpecifications || ""),
			flyersCompleted: Boolean(event.flyersCompleted),
			graphicsUploadNote: String(event.graphicsUploadNote || ""),
			dateTbd: Boolean(event.dateTbd),
			finId: String(event.finId || ""),
			funded: typeof event.funded === "boolean" ? event.funded : undefined,
			tresOwner:
				event.tresOwner === "vco" || event.tresOwner === "president"
					? event.tresOwner
					: undefined,
			progAppDoneAt:
				typeof event.progAppDoneAt === "number"
					? event.progAppDoneAt
					: undefined,
			progAppDoneBy:
				typeof event.progAppDoneBy === "string"
					? event.progAppDoneBy
					: undefined,
			tresStartDoneAt:
				typeof event.tresStartDoneAt === "number"
					? event.tresStartDoneAt
					: undefined,
			tresStartDoneBy:
				typeof event.tresStartDoneBy === "string"
					? event.tresStartDoneBy
					: undefined,
			tresFinishDoneAt:
				typeof event.tresFinishDoneAt === "number"
					? event.tresFinishDoneAt
					: undefined,
			tresFinishDoneBy:
				typeof event.tresFinishDoneBy === "string"
					? event.tresFinishDoneBy
					: undefined,
		};
	}

	static toFormData(initialData?: Partial<EventRequest>): EventFormData {
		if (!initialData) return { ...EventRequestMapping.defaultFormData };
		return {
			eventName:
				initialData.eventName || EventRequestMapping.defaultFormData.eventName,
			eventDescription:
				initialData.eventDescription ||
				EventRequestMapping.defaultFormData.eventDescription,
			eventType: initialData.eventType
				? normalizeEventType(initialData.eventType)
				: EventRequestMapping.defaultFormData.eventType,
			department: normalizeDepartment(initialData.department),
			location:
				initialData.location || EventRequestMapping.defaultFormData.location,
			startDate: initialData.startDate || Date.now(),
			endDate: initialData.endDate || Date.now() + 3600000,
			eventCode:
				initialData.eventCode || EventRequestMapping.defaultFormData.eventCode,
			pointsToReward: EventPoints.fromUnknown(initialData.pointsToReward),
			hasFood:
				initialData.hasFood ??
				initialData.foodDrinksBeingServed ??
				EventRequestMapping.defaultFormData.hasFood,
			needsFlyers:
				initialData.needsFlyers ??
				EventRequestMapping.defaultFormData.needsFlyers,
			needsGraphics:
				initialData.needsGraphics ??
				EventRequestMapping.defaultFormData.needsGraphics,
			needsASFunding:
				initialData.needsASFunding ??
				EventRequestMapping.defaultFormData.needsASFunding,
			estimatedAttendance:
				initialData.estimatedAttendance ??
				EventRequestMapping.defaultFormData.estimatedAttendance,
			files: initialData.files || [],
			invoices: initialData.invoices || [],
			willOrHaveRoomBooking:
				initialData.willOrHaveRoomBooking ??
				EventRequestMapping.defaultFormData.willOrHaveRoomBooking,
			roomBookingFiles: initialData.roomBookingFiles || [],
			foodDrinksBeingServed:
				initialData.foodDrinksBeingServed ??
				initialData.hasFood ??
				EventRequestMapping.defaultFormData.foodDrinksBeingServed,
			asFundingRequired:
				initialData.asFundingRequired ??
				initialData.needsASFunding ??
				EventRequestMapping.defaultFormData.asFundingRequired,
			flyerType: initialData.flyerType || [],
			otherFlyerType: initialData.otherFlyerType || "",
			flyerAdvertisingStartDate: initialData.flyerAdvertisingStartDate || 0,
			flyerAdditionalRequests: initialData.flyerAdditionalRequests || "",
			photographyNeeded:
				initialData.photographyNeeded ??
				EventRequestMapping.defaultFormData.photographyNeeded,
			requiredLogos: initialData.requiredLogos || [],
			otherLogos: initialData.otherLogos || [],
			advertisingFormat: initialData.advertisingFormat || "",
			additionalSpecifications: initialData.additionalSpecifications || "",
			flyersCompleted:
				initialData.flyersCompleted ??
				EventRequestMapping.defaultFormData.flyersCompleted,
			graphicsUploadNote:
				initialData.graphicsUploadNote ||
				EventRequestMapping.defaultFormData.graphicsUploadNote,
		};
	}

	static toInvoiceArgs(data: EventFormData): InvoiceInput[] {
		return data.invoices.map((inv) => ({
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
		}));
	}

	static toCreateArgs(logtoId: string, data: EventFormData) {
		return {
			logtoId,
			eventName: data.eventName,
			location: data.location,
			startDate: data.startDate,
			endDate: data.endDate,
			eventDescription: data.eventDescription,
			eventCode: data.eventCode,
			pointsToReward: EventPoints.fromUnknown(data.pointsToReward),
			eventType: normalizeEventType(data.eventType),
			department: data.department,
			expectedAttendance: data.estimatedAttendance,
			flyersNeeded: data.needsFlyers,
			needsGraphics: data.needsGraphics,
			needsAsFunding: data.needsASFunding,
			invoices: EventRequestMapping.toInvoiceArgs(data),
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
		};
	}

	static toUpdateArgs(logtoId: string, eventId: string, data: EventFormData) {
		return {
			logtoId,
			id: eventId as never,
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
			pointsToReward: EventPoints.fromUnknown(data.pointsToReward),
			invoices: EventRequestMapping.toInvoiceArgs(data),
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
		};
	}

	static toDraftCreateArgs(logtoId: string, data: Partial<EventRequest>) {
		return {
			logtoId,
			eventName: data.eventName || "Draft Event",
			location: data.location || "TBD",
			startDate: data.startDate || Date.now(),
			endDate: data.endDate || Date.now() + 3600000,
			eventDescription: data.eventDescription || "",
			eventCode: data.eventCode || `EVENT-${Date.now()}`,
			pointsToReward: EventPoints.fromUnknown(data.pointsToReward),
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
			invoices: [] as InvoiceInput[],
			needsGraphics: false,
			needsAsFunding: false,
			graphicsUploadNote: "",
		};
	}

	static toDraftUpdateArgs(
		logtoId: string,
		eventId: string,
		data: Partial<EventRequest>,
		editingDraft: EventRequest,
	) {
		return {
			logtoId,
			id: eventId as never,
			eventName: data.eventName || editingDraft.eventName,
			location: data.location || editingDraft.location,
			startDate: data.startDate || editingDraft.startDate,
			endDate: data.endDate || editingDraft.endDate,
			eventDescription: data.eventDescription || editingDraft.eventDescription,
			eventCode:
				data.eventCode || editingDraft.eventCode || `EVENT-${Date.now()}`,
			pointsToReward: EventPoints.fromUnknown(
				data.pointsToReward ?? editingDraft.pointsToReward,
			),
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
		};
	}
}
