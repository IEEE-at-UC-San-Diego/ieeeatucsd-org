import {
	AlertCircle,
	Download,
	ExternalLink,
	FileText,
	Image as ImageIcon,
	Loader2,
	RefreshCw,
	RotateCw,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

type FileKind = "pdf" | "image" | "unknown";

interface ReceiptViewerProps {
	receiptUrl: string;
	receiptName: string;
	receiptType?: "image" | "pdf";
	className?: string;
}

// Detect file type from Content-Type header via HEAD request, with URL fallback
async function detectFileKind(
	url: string,
	hintType?: "image" | "pdf",
): Promise<FileKind> {
	if (hintType === "pdf") return "pdf";
	if (hintType === "image") return "image";

	// Try URL-based detection first (fast path)
	const lower = url.toLowerCase();
	if (
		lower.endsWith(".pdf") ||
		lower.includes(".pdf?") ||
		lower.includes("%2F.pdf")
	)
		return "pdf";
	const imgExts = [
		".png",
		".jpg",
		".jpeg",
		".gif",
		".webp",
		".bmp",
		".svg",
		".tiff",
		".ico",
		".heic",
		".heif",
	];
	for (const ext of imgExts) {
		if (lower.endsWith(ext) || lower.includes(`${ext}?`)) return "image";
	}

	// Fallback: HEAD request to get Content-Type
	try {
		const resp = await fetch(url, { method: "HEAD" });
		const ct = resp.headers.get("content-type")?.toLowerCase() || "";
		if (ct.includes("pdf")) return "pdf";
		if (ct.startsWith("image/")) return "image";
		// Some servers return octet-stream; try GET with range to sniff magic bytes
		if (ct.includes("octet-stream") || !ct) {
			return await sniffMagicBytes(url);
		}
	} catch {
		// HEAD failed (CORS etc.), try GET with range
		try {
			return await sniffMagicBytes(url);
		} catch {
			// Last resort
		}
	}
	return "unknown";
}

// Sniff first bytes to detect PDF vs image
async function sniffMagicBytes(url: string): Promise<FileKind> {
	try {
		const resp = await fetch(url, { headers: { Range: "bytes=0-16" } });
		const buf = await resp.arrayBuffer();
		const bytes = new Uint8Array(buf);
		// PDF: %PDF
		if (
			bytes[0] === 0x25 &&
			bytes[1] === 0x50 &&
			bytes[2] === 0x44 &&
			bytes[3] === 0x46
		)
			return "pdf";
		// PNG: 0x89 P N G
		if (
			bytes[0] === 0x89 &&
			bytes[1] === 0x50 &&
			bytes[2] === 0x4e &&
			bytes[3] === 0x47
		)
			return "image";
		// JPEG: 0xFF 0xD8 0xFF
		if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
			return "image";
		// GIF: GIF8
		if (
			bytes[0] === 0x47 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x38
		)
			return "image";
		// WEBP: RIFF....WEBP
		if (
			bytes[0] === 0x52 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x46 &&
			bytes.length > 11 &&
			bytes[8] === 0x57 &&
			bytes[9] === 0x45 &&
			bytes[10] === 0x42 &&
			bytes[11] === 0x50
		)
			return "image";
		// HEIC/HEIF: ftyp at offset 4
		if (
			bytes.length > 11 &&
			bytes[4] === 0x66 &&
			bytes[5] === 0x74 &&
			bytes[6] === 0x79 &&
			bytes[7] === 0x70
		)
			return "image";
		// BMP: BM
		if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image";
		// TIFF: II or MM
		if (
			(bytes[0] === 0x49 && bytes[1] === 0x49) ||
			(bytes[0] === 0x4d && bytes[1] === 0x4d)
		)
			return "image";
	} catch {
		// ignore
	}
	return "unknown";
}

// Check if a URL points to a HEIC/HEIF file
async function isHeicFile(url: string): Promise<boolean> {
	const lower = url.toLowerCase();
	if (
		lower.endsWith(".heic") ||
		lower.endsWith(".heif") ||
		lower.includes(".heic?") ||
		lower.includes(".heif?")
	) {
		return true;
	}
	// Check Content-Type
	try {
		const resp = await fetch(url, { method: "HEAD" });
		const ct = resp.headers.get("content-type")?.toLowerCase() || "";
		if (ct.includes("heic") || ct.includes("heif")) return true;
	} catch {
		// ignore
	}
	// Check magic bytes for HEIC ftyp
	try {
		const resp = await fetch(url, { headers: { Range: "bytes=0-16" } });
		const buf = await resp.arrayBuffer();
		const bytes = new Uint8Array(buf);
		if (
			bytes.length > 11 &&
			bytes[4] === 0x66 &&
			bytes[5] === 0x74 &&
			bytes[6] === 0x79 &&
			bytes[7] === 0x70
		) {
			const brand = String.fromCharCode(
				bytes[8],
				bytes[9],
				bytes[10],
				bytes[11],
			);
			if (["heic", "heix", "hevc", "mif1"].includes(brand)) return true;
		}
	} catch {
		// ignore
	}
	return false;
}

// Convert HEIC to JPEG blob URL
async function convertHeicToJpeg(url: string): Promise<string> {
	const heic2any = (await import("heic2any")).default;
	const resp = await fetch(url);
	const blob = await resp.blob();
	const converted = await heic2any({
		blob,
		toType: "image/jpeg",
		quality: 0.92,
	});
	const resultBlob = Array.isArray(converted) ? converted[0] : converted;
	return URL.createObjectURL(resultBlob);
}

export default function ReceiptViewer({
	receiptUrl,
	receiptName,
	receiptType,
	className = "",
}: ReceiptViewerProps) {
	const [zoomLevel, setZoomLevel] = useState(1);
	const [rotation, setRotation] = useState(0);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [imageError, setImageError] = useState(false);
	const [fileKind, setFileKind] = useState<FileKind>("unknown");
	const [loading, setLoading] = useState(true);
	const [displayUrl, setDisplayUrl] = useState<string>(receiptUrl);
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [isConverting, setIsConverting] = useState(false);
	const blobUrlRef = useRef<string | null>(null);

	// Touch gesture tracking for pinch-zoom + pan on mobile
	const gestureRef = useRef<{
		mode: "none" | "pinch" | "pan";
		startDistance: number;
		startZoom: number;
		startPan: { x: number; y: number };
		startTouch: { x: number; y: number };
	}>({
		mode: "none",
		startDistance: 0,
		startZoom: 1,
		startPan: { x: 0, y: 0 },
		startTouch: { x: 0, y: 0 },
	});

	const handleZoomIn = () =>
		setZoomLevel((prev) => Math.min(prev + 0.25, MAX_ZOOM));
	const handleZoomOut = () =>
		setZoomLevel((prev) => Math.max(prev - 0.25, MIN_ZOOM));
	const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
	const resetView = () => {
		setZoomLevel(1);
		setRotation(0);
		setPan({ x: 0, y: 0 });
	};

	const touchDistance = (touches: React.TouchList) => {
		const [a, b] = [touches[0], touches[1]];
		return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
	};

	const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		if (e.touches.length === 2) {
			gestureRef.current = {
				mode: "pinch",
				startDistance: touchDistance(e.touches),
				startZoom: zoomLevel,
				startPan: pan,
				startTouch: { x: 0, y: 0 },
			};
		} else if (e.touches.length === 1 && zoomLevel > 1) {
			gestureRef.current = {
				mode: "pan",
				startDistance: 0,
				startZoom: zoomLevel,
				startPan: pan,
				startTouch: { x: e.touches[0].clientX, y: e.touches[0].clientY },
			};
		}
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
		const gesture = gestureRef.current;
		if (gesture.mode === "pinch" && e.touches.length === 2) {
			e.preventDefault();
			const newDistance = touchDistance(e.touches);
			if (gesture.startDistance > 0) {
				const scale = newDistance / gesture.startDistance;
				const nextZoom = Math.min(
					MAX_ZOOM,
					Math.max(MIN_ZOOM, gesture.startZoom * scale),
				);
				setZoomLevel(nextZoom);
			}
		} else if (gesture.mode === "pan" && e.touches.length === 1) {
			e.preventDefault();
			const dx = e.touches[0].clientX - gesture.startTouch.x;
			const dy = e.touches[0].clientY - gesture.startTouch.y;
			setPan({ x: gesture.startPan.x + dx, y: gesture.startPan.y + dy });
		}
	};

	const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
		if (e.touches.length === 0) {
			gestureRef.current.mode = "none";
		} else if (e.touches.length === 1 && zoomLevel > 1) {
			// Transition from pinch to pan without losing position
			gestureRef.current = {
				mode: "pan",
				startDistance: 0,
				startZoom: zoomLevel,
				startPan: pan,
				startTouch: { x: e.touches[0].clientX, y: e.touches[0].clientY },
			};
		}
	};

	const detectAndPrepare = useCallback(
		async (url: string) => {
			setLoading(true);
			setImageError(false);
			setErrorMessage("");
			setDisplayUrl(url);

			// Clean up previous blob URL
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}

			try {
				const kind = await detectFileKind(url, receiptType);
				setFileKind(kind);

				if (kind === "image") {
					// Check if HEIC and convert
					const heic = await isHeicFile(url);
					if (heic) {
						setIsConverting(true);
						try {
							const jpegUrl = await convertHeicToJpeg(url);
							blobUrlRef.current = jpegUrl;
							setDisplayUrl(jpegUrl);
						} catch (e) {
							console.error("HEIC conversion failed:", e);
							setErrorMessage(
								"Failed to convert HEIC image. Try downloading the file directly.",
							);
							setImageError(true);
						} finally {
							setIsConverting(false);
						}
					}
				} else if (kind === "unknown") {
					// Try loading as image first; if it fails, try PDF
					setFileKind("image");
				}
			} catch (e) {
				console.error("File detection failed:", e);
				// Default to image and let the error handler deal with it
				setFileKind("image");
			} finally {
				setLoading(false);
			}
		},
		[receiptType],
	);

	useEffect(() => {
		if (receiptUrl) {
			detectAndPrepare(receiptUrl);
		} else {
			setLoading(false);
		}
		return () => {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		};
	}, [receiptUrl, detectAndPrepare]);

	const handleImageError = () => {
		// If we thought it was an image but it failed, try as PDF
		if (fileKind === "image" && !imageError) {
			setFileKind("pdf");
		} else {
			setImageError(true);
			setErrorMessage(
				"Failed to load receipt. The file may be corrupted or in an unsupported format.",
			);
		}
	};

	const handleRetry = () => {
		setImageError(false);
		setErrorMessage("");
		resetView();
		detectAndPrepare(receiptUrl);
	};

	if (!receiptUrl) {
		return (
			<div
				className={`flex flex-col items-center justify-center p-8 bg-muted rounded-md border border-border text-muted-foreground h-full min-h-75 ${className}`}
			>
				<FileText className="w-12 h-12 mb-3 opacity-50" />
				<p className="text-muted-foreground">No receipt file available</p>
			</div>
		);
	}

	const isPdf = fileKind === "pdf";
	const isImage = fileKind === "image";

	return (
		<div
			className={`flex flex-col h-full bg-background rounded-md overflow-hidden border border-border ${className}`}
		>
			{/* Toolbar */}
			<div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border shrink-0">
				<div className="flex items-center gap-2 overflow-hidden">
					{isPdf ? (
						<FileText className="w-4 h-4 text-tone-danger shrink-0" />
					) : (
						<ImageIcon className="w-4 h-4 text-tone-info shrink-0" />
					)}
					<span
						className="text-foreground text-xs font-medium truncate max-w-37.5"
						title={receiptName}
					>
						{receiptName || "Receipt Preview"}
					</span>
					{!loading && (
						<Badge
							variant="secondary"
							className="text-[10px] h-5 ml-1 bg-muted text-muted-foreground border-border"
						>
							{isPdf ? "PDF" : "Image"}
						</Badge>
					)}
					{isConverting && (
						<Badge
							variant="secondary"
							className="text-[10px] h-5 ml-1 bg-ds-amber-100 text-tone-warning border-ds-amber-100"
						>
							Converting HEIC…
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-1">
					{isImage && !loading && !imageError && (
						<>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
								onClick={handleZoomOut}
								title="Zoom out"
							>
								<ZoomOut className="w-4 h-4" />
							</Button>
							<span className="text-muted-foreground text-xs w-10 text-center tabular-nums">
								{Math.round(zoomLevel * 100)}%
							</span>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
								onClick={handleZoomIn}
								title="Zoom in"
							>
								<ZoomIn className="w-4 h-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
								onClick={handleRotate}
								title="Rotate"
							>
								<RotateCw className="w-4 h-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
								onClick={resetView}
								title="Reset view"
							>
								<RefreshCw className="w-3 h-3" />
							</Button>
						</>
					)}
					<div className="w-px h-4 bg-muted mx-1" />
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
						onClick={() => {
							const a = document.createElement("a");
							a.href = receiptUrl;
							a.download = receiptName || "receipt";
							a.target = "_blank";
							a.click();
						}}
						title="Download"
					>
						<Download className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground hover:text-tone-info hover:bg-muted"
						onClick={() => window.open(receiptUrl, "_blank")}
						title="Open in new tab"
					>
						<ExternalLink className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{/* Content Viewer */}
			<div className="flex-1 overflow-hidden relative bg-muted flex items-center justify-center">
				{/* Loading / Converting State */}
				{loading && (
					<div className="flex flex-col items-center gap-3 text-muted-foreground">
						<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
						<p className="text-sm">
							{isConverting
								? "Converting HEIC image for preview…"
								: "Loading receipt…"}
						</p>
						{isConverting && (
							<p className="max-w-56 text-center text-xs text-muted-foreground/80">
								This can take a few seconds on larger photos.
							</p>
						)}
					</div>
				)}

				{/* Error State */}
				{!loading && imageError && (
					<div className="flex flex-col items-center gap-4 text-center p-8 max-w-sm">
						<div className="w-14 h-14 rounded-full bg-ds-red-100 flex items-center justify-center">
							<AlertCircle className="w-7 h-7 text-tone-danger" />
						</div>
						<div>
							<p className="text-sm font-medium text-foreground mb-1">
								Unable to display receipt
							</p>
							<p className="text-xs text-muted-foreground">{errorMessage}</p>
						</div>
						<div className="flex gap-2">
							<Button
								size="sm"
								variant="outline"
								onClick={handleRetry}
								className="text-xs"
							>
								<RefreshCw className="w-3 h-3 mr-1.5" />
								Retry
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => window.open(receiptUrl, "_blank")}
								className="text-xs"
							>
								<ExternalLink className="w-3 h-3 mr-1.5" />
								Open directly
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => {
									const a = document.createElement("a");
									a.href = receiptUrl;
									a.download = receiptName || "receipt";
									a.target = "_blank";
									a.click();
								}}
								className="text-xs"
							>
								<Download className="w-3 h-3 mr-1.5" />
								Download
							</Button>
						</div>
					</div>
				)}

				{/* PDF Viewer */}
				{!loading && isPdf && !imageError && (
					<div className="w-full h-full flex flex-col">
						<object
							data={`${receiptUrl}#toolbar=1&navpanes=0&view=FitH`}
							type="application/pdf"
							className="w-full h-full"
							title="PDF Receipt"
						>
							{/* Fallback: iframe */}
							<iframe
								src={`${receiptUrl}#toolbar=1&navpanes=0&view=FitH`}
								className="w-full h-full border-0"
								title="PDF Receipt"
							>
								<div className="flex flex-col items-center gap-4 p-8 text-center">
									<FileText className="w-12 h-12 text-muted-foreground" />
									<p className="text-sm text-muted-foreground">
										Your browser cannot display this PDF.
									</p>
									<Button
										size="sm"
										variant="outline"
										onClick={() => window.open(receiptUrl, "_blank")}
									>
										<ExternalLink className="w-3 h-3 mr-1.5" />
										Open PDF
									</Button>
								</div>
							</iframe>
						</object>
					</div>
				)}

				{/* Image Viewer */}
				{!loading && isImage && !imageError && (
					<div
						className="w-full h-full overflow-hidden flex items-center justify-center p-4 touch-none select-none"
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					>
						<img
							src={displayUrl}
							alt={receiptName || "Receipt"}
							className={cn(
								"max-w-full max-h-full object-contain rounded shadow-sm origin-center block",
								gestureRef.current.mode === "none" &&
									"transition-transform duration-200 ease-out",
							)}
							style={{
								transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
							}}
							onError={handleImageError}
							onLoad={() => setLoading(false)}
							draggable={false}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
