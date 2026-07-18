import { api } from "@convex/_generated/api";
import { format } from "date-fns";
import {
	Calendar,
	Check,
	Clock,
	Copy,
	DollarSign,
	ExternalLink,
	FileText,
	Globe,
	History,
	Image as ImageIcon,
	Link as LinkIcon,
	Loader2,
	MapPin,
	Pencil,
	Printer,
	Trash2,
	Upload,
	User,
	Users,
	Utensils,
} from "lucide-react";
import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { cn } from "@/lib/utils";
import { formatDepartmentLabel, formatEventTypeLabel } from "../constants";
import { StatusBadge } from "../filters/StatusBadge";
import type { EventRequest, EventStatus } from "../types";

function MetaField({
	icon: Icon,
	label,
	children,
	className,
}: {
	icon?: ComponentType<{ className?: string }>;
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("min-w-0 space-y-1", className)}>
			<div className="flex items-center gap-1.5 text-muted-foreground">
				{Icon ? <Icon className="size-3.5 shrink-0 opacity-70" /> : null}
				<span className="text-[11px] font-medium uppercase tracking-wider">
					{label}
				</span>
			</div>
			<div className="text-sm font-medium text-foreground">{children}</div>
		</div>
	);
}

interface EventViewModalProps {
	isOpen: boolean;
	onClose: () => void;
	event: EventRequest | null;
	onEdit?: (event: EventRequest) => void;
	onDelete?: (event: EventRequest) => void;
	onDecline?: (event: EventRequest) => void;
	onStatusChange?: (event: EventRequest, status: EventStatus) => void;
	onTogglePublish?: (event: EventRequest, canPublish: boolean) => void;
	onUpdateGraphics?: (
		event: EventRequest,
		updates: { flyersCompleted: boolean; graphicsUploadNote?: string },
	) => Promise<void> | void;
	canManageStatus?: boolean;
}

const editableStatuses: { value: EventStatus; label: string }[] = [
	{ value: "submitted", label: "Submitted" },
	{ value: "pending", label: "Pending" },
	{ value: "needs_review", label: "Needs Review" },
	{ value: "approved", label: "Approved" },
	{ value: "published", label: "Published" },
	{ value: "declined", label: "Declined" },
];

function isResolvableStorageId(value: string) {
	if (!value) return false;
	if (value.startsWith("http://") || value.startsWith("https://")) return false;
	if (value.startsWith("data:")) return false;
	return true;
}

function getDisplayFileName(fileRef: string, fallback: string) {
	try {
		const url = new URL(fileRef);
		const fromUrl = url.pathname.split("/").pop();
		return fromUrl || fallback;
	} catch {
		return fileRef.length > 48
			? `${fileRef.slice(0, 24)}...${fileRef.slice(-12)}`
			: fileRef || fallback;
	}
}

function areResolvedUrlMapsEqual(
	current: Record<string, string>,
	next: Record<string, string>,
) {
	const currentKeys = Object.keys(current);
	const nextKeys = Object.keys(next);
	if (currentKeys.length !== nextKeys.length) return false;

	return currentKeys.every((key) => current[key] === next[key]);
}

function formatInvoiceData(event: EventRequest, invoiceIndex?: number): string {
	if (!event.invoices || event.invoices.length === 0) {
		return "No invoice data available";
	}

	if (
		invoiceIndex !== undefined &&
		invoiceIndex >= 0 &&
		invoiceIndex < event.invoices.length
	) {
		const invoice = event.invoices[invoiceIndex];
		const itemStrings = invoice.items.map(
			(item) =>
				`${item.quantity || 1} ${item.description || "Item"} x${(item.unitPrice || 0).toFixed(2)} each`,
		);
		const subtotal = invoice.items.reduce(
			(sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0),
			0,
		);
		const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);
		let line = itemStrings.join(" | ");
		if (invoice.tax > 0) line += ` | Tax = ${invoice.tax.toFixed(2)}`;
		if (invoice.tip > 0) line += ` | Tip = ${invoice.tip.toFixed(2)}`;
		line += ` | Total = ${total.toFixed(2)} from ${invoice.vendor || "Unknown Vendor"}`;
		return line;
	}

	return event.invoices
		.map((invoice, idx) => {
			const itemStrings = invoice.items.map(
				(item) =>
					`${item.quantity || 1} ${item.description || "Item"} x${(item.unitPrice || 0).toFixed(2)} each`,
			);
			const subtotal = invoice.items.reduce(
				(sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0),
				0,
			);
			const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);
			let line = `Invoice ${idx + 1}: ${itemStrings.join(" | ")}`;
			if (invoice.tax > 0) line += ` | Tax = ${invoice.tax.toFixed(2)}`;
			if (invoice.tip > 0) line += ` | Tip = ${invoice.tip.toFixed(2)}`;
			line += ` | Total = ${total.toFixed(2)} from ${invoice.vendor || "Unknown Vendor"}`;
			return line;
		})
		.join("\n\n");
}

export function EventViewModal({
	isOpen,
	onClose,
	event,
	onEdit,
	onDelete,
	onStatusChange,
	onTogglePublish,
	onUpdateGraphics,
	canManageStatus,
}: EventViewModalProps) {
	const getStorageUrl = useAuthedMutation(api.events.getStorageUrl);
	const generateUploadUrl = useAuthedMutation(api.events.generateUploadUrl);
	const [activeTab, setActiveTab] = useState("details");
	const [copiedInvoice, setCopiedInvoice] = useState(false);
	const [graphicsCompleted, setGraphicsCompleted] = useState(false);
	const [graphicsUploadNote, setGraphicsUploadNote] = useState("");
	const [isSavingGraphics, setIsSavingGraphics] = useState(false);
	const [isUploadingGraphics, setIsUploadingGraphics] = useState(false);
	const [resolvedStorageUrls, setResolvedStorageUrls] = useState<
		Record<string, string>
	>({});
	const getStorageUrlRef = useRef(getStorageUrl);
	const resolvableFileRefsRef = useRef<string[]>([]);

	useEffect(() => {
		getStorageUrlRef.current = getStorageUrl;
	}, [getStorageUrl]);

	useEffect(() => {
		if (!event) return;
		setGraphicsCompleted(Boolean(event.flyersCompleted));
		setGraphicsUploadNote(event.graphicsUploadNote || "");
	}, [event]);

	const allFileRefs = useMemo(() => {
		if (!event) return [];
		const invoiceRefs = event.invoices.flatMap((invoice) => [
			...(invoice.invoiceFile ? [invoice.invoiceFile] : []),
			...(invoice.additionalFiles || []),
		]);
		return Array.from(
			new Set([
				...(event.files || []),
				...(event.roomBookingFiles || []),
				...invoiceRefs,
			]),
		);
	}, [event]);

	const resolvableFileRefs = useMemo(
		() => allFileRefs.filter(isResolvableStorageId).sort(),
		[allFileRefs],
	);
	const resolvableFileRefsKey = resolvableFileRefs.join("|");

	useEffect(() => {
		resolvableFileRefsRef.current = resolvableFileRefs;
	}, [resolvableFileRefs]);

	useEffect(() => {
		if (!event || !isOpen) return;
		let cancelled = false;

		const resolveRefs = async () => {
			const currentResolvableFileRefs = resolvableFileRefsRef.current;
			if (currentResolvableFileRefs.length === 0) {
				setResolvedStorageUrls((current) =>
					Object.keys(current).length === 0 ? current : {},
				);
				return;
			}

			const resolvedEntries = await Promise.all(
				currentResolvableFileRefs.map(async (ref) => {
					try {
						const url = await getStorageUrlRef.current({ storageId: ref });
						return [ref, url || ""] as const;
					} catch {
						return [ref, ""] as const;
					}
				}),
			);

			if (cancelled) return;
			const nextMap = Object.fromEntries(
				resolvedEntries.filter(([, value]) => Boolean(value)),
			) as Record<string, string>;
			setResolvedStorageUrls((current) =>
				areResolvedUrlMapsEqual(current, nextMap) ? current : nextMap,
			);
		};

		resolveRefs();
		return () => {
			cancelled = true;
		};
	}, [event?._id, isOpen, resolvableFileRefsKey]);

	if (!event) return null;

	const formatDate = (timestamp: number) => {
		return format(new Date(timestamp), "MMMM d, yyyy");
	};

	const formatTime = (timestamp: number) => {
		return format(new Date(timestamp), "h:mm a");
	};

	const resolveFileUrl = (fileRef: string) => {
		if (!fileRef) return null;
		if (!isResolvableStorageId(fileRef)) return fileRef;
		return resolvedStorageUrls[fileRef] || null;
	};

	const getRequirements = () => {
		const reqs = [];
		if (event.hasFood) reqs.push({ icon: Utensils, label: "Food" });
		if (event.needsFlyers) reqs.push({ icon: Printer, label: "Flyers" });
		if (event.needsGraphics)
			reqs.push({
				icon: ImageIcon,
				label: "Graphics",
				completed: Boolean(event.flyersCompleted),
			});
		return reqs;
	};

	const requirements = getRequirements();
	const totalInvoices = event.invoices.reduce(
		(sum, inv) => sum + (inv.total || inv.amount || 0),
		0,
	);
	const attendees = event.attendees || [];

	const invoiceFileRefs = event.invoices.flatMap((invoice) => [
		...(invoice.invoiceFile ? [invoice.invoiceFile] : []),
		...(invoice.additionalFiles || []),
	]);

	const graphicsNeeds =
		event.flyerType && event.flyerType.length > 0
			? event.flyerType
			: [
					...(event.needsFlyers ? ["Flyers"] : []),
					...(event.needsGraphics ? ["Marketing Graphics"] : []),
				];

	const copyInvoiceData = async () => {
		try {
			await navigator.clipboard.writeText(formatInvoiceData(event));
			setCopiedInvoice(true);
			setTimeout(() => setCopiedInvoice(false), 2000);
		} catch {
			// no-op: avoid throwing on restricted clipboard contexts
		}
	};

	const saveGraphicsUpdate = async () => {
		if (!onUpdateGraphics) return;
		setIsSavingGraphics(true);
		try {
			await onUpdateGraphics(event, {
				flyersCompleted: graphicsCompleted,
				graphicsUploadNote: graphicsUploadNote.trim() || undefined,
			});
		} finally {
			setIsSavingGraphics(false);
		}
	};

	const handleGraphicsFileUpload = async (file: File) => {
		if (!file) return;
		const maxSize = 25 * 1024 * 1024;
		if (file.size > maxSize) {
			return;
		}
		setIsUploadingGraphics(true);
		try {
			const uploadUrl = await generateUploadUrl({});
			const uploadResponse = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type || "application/octet-stream" },
				body: file,
			});
			if (!uploadResponse.ok) throw new Error("Upload failed");
			const { storageId } = await uploadResponse.json();
			const fileUrl = await getStorageUrl({ storageId });
			if (fileUrl) {
				const newNote = graphicsUploadNote
					? `${graphicsUploadNote}\n${fileUrl}`
					: fileUrl;
				setGraphicsUploadNote(newNote);
			}
		} catch (error) {
			console.error("Graphics file upload failed:", error);
		} finally {
			setIsUploadingGraphics(false);
		}
	};

	const isUrl = (text: string) => {
		try {
			const url = new URL(text.trim());
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	};

	const renderFileCards = (files: string[], sectionName: string) => {
		if (files.length === 0) {
			return (
				<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-7 text-center">
					<p className="text-sm text-muted-foreground">
						No {sectionName.toLowerCase()} attached
					</p>
				</div>
			);
		}

		return (
			<div className="grid gap-2 sm:grid-cols-2">
				{files.map((fileRef, idx) => {
					const fileUrl = resolveFileUrl(fileRef);
					return (
						<div
							key={`${sectionName}-${idx}`}
							className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2.5"
						>
							<div className="flex min-w-0 items-center gap-2.5">
								<div className="rounded-md bg-ds-blue-100 p-1.5">
									<FileText className="size-4 text-tone-info" />
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">
										{getDisplayFileName(fileRef, `${sectionName} ${idx + 1}`)}
									</p>
									<p className="text-xs text-muted-foreground">
										{fileUrl ? "Ready" : "Resolving…"}
									</p>
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon-sm"
								disabled={!fileUrl}
								onClick={() => {
									if (fileUrl)
										window.open(fileUrl, "_blank", "noopener,noreferrer");
								}}
							>
								<ExternalLink className="size-4" />
							</Button>
						</div>
					);
				})}
			</div>
		);
	};

	const footer = (
		<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex gap-2">
				{onEdit && (
					<Button
						size="sm"
						className="h-11 flex-1 sm:h-9 sm:flex-none"
						onClick={() => onEdit(event)}
					>
						<Pencil className="h-4 w-4" />
						Edit Event
					</Button>
				)}
				{onDelete && (
					<Button
						variant="outline"
						size="sm"
						className="h-11 flex-1 sm:h-9 sm:flex-none text-destructive hover:bg-destructive/10 border-destructive/30"
						onClick={() => onDelete(event)}
					>
						<Trash2 className="h-4 w-4" />
						Delete
					</Button>
				)}
			</div>
			<Button
				variant="outline"
				onClick={onClose}
				size="sm"
				className="h-11 w-full sm:h-9 sm:w-auto sm:px-5"
			>
				Close
			</Button>
		</div>
	);

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={event.eventName}
			variant="fullscreen"
			className="sm:max-w-4xl"
			footer={footer}
		>
			<div className="space-y-5 pb-2">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<StatusBadge status={event.status} />
					<span className="text-sm text-muted-foreground">
						{formatEventTypeLabel(event.eventType)}
					</span>
				</div>

				{event.status !== "draft" && canManageStatus && (
					<div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						<div className="flex items-center gap-2.5">
							<Label
								htmlFor="event-status"
								className="text-xs font-medium whitespace-nowrap text-muted-foreground"
							>
								Status
							</Label>
							<Select
								value={event.status}
								onValueChange={(value) => {
									if (onStatusChange)
										onStatusChange(event, value as EventStatus);
								}}
							>
								<SelectTrigger
									id="event-status"
									className="h-8 w-[148px] bg-background text-xs"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{editableStatuses.map((s) => (
										<SelectItem
											key={s.value}
											value={s.value}
											className="text-xs"
										>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center justify-between gap-3 border-t border-border/50 pt-2.5 sm:border-0 sm:pt-0">
							<Label
								htmlFor="can-publish"
								className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground"
							>
								<Globe className="size-3.5 shrink-0" />
								Show on website
							</Label>
							<Switch
								id="can-publish"
								size="sm"
								checked={event.status === "published"}
								onCheckedChange={(checked) => {
									if (onTogglePublish) onTogglePublish(event, checked);
								}}
							/>
						</div>
					</div>
				)}

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex flex-col gap-4"
				>
					<div className="scrollbar-quiet -mx-1 overflow-x-auto px-1 sm:overflow-visible">
						<TabsList className="h-9 w-max min-w-full justify-start sm:w-full">
							<TabsTrigger value="details" className="px-3">
								Details
							</TabsTrigger>
							<TabsTrigger value="files" className="px-3">
								Files
							</TabsTrigger>
							<TabsTrigger value="graphics" className="px-3">
								Graphics
							</TabsTrigger>
							<TabsTrigger value="funding" className="px-3">
								Funding
							</TabsTrigger>
							<TabsTrigger value="attendees" className="px-3">
								Attendees
							</TabsTrigger>
							<TabsTrigger value="history" className="px-3">
								History
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="details" className="mt-0 space-y-5">
						<div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
							<MetaField icon={Calendar} label="Date & Time">
								<p className="text-balance">{formatDate(event.startDate)}</p>
								<p className="mt-0.5 text-xs font-normal text-muted-foreground">
									{formatTime(event.startDate)} – {formatTime(event.endDate)}
								</p>
							</MetaField>

							<MetaField icon={MapPin} label="Location">
								<p className="text-balance">{event.location}</p>
							</MetaField>

							<MetaField icon={Users} label="Expected">
								<p className="tabular-nums">
									{event.estimatedAttendance || "N/A"}
								</p>
							</MetaField>

							<MetaField icon={User} label="Organizer">
								<p className="truncate" title={event.createdBy}>
									{event.createdBy}
								</p>
								<p className="mt-0.5 text-xs font-normal text-muted-foreground">
									{formatDate(event._creationTime)}
								</p>
							</MetaField>
						</div>

						<div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border/50 pt-5">
							<MetaField icon={FileText} label="Event Code">
								<p className="w-fit rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs tracking-wide">
									{event.eventCode}
								</p>
							</MetaField>

							{event.department ? (
								<MetaField label="Department">
									<p>{formatDepartmentLabel(event.department)}</p>
								</MetaField>
							) : null}
						</div>

						{requirements.length > 0 && (
							<div className="border-t border-border/50 pt-5">
								<span className="mb-2.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
									Requirements
								</span>
								<div className="flex flex-wrap gap-1.5">
									{requirements.map((req) => (
										<span
											key={req.label}
											className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
										>
											<req.icon className="size-3.5 opacity-70" />
											{req.label}
											{req.completed ? (
												<Check className="size-3 text-tone-success" />
											) : null}
										</span>
									))}
								</div>
							</div>
						)}

						<div className="border-t border-border/50 pt-5">
							<span className="mb-2.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
								Description
							</span>
							<div className="rounded-lg bg-muted/25 px-3.5 py-3 text-sm leading-relaxed text-pretty whitespace-pre-wrap text-foreground">
								{event.eventDescription || "No description provided."}
							</div>
						</div>
					</TabsContent>

					<TabsContent value="files" className="mt-0 space-y-5">
						<div>
							<h4 className="mb-2.5 text-sm font-medium">Room Booking</h4>
							{renderFileCards(event.roomBookingFiles || [], "Room Booking")}
						</div>
						<div>
							<h4 className="mb-2.5 text-sm font-medium">Invoices</h4>
							{renderFileCards(invoiceFileRefs, "Invoice")}
						</div>
						<div>
							<h4 className="mb-2.5 text-sm font-medium">General</h4>
							{renderFileCards(event.files || [], "Event File")}
						</div>
					</TabsContent>

					<TabsContent value="graphics" className="mt-0 space-y-4">
						<div className="rounded-lg border border-border/60 bg-card/50 p-4">
							<h4 className="mb-2.5 text-sm font-medium">Graphics Needed</h4>
							{graphicsNeeds.length > 0 ? (
								<div className="flex flex-wrap gap-1.5">
									{graphicsNeeds.map((need) => (
										<span
											key={need}
											className="inline-flex items-center gap-1.5 rounded-md border border-ds-blue-100 bg-ds-blue-100 px-2.5 py-1 text-xs font-medium text-tone-info"
										>
											<ImageIcon className="size-3 opacity-80" />
											{need}
										</span>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									No graphics requirements listed.
								</p>
							)}
						</div>

						<div className="space-y-4 rounded-lg border border-border/60 bg-card/50 p-4">
							<div className="flex items-center justify-between">
								<div>
									<h4 className="text-sm font-semibold">Graphics Delivery</h4>
									<p className="text-xs text-muted-foreground">
										Upload a file directly or paste a link to where graphics
										were delivered.
									</p>
								</div>
							</div>

							<div className="space-y-3">
								<Label htmlFor="graphics-upload-note">Link or File URL</Label>
								<div className="flex gap-2">
									<Input
										id="graphics-upload-note"
										value={graphicsUploadNote}
										onChange={(e) => setGraphicsUploadNote(e.target.value)}
										placeholder="Paste a drive folder link, URL, or upload a file below"
										disabled={!onUpdateGraphics || event.status === "published"}
										className="flex-1"
									/>
									{graphicsUploadNote &&
										isUrl(graphicsUploadNote.split("\n")[0]) && (
											<Button
												variant="outline"
												size="icon"
												onClick={() =>
													window.open(
														graphicsUploadNote.split("\n")[0],
														"_blank",
														"noopener,noreferrer",
													)
												}
												title="Open link"
											>
												<ExternalLink className="h-4 w-4" />
											</Button>
										)}
								</div>

								{/* Render all URLs in the note as clickable links */}
								{graphicsUploadNote &&
									graphicsUploadNote.split("\n").filter(isUrl).length > 0 && (
										<div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
											<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
												Linked Files
											</p>
											{graphicsUploadNote
												.split("\n")
												.filter(isUrl)
												.map((url, idx) => (
													<a
														key={idx}
														href={url.trim()}
														target="_blank"
														rel="noopener noreferrer"
														className="flex items-center gap-2 text-sm text-tone-info hover:text-tone-info hover:underline truncate"
													>
														<LinkIcon className="h-3.5 w-3.5 shrink-0" />
														<span className="truncate">{url.trim()}</span>
														<ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
													</a>
												))}
										</div>
									)}

								{/* File Upload */}
								{onUpdateGraphics && event.status !== "published" && (
									<div className="flex items-center gap-3">
										<label>
											<Input
												type="file"
												className="hidden"
												accept="image/*,application/pdf,.ai,.psd,.svg,.eps,.fig"
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file) void handleGraphicsFileUpload(file);
													e.target.value = "";
												}}
											/>
											<Button
												variant="outline"
												size="sm"
												asChild
												disabled={isUploadingGraphics}
											>
												<span>
													{isUploadingGraphics ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
													) : (
														<Upload className="h-3.5 w-3.5 mr-1.5" />
													)}
													{isUploadingGraphics
														? "Uploading..."
														: "Upload Graphics File"}
												</span>
											</Button>
										</label>
										<span className="text-xs text-muted-foreground">
											Images, PDFs, SVGs, or design files (max 25MB)
										</span>
									</div>
								)}
							</div>

							<div className="flex items-center justify-between pt-2 border-t">
								<div className="flex items-center gap-2">
									<Checkbox
										id="graphics-completed"
										checked={graphicsCompleted}
										onCheckedChange={(checked) =>
											setGraphicsCompleted(Boolean(checked))
										}
										disabled={!onUpdateGraphics || event.status === "published"}
									/>
									<Label
										htmlFor="graphics-completed"
										className="cursor-pointer"
									>
										Mark graphics as completed
									</Label>
								</div>
								{onUpdateGraphics && event.status !== "published" && (
									<Button
										size="sm"
										onClick={saveGraphicsUpdate}
										disabled={isSavingGraphics || isUploadingGraphics}
									>
										{isSavingGraphics ? "Saving..." : "Save Graphics Update"}
									</Button>
								)}
							</div>
						</div>
					</TabsContent>

					<TabsContent value="funding" className="mt-0 space-y-5">
						<div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/15 px-4 py-3.5">
							<div className="rounded-md bg-ds-green-100 p-2">
								<DollarSign className="size-5 text-tone-success" />
							</div>
							<div>
								<p className="text-sm font-medium">AS Funding</p>
								<p className="text-sm text-muted-foreground">
									{event.needsASFunding ? "Requested" : "Not requested"}
								</p>
							</div>
						</div>

						{event.invoices.length > 0 && (
							<div className="bg-ds-green-100 border border-ds-green-100 rounded-md p-4">
								<div className="flex items-center justify-between mb-2">
									<h4 className="text-sm font-semibold text-tone-success">
										Formatted Invoice Data (Copyable)
									</h4>
									<Button
										size="sm"
										variant="outline"
										onClick={copyInvoiceData}
										className="gap-1.5"
									>
										{copiedInvoice ? (
											<Check className="h-3.5 w-3.5" />
										) : (
											<Copy className="h-3.5 w-3.5" />
										)}
										{copiedInvoice ? "Copied!" : "Copy"}
									</Button>
								</div>
								<p className="text-xs font-mono text-tone-success bg-background/80 border rounded-md p-3 whitespace-pre-wrap break-words">
									{formatInvoiceData(event)}
								</p>
							</div>
						)}

						{event.invoices.length > 0 && (
							<div>
								<h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
									<span>Invoices</span>
									<span className="text-xs font-normal text-muted-foreground">
										{event.invoices.length} items
									</span>
								</h4>
								<div className="space-y-3">
									{event.invoices.map((invoice, index) => {
										const totalAmount = invoice.total || invoice.amount || 0;
										const invoiceFiles = [
											...(invoice.invoiceFile ? [invoice.invoiceFile] : []),
											...(invoice.additionalFiles || []),
										];
										return (
											<div
												key={invoice._id}
												className="border rounded-md bg-card overflow-hidden shadow-sm"
											>
												<div className="p-3 bg-muted/30 border-b flex justify-between items-center">
													<span className="font-medium text-sm">
														{invoice.vendor || `Invoice ${index + 1}`}
													</span>
													<span className="font-bold text-sm text-foreground">
														${totalAmount.toFixed(2)}
													</span>
												</div>
												<div className="p-3 space-y-2">
													{invoice.items.length > 0 ? (
														<ul className="space-y-1">
															{invoice.items.map((item, idx) => (
																<li
																	key={idx}
																	className="text-sm flex justify-between text-muted-foreground"
																>
																	<span>
																		{item.quantity || 1}x {item.description}
																	</span>
																	<span>
																		$
																		{(
																			item.unitPrice ||
																			item.total / (item.quantity || 1)
																		).toFixed(2)}
																	</span>
																</li>
															))}
														</ul>
													) : (
														<p className="text-sm text-muted-foreground italic">
															{invoice.description || "No item details"}
														</p>
													)}

													{invoiceFiles.length > 0 && (
														<div className="pt-2 border-t">
															<p className="text-xs font-medium mb-2">
																Attached Files
															</p>
															<div className="flex flex-wrap gap-2">
																{invoiceFiles.map((fileRef, fileIdx) => {
																	const fileUrl = resolveFileUrl(fileRef);
																	return (
																		<Button
																			key={`${invoice._id}-file-${fileIdx}`}
																			size="sm"
																			variant="outline"
																			className="h-7 text-xs"
																			disabled={!fileUrl}
																			onClick={() => {
																				if (fileUrl)
																					window.open(
																						fileUrl,
																						"_blank",
																						"noopener,noreferrer",
																					);
																			}}
																		>
																			<FileText className="h-3 w-3 mr-1" />
																			{getDisplayFileName(
																				fileRef,
																				`Invoice File ${fileIdx + 1}`,
																			)}
																		</Button>
																	);
																})}
															</div>
														</div>
													)}

													{(invoice.tax > 0 || invoice.tip > 0) && (
														<div className="pt-2 mt-2 border-t border-dashed text-xs text-muted-foreground flex justify-end gap-3">
															{invoice.tax > 0 && (
																<span>Tax: ${invoice.tax.toFixed(2)}</span>
															)}
															{invoice.tip > 0 && (
																<span>Tip: ${invoice.tip.toFixed(2)}</span>
															)}
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
								<div className="flex justify-between items-center mt-6 pt-4 border-t border-dashed">
									<span className="font-medium text-lg">Total Invoiced</span>
									<span className="text-2xl font-bold tracking-tight text-primary">
										${totalInvoices.toFixed(2)}
									</span>
								</div>
							</div>
						)}
					</TabsContent>

					<TabsContent value="attendees" className="mt-0 h-full">
						<div className="space-y-4">
							<div className="flex flex-wrap items-center gap-2">
								<span className="inline-flex items-center rounded-md bg-ds-blue-100 px-2.5 py-1 text-xs font-medium text-tone-info">
									Estimated {event.estimatedAttendance}
								</span>
								<span className="inline-flex items-center rounded-md bg-ds-green-100 px-2.5 py-1 text-xs font-medium tabular-nums text-tone-success">
									Checked in {event.attendeeCount || attendees.length}
								</span>
							</div>

							{attendees.length === 0 ? (
								<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-10 text-center">
									<Users className="mb-3 size-10 text-muted-foreground/35" />
									<h3 className="text-sm font-medium text-foreground">
										No attendees yet
									</h3>
									<p className="mt-1 text-sm text-muted-foreground">
										They'll show up here after check-in.
									</p>
								</div>
							) : (
								<div className="rounded-md border overflow-hidden">
									<div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
										<div className="col-span-5">Attendee</div>
										<div className="col-span-3">Checked In</div>
										<div className="col-span-2">Food</div>
										<div className="col-span-2 text-right">Points</div>
									</div>
									<div className="max-h-[320px] overflow-y-auto divide-y">
										{attendees.map((attendee, idx) => (
											<div
												key={`${attendee.userId}-${attendee.timeCheckedIn}-${idx}`}
												className="grid grid-cols-12 px-4 py-2.5 text-sm items-center"
											>
												<div className="col-span-5 min-w-0">
													<p className="font-medium truncate">
														{attendee.name}
													</p>
													{attendee.email && (
														<p className="text-xs text-muted-foreground truncate">
															{attendee.email}
														</p>
													)}
												</div>
												<div className="col-span-3 text-xs text-muted-foreground">
													{format(
														new Date(attendee.timeCheckedIn),
														"MMM d, yyyy h:mm a",
													)}
												</div>
												<div className="col-span-2 text-xs capitalize">
													{attendee.food || "none"}
												</div>
												<div className="col-span-2 text-right font-medium tabular-nums">
													{attendee.pointsEarned}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</TabsContent>

					<TabsContent value="history" className="mt-0">
						<div className="relative ml-1 space-y-0 border-l border-border/60 pl-5">
							<div className="relative pb-6">
								<div className="absolute -left-[27px] top-0.5 rounded-md border border-border/60 bg-background p-1">
									<Clock className="size-3.5 text-muted-foreground" />
								</div>
								<p className="text-sm font-medium">Created</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{formatDate(event._creationTime)} ·{" "}
									{formatTime(event._creationTime)}
								</p>
							</div>

							<div className="relative">
								<div className="absolute -left-[27px] top-0.5 rounded-md border border-border/60 bg-background p-1">
									<History className="size-3.5 text-muted-foreground" />
								</div>
								<p className="text-sm font-medium">Last updated</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{event._updatedAt
										? `${formatDate(event._updatedAt)} · ${formatTime(event._updatedAt)}`
										: "Never"}
								</p>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</ResponsiveOverlay>
	);
}
