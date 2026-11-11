import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	DEPARTMENT_OPTIONS,
	EVENT_TYPE_OPTIONS,
	type EventDepartmentValue,
	type EventTypeValue,
} from "../constants";

interface BasicInfoSectionProps {
	data: {
		eventName: string;
		eventDescription: string;
		eventType: EventTypeValue | "";
		department?: EventDepartmentValue;
	};
	onChange: (data: Partial<BasicInfoSectionProps["data"]>) => void;
}

export function BasicInfoSection({ data, onChange }: BasicInfoSectionProps) {
	const formId = useId();
	return (
		<div className="space-y-6">
			<div className="grid gap-6">
				<div className="space-y-2">
					<Label htmlFor={`${formId}-eventName`}>
						Event Name <span className="text-tone-danger">*</span>
					</Label>
					<Input
						id={`${formId}-eventName`}
						name="eventName"
						autoComplete="off"
						value={data.eventName}
						onChange={(e) => onChange({ eventName: e.target.value })}
						placeholder="Enter event name…"
						required
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-eventDescription`}>
						Event Description <span className="text-tone-danger">*</span>
					</Label>
					<Textarea
						id={`${formId}-eventDescription`}
						name="eventDescription"
						autoComplete="off"
						value={data.eventDescription}
						onChange={(e) => onChange({ eventDescription: e.target.value })}
						placeholder="Describe your event…"
						rows={4}
						required
					/>
					<p className="text-xs text-muted-foreground">
						Include key details about what attendees can expect.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor={`${formId}-eventType`}>
							Event Type <span className="text-tone-danger">*</span>
						</Label>
						<Select
							name="eventType"
							value={data.eventType || undefined}
							onValueChange={(value) =>
								onChange({ eventType: value as EventTypeValue })
							}
						>
							<SelectTrigger id={`${formId}-eventType`}>
								<SelectValue placeholder="Select event type" />
							</SelectTrigger>
							<SelectContent>
								{EVENT_TYPE_OPTIONS.map((type) => (
									<SelectItem key={type.value} value={type.value}>
										{type.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${formId}-department`}>Department</Label>
						<Select
							name="department"
							value={data.department ?? "none"}
							onValueChange={(value) =>
								onChange({
									department:
										value === "none"
											? undefined
											: (value as EventDepartmentValue),
								})
							}
						>
							<SelectTrigger id={`${formId}-department`}>
								<SelectValue placeholder="Select department (optional)" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Unspecified</SelectItem>
								{DEPARTMENT_OPTIONS.map((dept) => (
									<SelectItem key={dept.value} value={dept.value}>
										{dept.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		</div>
	);
}
