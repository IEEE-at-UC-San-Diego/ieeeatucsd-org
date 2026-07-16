import DOMPurify from "dompurify";
import {
	AlertCircle,
	Archive,
	Download,
	File,
	FileAudio,
	FileText,
	FileVideo,
	Image,
	Mail,
	Paperclip,
	RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { useMobileShell } from "@/components/mobile/MobileShellContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { EmailMessage } from "./types";

interface EmailModalProps {
	email: EmailMessage | null;
	credentials: { email: string; password: string } | null;
	onClose: () => void;
}

const getFileTypeIcon = (contentType: string, filename: string) => {
	const type = contentType.toLowerCase();
	const ext = filename.toLowerCase().split(".").pop() || "";

	if (
		type.includes("image/") ||
		["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)
	) {
		return <Image className="w-4 h-4 text-tone-info" />;
	}
	if (
		type.includes("video/") ||
		["mp4", "avi", "mov", "wmv", "flv"].includes(ext)
	) {
		return <FileVideo className="w-4 h-4 text-tone-purple" />;
	}
	if (type.includes("audio/") || ["mp3", "wav", "flac", "aac"].includes(ext)) {
		return <FileAudio className="w-4 h-4 text-tone-success" />;
	}
	if (type.includes("application/pdf") || ext === "pdf") {
		return <FileText className="w-4 h-4 text-tone-danger" />;
	}
	if (
		type.includes("application/zip") ||
		type.includes("application/x-rar") ||
		["zip", "rar", "7z", "tar"].includes(ext)
	) {
		return <Archive className="w-4 h-4 text-tone-warning" />;
	}
	if (
		type.includes("application/msword") ||
		type.includes("application/vnd.openxmlformats-officedocument") ||
		["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)
	) {
		return <FileText className="w-4 h-4 text-tone-info" />;
	}
	return <File className="w-4 h-4 text-muted-foreground" />;
};

const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / k ** i).toFixed(1)) + " " + sizes[i];
};

export function EmailModal({ email, credentials, onClose }: EmailModalProps) {
	const { getAuthHeaders } = useAuth();
	const { setHideTabBar } = useMobileShell();
	const [emailContent, setEmailContent] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"html" | "text">("html");

	useEffect(() => {
		setHideTabBar(!!email);
		return () => setHideTabBar(false);
	}, [email, setHideTabBar]);

	useEffect(() => {
		const fetchEmailContent = async () => {
			if (!email || !credentials) {
				setError("Authentication required to view email content");
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const response = await fetch("/api/ieee-email/fetch-content", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...getAuthHeaders(),
					},
					body: JSON.stringify({
						email: credentials.email,
						password: credentials.password,
						uid: email.uid,
					}),
				});

				const result = await response.json();

				if (result.success) {
					setEmailContent(result.emailContent);
					if (result.emailContent.htmlContent) {
						setViewMode("html");
					} else if (result.emailContent.textContent) {
						setViewMode("text");
					}
				} else {
					setError(
						result.message || "Unable to load email content. Please try again.",
					);
				}
			} catch (err) {
				console.error("Error fetching email content:", err);
				setError(
					"Network error occurred while loading email. Please check your connection and try again.",
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchEmailContent();
	}, [email?.uid, credentials]);

	if (!email) return null;

	const title =
		email.subject.length > 60
			? `${email.subject.substring(0, 60)}…`
			: email.subject;

	return (
		<ResponsiveOverlay
			open={!!email}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={title}
			description="Full email content viewer"
			variant="fullscreen"
			className="sm:max-w-3xl"
			footer={
				<Button className="h-11 w-full" onClick={onClose}>
					Done
				</Button>
			}
		>
			<style>{`
          .email-preview-paper {
            color-scheme: light;
            --border: #e5e7eb;
            --muted: #f9fafb;
            --foreground: #171717;
            background-color: #ffffff;
            color: var(--foreground);
          }
          .email-content {
            max-width: 100%;
            overflow-x: hidden;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .email-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
          }
          .email-content table {
            border-collapse: collapse;
            width: 100%;
            max-width: 100%;
            margin: 16px 0;
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .email-content pre, .email-content code {
            max-width: 100%;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }
          .email-content td, .email-content th {
            padding: 12px;
            border: 1px solid var(--border);
            text-align: left;
          }
          .email-content th {
            background-color: var(--muted);
            font-weight: 600;
          }
          .email-content a {
            color: var(--ds-blue-700);
            text-decoration: underline;
            word-break: break-word;
          }
          .email-content blockquote {
            border-left: 4px solid var(--ds-blue-700);
            padding-left: 16px;
            margin: 16px 0;
            background-color: var(--muted);
            padding: 16px;
            border-radius: 0 8px 8px 0;
            font-style: italic;
          }
          .email-content ul, .email-content ol {
            padding-left: 24px;
            margin: 12px 0;
          }
          .email-content li {
            margin: 4px 0;
          }
          .email-content p {
            margin: 12px 0;
            line-height: 1.6;
            overflow-wrap: anywhere;
          }
        `}</style>

			<div className="min-w-0 pb-4">
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-16 px-6 h-full">
						<RefreshCw className="w-8 h-8 text-tone-link animate-spin mb-4" />
						<div className="text-center">
							<h3 className="text-lg font-medium text-foreground mb-2">
								Loading Email Content
							</h3>
							<p className="text-muted-foreground">
								Please wait while we fetch your email...
							</p>
						</div>
					</div>
				) : error ? (
					<div className="p-8 h-full flex items-center justify-center">
						<div className="max-w-md mx-auto text-center">
							<div className="w-16 h-16 bg-ds-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
								<AlertCircle className="w-8 h-8 text-tone-danger" />
							</div>
							<h3 className="text-lg font-semibold text-foreground mb-2">
								Unable to Load Email
							</h3>
							<p className="text-muted-foreground mb-6">{error}</p>
							<Button onClick={() => window.location.reload()}>
								<RefreshCw className="w-4 h-4 mr-2" />
								Try Again
							</Button>
						</div>
					</div>
				) : emailContent ? (
					<div className="p-6">
						{/* Email Headers */}
						<div className="mb-6 bg-muted/40 rounded-md p-4 border border-border">
							<div className="flex flex-col space-y-3">
								<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
									<div className="flex-1 min-w-0">
										<h3 className="text-lg font-semibold text-foreground leading-tight mb-1">
											{emailContent.subject}
										</h3>
										<div className="flex items-center space-x-2 text-sm text-muted-foreground">
											<span className="font-medium">From:</span>
											<span className="text-foreground">
												{emailContent.from}
											</span>
										</div>
									</div>
									<div className="shrink-0">
										<div className="text-sm text-muted-foreground bg-background px-3 py-1 rounded-full border border-border">
											{new Date(emailContent.date).toLocaleDateString("en-US", {
												weekday: "short",
												year: "numeric",
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</div>
									</div>
								</div>
								<div className="flex items-center space-x-2 text-sm text-muted-foreground">
									<span className="font-medium">To:</span>
									<span className="text-foreground">{emailContent.to}</span>
								</div>
							</div>
						</div>

						{/* Attachments */}
						{emailContent.attachments &&
							emailContent.attachments.length > 0 && (
								<div className="mb-6">
									<div className="flex items-center space-x-2 mb-4">
										<div className="p-1.5 bg-ds-blue-100 rounded-md">
											<Paperclip className="w-4 h-4 text-tone-info" />
										</div>
										<h4 className="text-sm font-semibold text-foreground">
											{emailContent.attachments.length} Attachment
											{emailContent.attachments.length > 1 ? "s" : ""}
										</h4>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{emailContent.attachments.map(
											(attachment: any, index: number) => (
												<div
													key={index}
													className="group flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border hover:border-ieee-blue hover:shadow-md transition-[border-color,box-shadow] duration-150 ease-[ease]"
												>
													<div className="flex items-center space-x-3 flex-1 min-w-0">
														<div className="shrink-0">
															{getFileTypeIcon(
																attachment.contentType,
																attachment.filename,
															)}
														</div>
														<div className="min-w-0 flex-1">
															<p className="text-sm font-medium text-foreground truncate group-hover:text-tone-link transition-colors">
																{attachment.filename.length > 25
																	? `${attachment.filename.substring(0, 22)}...${attachment.filename.split(".").pop()}`
																	: attachment.filename}
															</p>
															<div className="flex items-center space-x-2 text-xs text-muted-foreground">
																<span className="px-2 py-0.5 bg-background rounded-full border border-border text-xs">
																	{attachment.contentType
																		.split("/")[1]
																		?.toUpperCase() || "FILE"}
																</span>
																<span>•</span>
																<span className="font-medium">
																	{formatFileSize(attachment.size)}
																</span>
															</div>
														</div>
													</div>
													<Button variant="ghost" size="sm" disabled>
														<Download className="w-4 h-4 text-muted-foreground group-hover:text-tone-link" />
													</Button>
												</div>
											),
										)}
									</div>
								</div>
							)}

						{/* Email Content */}
						<div className="border-t border-border pt-6">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center space-x-2">
									<div className="p-1.5 bg-ds-green-100 rounded-lg">
										<Mail className="w-4 h-4 text-tone-success" />
									</div>
									<h4 className="text-sm font-semibold text-foreground">
										Message Content
									</h4>
								</div>
								{emailContent &&
									(emailContent.htmlContent || emailContent.textContent) &&
									emailContent.htmlContent &&
									emailContent.textContent && (
										<div className="flex bg-muted rounded-lg p-1">
											<Button
												size="sm"
												variant={viewMode === "html" ? "default" : "ghost"}
												onClick={() => setViewMode("html")}
												className="h-7 text-xs"
											>
												Rich View
											</Button>
											<Button
												size="sm"
												variant={viewMode === "text" ? "default" : "ghost"}
												onClick={() => setViewMode("text")}
												className="h-7 text-xs"
											>
												Plain Text
											</Button>
										</div>
									)}
							</div>

							{/* Content Display */}
							{viewMode === "html" && emailContent.htmlContent ? (
								<div className="email-preview-paper border border-border rounded-md overflow-hidden shadow-sm">
									<div
										className="prose prose-sm max-w-none p-6 email-content"
										dangerouslySetInnerHTML={{
											__html: DOMPurify.sanitize(emailContent.htmlContent, {
												ALLOWED_TAGS: [
													"p",
													"br",
													"strong",
													"b",
													"em",
													"i",
													"u",
													"s",
													"strike",
													"del",
													"a",
													"ul",
													"ol",
													"li",
													"h1",
													"h2",
													"h3",
													"h4",
													"h5",
													"h6",
													"blockquote",
													"div",
													"span",
													"table",
													"tr",
													"td",
													"th",
													"thead",
													"tbody",
													"tfoot",
													"img",
													"figure",
													"figcaption",
													"pre",
													"code",
													"hr",
													"sub",
													"sup",
													"small",
													"mark",
													"ins",
													"abbr",
													"cite",
													"q",
													"dfn",
													"time",
												],
												ALLOWED_ATTR: [
													"href",
													"target",
													"rel",
													"style",
													"class",
													"id",
													"src",
													"alt",
													"width",
													"height",
													"title",
													"colspan",
													"rowspan",
													"align",
													"valign",
													"datetime",
													"cite",
												],
												ALLOW_DATA_ATTR: false,
												ADD_ATTR: ["target", "rel"],
												FORBID_ATTR: ["onerror", "onload", "onclick"],
												FORBID_TAGS: [
													"script",
													"object",
													"embed",
													"form",
													"input",
													"button",
												],
											}).replace(
												/<a\s+(?:[^>]*?\s+)?href="([^"]*)"(?![^>]*rel=)/gi,
												'<a href="$1" target="_blank" rel="noopener noreferrer"',
											),
										}}
									/>
								</div>
							) : (
								<div className="bg-muted/40 p-6 rounded-md border border-border">
									<pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
										{emailContent.textContent || emailContent.htmlContent}
									</pre>
								</div>
							)}
						</div>
					</div>
				) : null}
			</div>
		</ResponsiveOverlay>
	);
}
