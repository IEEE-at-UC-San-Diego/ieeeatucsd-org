import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { format } from "date-fns";
import {
	MapPin,
	Calendar,
	Users,
	Utensils,
	Printer,
	Image as ImageIcon,
	DollarSign,
	Clock,
	User,
	FileText,
	History,
	Pencil,
	Trash2,
	Globe,
	Check,
	Copy,
	ExternalLink,
	Upload,
	Loader2,
	Link as LinkIcon,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "../filters/StatusBadge";
import { formatDepartmentLabel, formatEventTypeLabel } from "../constants";
import type { EventRequest, EventStatus } from "../types";

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
				<div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed">
					<p className="text-sm text-muted-foreground">
						No {sectionName.toLowerCase()} attached
					</p>
				</div>
			);
		}

		return (
			<div className="grid sm:grid-cols-2 gap-3">
				{files.map((fileRef, idx) => {
					const fileUrl = resolveFileUrl(fileRef);
					return (
						<div
							key={`${sectionName}-${idx}`}
							className="flex items-center justify-between p-3 border rounded-lg bg-card"
						>
							<div className="flex items-center gap-3 overflow-hidden">
								<div className="p-2 bg-blue-50 rounded-md">
									<FileText className="h-5 w-5 text-blue-500" />
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium truncate">
										{getDisplayFileName(fileRef, `${sectionName} ${idx + 1}`)}
									</p>
									<p className="text-xs text-muted-foreground">
										{fileUrl ? "Ready" : "Resolving secure file..."}
									</p>
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								disabled={!fileUrl}
								onClick={() => {
									if (fileUrl)
										window.open(fileUrl, "_blank", "noopener,noreferrer");
								}}
							>
								<ExternalLink className="h-4 w-4" />
							</Button>
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 overflow-hidden flex flex-col">
				<DialogHeader className="p-6 pb-2 space-y-4">
					<div className="flex items-start justify-between">
						<div>
							<DialogTitle className="text-2xl font-bold tracking-tight">
								{event.eventName}
							</DialogTitle>
							<DialogDescription className="sr-only">
								View and manage event details, files, graphics, funding,
								attendees, and history
							</DialogDescription>
							<div className="flex items-center gap-2 mt-2">
								<StatusBadge status={event.status} />
								<span className="text-sm text-muted-foreground border-l pl-2 ml-1">
									{formatEventTypeLabel(event.eventType)}
								</span>
							</div>
						</div>
					</div>

					{event.status !== "draft" && canManageStatus && (
						<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-3 border-y bg-muted/20 -mx-6 px-6">
							<div className="flex items-center gap-2">
								<Label
									htmlFor="event-status"
									className="text-sm font-medium whitespace-nowrap text-muted-foreground"
								>
									Status:
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
										className="w-[140px] h-8 text-xs bg-background"
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
							<div className="flex items-center gap-2">
								<Checkbox
									id="can-publish"
									checked={event.status === "published"}
									onCheckedChange={(checked) => {
										if (onTogglePublish)
											onTogglePublish(event, checked as boolean);
									}}
								/>
								<Label
									htmlFor="can-publish"
									className="text-sm cursor-pointer flex items-center gap-1.5 font-medium"
								>
									<Globe className="h-3.5 w-3.5 text-blue-500" />
									Published
								</Label>
							</div>
						</div>
					)}
				</DialogHeader>

				<div className="flex-1 overflow-y-auto p-6 pt-2">
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="h-full flex flex-col"
					>
						<TabsList className="grid w-full grid-cols-6 mb-4">
							<TabsTrigger value="details">Details</TabsTrigger>
							<TabsTrigger value="files">Files</TabsTrigger>
							<TabsTrigger value="graphics">Graphics</TabsTrigger>
							<TabsTrigger value="funding">Funding</TabsTrigger>
							<TabsTrigger value="attendees">Attendees</TabsTrigger>
							<TabsTrigger value="history">History</TabsTrigger>
						</TabsList>

						<TabsContent
							value="details"
							className="space-y-6 animate-in fade-in-50 duration-300"
						>
							<div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
								<div className="space-y-1">
									<div className="flex items-center gap-2 text-muted-foreground mb-1">
										<Calendar className="h-4 w-4" />
										<span className="text-xs font-semibold uppercase tracking-wider">
											Date & Time
										</span>
									</div>
									<p className="font-medium">{formatDate(event.startDate)}</p>
									<p className="text-sm text-muted-foreground">
										{formatTime(event.startDate)} - {formatTime(event.endDate)}
									</p>
								</div>

								<div className="space-y-1">
									<div className="flex items-center gap-2 text-muted-foreground mb-1">
										<MapPin className="h-4 w-4" />
										<span className="text-xs font-semibold uppercase tracking-wider">
											Location
										</span>
									</div>
									<p className="font-medium">{event.location}</p>
								</div>

								<div className="space-y-1">
									<div className="flex items-center gap-2 text-muted-foreground mb-1">
										<Users className="h-4 w-4" />
										<span className="text-xs font-semibold uppercase tracking-wider">
											Expected Attendees
										</span>
									</div>
									<p className="font-medium">
										{event.estimatedAttendance || "N/A"}
									</p>
								</div>

								<div className="space-y-1">
									<div className="flex items-center gap-2 text-muted-foreground mb-1">
										<User className="h-4 w-4" />
										<span className="text-xs font-semibold uppercase tracking-wider">
											Organizer
										</span>
									</div>
									<p className="font-medium truncate" title={event.createdBy}>
										{event.createdBy}
									</p>
									<p className="text-xs text-muted-foreground">
										on {formatDate(event._creationTime)}
									</p>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-6 pt-4 border-t">
								<div className="space-y-1">
									<div className="flex items-center gap-2 text-muted-foreground mb-1">
										<FileText className="h-4 w-4" />
										<span className="text-xs font-semibold uppercase tracking-wider">
											Event Code
										</span>
									</div>
									<p className="font-mono bg-muted/50 px-2 py-0.5 rounded text-sm w-fit">
										{event.eventCode}
									</p>
								</div>

								{event.department && (
									<div className="space-y-1">
										<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
											Department
										</span>
										<p className="font-medium">
											{formatDepartmentLabel(event.department)}
										</p>
									</div>
								)}
							</div>

							{requirements.length > 0 && (
								<div className="pt-4 border-t">
									<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
										Requirements
									</span>
									<div className="flex flex-wrap gap-2">
										{requirements.map((req) => (
											<span
												key={req.label}
												className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border"
											>
												<req.icon className="h-3.5 w-3.5" />
												{req.label}
												{req.completed && (
													<Check className="h-3 w-3.5 text-green-600 ml-0.5" />
												)}
											</span>
										))}
									</div>
								</div>
							)}

							<div className="pt-4 border-t">
								<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
									Description
								</span>
								<div className="bg-muted/30 p-4 rounded-lg text-sm text-foreground whitespace-pre-wrap leading-relaxed border">
									{event.eventDescription}
								</div>
							</div>
						</TabsContent>

						<TabsContent
							value="files"
							className="space-y-6 animate-in fade-in-50 duration-300"
						>
							<div>
								<h4 className="text-sm font-semibold mb-3">
									Room Booking Files
								</h4>
								{renderFileCards(event.roomBookingFiles || [], "Room Booking")}
							</div>
							<div>
								<h4 className="text-sm font-semibold mb-3">Invoice Files</h4>
								{renderFileCards(invoiceFileRefs, "Invoice")}
							</div>
							<div>
								<h4 className="text-sm font-semibold mb-3">
									General Event Files
								</h4>
								{renderFileCards(event.files || [], "Event File")}
							</div>
						</TabsContent>

						<TabsContent
							value="graphics"
							className="space-y-6 animate-in fade-in-50 duration-300"
						>
							<div className="border rounded-xl p-4 bg-card">
								<h4 className="text-sm font-semibold mb-3">Graphics Needed</h4>
								{graphicsNeeds.length > 0 ? (
									<div className="flex flex-wrap gap-2">
										{graphicsNeeds.map((need) => (
											<span
												key={need}
												className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
											>
												<ImageIcon className="h-3 w-3" />
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

							<div className="border rounded-xl p-4 bg-card space-y-4">
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
											disabled={
												!onUpdateGraphics || event.status === "published"
											}
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
															className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
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
												<input
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
											disabled={
												!onUpdateGraphics || event.status === "published"
											}
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

						<TabsContent
							value="funding"
							className="space-y-6 animate-in fade-in-50 duration-300"
						>
							<div className="flex items-center justify-between p-4 border rounded-xl bg-gradient-to-r from-background to-muted/20">
								<div className="flex items-center gap-4">
									<div className="p-3 bg-green-100 rounded-full">
										<DollarSign className="h-6 w-6 text-green-600" />
									</div>
									<div>
										<p className="font-semibold">AS Funding Requested</p>
										<p className="text-sm text-muted-foreground">
											Status:{" "}
											<span
												className={
													event.needsASFunding
														? "text-green-600 font-medium"
														: "text-muted-foreground"
												}
											>
												{event.needsASFunding ? "Yes" : "No"}
											</span>
										</p>
									</div>
								</div>
							</div>

							{event.invoices.length > 0 && (
								<div className="bg-green-50 border border-green-200 rounded-xl p-4">
									<div className="flex items-center justify-between mb-2">
										<h4 className="text-sm font-semibold text-green-900">
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
									<p className="text-xs font-mono text-green-900 bg-white/80 border rounded-md p-3 whitespace-pre-wrap break-words">
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
													className="border rounded-xl bg-card overflow-hidden shadow-sm"
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

						<TabsContent value="attendees" className="h-full">
							<div className="space-y-4">
								<div className="rounded-xl border p-4 bg-muted/20">
									<div className="flex flex-wrap items-center gap-3 text-sm">
										<span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
											Estimated: {event.estimatedAttendance}
										</span>
										<span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
											Checked In: {event.attendeeCount || attendees.length}
										</span>
									</div>
								</div>

								{attendees.length === 0 ? (
									<div className="h-full flex flex-col items-center justify-center p-8 text-center bg-muted/10 rounded-xl border border-dashed">
										<Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
										<h3 className="font-medium text-foreground">
											No attendees yet
										</h3>
										<p className="text-sm text-muted-foreground mt-1">
											Attendees will appear here after members check in.
										</p>
									</div>
								) : (
									<div className="rounded-xl border overflow-hidden">
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

						<TabsContent value="history" className="space-y-4">
							<div className="space-y-0 relative pl-4 border-l-2 border-muted ml-2">
								<div className="relative pb-6 pl-6">
									<div className="absolute -left-[25px] top-0 p-1 bg-background rounded-full border border-muted">
										<Clock className="h-4 w-4 text-muted-foreground" />
									</div>
									<p className="font-medium text-sm">Event Created</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										{formatDate(event._creationTime)} at{" "}
										{formatTime(event._creationTime)}
									</p>
								</div>

								<div className="relative pl-6">
									<div className="absolute -left-[25px] top-0 p-1 bg-background rounded-full border border-muted">
										<History className="h-4 w-4 text-muted-foreground" />
									</div>
									<p className="font-medium text-sm">Last Updated</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										{event._updatedAt
											? `${formatDate(event._updatedAt)} at ${formatTime(event._updatedAt)}`
											: "Never"}
									</p>
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</div>

				<DialogFooter className="p-6 border-t bg-muted/10 flex justify-between items-center mt-auto">
					<div className="flex gap-2">
						{onEdit && (
							<Button variant="outline" size="sm" onClick={() => onEdit(event)}>
								<Pencil className="h-4 w-4 mr-2" />
								Edit Event
							</Button>
						)}
						{onDelete && (
							<Button
								variant="outline"
								size="sm"
								className="text-destructive hover:bg-destructive/10 border-destructive/20"
								onClick={() => onDelete(event)}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Delete
							</Button>
						)}
					</div>
					<Button onClick={onClose} size="sm" className="px-6">
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
