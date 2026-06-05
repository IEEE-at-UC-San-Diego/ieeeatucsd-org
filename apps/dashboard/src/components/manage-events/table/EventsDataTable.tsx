import { useState } from "react";
import {
	ChevronUp,
	ChevronDown,
	Eye,
	Pencil,
	Trash2,
	MapPin,
	Users,
	Utensils,
	Image,
	Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "../filters/StatusBadge";
import { formatEventTypeLabel } from "../constants";
import type { EventRequest, SortConfig } from "../types";
import { format } from "date-fns";

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
	const [hoveredRow, setHoveredRow] = useState<string | null>(null);

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
					className: "bg-green-100 text-green-700 border-green-200",
				});
			} else {
				reqs.push({
					icon: Image,
					label: "Graphics Needed",
					className: "bg-red-100 text-red-700 border-red-200",
				});
			}
		} else {
			reqs.push({
				icon: Image,
				label: "Graphics N/A",
				className: "bg-gray-100 text-gray-600 border-gray-200",
			});
		}
		return reqs;
	};

	if (events.length === 0) {
		return (
			<div className="bg-white rounded-xl border p-8 text-center">
				<div className="text-gray-400 mb-4">
					<MapPin className="w-12 h-12 mx-auto" />
				</div>
				<h3 className="text-lg font-medium text-gray-900 mb-2">
					No events found
				</h3>
				<p className="text-gray-500">
					Create a new event or adjust your filters to see events here.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-xl border overflow-hidden max-w-full">
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
							const isHovered = hoveredRow === event._id;

							return (
								<TableRow
									key={event._id}
									className="border-b last:border-b-0 hover:bg-muted/40 transition-colors cursor-pointer"
									onMouseEnter={() => setHoveredRow(event._id)}
									onMouseLeave={() => setHoveredRow(null)}
									onClick={() => onView(event)}
								>
									<TableCell className="min-w-[180px] py-3 px-4 pl-6">
										<div className="font-medium text-foreground truncate max-w-[200px]">
											{event.eventName}
										</div>
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
														className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-medium border ${req.className || "bg-muted text-muted-foreground border-border"}`}
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
										<div
											className={`flex items-center gap-1 justify-end transition-opacity duration-200 ${
												isHovered ? "opacity-100" : "opacity-0"
											}`}
											onClick={(e) => e.stopPropagation()}
										>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-foreground"
												onClick={(e) => {
													e.stopPropagation();
													onView(event);
												}}
												title="View"
											>
												<Eye className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-foreground"
												onClick={(e) => {
													e.stopPropagation();
													onEdit(event);
												}}
												title="Edit"
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
												onClick={(e) => {
													e.stopPropagation();
													onDelete(event);
												}}
												title="Delete"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
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
