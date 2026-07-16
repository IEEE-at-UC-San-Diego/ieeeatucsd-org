import { Eye, File, Lock, Trash2, Unlock, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EventFile } from "../types";

interface FileManagerModalProps {
	isOpen: boolean;
	onClose: () => void;
	eventId?: string;
	files: EventFile[];
	onUpload: (files: FileList) => void;
	onDelete: (fileId: string) => void;
	onToggleVisibility?: (fileId: string, isPublic: boolean) => void;
}

export function FileManagerModal({
	isOpen,
	onClose,
	eventId: _eventId,
	files,
	onUpload,
	onDelete,
	onToggleVisibility,
}: FileManagerModalProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		if (e.dataTransfer.files.length > 0) {
			setSelectedFiles(e.dataTransfer.files);
		}
	}, []);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			setSelectedFiles(e.target.files);
		}
	};

	const handleUpload = () => {
		if (selectedFiles) {
			onUpload(selectedFiles);
			setSelectedFiles(null);
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={onClose}
			title="File Manager"
			variant="large-sheet"
			className="sm:max-w-2xl"
			footer={
				<Button
					variant="outline"
					className="h-11 w-full sm:h-9 sm:w-auto"
					onClick={onClose}
				>
					Close
				</Button>
			}
		>
			<div className="space-y-4">
				<div
					className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
						isDragging
							? "border-ds-blue-700 bg-ds-blue-100"
							: "border-border hover:border-ds-gray-500"
					}`}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					<Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
					<p className="text-sm text-muted-foreground mb-2">
						Drag and drop files here, or{" "}
						<label className="text-tone-info hover:text-tone-info cursor-pointer font-medium">
							browse
							<Input
								type="file"
								multiple
								className="hidden"
								onChange={handleFileSelect}
							/>
						</label>
					</p>
					<p className="text-xs text-muted-foreground">
						Supports images, documents, and PDFs up to 50MB
					</p>
				</div>

				{selectedFiles && selectedFiles.length > 0 && (
					<div className="bg-ds-blue-100 rounded-lg p-4">
						<div className="flex items-center justify-between">
							<span className="text-sm text-ds-blue-1000">
								{selectedFiles.length} file
								{selectedFiles.length !== 1 ? "s" : ""} selected
							</span>
							<div className="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setSelectedFiles(null)}
								>
									<X className="h-4 w-4 mr-1" />
									Clear
								</Button>
								<Button size="sm" onClick={handleUpload}>
									<Upload className="h-4 w-4 mr-1" />
									Upload
								</Button>
							</div>
						</div>
						<div className="mt-2 space-y-1">
							{Array.from(selectedFiles).map((file, idx) => (
								<div
									key={idx}
									className="text-xs text-tone-info flex items-center gap-2"
								>
									<File className="h-3 w-3" />
									{file.name} ({formatFileSize(file.size)})
								</div>
							))}
						</div>
					</div>
				)}

				<div className="border rounded-lg overflow-hidden">
					<div className="bg-muted px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase">
						{files.length} file{files.length !== 1 ? "s" : ""}
					</div>

					{files.length === 0 ? (
						<div className="p-8 text-center text-muted-foreground">
							<File className="h-12 w-12 mx-auto mb-2 opacity-50" />
							<p>No files uploaded yet</p>
							<p className="text-xs text-muted-foreground mt-1">
								Upload files to share with event attendees
							</p>
						</div>
					) : (
						<div className="divide-y">
							{files.map((file) => (
								<div
									key={file._id}
									className="flex items-center justify-between p-4 hover:bg-muted"
								>
									<div className="flex items-center gap-3 min-w-0">
										<File className="h-8 w-8 text-muted-foreground flex-shrink-0" />
										<div className="min-w-0">
											<p className="text-sm font-medium text-foreground truncate">
												{file.name}
											</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<span>Uploaded {formatDate(file.uploadedAt)}</span>
												<span>•</span>
												<span className="flex items-center gap-1">
													{file.isPublic ? (
														<>
															<Unlock className="h-3 w-3" />
															Public
														</>
													) : (
														<>
															<Lock className="h-3 w-3" />
															Private
														</>
													)}
												</span>
											</div>
										</div>
									</div>

									<div className="flex items-center gap-1 flex-shrink-0">
										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0"
											onClick={() => window.open(file.url, "_blank")}
										>
											<Eye className="h-4 w-4" />
										</Button>
										{onToggleVisibility && (
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={() =>
													onToggleVisibility(file._id, !file.isPublic)
												}
												title={file.isPublic ? "Make private" : "Make public"}
											>
												{file.isPublic ? (
													<Unlock className="h-4 w-4" />
												) : (
													<Lock className="h-4 w-4" />
												)}
											</Button>
										)}
										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0 text-muted-foreground hover:text-tone-danger"
											onClick={() => onDelete(file._id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</ResponsiveOverlay>
	);
}
