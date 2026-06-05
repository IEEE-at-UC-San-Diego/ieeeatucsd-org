import { useState, useRef } from "react";
import { Upload, Loader2, AlertCircle, CheckCircle, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { InvoiceItem } from "../types";

interface ParsedInvoiceData {
  vendor: string;
  items: InvoiceItem[];
  tax: number;
  tip: number;
  subtotal: number;
  total: number;
}

interface InvoiceFileUploadProps {
  invoiceId: string;
  existingFile?: string;
  onParsed: (data: ParsedInvoiceData) => void;
  onFileUploaded: (fileUrl: string) => void;
  generateUploadUrl?: () => Promise<string>;
  aiEnabled?: boolean;
}

export function shouldParseUploadedInvoiceWithAI(aiEnabled: boolean) {
  return aiEnabled;
}

export function InvoiceFileUpload({
  existingFile,
  onParsed,
  onFileUploaded,
  generateUploadUrl,
  aiEnabled = true,
}: InvoiceFileUploadProps) {
  const { getAuthHeaders } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState(existingFile || "");
  const [parseSuccess, setParseSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setError("");
    setParseSuccess(false);

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("File too large. Maximum 10MB.");
      return;
    }

    const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      setError("Unsupported file type. Use PDF, JPG, PNG, GIF, or WebP.");
      return;
    }

    const parseDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    // Upload file to Convex storage if generateUploadUrl is available
    let fileUrl = "";
    if (generateUploadUrl) {
      setIsUploading(true);
      try {
        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } = await uploadResponse.json();
        fileUrl = storageId;
        setUploadedFileUrl(fileUrl);
        onFileUploaded(fileUrl);
      } catch (err) {
        setError("Failed to upload file. Please try again.");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Parse with AI
    if (shouldParseUploadedInvoiceWithAI(aiEnabled)) {
      setIsParsing(true);
      try {
        const response = await fetch("/api/parse-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          // Parse the actual file bytes via data URL, not Convex storage ID.
          body: JSON.stringify({ imageUrl: parseDataUrl }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "AI parsing failed");
        }

        const result = await response.json();
        if (result.success && result.data) {
          onParsed({
            vendor: result.data.vendor,
            items: result.data.items.map((item: any) => ({
              description: item.description,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              total: item.total || 0,
            })),
            tax: result.data.tax || 0,
            tip: result.data.tip || 0,
            subtotal: result.data.subtotal || 0,
            total: result.data.total || 0,
          });
          setParseSuccess(true);
        } else {
          throw new Error("No data returned from AI");
        }
      } catch (err) {
        setError(
          `AI parsing failed: ${err instanceof Error ? err.message : "Unknown error"}. You can still enter items manually.`
        );
      } finally {
        setIsParsing(false);
      }
    } else {
      setError("AI is disabled for this account. Enter invoice details manually.");
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-red-600">{error}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setError("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {parseSuccess && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-xs text-green-600">
            Invoice parsed successfully! Please verify the extracted data below.
          </p>
        </div>
      )}

      {uploadedFileUrl && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <FileText className="h-3.5 w-3.5" />
          <span>Invoice file attached</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={isUploading || isParsing}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Uploading...
            </>
          ) : isParsing ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              AI Scanning...
            </>
          ) : (
            <>
              <Upload className="h-3 w-3 mr-1" />
              {uploadedFileUrl
                ? "Replace Invoice File"
                : aiEnabled
                  ? "Upload & Scan Invoice"
                  : "Upload Invoice"}
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}
