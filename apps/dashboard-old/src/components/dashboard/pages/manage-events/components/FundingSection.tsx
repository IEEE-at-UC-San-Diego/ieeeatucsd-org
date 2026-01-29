import React, { useState } from "react";
import {
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Tabs,
  Tab,
  Card,
  CardBody,
  Chip,
} from "@heroui/react";
import type {
  InvoiceFormData,
  InvoiceTabState,
  JsonImportData,
} from "../types/EventRequestTypes";
import { calculateGrandTotal } from "../utils/eventRequestUtils";
import EnhancedFileUploadManager from "./EnhancedFileUploadManager";
import { showToast } from "../../../shared/utils/toast";
import { uploadFilesForEvent } from "../utils/fileUploadUtils";

interface FundingSectionProps {
  needsAsFunding: boolean;
  invoices: InvoiceFormData[];
  invoiceTabState: InvoiceTabState;
  jsonImportData: JsonImportData;
  activeInvoiceTab: string;
  onAddInvoice: () => void;
  onRemoveInvoice: (invoiceId: string) => void;
  onUpdateInvoice: (
    invoiceId: string,
    updates: Partial<InvoiceFormData>,
  ) => void;
  onAddInvoiceItem: (invoiceId: string) => void;
  onRemoveInvoiceItem: (invoiceId: string, itemIndex: number) => void;
  onUpdateInvoiceItem: (
    invoiceId: string,
    itemIndex: number,
    field: string,
    value: string | number,
  ) => void;
  onHandleJsonImport: (invoiceId: string) => void;
  onUpdateJsonImportData: (invoiceId: string, data: string) => void;
  onUpdateInvoiceTabState: (
    invoiceId: string,
    tab: "details" | "import",
  ) => void;
  onSetActiveInvoiceTab: (invoiceId: string) => void;
  onRemoveExistingFile?: (
    fileUrl: string,
    fileType: "roomBooking" | "invoice" | "invoiceFiles" | "otherLogos",
  ) => void;
  eventRequestId?: string;
}

export default function FundingSection({
  needsAsFunding,
  invoices,
  invoiceTabState,
  jsonImportData,
  activeInvoiceTab,
  onAddInvoice,
  onRemoveInvoice,
  onUpdateInvoice,
  onAddInvoiceItem,
  onRemoveInvoiceItem,
  onUpdateInvoiceItem,
  onHandleJsonImport,
  onUpdateJsonImportData,
  onUpdateInvoiceTabState,
  onSetActiveInvoiceTab,
  onRemoveExistingFile,
  eventRequestId,
}: FundingSectionProps) {
  const [parsingInvoices, setParsingInvoices] = useState<Set<string>>(
    new Set(),
  );
  const [uploadingInvoices, setUploadingInvoices] = useState<Set<string>>(
    new Set(),
  );
  const [parseResults, setParseResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  const hasInvoiceFiles = (invoice: InvoiceFormData): boolean => {
    const hasNewFiles =
      (invoice.invoiceFiles && invoice.invoiceFiles.length > 0) ||
      (invoice.invoiceFile !== null && invoice.invoiceFile !== undefined);
    const hasExistingFiles =
      (invoice.existingInvoiceFiles &&
        invoice.existingInvoiceFiles.length > 0) ||
      (invoice.existingInvoiceFile &&
        invoice.existingInvoiceFile.trim() !== "");
    return Boolean(hasNewFiles || hasExistingFiles);
  };

  const handleInvoiceFileUpload = async (
    invoiceId: string,
    files: File[] | File | null,
  ) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const fileArray = Array.isArray(files) ? files : files ? [files] : [];

    // Update invoice with new files immediately for UI feedback
    onUpdateInvoice(invoiceId, {
      invoiceFiles: fileArray,
      invoiceFile: fileArray[0] || null,
    });

    // If no files, clear parse results and return
    if (fileArray.length === 0) {
      setParseResults((prev) => {
        const newResults = { ...prev };
        delete newResults[invoiceId];
        return newResults;
      });
      return;
    }

    // Only proceed with upload if we have a new File object
    if (!(fileArray[0] instanceof File)) {
      return;
    }

    try {
      setUploadingInvoices((prev) => new Set(prev).add(invoiceId));

      // Generate event ID for upload (use existing or create temp ID)
      const eventId = eventRequestId || `temp_${Date.now()}_${invoiceId}`;

      // Upload file to Firebase Storage
      const uploadedUrls = await uploadFilesForEvent(
        fileArray,
        eventId,
        "invoice",
      );

      if (uploadedUrls.length === 0) {
        throw new Error("File upload failed - no URLs returned");
      }

      // Update invoice with the uploaded file URL
      const existingUrls = invoice.existingInvoiceFiles || [];
      const updatedUrls = [...existingUrls, ...uploadedUrls];

      onUpdateInvoice(invoiceId, {
        existingInvoiceFiles: updatedUrls,
        existingInvoiceFile: updatedUrls[0] || "",
      });

      setUploadingInvoices((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });

      // Automatically trigger AI parsing with the uploaded URL
      await parseInvoiceWithAI(invoiceId, uploadedUrls[0]);
    } catch (error) {
      console.error("Error uploading invoice file:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload file";

      setUploadingInvoices((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });

      showToast.error(errorMessage);

      // Clear the failed file from state
      onUpdateInvoice(invoiceId, {
        invoiceFiles: [],
        invoiceFile: null,
      });
    }
  };

  const parseInvoiceWithAI = async (invoiceId: string, imageUrl?: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    // Get the first invoice file URL (either new or existing)
    let invoiceImageUrl: string | null = imageUrl || null;

    if (!invoiceImageUrl) {
      if (
        invoice.existingInvoiceFiles &&
        invoice.existingInvoiceFiles.length > 0
      ) {
        invoiceImageUrl = invoice.existingInvoiceFiles[0];
      } else if (invoice.existingInvoiceFile) {
        invoiceImageUrl = invoice.existingInvoiceFile;
      }
    }

    if (!invoiceImageUrl) {
      showToast.error("Please upload an invoice file first before parsing");
      return;
    }

    try {
      setParsingInvoices((prev) => new Set(prev).add(invoiceId));
      setParseResults((prev) => ({
        ...prev,
        [invoiceId]: { success: false, message: "Parsing invoice..." },
      }));

      const response = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: invoiceImageUrl }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMessage =
          result.error || result.message || "Failed to parse invoice";
        const details = result.details ? ` (${result.details})` : "";
        throw new Error(`${errorMessage}${details}`);
      }

      const parsedData = result.data;

      if (!parsedData || typeof parsedData !== "object") {
        throw new Error("Invalid response from AI service");
      }

      // Map parsed receipt data to invoice format
      const items = Array.isArray(parsedData.lineItems)
        ? parsedData.lineItems.map((item: any) => ({
          description: item.description || "",
          quantity: 1,
          unitPrice: parseFloat(item.amount) || 0,
          total: parseFloat(item.amount) || 0,
        }))
        : [
          {
            description: "Invoice Total",
            quantity: 1,
            unitPrice: parseFloat(parsedData.total) || 0,
            total: parseFloat(parsedData.total) || 0,
          },
        ];

      const updates: Partial<InvoiceFormData> = {
        vendor: parsedData.vendorName || parsedData.location || "",
        items: items,
        tax: parseFloat(parsedData.tax) || 0,
        tip: parseFloat(parsedData.tip) || 0,
      };

      onUpdateInvoice(invoiceId, updates);

      setParseResults((prev) => ({
        ...prev,
        [invoiceId]: {
          success: true,
          message:
            "Invoice parsed successfully! Review and edit the information below.",
        },
      }));

      showToast.success("Invoice parsed successfully!");
    } catch (error) {
      console.error("Error parsing invoice:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to parse invoice";

      setParseResults((prev) => ({
        ...prev,
        [invoiceId]: {
          success: false,
          message: errorMessage,
        },
      }));

      showToast.error(errorMessage);
    } finally {
      setParsingInvoices((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  if (!needsAsFunding) {
    return (
      <Card className="bg-gray-50">
        <CardBody className="p-4">
          <p className="text-sm text-gray-600 flex items-center">
            <DollarSign className="w-4 h-4 mr-2" />
            No AS funding requested for this event.
          </p>
        </CardBody>
      </Card>
    );
  }

  const grandTotal = calculateGrandTotal(invoices);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            AS Funding Details
          </h3>
        </div>
        <Button
          color="success"
          startContent={<Plus className="w-4 h-4" />}
          onPress={onAddInvoice}
        >
          Add Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardBody className="p-4">
            <p className="text-sm text-yellow-800">
              Please add at least one invoice to request AS funding.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Invoice Tabs */}
          <Tabs
            selectedKey={activeInvoiceTab}
            onSelectionChange={(key) => onSetActiveInvoiceTab(key as string)}
            color="success"
            variant="underlined"
          >
            {invoices.map((invoice, index) => {
              const subtotal = invoice.items.reduce(
                (sum, item) => sum + item.total,
                0,
              );
              const total = subtotal + invoice.tax + invoice.tip;
              const hasMissingFiles = !hasInvoiceFiles(invoice);

              return (
                <Tab
                  key={invoice.id}
                  title={
                    <div className="flex items-center space-x-2">
                      <span>
                        Invoice #{index + 1}
                        {invoice.vendor && ` - ${invoice.vendor}`}
                      </span>
                      {hasMissingFiles && (
                        <span title="Missing invoice file">
                          <AlertTriangle
                            className="w-4 h-4 text-red-500"
                          />
                        </span>
                      )}
                      {total > 0 && (
                        <Chip size="sm" variant="flat">
                          ${total.toFixed(2)}
                        </Chip>
                      )}
                    </div>
                  }
                >
                  <Card className="border border-gray-200">
                    <CardBody className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-gray-900">
                          Invoice #{index + 1}
                        </h4>
                        <Button
                          color="danger"
                          variant="light"
                          startContent={<Trash2 className="w-4 h-4" />}
                          onPress={() => onRemoveInvoice(invoice.id)}
                          size="sm"
                        >
                          Remove
                        </Button>
                      </div>

                      {/* Invoice Sub-tabs */}
                      <Tabs
                        selectedKey={invoiceTabState[invoice.id] || "details"}
                        onSelectionChange={(key) =>
                          onUpdateInvoiceTabState(
                            invoice.id,
                            key as "details" | "import",
                          )
                        }
                        size="sm"
                      >
                        <Tab key="details" title="Manual Entry">
                          <div className="space-y-4 pt-4">
                            {/* Invoice File - Must be first for auto-parse on upload */}
                            <div>
                              {!hasInvoiceFiles(invoice) &&
                                !uploadingInvoices.has(invoice.id) && (
                                  <div className="flex items-center space-x-2 mb-3 text-red-600">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span className="text-sm font-medium">
                                      Invoice file required
                                    </span>
                                  </div>
                                )}

                              {/* Show upload progress */}
                              {uploadingInvoices.has(invoice.id) && (
                                <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center space-x-3">
                                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                  <div>
                                    <p className="text-sm font-medium text-blue-900">
                                      Uploading invoice file...
                                    </p>
                                    <p className="text-xs text-blue-700">
                                      Please wait while we upload your file
                                    </p>
                                  </div>
                                </div>
                              )}

                              <EnhancedFileUploadManager
                                title="Invoice Files"
                                description="Upload invoice files (PDF or image). AI will automatically extract invoice data from PDFs and images. Max size: 1MB per file."
                                existingFiles={
                                  invoice.existingInvoiceFiles || []
                                }
                                newFiles={invoice.invoiceFiles || []}
                                onFilesChange={(files) =>
                                  handleInvoiceFileUpload(invoice.id, files)
                                }
                                onRemoveExistingFile={(fileUrl) => {
                                  if (onRemoveExistingFile) {
                                    onRemoveExistingFile(
                                      fileUrl,
                                      "invoiceFiles",
                                    );
                                  }
                                  const updatedFiles = (
                                    invoice.existingInvoiceFiles || []
                                  ).filter((url) => url !== fileUrl);
                                  onUpdateInvoice(invoice.id, {
                                    existingInvoiceFiles: updatedFiles,
                                    existingInvoiceFile: updatedFiles[0] || "",
                                  });
                                  // Clear parse results when file is removed
                                  setParseResults((prev) => {
                                    const newResults = { ...prev };
                                    delete newResults[invoice.id];
                                    return newResults;
                                  });
                                }}
                                allowedTypes={[
                                  "pdf",
                                  "jpg",
                                  "jpeg",
                                  "png",
                                  "doc",
                                  "docx",
                                ]}
                                maxSizeInMB={1}
                                maxFiles={1}
                                multiple={false}
                                required={true}
                                disabled={uploadingInvoices.has(invoice.id)}
                                eventRequestId={eventRequestId}
                                className={
                                  !hasInvoiceFiles(invoice) &&
                                    !uploadingInvoices.has(invoice.id)
                                    ? "border-2 border-red-300 bg-red-50 rounded-lg"
                                    : ""
                                }
                              />

                              {/* Parse Result Message - Show immediately after file upload */}
                              {parseResults[invoice.id] && (
                                <Card
                                  className={`mt-3 ${parseResults[invoice.id].success ? "bg-green-50 border-green-200" : parsingInvoices.has(invoice.id) ? "bg-blue-50 border-blue-200" : "bg-yellow-50 border-yellow-200"}`}
                                >
                                  <CardBody className="p-3">
                                    <div className="flex items-start space-x-2">
                                      {parsingInvoices.has(invoice.id) ? (
                                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                                      ) : parseResults[invoice.id].success ? (
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                      ) : (
                                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                      )}
                                      <div className="flex-1">
                                        <p
                                          className={`text-sm font-medium ${parsingInvoices.has(invoice.id) ? "text-blue-900" : parseResults[invoice.id].success ? "text-green-800" : "text-yellow-800"}`}
                                        >
                                          {parseResults[invoice.id].message}
                                        </p>
                                        {parsingInvoices.has(invoice.id) && (
                                          <p className="text-xs text-blue-700 mt-1">
                                            This usually takes 2-5 seconds.
                                            Please wait.
                                          </p>
                                        )}
                                        {!parseResults[invoice.id].success &&
                                          !parsingInvoices.has(invoice.id) && (
                                            <Button
                                              size="sm"
                                              color="primary"
                                              variant="flat"
                                              className="mt-2"
                                              startContent={
                                                <Sparkles className="w-3 h-3" />
                                              }
                                              onPress={() =>
                                                parseInvoiceWithAI(invoice.id)
                                              }
                                            >
                                              Retry Parsing
                                            </Button>
                                          )}
                                      </div>
                                    </div>
                                  </CardBody>
                                </Card>
                              )}
                            </div>

                            {/* Show processing overlay when uploading or parsing */}
                            {uploadingInvoices.has(invoice.id) ||
                              parsingInvoices.has(invoice.id) ? (
                              <div className="text-center py-12 bg-blue-50 border border-blue-200 rounded-lg">
                                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                                <p className="text-lg font-semibold text-blue-900 mb-2">
                                  {uploadingInvoices.has(invoice.id)
                                    ? "Uploading your invoice..."
                                    : "AI is analyzing your invoice..."}
                                </p>
                                <p className="text-sm text-blue-700">
                                  {uploadingInvoices.has(invoice.id)
                                    ? "File is being uploaded to secure storage."
                                    : "This usually takes 2-5 seconds. Please wait."}
                                </p>
                              </div>
                            ) : (
                              <>
                                {/* Vendor */}
                                <Input
                                  label="Vendor/Restaurant"
                                  placeholder="Enter vendor or restaurant name"
                                  value={invoice.vendor}
                                  onValueChange={(value) =>
                                    onUpdateInvoice(invoice.id, {
                                      vendor: value,
                                    })
                                  }
                                  isRequired
                                  classNames={{
                                    label: "text-sm font-medium",
                                  }}
                                />

                                {/* Items */}
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-gray-700">
                                      Invoice Items *
                                    </label>
                                    <Button
                                      color="primary"
                                      variant="light"
                                      startContent={
                                        <Plus className="w-4 h-4" />
                                      }
                                      onPress={() =>
                                        onAddInvoiceItem(invoice.id)
                                      }
                                      size="sm"
                                    >
                                      Add Item
                                    </Button>
                                  </div>

                                  <div className="space-y-3">
                                    {invoice.items.map((item, itemIndex) => (
                                      <Card
                                        key={itemIndex}
                                        className="bg-gray-50"
                                      >
                                        <CardBody className="p-3">
                                          <div className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-4">
                                              <Input
                                                size="sm"
                                                placeholder="Item description"
                                                value={item.description}
                                                onValueChange={(value) =>
                                                  onUpdateInvoiceItem(
                                                    invoice.id,
                                                    itemIndex,
                                                    "description",
                                                    value,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="col-span-2">
                                              <Input
                                                type="number"
                                                size="sm"
                                                placeholder="Qty"
                                                value={item.quantity.toString()}
                                                onValueChange={(value) =>
                                                  onUpdateInvoiceItem(
                                                    invoice.id,
                                                    itemIndex,
                                                    "quantity",
                                                    parseInt(value) || 1,
                                                  )
                                                }
                                                min={1}
                                              />
                                            </div>
                                            <div className="col-span-2">
                                              <Input
                                                type="number"
                                                size="sm"
                                                placeholder="Price"
                                                value={item.unitPrice.toString()}
                                                onValueChange={(value) =>
                                                  onUpdateInvoiceItem(
                                                    invoice.id,
                                                    itemIndex,
                                                    "unitPrice",
                                                    parseFloat(value) || 0,
                                                  )
                                                }
                                                min={0}
                                                step={0.01}
                                              />
                                            </div>
                                            <div className="col-span-2">
                                              <Input
                                                size="sm"
                                                value={`$${item.total.toFixed(2)}`}
                                                isReadOnly
                                                classNames={{
                                                  input: "bg-gray-100",
                                                }}
                                              />
                                            </div>
                                            <div className="col-span-2 flex justify-center">
                                              {invoice.items.length > 1 && (
                                                <Button
                                                  isIconOnly
                                                  color="danger"
                                                  variant="light"
                                                  size="sm"
                                                  onPress={() =>
                                                    onRemoveInvoiceItem(
                                                      invoice.id,
                                                      itemIndex,
                                                    )
                                                  }
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </CardBody>
                                      </Card>
                                    ))}
                                  </div>
                                </div>

                                {/* Tax and Tip */}
                                <div className="grid grid-cols-2 gap-4">
                                  <Input
                                    type="number"
                                    label="Tax ($)"
                                    placeholder="0.00"
                                    value={invoice.tax.toString()}
                                    onValueChange={(value) =>
                                      onUpdateInvoice(invoice.id, {
                                        tax: parseFloat(value) || 0,
                                      })
                                    }
                                    min={0}
                                    step={0.01}
                                    classNames={{
                                      label: "text-sm font-medium",
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    label="Tip ($)"
                                    placeholder="0.00"
                                    value={invoice.tip.toString()}
                                    onValueChange={(value) =>
                                      onUpdateInvoice(invoice.id, {
                                        tip: parseFloat(value) || 0,
                                      })
                                    }
                                    min={0}
                                    step={0.01}
                                    classNames={{
                                      label: "text-sm font-medium",
                                    }}
                                  />
                                </div>

                                {/* Invoice Total */}
                                <Card className="bg-green-50 border-green-200">
                                  <CardBody className="p-3">
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center text-sm">
                                        <span>Subtotal:</span>
                                        <span>${subtotal.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm">
                                        <span>Tax:</span>
                                        <span>${invoice.tax.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm">
                                        <span>Tip:</span>
                                        <span>${invoice.tip.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-lg font-semibold border-t border-green-200 pt-2">
                                        <span>Total:</span>
                                        <span>${total.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </CardBody>
                                </Card>
                              </>
                            )}
                          </div>
                        </Tab>

                        <Tab key="import" title="Import JSON">
                          <div className="space-y-4 pt-4">
                            <Textarea
                              label="Import Invoice Data (JSON)"
                              placeholder='{"vendor": "Restaurant Name", "tax": 5.50, "tip": 10.00, "items": [{"description": "Item 1", "quantity": 2, "unitPrice": 15.99}]}'
                              value={jsonImportData[invoice.id] || ""}
                              onValueChange={(value) =>
                                onUpdateJsonImportData(invoice.id, value)
                              }
                              minRows={8}
                              classNames={{
                                label: "text-sm font-medium",
                                input: "font-mono text-sm",
                              }}
                            />
                            <Button
                              color="primary"
                              onPress={() => onHandleJsonImport(invoice.id)}
                            >
                              Import Data
                            </Button>
                          </div>
                        </Tab>
                      </Tabs>
                    </CardBody>
                  </Card>
                </Tab>
              );
            })}
          </Tabs>

          {/* Grand Total */}
          {invoices.length > 1 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardBody className="p-4">
                <div className="flex justify-between items-center text-xl font-bold text-blue-900">
                  <span>Grand Total (All Invoices):</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
