import {
	AlertCircle,
	CheckCircle,
	FileText,
	Loader2,
	Upload,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	invoiceUploadErrorMessage,
	isInvoiceUploadBusy,
	type ParsedInvoiceData,
} from "./invoiceUploadState";
import { useInvoiceUpload } from "./useInvoiceUpload";

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
	const [uploadedFileUrl, setUploadedFileUrl] = useState(existingFile || "");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { phase, selectFile, dismiss } = useInvoiceUpload({
		generateUploadUrl,
		parseWithAI: shouldParseUploadedInvoiceWithAI(aiEnabled),
		onUploaded: (storageId) => {
			setUploadedFileUrl(storageId);
			onFileUploaded(storageId);
		},
		onFinished: ({ parsed }) => {
			if (parsed) onParsed(parsed);
		},
	});
	const error = invoiceUploadErrorMessage(phase);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		e.target.value = "";
		selectFile(file);
	};

	return (
		<div className="space-y-2">
			<output aria-live="polite" className="block space-y-2">
				{error && (
					<div className="flex items-start gap-2 p-2 bg-ds-red-100 border border-ds-red-100 rounded-lg">
						<AlertCircle className="h-4 w-4 text-tone-danger mt-0.5 shrink-0" />
						<div className="min-w-0 flex-1">
							<p className="text-xs text-tone-danger break-words">{error}</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-5 w-5 p-0"
							onClick={dismiss}
							aria-label="Dismiss error"
						>
							<X className="h-3 w-3" />
						</Button>
					</div>
				)}

				{phase.status === "parsed" && (
					<div className="flex items-center gap-2 p-2 bg-ds-green-100 border border-ds-green-100 rounded-lg">
						<CheckCircle className="h-4 w-4 text-tone-success shrink-0" />
						<p className="text-xs text-tone-success">
							Invoice parsed successfully! Verify the extracted data below.
						</p>
					</div>
				)}
			</output>

			{uploadedFileUrl && (
				<div className="flex items-center gap-2 text-xs text-tone-success">
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
					disabled={isInvoiceUploadBusy(phase)}
					onClick={() => fileInputRef.current?.click()}
				>
					{phase.status === "uploading" ? (
						<>
							<Loader2 className="h-3 w-3 mr-1 animate-spin" />
							Uploading…
						</>
					) : phase.status === "parsing" ? (
						<>
							<Loader2 className="h-3 w-3 mr-1 animate-spin" />
							AI Scanning…
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
				<Input
					ref={fileInputRef}
					type="file"
					name="invoiceFile"
					aria-label="Upload invoice file"
					accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
					className="hidden"
					onChange={handleFileSelect}
				/>
			</div>
		</div>
	);
}
