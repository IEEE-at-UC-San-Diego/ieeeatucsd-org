import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, X, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  parseFlexibleTime,
  parseFlexibleDate,
  formatDateShort,
  formatTimeShort,
  combineDateAndTime,
} from "../utils/parseTime";

interface LogisticsSectionProps {
  data: {
    location: string;
    startDate: number;
    endDate: number;
    eventCode: string;
    hasFood: boolean;
    willOrHaveRoomBooking: boolean;
    roomBookingFiles: string[];
    foodDrinksBeingServed: boolean;
  };
  onChange: (data: Partial<LogisticsSectionProps["data"]>) => void;
  onUploadRoomBooking?: (files: File[]) => void;
}

export function LogisticsSection({ data, onChange, onUploadRoomBooking }: LogisticsSectionProps) {
  const [dateText, setDateText] = useState(formatDateShort(data.startDate));
  const [startTimeText, setStartTimeText] = useState(formatTimeShort(data.startDate));
  const [endTimeText, setEndTimeText] = useState(formatTimeShort(data.endDate));
  const [dateError, setDateError] = useState("");
  const [startTimeError, setStartTimeError] = useState("");
  const [endTimeError, setEndTimeError] = useState("");
  const timeRangeError =
    Number.isFinite(data.startDate) && Number.isFinite(data.endDate) && data.endDate <= data.startDate
      ? "End time must be after start time."
      : "";

  const handleDateBlur = () => {
    setDateError("");
    const parsed = parseFlexibleDate(dateText);
    if (!parsed) {
      if (dateText.trim()) setDateError("Invalid date. Use mm/dd/yy format.");
      return;
    }
    // Preserve existing times
    const startTime = new Date(data.startDate);
    const endTime = new Date(data.endDate);
    const newStart = combineDateAndTime(parsed, { hours: startTime.getHours(), minutes: startTime.getMinutes() });
    const newEnd = combineDateAndTime(parsed, { hours: endTime.getHours(), minutes: endTime.getMinutes() });
    onChange({ startDate: newStart, endDate: newEnd });
  };

  const handleStartTimeBlur = () => {
    setStartTimeError("");
    const parsed = parseFlexibleTime(startTimeText);
    if (!parsed) {
      if (startTimeText.trim()) setStartTimeError("Invalid time. Try 9am, 9:00am, 14:00, etc.");
      return;
    }
    const newStart = combineDateAndTime(data.startDate, parsed);
    onChange({ startDate: newStart });
    setStartTimeText(formatTimeShort(newStart));
  };

  const handleEndTimeBlur = () => {
    setEndTimeError("");
    const parsed = parseFlexibleTime(endTimeText);
    if (!parsed) {
      if (endTimeText.trim()) setEndTimeError("Invalid time. Try 2pm, 2:00pm, 14:00, etc.");
      return;
    }
    const newEnd = combineDateAndTime(data.endDate || data.startDate, parsed);
    onChange({ endDate: newEnd });
    setEndTimeText(formatTimeShort(newEnd));
  };

  const handleRoomBookingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUploadRoomBooking) {
      onUploadRoomBooking(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const removeRoomBookingFile = (index: number) => {
    const updated = data.roomBookingFiles.filter((_, i) => i !== index);
    onChange({ roomBookingFiles: updated });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="location">
            Location <span className="text-red-500">*</span>
          </Label>
          <Input
            id="location"
            value={data.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="e.g., Price Center East Ballroom"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventDate">
            Event Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="eventDate"
            value={dateText}
            onChange={(e) => setDateText(e.target.value)}
            onBlur={handleDateBlur}
            placeholder="mm/dd/yy"
          />
          {dateError && <p className="text-xs text-red-500">{dateError}</p>}
          <p className="text-xs text-gray-500">Type in mm/dd/yy format (e.g., 02/14/26)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">
              Start Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="startTime"
              value={startTimeText}
              onChange={(e) => setStartTimeText(e.target.value)}
              onBlur={handleStartTimeBlur}
              placeholder="e.g., 9am, 9:00 AM, 14:00"
            />
            {startTimeError && <p className="text-xs text-red-500">{startTimeError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endTime">
              End Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="endTime"
              value={endTimeText}
              onChange={(e) => setEndTimeText(e.target.value)}
              onBlur={handleEndTimeBlur}
              placeholder="e.g., 2pm, 2:00 PM, 17:00"
            />
            {endTimeError && <p className="text-xs text-red-500">{endTimeError}</p>}
          </div>
        </div>
        {timeRangeError && <p className="text-xs text-red-500">{timeRangeError}</p>}

        <div className="space-y-2">
          <Label htmlFor="eventCode">
            Event Code <span className="text-red-500">*</span>
          </Label>
          <Input
            id="eventCode"
            value={data.eventCode}
            onChange={(e) => onChange({ eventCode: e.target.value })}
            placeholder="e.g., TECH-WORKSHOP-2024"
            required
          />
          <p className="text-xs text-gray-500">
            Used for check-in and tracking attendance.
          </p>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="willOrHaveRoomBooking"
              checked={data.willOrHaveRoomBooking}
              onCheckedChange={(checked) => onChange({ willOrHaveRoomBooking: checked as boolean })}
            />
            <div className="space-y-1">
              <Label htmlFor="willOrHaveRoomBooking" className="cursor-pointer">
                Room booking secured or in progress
              </Label>
              <p className="text-xs text-gray-500">
                Check this if you have or will have a room booking for this event. Room bookings should be secured before submitting.
              </p>
            </div>
          </div>

          {data.willOrHaveRoomBooking && (
            <div className="ml-7 space-y-3 p-4 border rounded-lg bg-gray-50/50">
              <Label className="text-xs font-medium">Room Booking Files</Label>
              {data.roomBookingFiles.length > 0 && (
                <div className="space-y-2">
                  {data.roomBookingFiles.map((file, idx) => {
                    const fileName = file.split("/").pop()?.split("?")[0] || `File ${idx + 1}`;
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="truncate max-w-50">{fileName}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => removeRoomBookingFile(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                <Upload className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Upload room booking confirmation</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  multiple
                  className="hidden"
                  onChange={handleRoomBookingFileChange}
                />
              </label>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">
              Will you be serving food or drinks at this event? <span className="text-red-500">*</span>
            </Label>
            <RadioGroup
              value={data.foodDrinksBeingServed ? "yes" : "no"}
              onValueChange={(val) => {
                const isYes = val === "yes";
                onChange({ foodDrinksBeingServed: isYes, hasFood: isYes });
              }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <RadioGroupItem value="yes" id="food-yes" />
                <Label htmlFor="food-yes" className="cursor-pointer flex-1">
                  Yes, we will serve food or drinks
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <RadioGroupItem value="no" id="food-no" />
                <Label htmlFor="food-no" className="cursor-pointer flex-1">
                  No food or drinks will be served
                </Label>
              </div>
            </RadioGroup>
            {data.foodDrinksBeingServed && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    <strong>Important:</strong> If serving food/drinks, you may need AS funding and must follow university guidelines.
                    All food must be from approved AS vendors. Home-cooked food is not permitted unless approved by VC Operations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
