import { useState, useRef } from "react";
import { DollarSign, Plus, Trash2, Upload, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import type { Invoice, InvoiceItem } from "../types";

interface FundingSectionProps {
  data: {
    needsASFunding: boolean;
    asFundingRequired: boolean;
    invoices: Invoice[];
  };
  onChange: (data: Partial<FundingSectionProps["data"]>) => void;
  generateUploadUrl?: () => Promise<string>;
  aiEnabled?: boolean;
}

export function shouldParseInvoiceWithAI(aiEnabled: boolean) {
  return aiEnabled;
}

export function FundingSection({
  data,
  onChange,
  generateUploadUrl,
  aiEnabled = true,
}: FundingSectionProps) {
  const { getAuthHeaders } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddInvoiceViaUpload = async (file: File) => {
    setUploadError("");
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError("File too large. Maximum 10MB.");
      return;
    }
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      setUploadError("Unsupported file type. Use PDF, JPG, PNG, GIF, or WebP.");
      return;
    }

    setIsUploading(true);
    const newInvoiceId = crypto.randomUUID();

    let fileUrl = "";
    const parseDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    // Upload to Convex if available
    if (generateUploadUrl) {
      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (res.ok) {
          const { storageId } = await res.json();
          fileUrl = storageId;
        }
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }

    // AI parse
    if (shouldParseInvoiceWithAI(aiEnabled)) {
      try {
        const response = await fetch("/api/parse-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          // Use local data URL for parsing. Convex storage IDs are not fetchable URLs.
          body: JSON.stringify({ imageUrl: parseDataUrl }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const parsed = result.data;
            const newInvoice: Invoice = {
              _id: newInvoiceId,
              vendor: parsed.vendor || "",
              items: (parsed.items || []).map((item: any) => ({
                description: item.description || "",
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                total: item.total || 0,
              })),
              tax: parsed.tax || 0,
              tip: parsed.tip || 0,
              invoiceFile: fileUrl || undefined,
              additionalFiles: [],
              subtotal: parsed.subtotal || 0,
              total: parsed.total || 0,
              amount: parsed.total || 0,
              description: "",
            };
            onChange({ invoices: [...data.invoices, newInvoice] });
            setIsUploading(false);
            return;
          }
        }
        // AI failed — create empty invoice with file attached
        setUploadError("AI parsing failed. Please enter invoice details manually.");
      } catch {
        setUploadError("AI parsing failed. Please enter invoice details manually.");
      }
    } else {
      setUploadError("AI is disabled. Please enter invoice details manually.");
    }

    // Fallback: create invoice with file but no parsed data
    const newInvoice: Invoice = {
      _id: newInvoiceId,
      vendor: "",
      items: [],
      tax: 0,
      tip: 0,
      invoiceFile: fileUrl || undefined,
      additionalFiles: [],
      subtotal: 0,
      total: 0,
      amount: 0,
      description: "",
    };
    onChange({ invoices: [...data.invoices, newInvoice] });
    setIsUploading(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAddInvoiceViaUpload(file);
    e.target.value = "";
  };

  const addInvoiceManual = () => {
    const newInvoice: Invoice = {
      _id: crypto.randomUUID(),
      vendor: "",
      items: [],
      tax: 0,
      tip: 0,
      additionalFiles: [],
      subtotal: 0,
      total: 0,
      amount: 0,
      description: "",
    };
    onChange({ invoices: [...data.invoices, newInvoice] });
  };

  const addLineItem = (invoiceId: string) => {
    const invoice = data.invoices.find((inv) => inv._id === invoiceId);
    if (!invoice) return;
    const newItem: InvoiceItem = { description: "", quantity: 1, unitPrice: 0, total: 0 };
    const updatedItems = [...invoice.items, newItem];
    updateInvoice(invoiceId, { items: updatedItems });
  };

  const updateLineItem = (invoiceId: string, itemIndex: number, updates: Partial<InvoiceItem>) => {
    const invoice = data.invoices.find((inv) => inv._id === invoiceId);
    if (!invoice) return;
    const updatedItems = invoice.items.map((item, idx) => {
      if (idx !== itemIndex) return item;
      const updated = { ...item, ...updates };
      if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
        updated.total = updated.quantity * updated.unitPrice;
      }
      return updated;
    });
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);
    updateInvoice(invoiceId, { items: updatedItems, subtotal, total, amount: total });
  };

  const removeLineItem = (invoiceId: string, itemIndex: number) => {
    const invoice = data.invoices.find((inv) => inv._id === invoiceId);
    if (!invoice) return;
    const updatedItems = invoice.items.filter((_, idx) => idx !== itemIndex);
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);
    updateInvoice(invoiceId, { items: updatedItems, subtotal, total, amount: total });
  };

  const removeInvoice = (id: string) => {
    onChange({ invoices: data.invoices.filter((inv) => inv._id !== id) });
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    onChange({
      invoices: data.invoices.map((inv) =>
        inv._id === id ? { ...inv, ...updates } : inv
      ),
    });
  };

  const recalcInvoiceTotal = (invoiceId: string, field: "tax" | "tip", value: number) => {
    const invoice = data.invoices.find((inv) => inv._id === invoiceId);
    if (!invoice) return;
    const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
    const tax = field === "tax" ? value : (invoice.tax || 0);
    const tip = field === "tip" ? value : (invoice.tip || 0);
    const total = subtotal + tax + tip;
    updateInvoice(invoiceId, { [field]: value, subtotal, total, amount: total });
  };

  const totalAmount = data.invoices.reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-500" />
            Do you need AS (Associated Students) funding for this event? <span className="text-red-500">*</span>
          </Label>
          <RadioGroup
            value={data.needsASFunding ? "yes" : "no"}
            onValueChange={(val) => {
              const isYes = val === "yes";
              onChange({ needsASFunding: isYes, asFundingRequired: isYes });
            }}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <RadioGroupItem value="yes" id="funding-yes" />
              <Label htmlFor="funding-yes" className="cursor-pointer flex-1">
                Yes, I need AS funding
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <RadioGroupItem value="no" id="funding-no" />
              <Label htmlFor="funding-no" className="cursor-pointer flex-1">
                No, I have other funding sources
              </Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-gray-500">
            AS funding requires detailed invoices and receipts. You'll need to provide this information in the next step.
          </p>
        </div>

        {data.needsASFunding && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-medium mb-1">AS Funding Guidelines</p>
            <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
              <li>Maximum $5,000 per event</li>
              <li>Itemized receipts required</li>
              <li>Food/drinks must follow university guidelines</li>
              <li>AS logo required on all funded materials</li>
            </ul>
          </div>
        )}

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Invoices
            </h3>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {aiEnabled ? "Scanning..." : "Uploading..."}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Invoice
                  </>
                )}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={addInvoiceManual}>
                <Plus className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600">{uploadError}</p>
            </div>
          )}

          {data.invoices.length === 0 ? (
            <div
              className="text-center py-8 border border-dashed rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              tabIndex={0}
              role="button"
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Upload an invoice to get started</p>
              <p className="text-xs text-gray-400 mt-1">
                {aiEnabled
                  ? "AI will automatically scan and extract line items"
                  : "AI is disabled for this account; enter invoice details manually"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                PDF, JPG, PNG supported · or use Manual Entry above
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.invoices.map((invoice) => (
                <div
                  key={invoice._id}
                  className="p-4 border rounded-lg space-y-4 bg-gray-50/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      Invoice #{data.invoices.indexOf(invoice) + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => removeInvoice(invoice._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`vendor-${invoice._id}`}>Vendor</Label>
                    <Input
                      id={`vendor-${invoice._id}`}
                      value={invoice.vendor}
                      onChange={(e) =>
                        updateInvoice(invoice._id, { vendor: e.target.value })
                      }
                      placeholder="e.g., Costco"
                    />
                  </div>

                  {invoice.invoiceFile && (
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {aiEnabled ? "Invoice file attached (AI-scanned)" : "Invoice file attached"}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Line Items</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addLineItem(invoice._id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Item
                      </Button>
                    </div>
                    {invoice.items.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No line items yet. Add items or enter a total amount below.</p>
                    ) : (
                      <div className="space-y-2">
                        {invoice.items.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5">
                              {idx === 0 && <Label className="text-[10px] text-gray-500">Description</Label>}
                              <Input
                                value={item.description}
                                onChange={(e) => updateLineItem(invoice._id, idx, { description: e.target.value })}
                                placeholder="Item description"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="col-span-2">
                              {idx === 0 && <Label className="text-[10px] text-gray-500">Qty</Label>}
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateLineItem(invoice._id, idx, { quantity: parseInt(e.target.value) || 1 })}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="col-span-2">
                              {idx === 0 && <Label className="text-[10px] text-gray-500">Price</Label>}
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitPrice || ""}
                                onChange={(e) => updateLineItem(invoice._id, idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="col-span-2 text-xs font-medium text-right pt-1">
                              {idx === 0 && <Label className="text-[10px] text-gray-500 block">Total</Label>}
                              ${item.total.toFixed(2)}
                            </div>
                            <div className="col-span-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => removeLineItem(invoice._id, idx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                    <div className="space-y-1">
                      <Label htmlFor={`tax-${invoice._id}`} className="text-xs">Tax ($)</Label>
                      <Input
                        id={`tax-${invoice._id}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={invoice.tax || ""}
                        onChange={(e) => recalcInvoiceTotal(invoice._id, "tax", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`tip-${invoice._id}`} className="text-xs">Tip ($)</Label>
                      <Input
                        id={`tip-${invoice._id}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={invoice.tip || ""}
                        onChange={(e) => recalcInvoiceTotal(invoice._id, "tip", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Invoice Total</Label>
                      <div className="h-8 flex items-center text-sm font-bold">
                        ${(invoice.total || invoice.amount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`description-${invoice._id}`}>
                      Notes / Description
                    </Label>
                    <Textarea
                      id={`description-${invoice._id}`}
                      value={invoice.description}
                      onChange={(e) =>
                        updateInvoice(invoice._id, { description: e.target.value })
                      }
                      placeholder="Additional notes about this invoice..."
                      rows={2}
                    />
                  </div>

                </div>
              ))}

              {data.invoices.length > 0 && (
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-sm font-medium text-gray-600">
                    Total Invoiced:
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
