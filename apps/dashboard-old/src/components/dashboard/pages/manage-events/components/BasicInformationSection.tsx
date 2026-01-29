import { useState, useEffect } from "react";
import { Calendar, MapPin, FileText, DollarSign } from "lucide-react";
import { Input, Textarea, Select, SelectItem, Button } from "@heroui/react";
import type { EventFormData, FieldError } from "../types/EventRequestTypes";
import { departmentOptions } from "../types/EventRequestTypes";
import {
  generateEventCode,
  formatTimeTo12H,
  parseDateMMDDYY,
  flexibleTimeParser
} from "../utils/eventRequestUtils";

interface BasicInformationSectionProps {
  formData: EventFormData;
  fieldErrors: FieldError;
  onInputChange: (field: string, value: any) => void;
  editingRequestId?: string;
}

export default function BasicInformationSection({
  formData,
  fieldErrors,
  onInputChange,
  editingRequestId,
}: BasicInformationSectionProps) {
  // State to track raw time input for editing
  const [rawTimeInput, setRawTimeInput] = useState(() => {
    // Initialize with formatted time if it exists
    if (formData.startTime?.includes(":") && formData.endTime?.includes(":")) {
      return `${formatTimeTo12H(formData.startTime)} - ${formatTimeTo12H(formData.endTime)}`;
    } else if (formData.startTime?.includes(":")) {
      return formatTimeTo12H(formData.startTime);
    }
    return formData.startTime || "";
  });
  const [hasUserEditedTime, setHasUserEditedTime] = useState(false);

  // State for real-time validation feedback
  const [dateValidation, setDateValidation] = useState<{ isValid: boolean; message: string }>({
    isValid: false,
    message: "Enter date as MM/DD/YYYY or MMDDYYYY"
  });
  const [timeValidation, setTimeValidation] = useState<{ isValid: boolean; message: string }>({
    isValid: false,
    message: "Enter time range (e.g., 9am-10pm or 10:00 AM - 2:00 PM)"
  });

  // Real-time date validation
  const validateDate = (value: string) => {
    if (!value) {
      setDateValidation({ isValid: false, message: <span>Enter date as MM/DD/YYYY or MMDDYYYY</span> });
      return;
    }

    const parsed = parseDateMMDDYY(value);
    if (parsed) {
      const [year, month, day] = parsed.split("-");
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      setDateValidation({
        isValid: true,
        message: <span className="text-success">✓ Valid: {formattedDate} ({parsed})</span>
      });
    } else {
      setDateValidation({
        isValid: false,
        message: <span className="text-danger">Invalid date format. Use MM/DD/YYYY or MMDDYYYY</span>
      });
    }
  };

  // Real-time time validation - require time ranges only
  const validateTime = (value: string) => {
    if (!value) {
      setTimeValidation({
        isValid: false,
        message: <span>Enter time range (e.g., 9am-10pm or 10:00 AM - 2:00 PM)</span>
      });
      return;
    }

    const result = flexibleTimeParser.parse(value, { validateRanges: true });
    if (result.isValid) {
      if (result.timeRange) {
        setTimeValidation({
          isValid: true,
          message: <span className="text-success">✓ Valid range: {result.timeRange.displayString}</span>
        });
      } else if (result.time) {
        // Single time is parsed but not valid for this form
        setTimeValidation({
          isValid: false,
          message: <span className="text-danger">Time must be a range (e.g., "10am-2pm" or "10:00 AM - 2:00 PM")</span>
        });
      }
    } else {
      setTimeValidation({
        isValid: false,
        message: <span className="text-danger">{result.errorMessage || "Invalid time format"}</span>
      });
    }
  };

  // Parse time input function to handle both blur and Enter key events
  const parseTimeInput = (value: string) => {
    // Try to parse the input using flexible parser
    const result = flexibleTimeParser.parse(value, { validateRanges: true });

    if (result.isValid && result.timeRange) {
      // Handle range input - populate both start and end times in formData
      onInputChange("startTime", result.timeRange.startTime.time24);
      onInputChange("endTime", result.timeRange.endTime.time24);
      // Don't update rawTimeInput - let the user keep their input format
    } else {
      // If invalid or not a range, clear the stored times
      onInputChange("startTime", "");
      onInputChange("endTime", "");
    }
    // The live validation will show whether the input is valid
  };

  useEffect(() => {
    setHasUserEditedTime(false);
  }, [editingRequestId]);

  useEffect(() => {
    validateDate(formData.startDate);
  }, [formData.startDate]);

  // Sync raw input when formData changes from external sources (e.g., loading existing data)
  // Only update if the times are set but rawTimeInput is empty (initial load case)
  useEffect(() => {
    if (hasUserEditedTime) {
      return;
    }

    if (formData.startTime?.includes(":") && formData.endTime?.includes(":")) {
      const formattedValue = `${formatTimeTo12H(formData.startTime)} - ${formatTimeTo12H(formData.endTime)}`;
      setRawTimeInput(formattedValue);
      validateTime(formattedValue);
      return;
    }

    if (formData.startTime?.includes(":")) {
      const formattedValue = formatTimeTo12H(formData.startTime);
      setRawTimeInput(formattedValue);
      validateTime(formattedValue);
      return;
    }

    setRawTimeInput("");
    validateTime("");
  }, [formData.startTime, formData.endTime, hasUserEditedTime]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Event Name */}
        <Input
          type="text"
          label="Event Name"
          placeholder="Enter event name"
          value={formData.name}
          onValueChange={(value) => onInputChange("name", value)}
          isRequired
          isInvalid={!!fieldErrors.name}
          errorMessage={fieldErrors.name && "Event name is required"}
          startContent={<FileText className="w-4 h-4 text-gray-400" />}
          classNames={{
            label: "text-sm font-medium",
          }}
        />

        {/* Location */}
        <Input
          type="text"
          label="Location"
          placeholder="Enter event location"
          value={formData.location}
          onValueChange={(value) => onInputChange("location", value)}
          isRequired
          isInvalid={!!fieldErrors.location}
          errorMessage={fieldErrors.location && "Location is required"}
          startContent={<MapPin className="w-4 h-4 text-gray-400" />}
          classNames={{
            label: "text-sm font-medium",
          }}
        />

        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              type="text"
              label="Date"
              placeholder="MM/DD/YYYY (e.g., 12/25/2023)"
              value={formData.startDate}
              onValueChange={(value) => {
                // Allow user to type slashes naturally
                // Only auto-format if they're typing without slashes
                let formatted = value;

                // If the value doesn't contain slashes, auto-format it
                if (!value.includes('/')) {
                  const digitsOnly = value.replace(/\D/g, "");

                  if (digitsOnly.length === 0) {
                    formatted = "";
                  } else if (digitsOnly.length <= 2) {
                    // Just MM
                    formatted = digitsOnly;
                  } else if (digitsOnly.length <= 4) {
                    // MM/DD
                    formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
                  } else if (digitsOnly.length <= 8) {
                    // MM/DD/YYYY
                    formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
                  } else {
                    // Truncate to 8 digits max
                    formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
                  }
                } else {
                  // User is typing with slashes, just limit the length
                  // Max format is MM/DD/YYYY = 10 characters
                  formatted = value.slice(0, 10);
                }

                onInputChange("startDate", formatted);
                validateDate(formatted);
              }}
              isRequired
              isInvalid={!!fieldErrors.startDate || !dateValidation.isValid}
              errorMessage={fieldErrors.startDate && "Date is required"}
              classNames={{
                label: "text-sm font-medium",
                input: dateValidation.isValid ? "border-success" : fieldErrors.startDate ? "border-danger" : "",
              }}
              description={dateValidation.message}
              startContent={<Calendar className="w-4 h-4 text-gray-400" />}
            />
          </div>
          <div>
            <Input
              type="text"
              label="Time Range"
              placeholder="e.g., 9am-10pm or 10:00 AM - 2:00 PM"
              value={rawTimeInput}
              onValueChange={(value) => {
                // Only update the raw input value without parsing
                setRawTimeInput(value);
                setHasUserEditedTime(true);
                validateTime(value);
              }}
              onBlur={(e) => {
                const value = e.target.value;
                parseTimeInput(value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = e.currentTarget.value;
                  parseTimeInput(value);
                }
              }}
              isRequired
              isInvalid={!!fieldErrors.startTime || !!fieldErrors.endTime || !timeValidation.isValid}
              errorMessage={
                fieldErrors.startTime
                  ? "Start time is required"
                  : fieldErrors.endTime
                    ? "End time is required"
                    : undefined
              }
              classNames={{
                label: "text-sm font-medium",
                input: timeValidation.isValid ? "border-success" : (fieldErrors.startTime || fieldErrors.endTime) ? "border-danger" : "",
              }}
              description={timeValidation.message}
            />
          </div>
        </div>

        {/* Event Description */}
        <Textarea
          label="Event Description"
          placeholder="Describe your event in detail"
          value={formData.eventDescription}
          onValueChange={(value) => onInputChange("eventDescription", value)}
          isRequired
          isInvalid={!!fieldErrors.eventDescription}
          errorMessage={
            fieldErrors.eventDescription && "Event description is required"
          }
          minRows={4}
          classNames={{
            label: "text-sm font-medium",
          }}
        />

        {/* Department */}
        <Select
          label="Department"
          placeholder="Select department"
          selectedKeys={[formData.department]}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            onInputChange("department", selected);
          }}
          classNames={{
            label: "text-sm font-medium",
          }}
        >
          {departmentOptions.map((dept) => (
            <SelectItem key={dept}>
              {dept}
            </SelectItem>
          ))}
        </Select>

        {/* Event Code */}
        <div>
          <div className="flex gap-2">
            <Input
              type="text"
              label="Event Code"
              placeholder="Enter or generate event code"
              value={formData.eventCode}
              onValueChange={(value) => onInputChange("eventCode", value)}
              description="This code will be used for event check-ins and point tracking"
              classNames={{
                label: "text-sm font-medium",
                base: "flex-1",
              }}
            />
            <Button
              color="primary"
              onPress={() => onInputChange("eventCode", generateEventCode())}
              className="mt-auto mb-6"
            >
              Generate
            </Button>
          </div>
        </div>

        {/* Points to Reward */}
        <Input
          type="number"
          label="Points to Reward"
          placeholder="Enter points to reward attendees"
          value={formData.pointsToReward.toString()}
          onValueChange={(value) =>
            onInputChange("pointsToReward", parseInt(value) || 0)
          }
          min={0}
          description="Points that will be awarded to attendees for participating in this event"
          startContent={<DollarSign className="w-4 h-4 text-gray-400" />}
          classNames={{
            label: "text-sm font-medium",
          }}
        />
      </div>
    </div>
  );
}
