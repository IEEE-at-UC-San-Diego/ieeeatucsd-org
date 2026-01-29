import React from "react";
import {
  MapPin,
  Users,
  Upload,
  DollarSign,
  AlertTriangle,
  FileText,
  Image,
} from "lucide-react";
import { Input, RadioGroup, Radio, Card, CardBody } from "@heroui/react";
import type { EventFormData } from "../types/EventRequestTypes";
import { calculateBudget, extractFileName } from "../utils/eventRequestUtils";
import EnhancedFileUploadManager from "./EnhancedFileUploadManager";

interface LogisticsSectionProps {
  formData: EventFormData;
  onInputChange: (field: string, value: any) => void;
  onRemoveExistingFile: (
    fileUrl: string,
    fileType: "roomBooking" | "invoice" | "invoiceFiles" | "otherLogos",
  ) => void;
  eventRequestId?: string;
}

export default function LogisticsSection({
  formData,
  onInputChange,
  onRemoveExistingFile,
  eventRequestId,
}: LogisticsSectionProps) {
  const attendance = parseInt(formData.expectedAttendance) || 0;
  const budget = calculateBudget(attendance);

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split(".").pop();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const renderExistingFiles = (
    files: string[],
    title: string,
    fileType: "roomBooking" | "invoice" | "invoiceFiles" | "otherLogos",
  ) => {
    if (!files || files.length === 0) return null;

    return (
      <div className="mt-3">
        <p className="text-sm font-medium text-gray-700 mb-2">{title}:</p>
        <div className="space-y-2">
          {files.map((fileUrl, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 p-2 rounded"
            >
              <div className="flex items-center space-x-2">
                {getFileIcon(fileUrl)}
                <span className="text-sm text-gray-700">
                  {extractFileName(fileUrl)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  View
                </a>
                <button
                  type="button"
                  onClick={() => onRemoveExistingFile(fileUrl, fileType)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <MapPin className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Event Logistics</h3>
      </div>

      {/* Room Booking */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <RadioGroup
          label="Do you have a room booking for this event?"
          value={formData.hasRoomBooking ? "true" : "false"}
          onValueChange={(value) =>
            onInputChange("hasRoomBooking", value === "true")
          }
          isRequired
          classNames={{
            label: "text-sm font-medium text-gray-700 mb-3",
          }}
        >
          <Radio value="true">
            <span className="text-sm text-gray-700">
              Yes, I have a room booking
            </span>
          </Radio>
          <Radio value="false">
            <span className="text-sm text-gray-700">
              No, I need help with room booking
            </span>
          </Radio>
        </RadioGroup>

        {formData.hasRoomBooking && (
          <div className="mt-4">
            <EnhancedFileUploadManager
              title="Room Booking Confirmation"
              description="Please upload your room booking confirmation (PDF, image, or document). Max size: 1MB"
              existingFiles={formData.existingRoomBookingFiles}
              newFiles={formData.roomBookingFile}
              onFilesChange={(files) => onInputChange("roomBookingFile", files)}
              onRemoveExistingFile={(fileUrl) =>
                onRemoveExistingFile(fileUrl, "roomBooking")
              }
              allowedTypes={["pdf", "jpg", "jpeg", "png", "doc", "docx"]}
              maxSizeInMB={1}
              maxFiles={1}
              multiple={false}
              required={true}
              eventRequestId={eventRequestId}
            />
          </div>
        )}
      </div>

      {/* Expected Attendance */}
      <div>
        <Input
          type="number"
          label="Expected Attendance"
          placeholder="Enter expected number of attendees (positive integer only)"
          value={formData.expectedAttendance}
          onValueChange={(value) => {
            if (value === "" || (/^\d+$/.test(value) && parseInt(value) > 0)) {
              onInputChange("expectedAttendance", value);
            }
          }}
          isRequired
          min={1}
          startContent={<Users className="w-4 h-4 text-gray-400" />}
          classNames={{
            label: "text-sm font-medium",
          }}
        />

        {attendance > 0 && (
          <Card className="mt-3 bg-blue-50 border-blue-200">
            <CardBody className="p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                <DollarSign className="w-4 h-4 mr-1" />
                Budget Calculation
              </h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>Expected Attendance: {attendance} people</p>
                <p>Cost per person: ${budget.perPersonCost}</p>
                <p>Calculated Budget: ${budget.calculatedBudget}</p>
                <p className="font-medium">
                  Recommended Budget: ${budget.actualBudget}
                  {budget.isAtMax && (
                    <span className="text-orange-600 ml-2">
                      (Maximum budget reached)
                    </span>
                  )}
                </p>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Food and Drinks */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardBody className="p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <RadioGroup
                label="Will you be serving food or drinks at this event?"
                value={formData.servingFoodDrinks ? "true" : "false"}
                onValueChange={(value) =>
                  onInputChange("servingFoodDrinks", value === "true")
                }
                isRequired
                classNames={{
                  label: "text-sm font-medium text-gray-700 mb-3",
                }}
              >
                <Radio value="true">
                  <span className="text-sm text-gray-700">
                    Yes, we will serve food or drinks
                  </span>
                </Radio>
                <Radio value="false">
                  <span className="text-sm text-gray-700">
                    No food or drinks will be served
                  </span>
                </Radio>
              </RadioGroup>
              <p className="text-xs text-yellow-700 mt-2">
                Important: If serving food/drinks, you may need AS funding and
                must follow university guidelines
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AS Funding */}
      {formData.servingFoodDrinks && (
        <Card className="bg-green-50 border-green-200">
          <CardBody className="p-4">
            <RadioGroup
              label="Do you need AS (Associated Students) funding for this event?"
              value={formData.needsAsFunding ? "true" : "false"}
              onValueChange={(value) =>
                onInputChange("needsAsFunding", value === "true")
              }
              isRequired
              classNames={{
                label: "text-sm font-medium text-gray-700 mb-3",
              }}
            >
              <Radio value="true">
                <span className="text-sm text-gray-700">
                  Yes, I need AS funding
                </span>
              </Radio>
              <Radio value="false">
                <span className="text-sm text-gray-700">
                  No, I have other funding sources
                </span>
              </Radio>
            </RadioGroup>
            <p className="text-xs text-green-700 mt-2">
              AS funding requires detailed invoices and receipts. You'll need to
              provide this information in the next step.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
