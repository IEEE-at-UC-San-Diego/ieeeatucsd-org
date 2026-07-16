import { Link } from "@tanstack/react-router";
import {
	AlertCircle,
	Check,
	Edit3,
	ExternalLink,
	Eye,
	FileText,
	History,
	Loader2,
	MoreHorizontal,
	Printer,
	RefreshCw,
	RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ResponsiveOverlay, useMobileShell } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConstitutionAuditLog } from "./ConstitutionAuditLog";
import ConstitutionDocumentEditor, {
	type ConstitutionDocumentEditorHandle,
} from "./ConstitutionDocumentEditor";
import ConstitutionPreview from "./ConstitutionPreview";
import ConstitutionSearch from "./ConstitutionSearch";
import ConstitutionVersionHistory from "./ConstitutionVersionHistory";
import { useConstitutionData } from "./hooks/useConstitutionData";
import type { SaveStatus } from "./types";
import { exportConstitutionToPdf } from "./utils/pdfExport";

type BuilderView = "editor" | "audit" | "versions";

const ConstitutionBuilderContent = () => {
	const isMobile = useIsMobile();
	const { setHideTabBar } = useMobileShell();
	const {
		sections,
		versions,
		isLoading,
		saveDocumentSections,
		saveVersion,
		restoreVersion,
		initializeConstitution,
		constitution,
		constitutionId,
	} = useConstitutionData();

	const [currentView, setCurrentView] = useState<BuilderView>("editor");
	const [previewOpen, setPreviewOpen] = useState(false);
	const [exportSheetOpen, setExportSheetOpen] = useState(false);
	const [documentSaveStatus, setDocumentSaveStatus] =
		useState<SaveStatus>("idle");
	const editorRef = useRef<ConstitutionDocumentEditorHandle>(null);

	const saveStatus: SaveStatus = isLoading ? "idle" : documentSaveStatus;

	useEffect(() => {
		initializeConstitution();
	}, [initializeConstitution]);

	useEffect(() => {
		setHideTabBar(previewOpen || exportSheetOpen);
		return () => setHideTabBar(false);
	}, [previewOpen, exportSheetOpen, setHideTabBar]);

	const handlePrint = () => {
		if (!constitution) return;
		exportConstitutionToPdf(constitution, sections);
	};

	const handleRetrySave = () => {
		editorRef.current?.retrySave();
	};

	if (isLoading) {
		return (
			<div className="w-full max-w-none p-4 md:p-6">
				<div className="max-w-7xl mx-auto">
					<div className="space-y-4">
						<div className="h-10 bg-muted rounded animate-pulse" />
						<div className="h-64 bg-muted rounded animate-pulse" />
					</div>
				</div>
			</div>
		);
	}

	const previewButton = isMobile ? (
		<Button
			variant="outline"
			size="sm"
			className="h-11 shrink-0 gap-1.5"
			onClick={() => setPreviewOpen(true)}
		>
			<Eye className="h-4 w-4" />
			Preview
		</Button>
	) : (
		<Button
			variant="outline"
			className="inline-flex items-center gap-2 text-sm font-medium"
			asChild
		>
			<Link
				to="/constitution-preview"
				target="_blank"
				rel="noopener noreferrer"
			>
				<ExternalLink className="h-4 w-4" />
				Live Preview
			</Link>
		</Button>
	);

	return (
		<div className="w-full max-w-none p-4 md:p-6">
			<div className="max-w-7xl mx-auto">
				{/* Header — full layout on lg+; below lg the desktop block is hidden, so we show a compact bar with Preview + tabs */}
				<div className="mb-4 md:mb-6 lg:mb-8">
					<div className="lg:hidden space-y-3 mb-4">
						<div className="flex items-start justify-between gap-3">
							<h1 className="text-xl font-bold text-foreground flex items-center gap-2 min-w-0">
								<FileText className="h-6 w-6 text-tone-info shrink-0" />
								<span className="truncate">Constitution Builder</span>
							</h1>
							<div className="flex shrink-0 items-center gap-2">
								{previewButton}
								{isMobile && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-11 w-11 shrink-0 p-0"
										onClick={() => setExportSheetOpen(true)}
										aria-label="More preview and export options"
									>
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								)}
							</div>
						</div>
						<div className="max-w-md">
							<ConstitutionSearch
								sections={sections}
								onSelectSection={() => {
									setCurrentView("editor");
								}}
							/>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
								{saveStatus === "saved" && (
									<>
										<Check className="h-3.5 w-3.5 text-tone-success" />
										<span className="text-tone-success">Saved</span>
									</>
								)}
								{saveStatus === "idle" && (
									<>
										<FileText className="h-3.5 w-3.5 text-muted-foreground" />
										<span>Ready</span>
									</>
								)}
								{saveStatus === "saving" && (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										<span>Saving…</span>
									</>
								)}
								{saveStatus === "error" && (
									<>
										<AlertCircle className="h-3.5 w-3.5 text-tone-danger" />
										<span className="text-tone-danger">Save failed</span>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 gap-1 px-2 text-xs text-tone-danger hover:text-tone-danger"
											onClick={handleRetrySave}
										>
											<RefreshCw className="h-3 w-3" />
											Retry
										</Button>
									</>
								)}
							</div>
							<div className="flex flex-1 min-w-0 bg-muted rounded-md p-1">
								<Button
									onClick={() => setCurrentView("editor")}
									className={`flex-1 px-2 py-2 rounded-md text-xs font-medium min-h-[44px] ${
										currentView === "editor"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									variant="ghost"
								>
									<Edit3 className="h-4 w-4 inline mr-1" />
									Editor
								</Button>
								<Button
									onClick={() => setCurrentView("versions")}
									className={`flex-1 px-2 py-2 rounded-md text-xs font-medium min-h-[44px] ${
										currentView === "versions"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									variant="ghost"
								>
									<RotateCcw className="h-4 w-4 inline mr-1" />
									Versions
								</Button>
								<Button
									onClick={() => setCurrentView("audit")}
									className={`flex-1 px-2 py-2 rounded-md text-xs font-medium min-h-[44px] ${
										currentView === "audit"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									variant="ghost"
								>
									<History className="h-4 w-4 inline mr-1" />
									Audit
								</Button>
							</div>
						</div>
					</div>

					<div className="hidden lg:flex items-center justify-between">
						<div className="flex-1 mr-8">
							<h1 className="text-2xl xl:text-3xl font-bold text-foreground flex items-center gap-3">
								<FileText className="h-7 w-7 xl:h-8 xl:w-8 text-tone-info" />
								Constitution Builder
							</h1>
							<p className="text-muted-foreground mt-2 mb-4">
								Collaboratively build and manage the organization's constitution
							</p>
							<div className="max-w-md">
								<ConstitutionSearch
									sections={sections}
									onSelectSection={() => {
										setCurrentView("editor");
									}}
								/>
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2 text-sm">
								{saveStatus === "saved" && (
									<>
										<Check className="h-4 w-4 text-tone-success" />
										<span className="text-tone-success">Changes saved</span>
									</>
								)}
								{saveStatus === "idle" && (
									<>
										<FileText className="h-4 w-4 text-muted-foreground" />
										<span className="text-muted-foreground">Ready to edit</span>
									</>
								)}
								{saveStatus === "saving" && (
									<>
										<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
										<span className="text-muted-foreground">Saving…</span>
									</>
								)}
								{saveStatus === "error" && (
									<>
										<AlertCircle className="h-4 w-4 text-tone-danger" />
										<span className="text-tone-danger">Save failed</span>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-8 gap-1.5 px-2 text-tone-danger hover:text-tone-danger"
											onClick={handleRetrySave}
										>
											<RefreshCw className="h-3.5 w-3.5" />
											Retry
										</Button>
									</>
								)}
							</div>

							{previewButton}

							<div className="flex bg-muted rounded-md p-1">
								<Button
									onClick={() => setCurrentView("editor")}
									className={`px-3 py-2 rounded-md text-sm font-medium min-h-[44px] ${
										currentView === "editor"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									variant="ghost"
								>
									<Edit3 className="h-4 w-4 inline mr-2" />
									Editor
								</Button>
								<Button
									onClick={() => setCurrentView("versions")}
									className={`px-3 py-2 rounded-md text-sm font-medium min-h-[44px] ${
										currentView === "versions"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									variant="ghost"
								>
									<RotateCcw className="h-4 w-4 inline mr-2" />
									Versions
								</Button>
								<Button
									onClick={() => setCurrentView("audit")}
									className={`px-3 py-2 rounded-md text-sm font-medium min-h-[44px] ${
										currentView === "audit"
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									variant="ghost"
								>
									<History className="h-4 w-4 inline mr-2" />
									Audit Log
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto">
				{currentView === "editor" ? (
					<ConstitutionDocumentEditor
						ref={editorRef}
						sections={sections}
						onSaveDocument={saveDocumentSections}
						onSaveVersion={saveVersion}
						onSaveStatusChange={setDocumentSaveStatus}
					/>
				) : currentView === "versions" ? (
					<div className="bg-background rounded-md shadow-sm border border-border p-4 md:p-6">
						<ConstitutionVersionHistory
							versions={versions}
							currentVersion={constitution?.version}
							onRestoreVersion={restoreVersion}
						/>
					</div>
				) : (
					<div className="bg-background rounded-md shadow-sm border border-border p-4 md:p-6">
						<ConstitutionAuditLog constitutionId={constitutionId || ""} />
					</div>
				)}
			</div>

			<ResponsiveOverlay
				open={previewOpen}
				onOpenChange={setPreviewOpen}
				title="Constitution Preview"
				description="Full-screen reader for the current constitution draft."
				variant="fullscreen"
				footer={
					isMobile ? (
						<Button
							variant="outline"
							className="h-11 w-full"
							onClick={() => setPreviewOpen(false)}
						>
							Done
						</Button>
					) : (
						<div className="flex w-full gap-2">
							<Button
								variant="outline"
								className="h-11 flex-1"
								onClick={() => setPreviewOpen(false)}
							>
								Done
							</Button>
							<Button className="h-11 flex-1" onClick={handlePrint}>
								Export PDF
							</Button>
						</div>
					)
				}
			>
				<div className="pb-4">
					<ConstitutionPreview
						constitution={constitution ?? null}
						sections={sections}
						onPrint={handlePrint}
					/>
				</div>
			</ResponsiveOverlay>

			<ResponsiveOverlay
				open={exportSheetOpen}
				onOpenChange={setExportSheetOpen}
				title="Preview & export"
				description="View or export the current constitution draft."
				variant="sheet"
			>
				<div className="space-y-2 pb-2">
					<Button
						variant="outline"
						className="h-12 w-full justify-start gap-3"
						onClick={() => {
							setExportSheetOpen(false);
							setPreviewOpen(true);
						}}
					>
						<Eye className="size-4" />
						Preview
					</Button>
					<Button
						variant="outline"
						className="h-12 w-full justify-start gap-3"
						onClick={() => {
							setExportSheetOpen(false);
							handlePrint();
						}}
					>
						<Printer className="size-4" />
						Export PDF
					</Button>
					<Button
						variant="outline"
						className="h-12 w-full justify-start gap-3"
						asChild
					>
						<Link
							to="/constitution-preview"
							target="_blank"
							rel="noopener noreferrer"
							onClick={() => setExportSheetOpen(false)}
						>
							<ExternalLink className="size-4" />
							Open live preview
						</Link>
					</Button>
				</div>
			</ResponsiveOverlay>
		</div>
	);
};

export default ConstitutionBuilderContent;
