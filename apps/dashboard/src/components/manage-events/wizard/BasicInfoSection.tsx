import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="eventName">
            Event Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="eventName"
            value={data.eventName}
            onChange={(e) => onChange({ eventName: e.target.value })}
            placeholder="Enter event name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventDescription">
            Event Description <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="eventDescription"
            value={data.eventDescription}
            onChange={(e) => onChange({ eventDescription: e.target.value })}
            placeholder="Describe your event..."
            rows={4}
            required
          />
          <p className="text-xs text-gray-500">
            Include key details about what attendees can expect.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="eventType">
              Event Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={data.eventType || undefined}
              onValueChange={(value) => onChange({ eventType: value as EventTypeValue })}
            >
              <SelectTrigger id="eventType">
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
            <Label htmlFor="department">Department</Label>
            <Select
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
              <SelectTrigger id="department">
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
