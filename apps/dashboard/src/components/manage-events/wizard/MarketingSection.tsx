import { Printer, Image, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BudgetCalculation } from "./BudgetCalculation";

const FLYER_TYPE_OPTIONS = [
  "Digital flyer (with social media advertising: Facebook, Instagram, Discord)",
  "Digital flyer (with NO social media advertising)",
  "Physical flyer (for posting around campus)",
  "Social media graphics (Instagram story, post, etc.)",
  "Email newsletter graphics",
  "Website banner",
  "Other (please specify in additional requests)",
];

const LOGO_OPTIONS = [
  "IEEE",
  "AS (required if funded by AS)",
  "HKN",
  "TESC",
  "PIB",
  "TNT",
  "SWE",
  "OTHER (please upload transparent logo files)",
];

const FORMAT_OPTIONS = ["PDF", "JPEG", "PNG", "Doesn't Matter"];

interface MarketingSectionProps {
  data: {
    needsFlyers: boolean;
    needsGraphics: boolean;
    estimatedAttendance: number;
    flyerType: string[];
    otherFlyerType: string;
    flyerAdvertisingStartDate: number;
    flyerAdditionalRequests: string;
    photographyNeeded: boolean;
    requiredLogos: string[];
    otherLogos: string[];
    advertisingFormat: string;
    additionalSpecifications: string;
    graphicsUploadNote: string;
  };
  onChange: (data: Partial<MarketingSectionProps["data"]>) => void;
}

export function MarketingSection({ data, onChange }: MarketingSectionProps) {
  const formatDateForInput = (timestamp: number) => {
    if (!timestamp) return "";
    return new Date(timestamp).toISOString().slice(0, 16);
  };

  const toggleArrayItem = (arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">
            Marketing Materials
          </h3>

          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="needsFlyers"
              checked={data.needsFlyers}
              onCheckedChange={(checked) =>
                onChange({ needsFlyers: checked as boolean })
              }
            />
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-gray-500" />
                <Label htmlFor="needsFlyers" className="cursor-pointer font-medium">
                  Flyers Needed
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                Physical flyers to be printed and distributed on campus.
              </p>
            </div>
          </div>

          {(data.needsFlyers || data.needsGraphics) && (
            <div className="ml-7 space-y-4 p-4 border rounded-lg bg-gray-50/50">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">
                  Graphics Needed
                </Label>
                <div className="flex flex-col space-y-2">
                  {FLYER_TYPE_OPTIONS.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`flyer-${type}`}
                        checked={data.flyerType.includes(type)}
                        onCheckedChange={() => onChange({ flyerType: toggleArrayItem(data.flyerType, type) })}
                      />
                      <Label htmlFor={`flyer-${type}`} className="text-xs cursor-pointer">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {data.flyerType.includes("Other (please specify in additional requests)") && (
                <div className="space-y-2">
                  <Label htmlFor="otherFlyerType">Please specify the other flyer type</Label>
                  <Input
                    id="otherFlyerType"
                    value={data.otherFlyerType}
                    onChange={(e) => onChange({ otherFlyerType: e.target.value })}
                    placeholder="Specify other flyer type..."
                  />
                </div>
              )}

              {data.needsFlyers && (
                <div className="space-y-2">
                  <Label htmlFor="flyerAdvertisingStartDate">Advertising Start Date</Label>
                  <Input
                    id="flyerAdvertisingStartDate"
                    type="datetime-local"
                    value={formatDateForInput(data.flyerAdvertisingStartDate)}
                    onChange={(e) => onChange({ flyerAdvertisingStartDate: e.target.value ? new Date(e.target.value).getTime() : 0 })}
                  />
                  <p className="text-xs text-gray-500">When should flyer distribution begin?</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="flyerAdditionalRequests">Additional Flyer Requests</Label>
                <Textarea
                  id="flyerAdditionalRequests"
                  value={data.flyerAdditionalRequests}
                  onChange={(e) => onChange({ flyerAdditionalRequests: e.target.value })}
                  placeholder="Any specific design requirements, dimensions, or other flyer needs..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="needsGraphics"
              checked={data.needsGraphics}
              onCheckedChange={(checked) =>
                onChange({ needsGraphics: checked as boolean })
              }
            />
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-gray-500" />
                <Label htmlFor="needsGraphics" className="cursor-pointer font-medium">
                  Graphics Needed
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                Digital graphics for social media, website, and digital displays.
              </p>
            </div>
          </div>

          {(data.needsFlyers || data.needsGraphics) && (
            <div className="ml-7 space-y-4 p-4 border rounded-lg bg-gray-50/50">
              <div className="space-y-2">
                <Label htmlFor="advertisingFormat">Preferred file format for final graphics</Label>
                <Select
                  value={data.advertisingFormat}
                  onValueChange={(value) => onChange({ advertisingFormat: value })}
                >
                  <SelectTrigger id="advertisingFormat">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalSpecifications">Additional specifications or requests</Label>
                <Textarea
                  id="additionalSpecifications"
                  value={data.additionalSpecifications}
                  onChange={(e) => onChange({ additionalSpecifications: e.target.value })}
                  placeholder="Any specific design requirements, colors, themes, or other details..."
                  rows={3}
                />
              </div>

              {data.needsGraphics && (
                <div className="space-y-2">
                  <Label htmlFor="graphicsUploadNote">Graphics delivery note (optional)</Label>
                  <Input
                    id="graphicsUploadNote"
                    value={data.graphicsUploadNote}
                    onChange={(e) => onChange({ graphicsUploadNote: e.target.value })}
                    placeholder="Paste delivery link or note where graphics were uploaded"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="photographyNeeded"
              checked={data.photographyNeeded}
              onCheckedChange={(checked) =>
                onChange({ photographyNeeded: checked as boolean })
              }
            />
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-gray-500" />
                <Label htmlFor="photographyNeeded" className="cursor-pointer font-medium">
                  Photography Needed
                </Label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                Request a photographer for the event. Submit photos within 48 hours of the event.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-900">
            Required Logos
          </h3>
          <div className="flex flex-col space-y-2">
            {LOGO_OPTIONS.map((logo) => (
              <div key={logo} className="flex items-center space-x-2">
                <Checkbox
                  id={`logo-${logo}`}
                  checked={data.requiredLogos.includes(logo)}
                  onCheckedChange={() => onChange({ requiredLogos: toggleArrayItem(data.requiredLogos, logo) })}
                />
                <Label htmlFor={`logo-${logo}`} className="text-xs cursor-pointer">
                  {logo}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            AS logo is required on all AS-funded materials.
          </p>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-900">
            Expected Attendance
          </h3>

          <div className="space-y-2">
            <Label htmlFor="estimatedAttendance">
              Estimated Number of Attendees
            </Label>
            <input
              id="estimatedAttendance"
              type="number"
              min={1}
              value={data.estimatedAttendance || ""}
              onChange={(e) =>
                onChange({
                  estimatedAttendance: e.target.value
                    ? parseInt(e.target.value)
                    : 0,
                })
              }
              placeholder="e.g., 50"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-gray-500">
              This helps us plan resources and capacity for your event.
            </p>
            <BudgetCalculation estimatedAttendance={data.estimatedAttendance} />
          </div>
        </div>
      </div>
    </div>
  );
}
