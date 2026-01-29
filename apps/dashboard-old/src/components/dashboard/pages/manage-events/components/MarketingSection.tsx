import React from "react";
import { Megaphone, Image } from "lucide-react";
import { Checkbox, Select, SelectItem, Input, Textarea } from "@heroui/react";
import type { EventFormData } from "../types/EventRequestTypes";
import { flyerTypes, logoTypes, formatTypes } from "../types/EventRequestTypes";
import EnhancedFileUploadManager from "./EnhancedFileUploadManager";

interface MarketingSectionProps {
  formData: EventFormData;
  onInputChange: (field: string, value: any) => void;
  onArrayChange: (field: string, value: string, checked: boolean) => void;
  onFileChange: (field: string, files: FileList | null) => void;
  onRemoveExistingFile?: (
    fileUrl: string,
    fileType:
      | "roomBooking"
      | "invoice"
      | "invoiceFiles"
      | "otherLogos"
      | "otherFlyerFiles",
  ) => void;
  eventRequestId?: string;
}

export default function MarketingSection({
  formData,
  onInputChange,
  onArrayChange,
  onFileChange,
  onRemoveExistingFile,
  eventRequestId,
}: MarketingSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Megaphone className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Marketing & Graphics
        </h3>
      </div>

      {/* Graphics Needed */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <Checkbox
          isSelected={formData.needsGraphics}
          onValueChange={(checked) => onInputChange("needsGraphics", checked)}
        >
          <span className="text-sm font-medium text-gray-700">
            I need graphics/marketing materials for this event
          </span>
        </Checkbox>
      </div>

      {formData.needsGraphics && (
        <div className="space-y-6 border-l-4 border-blue-200 pl-6">
          {/* Flyer Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What type of flyers/graphics do you need? *
            </label>
            <div className="flex flex-col space-y-2">
              {flyerTypes.map((type) => (
                <Checkbox
                  key={type}
                  isSelected={formData.flyerType.includes(type)}
                  onValueChange={(checked) =>
                    onArrayChange("flyerType", type, checked)
                  }
                >
                  <span className="text-sm text-gray-700">{type}</span>
                </Checkbox>
              ))}
            </div>
          </div>

          {/* Other Flyer Type */}
          {formData.flyerType.includes(
            "Other (please specify in additional requests)",
          ) && (
              <div className="space-y-4">
                <Input
                  type="text"
                  label="Please specify the other flyer type"
                  placeholder="Specify other flyer type"
                  value={formData.otherFlyerType}
                  onValueChange={(value) =>
                    onInputChange("otherFlyerType", value)
                  }
                  isRequired
                  classNames={{
                    label: "text-sm font-medium",
                  }}
                />

                {/* Other Flyer Files Upload */}
                <div>
                  <EnhancedFileUploadManager
                    title="Other Flyer Reference Files"
                    description="Upload reference files, examples, or specifications for your custom flyer type. Max size: 10MB each. You can also paste images directly."
                    existingFiles={formData.existingOtherFlyerFiles || []}
                    newFiles={formData.otherFlyerFiles || []}
                    onFilesChange={(files) => {
                      if (Array.isArray(files)) {
                        const fileList = {
                          ...files,
                          length: files.length,
                          item: (index: number) => files[index] || null,
                        } as FileList;
                        onFileChange("otherFlyerFiles", fileList);
                      } else {
                        onFileChange("otherFlyerFiles", null);
                      }
                    }}
                    onRemoveExistingFile={(fileUrl) =>
                      onRemoveExistingFile?.(fileUrl, "otherFlyerFiles")
                    }
                    allowedTypes={[
                      "pdf",
                      "png",
                      "jpg",
                      "jpeg",
                      "gif",
                      "doc",
                      "docx",
                    ]}
                    maxSizeInMB={10}
                    maxFiles={5}
                    multiple={true}
                    required={false}
                    eventRequestId={eventRequestId}
                  />
                </div>
              </div>
            )}

          {/* Required Logos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Which logos are required on your graphics? *
            </label>
            <div className="flex flex-col space-y-2">
              {logoTypes.map((logo) => (
                <Checkbox
                  key={logo}
                  isSelected={formData.requiredLogos.includes(logo)}
                  onValueChange={(checked) =>
                    onArrayChange("requiredLogos", logo, checked)
                  }
                >
                  <span className="text-sm text-gray-700">{logo}</span>
                </Checkbox>
              ))}
            </div>
          </div>

          {/* Other Logo Files */}
          {formData.requiredLogos.includes(
            "OTHER (please upload transparent logo files)",
          ) && (
              <div>
                <EnhancedFileUploadManager
                  title="Other Logo Files"
                  description="Please upload transparent PNG files for best quality. Max size: 10MB each. You can also paste images directly."
                  existingFiles={formData.existingOtherLogos || []}
                  newFiles={formData.otherLogoFiles || []}
                  onFilesChange={(files) => {
                    if (Array.isArray(files)) {
                      const fileList = {
                        ...files,
                        length: files.length,
                        item: (index: number) => files[index] || null,
                      } as FileList;
                      onFileChange("otherLogoFiles", fileList);
                    } else {
                      onFileChange("otherLogoFiles", null);
                    }
                  }}
                  onRemoveExistingFile={(fileUrl) =>
                    onRemoveExistingFile?.(fileUrl, "otherLogos")
                  }
                  allowedTypes={["png", "jpg", "jpeg", "svg", "gif"]}
                  maxSizeInMB={10}
                  maxFiles={5}
                  multiple={true}
                  required={true}
                  eventRequestId={eventRequestId}
                />
              </div>
            )}

          {/* Advertising Format */}
          <Select
            label="Preferred file format for final graphics"
            placeholder="Select format"
            selectedKeys={
              formData.advertisingFormat ? [formData.advertisingFormat] : []
            }
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              onInputChange("advertisingFormat", selected || "");
            }}
            isRequired
            classNames={{
              label: "text-sm font-medium",
            }}
          >
            {formatTypes.map((format) => (
              <SelectItem key={format}>
                {format}
              </SelectItem>
            ))}
          </Select>

          {/* Additional Specifications */}
          <Textarea
            label="Additional specifications or requests"
            placeholder="Any specific design requirements, colors, themes, or other details..."
            value={formData.additionalSpecifications}
            onValueChange={(value) =>
              onInputChange("additionalSpecifications", value)
            }
            minRows={3}
            classNames={{
              label: "text-sm font-medium",
            }}
          />

          {/* Photography Needed */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <Checkbox
              isSelected={formData.photographyNeeded}
              onValueChange={(checked) =>
                onInputChange("photographyNeeded", checked)
              }
            >
              <span className="text-sm font-medium text-gray-700">
                I need photography coverage for this event
              </span>
            </Checkbox>
            <p className="text-xs text-gray-500 mt-2 ml-7">
              Check this if you want professional photos taken during your event
            </p>
          </div>
        </div>
      )}

      {!formData.needsGraphics && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">
            <Image className="w-4 h-4 inline mr-2" />
            No graphics or marketing materials needed for this event.
          </p>
        </div>
      )}
    </div>
  );
}
