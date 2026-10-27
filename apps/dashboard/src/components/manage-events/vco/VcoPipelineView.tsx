import { format } from "date-fns";
import {
	AlertTriangle,
	CalendarClock,
	MapPin,
	UserRound,
	Users,
	Utensils,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	type CalendarDate,
	type QuarterStartSettings,
	VcoDeadlines,
	type VcoFlag,
	type VcoPipelineStatus,
	type VcoTresOwner,
} from "@/lib/vco/VcoDeadlines";
import type { EventRequest } from "../types";
import { formatTimeShort } from "../utils/parseTime";

export type VcoPipelinePatch = {
	dateTbd?: boolean;
	finId?: string;
	funded?: boolean;
	tresOwner?: VcoTresOwner;
};

type VcoRow = {
	event: EventRequest;
	status: VcoPipelineStatus;
};

const FLAG_COPY: Record<VcoFlag, string> = {
	missing_venue: "Missing venue",
	missing_headcount: "Missing headcount",
	missing_invoice: "Missing invoice",
	late: "Late",
	food_over_cap: "Over $10/head",
	in_finals_week: "Finals week",
	overdue: "Overdue",
};

function calendarToDate(date: CalendarDate): Date {
	return new Date(date.year, date.month - 1, date.day);
}

function formatCalendarDate(date: CalendarDate): string {
	return format(calendarToDate(date), "MMM d");
}

function countdownLabel(daysUntil: number): string {
	if (daysUntil < 0) return `${Math.abs(daysUntil)}d late`;
	if (daysUntil === 0) return "due today";
	return `${daysUntil}d`;
}

function vendorLabel(event: EventRequest): string {
	const vendors = event.invoices
		.map((invoice) => invoice.vendor?.trim())
		.filter(Boolean);
	return vendors[0] || "—";
}

function foodLabel(status: VcoPipelineStatus, event: EventRequest): string {
	if (status.foodCostPerHead === null) {
		if (!event.hasFood && !event.foodDrinksBeingServed) return "No food";
		return vendorLabel(event);
	}
	const vendor = vendorLabel(event);
	const perHead = `$${status.foodCostPerHead.toFixed(2)}/head`;
	return vendor === "—" ? perHead : `${vendor} · ${perHead}`;
}

function isUpcoming(status: VcoPipelineStatus, today: CalendarDate): boolean {
	if (status.needsDate) return true;
	if (!status.eventDate) return false;
	return VcoDeadlines.compare(status.eventDate, today) >= 0;
}

export function VcoPipelineView({
	events,
	weekLabelSettings,
	nowMs = Date.now(),
	onView,
	onPipelineChange,
}: {
	events: EventRequest[];
	weekLabelSettings: QuarterStartSettings;
	nowMs?: number;
	onView: (event: EventRequest) => void;
	onPipelineChange: (event: EventRequest, patch: VcoPipelinePatch) => void;
}) {
	const isMobile = useIsMobile();
	const [flaggedOnly, setFlaggedOnly] = useState(false);
	const [thisQuarter, setThisQuarter] = useState(false);
	const [search, setSearch] = useState("");

	const finalsWeeks = useMemo(
		() => VcoDeadlines.resolveFinalsWeeks(weekLabelSettings),
		[weekLabelSettings],
	);
	const today = useMemo(() => VcoDeadlines.toCalendarDate(nowMs), [nowMs]);

	const rows = useMemo(() => {
		const computed: VcoRow[] = events.map((event) => ({
			event,
			status: VcoDeadlines.compute(
				{
					eventName: event.eventName,
					startDate: event.startDate,
					dateTbd: event.dateTbd,
					createdAt: event.createdAt ?? event._creationTime,
					location: event.location,
					expectedAttendance: event.estimatedAttendance,
					invoices: event.invoices,
					needsAsFunding: event.needsASFunding,
					asFundingRequired: event.asFundingRequired,
					funded: event.funded,
					tresOwner: event.tresOwner,
				},
				{ nowMs, finalsWeeks },
			),
		}));

		const visible = computed.filter((row) => {
			if (!isUpcoming(row.status, today)) return false;
			if (flaggedOnly && row.status.flags.length === 0) return false;
			if (
				thisQuarter &&
				!row.status.needsDate &&
				row.status.eventDate &&
				!VcoDeadlines.isInCurrentQuarter(
					row.status.eventDate,
					today,
					weekLabelSettings,
				)
			) {
				return false;
			}
			if (search.trim()) {
				const query = search.trim().toLowerCase();
				const haystack = [
					row.event.eventName,
					row.event.location,
					row.event.createdBy,
					row.event.finId,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				if (!haystack.includes(query)) return false;
			}
			return true;
		});

		return VcoDeadlines.sortByNextDeadline(visible);
	}, [
		events,
		finalsWeeks,
		flaggedOnly,
		nowMs,
		search,
		thisQuarter,
		today,
		weekLabelSettings,
	]);

	const datedRows = rows.filter((row) => !row.status.needsDate);
	const undatedRows = rows.filter((row) => row.status.needsDate);
	const flaggedCount = rows.filter((row) => row.status.flags.length > 0).length;

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative min-w-0 max-w-md flex-1">
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search pipeline events..."
						aria-label="Search VCO pipeline events"
					/>
				</div>
				<div className="flex flex-wrap items-center gap-4">
					<label className="inline-flex items-center gap-2 text-sm">
						<Checkbox
							checked={flaggedOnly}
							onCheckedChange={(checked) => setFlaggedOnly(checked === true)}
						/>
						Flagged only
					</label>
					<label className="inline-flex items-center gap-2 text-sm">
						<Checkbox
							checked={thisQuarter}
							onCheckedChange={(checked) => setThisQuarter(checked === true)}
						/>
						This quarter
					</label>
				</div>
			</div>

			<div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
				<span>
					<span className="font-medium text-foreground">
						{datedRows.length}
					</span>{" "}
					upcoming
				</span>
				<span>
					<span className="font-medium text-foreground">{flaggedCount}</span>{" "}
					flagged
				</span>
				<span>
					<span className="font-medium text-foreground">
						{undatedRows.length}
					</span>{" "}
					need a date
				</span>
			</div>

			{undatedRows.length > 0 && (
				<section className="space-y-2">
					<h2 className="text-sm font-medium text-foreground">Needs date</h2>
					{isMobile ? (
						<VcoMobileList
							rows={undatedRows}
							onView={onView}
							onPipelineChange={onPipelineChange}
						/>
					) : (
						<VcoTable
							rows={undatedRows}
							onView={onView}
							onPipelineChange={onPipelineChange}
						/>
					)}
				</section>
			)}

			<section className="space-y-2">
				<h2 className="text-sm font-medium text-foreground">
					Upcoming by next deadline
				</h2>
				{datedRows.length === 0 ? (
					<div className="rounded-md border bg-background p-8 text-center text-sm text-muted-foreground">
						No upcoming dated events match these filters.
					</div>
				) : isMobile ? (
					<VcoMobileList
						rows={datedRows}
						onView={onView}
						onPipelineChange={onPipelineChange}
					/>
				) : (
					<VcoTable
						rows={datedRows}
						onView={onView}
						onPipelineChange={onPipelineChange}
					/>
				)}
			</section>
		</div>
	);
}

function VcoTable({
	rows,
	onView,
	onPipelineChange,
}: {
	rows: VcoRow[];
	onView: (event: EventRequest) => void;
	onPipelineChange: (event: EventRequest, patch: VcoPipelinePatch) => void;
}) {
	return (
		<div className="max-w-full overflow-hidden rounded-md border bg-background">
			<div className="scrollbar-thin overflow-x-auto">
				<Table className="w-full">
					<TableHeader>
						<TableRow className="border-b hover:bg-transparent">
							<TableHead className="px-4 py-3 pl-6">Event</TableHead>
							<TableHead className="px-4 py-3">Date</TableHead>
							<TableHead className="px-4 py-3">Officer</TableHead>
							<TableHead className="px-4 py-3">Venue / time</TableHead>
							<TableHead className="px-4 py-3">Headcount</TableHead>
							<TableHead className="px-4 py-3">Food / vendor</TableHead>
							<TableHead className="px-4 py-3">Next deadline</TableHead>
							<TableHead className="px-4 py-3 pr-6">Pipeline</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow
								key={row.event._id}
								className="border-b last:border-b-0 hover:bg-muted/40"
							>
								<TableCell className="min-w-[180px] px-4 py-3 pl-6">
									<button
										type="button"
										className="block max-w-[220px] truncate text-left font-medium text-foreground hover:underline"
										onClick={() => onView(row.event)}
									>
										{row.event.eventName}
									</button>
									<div className="mt-1 flex flex-wrap gap-1">
										<FlagBadges flags={row.status.flags} />
									</div>
								</TableCell>
								<TableCell className="px-4 py-3 text-sm tabular-nums">
									{row.status.needsDate
										? "Needs date"
										: format(row.event.startDate, "MMM d, yyyy")}
								</TableCell>
								<TableCell className="px-4 py-3 text-sm">
									{row.event.createdBy}
								</TableCell>
								<TableCell className="min-w-[140px] px-4 py-3">
									<div className="flex items-center gap-1.5 text-sm">
										<MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										<span className="max-w-[160px] truncate">
											{row.event.location || "TBD"}
										</span>
									</div>
									<div className="mt-0.5 text-xs text-muted-foreground">
										{row.status.needsDate
											? "—"
											: formatTimeShort(row.event.startDate)}
									</div>
								</TableCell>
								<TableCell className="px-4 py-3 text-sm tabular-nums">
									{row.event.estimatedAttendance > 0
										? row.event.estimatedAttendance
										: "—"}
								</TableCell>
								<TableCell className="min-w-[140px] px-4 py-3 text-sm">
									{foodLabel(row.status, row.event)}
								</TableCell>
								<TableCell className="min-w-[170px] px-4 py-3">
									<DeadlineCell status={row.status} />
								</TableCell>
								<TableCell className="min-w-[220px] px-4 py-3 pr-6">
									<PipelineEditor
										key={row.event._id}
										event={row.event}
										status={row.status}
										onPipelineChange={onPipelineChange}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

function VcoMobileList({
	rows,
	onView,
	onPipelineChange,
}: {
	rows: VcoRow[];
	onView: (event: EventRequest) => void;
	onPipelineChange: (event: EventRequest, patch: VcoPipelinePatch) => void;
}) {
	return (
		<div className="space-y-3">
			{rows.map((row) => (
				<article
					key={row.event._id}
					className="space-y-3 rounded-md border bg-background p-4"
				>
					<div className="flex items-start justify-between gap-3">
						<button
							type="button"
							className="min-w-0 text-left"
							onClick={() => onView(row.event)}
						>
							<h3 className="truncate font-medium text-foreground">
								{row.event.eventName}
							</h3>
							<p className="text-xs text-muted-foreground">
								{row.status.needsDate
									? "Needs date"
									: format(row.event.startDate, "MMM d, yyyy")}
							</p>
						</button>
						<FlagBadges flags={row.status.flags} />
					</div>
					<dl className="grid grid-cols-2 gap-2 text-sm">
						<div>
							<dt className="text-xs text-muted-foreground">Officer</dt>
							<dd className="flex items-center gap-1.5">
								<UserRound className="h-3.5 w-3.5 text-muted-foreground" />
								{row.event.createdBy}
							</dd>
						</div>
						<div>
							<dt className="text-xs text-muted-foreground">Headcount</dt>
							<dd className="flex items-center gap-1.5">
								<Users className="h-3.5 w-3.5 text-muted-foreground" />
								{row.event.estimatedAttendance > 0
									? row.event.estimatedAttendance
									: "—"}
							</dd>
						</div>
						<div>
							<dt className="text-xs text-muted-foreground">Venue / time</dt>
							<dd>
								{row.event.location || "TBD"}
								{!row.status.needsDate && (
									<span className="block text-xs text-muted-foreground">
										{formatTimeShort(row.event.startDate)}
									</span>
								)}
							</dd>
						</div>
						<div>
							<dt className="text-xs text-muted-foreground">Food / vendor</dt>
							<dd className="flex items-center gap-1.5">
								<Utensils className="h-3.5 w-3.5 text-muted-foreground" />
								{foodLabel(row.status, row.event)}
							</dd>
						</div>
					</dl>
					<DeadlineCell status={row.status} />
					<PipelineEditor
						key={row.event._id}
						event={row.event}
						status={row.status}
						onPipelineChange={onPipelineChange}
					/>
				</article>
			))}
		</div>
	);
}

function FlagBadges({ flags }: { flags: VcoFlag[] }) {
	if (flags.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-1">
			{flags.map((flag) => {
				const warning = flag === "food_over_cap" || flag === "in_finals_week";
				const late = flag === "late";
				return (
					<Badge
						key={flag}
						variant={warning ? "warning" : late ? "secondary" : "destructive"}
					>
						{flag === "late" ? (
							"Late"
						) : warning ? (
							<>
								<AlertTriangle />
								{FLAG_COPY[flag]}
							</>
						) : (
							FLAG_COPY[flag]
						)}
					</Badge>
				);
			})}
		</div>
	);
}

function DeadlineCell({ status }: { status: VcoPipelineStatus }) {
	if (status.needsDate || !status.nextDeadline) {
		return <span className="text-sm text-muted-foreground">No deadline</span>;
	}
	const overdue = status.nextDeadline.overdue;
	return (
		<div className={overdue ? "text-tone-danger" : "text-foreground"}>
			<div className="flex items-center gap-1.5 text-sm font-medium">
				<CalendarClock className="h-3.5 w-3.5 shrink-0" />
				{status.nextDeadline.label}
			</div>
			<div className="text-xs tabular-nums">
				{formatCalendarDate(status.nextDeadline.date)} ·{" "}
				{countdownLabel(status.nextDeadline.daysUntil)}
			</div>
		</div>
	);
}

function PipelineEditor({
	event,
	status,
	onPipelineChange,
}: {
	event: EventRequest;
	status: VcoPipelineStatus;
	onPipelineChange: (event: EventRequest, patch: VcoPipelinePatch) => void;
}) {
	const [finId, setFinId] = useState(event.finId ?? "");

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<Input
					value={finId}
					onChange={(change) => setFinId(change.target.value)}
					onBlur={() => {
						if ((event.finId ?? "") !== finId.trim()) {
							onPipelineChange(event, { finId: finId.trim() });
						}
					}}
					placeholder="FIN-ID"
					aria-label={`FIN-ID for ${event.eventName}`}
					className="h-8 w-[7.5rem] text-xs"
				/>
				<Select
					value={status.tresOwner}
					onValueChange={(value) =>
						onPipelineChange(event, { tresOwner: value as VcoTresOwner })
					}
				>
					<SelectTrigger
						className="h-8 w-[7.5rem] text-xs"
						aria-label={`T-Res owner for ${event.eventName}`}
					>
						<SelectValue placeholder="T-Res owner" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="vco">T-Res: VCO</SelectItem>
						<SelectItem value="president">T-Res: President</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-wrap items-center gap-3 text-xs">
				<label className="inline-flex items-center gap-1.5">
					<Switch
						size="sm"
						checked={status.funded}
						onCheckedChange={(checked) =>
							onPipelineChange(event, { funded: checked })
						}
						aria-label={`Funded status for ${event.eventName}`}
					/>
					Funded
				</label>
				<label className="inline-flex items-center gap-1.5">
					<Checkbox
						checked={Boolean(event.dateTbd)}
						onCheckedChange={(checked) =>
							onPipelineChange(event, { dateTbd: checked === true })
						}
					/>
					Needs date
				</label>
			</div>
		</div>
	);
}
