import { format } from "date-fns";
import {
	ChevronDown,
	ChevronUp,
	Eye,
	Image,
	MapPin,
	MoreHorizontal,
	Pencil,
	Printer,
	Trash2,
	Users,
	Utensils,
} from "lucide-react";
import { MobileDataList, MobileDataListItem } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatEventTypeLabel } from "../constants";
import { StatusBadge } from "../filters/StatusBadge";
import type { EventRequest, SortConfig } from "../types";

interface EventsDataTableProps {
	events: EventRequest[];
	sortConfig: SortConfig;
	onSort: (field: string) => void;
	onView: (event: EventRequest) => void;
	onEdit: (event: EventRequest) => void;
	onDelete: (event: EventRequest) => void;
	onConvertToDraft: (event: EventRequest) => void;
	pagination?: {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
	};
}

export function EventsDataTable({
	events,
	sortConfig,
	onSort,
	onView,
	onEdit,
	onDelete,
	pagination,
}: EventsDataTableProps) {
	const isMobile = useIsMobile();

	const getSortIcon = (field: string) => {
		if (sortConfig.field === field) {
			return sortConfig.direction === "asc" ? (
				<ChevronUp className="w-3.5 h-3.5" />
			) : (
				<ChevronDown className="w-3.5 h-3.5" />
			);
		}
		return null;
	};

	const getRequirements = (event: EventRequest) => {
		const reqs: Array<{
			icon: typeof Utensils;
			label: string;
			className?: string;
		}> = [];
		if (event.hasFood) reqs.push({ icon: Utensils, label: "Food" });
		if (event.needsFlyers) reqs.push({ icon: Printer, label: "Flyers" });
		if (event.needsGraphics) {
			if (event.flyersCompleted) {
				reqs.push({
					icon: Image,
					label: "Graphics Submitted",
					className: "bg-ds-green-100 text-ds-green-700 border-ds-green-100",
				});
			} else {
				reqs.push({
					icon: Image,
					label: "Graphics Needed",
					className: "bg-ds-red-100 text-ds-red-800 border-ds-red-100",
				});
			}
		} else {
			reqs.push({
				icon: Image,
				label: "Graphics N/A",
				className: "bg-muted text-muted-foreground border-border",
			});
		}
		return reqs;
	};

	if (events.length === 0) {
		return (
			<div className="bg-background rounded-md border p-8 text-center">
				<div className="text-muted-foreground mb-4">
					<MapPin className="w-12 h-12 mx-auto" />
				</div>
				<h3 className="text-lg font-medium text-foreground mb-2">
					No events found
				</h3>
				<p className="text-muted-foreground">
					Create a new event or adjust your filters to see events here.
				</p>
			</div>
		);
	}

	if (isMobile) {
		return (
			<div className="space-y-3">
				<MobileDataList>
					{events.map((event) => (
						<MobileDataListItem
							key={event._id}
							title={event.eventName}
							subtitle={
								<span className="flex items-center gap-1">
									<MapPin className="size-3 shrink-0" />
									{event.location}
								</span>
							}
							meta={format(event.startDate, "MMM d, yyyy")}
							status={<StatusBadge status={event.status} />}
							onClick={() => onView(event)}
							actions={
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="size-11"
											aria-label={`More actions for ${event.eventName}`}
										>
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => onView(event)}>
											<Eye /> View
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={() => onEdit(event)}>
											<Pencil /> Edit
										</DropdownMenuItem>
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => onDelete(event)}
										>
											<Trash2 /> Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							}
						/>
					))}
				</MobileDataList>
				{pagination && pagination.totalPages > 1 && (
					<div className="flex items-center justify-between gap-3 px-1">
						<Button
							variant="outline"
							className="h-11 flex-1"
							disabled={pagination.currentPage <= 1}
							onClick={() =>
								pagination.onPageChange(pagination.currentPage - 1)
							}
						>
							Previous
						</Button>
						<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
							Page {pagination.currentPage} of {pagination.totalPages}
						</span>
						<Button
							variant="outline"
							className="h-11 flex-1"
							disabled={pagination.currentPage >= pagination.totalPages}
							onClick={() =>
								pagination.onPageChange(pagination.currentPage + 1)
							}
						>
							Next
						</Button>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="bg-background rounded-md border overflow-hidden max-w-full">
			<div className="overflow-x-auto scrollbar-thin">
				<Table className="w-full">
					<TableHeader>
						<TableRow className="border-b bg-muted/40 hover:bg-muted/40">
							<TableHead
								className="cursor-pointer hover:bg-muted/50 transition-colors w-[30%] py-3 px-4 pl-6"
								onClick={() => onSort("eventName")}
							>
								<span className="flex items-center gap-1">
									Name {getSortIcon("eventName")}
								</span>
							</TableHead>
							<TableHead
								className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4"
								onClick={() => onSort("status")}
							>
								<span className="flex items-center gap-1">
									Status {getSortIcon("status")}
								</span>
							</TableHead>
							<TableHead className="py-3 px-4">Location</TableHead>
							<TableHead className="py-3 px-4">Requirements</TableHead>
							<TableHead
								className="cursor-pointer hover:bg-muted/50 transition-colors text-right py-3 px-4"
								onClick={() => onSort("startDate")}
							>
								<span className="flex items-center justify-end gap-1">
									Date {getSortIcon("startDate")}
								</span>
							</TableHead>
							<TableHead className="text-right py-3 px-4 pr-6">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{events.map((event) => {
							const requirements = getRequirements(event);
							return (
								<TableRow
									key={event._id}
									className="border-b last:border-b-0 transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
								>
									<TableCell className="min-w-[180px] py-3 px-4 pl-6">
										<button
											type="button"
											className="block max-w-[200px] truncate text-left font-medium text-foreground hover:underline"
											onClick={() => onView(event)}
										>
											{event.eventName}
										</button>
										<div className="text-xs text-muted-foreground">
											{formatEventTypeLabel(event.eventType)}
										</div>
									</TableCell>
									<TableCell className="py-3 px-4">
										<StatusBadge status={event.status} />
									</TableCell>
									<TableCell className="min-w-[120px] py-3 px-4">
										<div className="flex items-center gap-1.5 text-sm text-foreground">
											<MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
											<span className="truncate max-w-[150px]">
												{event.location}
											</span>
										</div>
										{event.estimatedAttendance > 0 && (
											<div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
												<Users className="h-3 w-3" />
												Expected: {event.estimatedAttendance}
											</div>
										)}
										{event.status === "published" && (
											<div className="text-xs text-muted-foreground mt-0.5">
												Checked in: {event.attendeeCount || 0}
											</div>
										)}
									</TableCell>
									<TableCell className="py-3 px-4">
										<div className="flex flex-wrap gap-1.5">
											{requirements.length === 0 ? (
												<span className="text-xs text-muted-foreground">-</span>
											) : (
												requirements.map((req) => (
													<span
														key={req.label}
														className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${req.className || "bg-muted text-muted-foreground border-border"}`}
													>
														<req.icon className="h-3 w-3" />
														{req.label}
													</span>
												))
											)}
										</div>
									</TableCell>
									<TableCell className="py-3 px-4 text-right">
										<div className="text-sm font-medium text-foreground tabular-nums">
											{format(event.startDate, "MMM d, yyyy")}
										</div>
									</TableCell>
									<TableCell className="py-3 px-4 pr-6 text-right">
										<div className="flex items-center justify-end gap-1">
											<Button
												variant="ghost"
												size="sm"
												className="text-muted-foreground hover:text-foreground"
												onClick={() => onView(event)}
											>
												<Eye className="h-4 w-4" />
												<span className="hidden xl:inline">View</span>
											</Button>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label={`More actions for ${event.eventName}`}
													>
														<MoreHorizontal />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem onSelect={() => onEdit(event)}>
														<Pencil /> Edit
													</DropdownMenuItem>
													<DropdownMenuItem
														variant="destructive"
														onSelect={() => onDelete(event)}
													>
														<Trash2 /> Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
			{pagination && (
				<div className="flex items-center justify-between px-4 py-3 border-t">
					<span className="text-sm text-muted-foreground">
						Showing {((pagination.currentPage - 1) * 10 + 1).toLocaleString()}{" "}
						to{" "}
						{Math.min(
							pagination.currentPage * 10,
							events.length,
						).toLocaleString()}{" "}
						of {events.length.toLocaleString()} events
					</span>
					<Pagination
						currentPage={pagination.currentPage}
						totalPages={pagination.totalPages}
						onPageChange={pagination.onPageChange}
					/>
				</div>
			)}
		</div>
	);
}
