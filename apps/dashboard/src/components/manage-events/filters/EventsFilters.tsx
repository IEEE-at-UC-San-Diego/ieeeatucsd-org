import { Search, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EventFilters, EventStatus } from "../types";

interface EventsFiltersProps {
	filters: EventFilters;
	onFiltersChange: (filters: EventFilters) => void;
	onClearFilters: () => void;
}

const statusOptions: { value: EventStatus; label: string }[] = [
	{ value: "draft", label: "Draft" },
	{ value: "submitted", label: "Submitted" },
	{ value: "pending", label: "Pending" },
	{ value: "needs_review", label: "Needs Review" },
	{ value: "approved", label: "Approved" },
	{ value: "declined", label: "Declined" },
	{ value: "published", label: "Published" },
];

const presetStatusMap: Record<
	NonNullable<EventFilters["teamPreset"]>,
	EventStatus[]
> = {
	for_events: [],
	for_internal: ["approved", "published"],
	for_operations: ["submitted", "pending", "needs_review"],
};

export function EventsFilters({
	filters,
	onFiltersChange,
	onClearFilters,
}: EventsFiltersProps) {
	const selectedStatuses = filters.statuses || [];
	const hasActiveFilters =
		filters.search.trim().length > 0 ||
		selectedStatuses.length > 0 ||
		Boolean(filters.teamPreset);

	const statusLabel = (() => {
		if (selectedStatuses.length === 0) return "All statuses";
		if (selectedStatuses.length === 1) {
			return (
				statusOptions.find((option) => option.value === selectedStatuses[0])
					?.label || "1 status"
			);
		}
		return `${selectedStatuses.length} statuses`;
	})();

	const handleStatusToggle = (status: EventStatus, checked: boolean) => {
		const nextStatuses = checked
			? [...selectedStatuses, status]
			: selectedStatuses.filter((value) => value !== status);

		onFiltersChange({
			...filters,
			statuses: nextStatuses,
		});
	};

	const handlePresetChange = (
		value: NonNullable<EventFilters["teamPreset"]> | "none",
	) => {
		if (value === "none") {
			onFiltersChange({
				...filters,
				teamPreset: undefined,
			});
			return;
		}

		onFiltersChange({
			...filters,
			teamPreset: value,
			statuses: presetStatusMap[value],
		});
	};

	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
				<div className="relative flex-1 min-w-0 max-w-md">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search events..."
						value={filters.search}
						onChange={(e) =>
							onFiltersChange({ ...filters, search: e.target.value })
						}
						className="pl-9"
					/>
					{filters.search && (
						<button
							onClick={() => onFiltersChange({ ...filters, search: "" })}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							type="button"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				<Select
					value={filters.teamPreset || "none"}
					onValueChange={(value) =>
						handlePresetChange(
							value as NonNullable<EventFilters["teamPreset"]> | "none",
						)
					}
				>
					<SelectTrigger className="w-full sm:w-[180px]">
						<SelectValue placeholder="Team preset" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No team preset</SelectItem>
						<SelectItem value="for_events">For Events</SelectItem>
						<SelectItem value="for_internal">For Internal</SelectItem>
						<SelectItem value="for_operations">For Operations</SelectItem>
					</SelectContent>
				</Select>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							className="w-full justify-between sm:w-[190px]"
						>
							<span className="inline-flex items-center gap-2">
								<SlidersHorizontal className="h-4 w-4" />
								{statusLabel}
							</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56" align="start">
						<DropdownMenuLabel>Status Filters</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{statusOptions.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={selectedStatuses.includes(option.value)}
								onCheckedChange={(checked) =>
									handleStatusToggle(option.value, checked === true)
								}
							>
								{option.label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{hasActiveFilters && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onClearFilters}
					className="shrink-0"
				>
					<X className="h-4 w-4 mr-2" />
					Clear filters
				</Button>
			)}
		</div>
	);
}
