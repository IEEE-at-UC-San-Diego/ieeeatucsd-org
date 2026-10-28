import { AlertTriangle, CalendarClock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
	VcoDeadlines,
	type VcoFlag,
	type VcoPipelineStatus,
	type VcoTresOwner,
} from "@/lib/vco/VcoDeadlines";
import type { EventRequest } from "../types";

export type VcoPipelinePatch = {
	dateTbd?: boolean;
	finId?: string;
	funded?: boolean;
	tresOwner?: VcoTresOwner;
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

export function VcoFlagBadges({ status }: { status: VcoPipelineStatus }) {
	if (!status.needsDate && status.flags.length === 0) return null;

	return (
		<div className="mt-1 flex flex-wrap gap-1">
			{status.needsDate && (
				<Badge variant="warning">
					<AlertTriangle />
					Needs date
				</Badge>
			)}
			{status.flags.map((flag) => {
				const missingField =
					flag === "missing_venue" || flag === "missing_headcount";
				const missingOverdue =
					missingField && status.overdueFlags.includes(flag);
				const warning =
					flag === "food_over_cap" ||
					flag === "in_finals_week" ||
					(missingField && !missingOverdue);
				const late = flag === "late";
				return (
					<Badge
						key={flag}
						variant={warning ? "warning" : late ? "secondary" : "destructive"}
					>
						{late ? (
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

export function VcoDeadlineCell({ status }: { status: VcoPipelineStatus }) {
	if (status.needsDate || !status.nextDeadline) {
		return <span className="text-sm text-muted-foreground">—</span>;
	}
	const overdue = status.nextDeadline.overdue;
	return (
		<div className={overdue ? "text-tone-danger" : "text-foreground"}>
			<div className="flex items-center gap-1.5 text-sm font-medium">
				<CalendarClock className="h-3.5 w-3.5 shrink-0" />
				{status.nextDeadline.label}
			</div>
			<div className="text-xs tabular-nums">
				{VcoDeadlines.formatCalendarDate(status.nextDeadline.date)} ·{" "}
				{VcoDeadlines.countdownLabel(status.nextDeadline.daysUntil)}
			</div>
		</div>
	);
}

export function VcoFundedToggle({
	event,
	status,
	onPipelineChange,
}: {
	event: EventRequest;
	status: VcoPipelineStatus;
	onPipelineChange: (event: EventRequest, patch: VcoPipelinePatch) => void;
}) {
	return (
		<Switch
			size="sm"
			checked={status.funded}
			onCheckedChange={(checked) =>
				onPipelineChange(event, { funded: checked })
			}
			aria-label={`Funded status for ${event.eventName}`}
		/>
	);
}

export function VcoFinIdField({
	event,
	onPipelineChange,
}: {
	event: EventRequest;
	onPipelineChange: (event: EventRequest, patch: VcoPipelinePatch) => void;
}) {
	const [finId, setFinId] = useState(event.finId ?? "");

	return (
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
	);
}

export function VcoTresOwnerSelect({
	event,
	status,
	onPipelineChange,
}: {
	event: EventRequest;
	status: VcoPipelineStatus;
	onPipelineChange: (event: EventRequest, patch: VcoPipelinePatch) => void;
}) {
	return (
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
				<SelectItem value="vco">VCO</SelectItem>
				<SelectItem value="president">President</SelectItem>
			</SelectContent>
		</Select>
	);
}

export function VcoFoodCostCell({ status }: { status: VcoPipelineStatus }) {
	if (status.foodCostPerHead === null) {
		return <span className="text-sm text-muted-foreground">—</span>;
	}
	return (
		<span className="text-sm tabular-nums">
			${status.foodCostPerHead.toFixed(2)}
		</span>
	);
}
