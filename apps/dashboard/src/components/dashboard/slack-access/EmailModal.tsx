import DOMPurify from "dompurify";
import {
	Archive,
	File,
	FileAudio,
	FileText,
	FileVideo,
	Image,
	RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { useMobileShell } from "@/components/mobile/MobileShellContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/** Splits "Name <address>" into its parts; falls back to the raw string. */
export function parseSender(from: string): { name: string; address: string } {
	const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
	if (match) {
		const name = match[1].trim();
		return { name: name || match[2], address: name ? match[2] : "" };
	}
	return { name: from, address: "" };
}

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

	return (
		<ResponsiveOverlay
			open={!!email}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title="Message"
			variant="fullscreen"
			className="sm:max-w-5xl"
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
            border-radius: 4px;
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
            border-left: 2px solid var(--border);
            padding-left: 16px;
            margin: 16px 0;
            color: #525252;
          }
          .email-content ul, .email-content ol {
            padding-left: 24px;
            margin: 12px 0;
          }
          .email-content ul { list-style: disc; }
          .email-content ol { list-style: decimal; }
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
					<div className="flex flex-col items-center justify-center px-6 py-20 text-center">
						<RefreshCw className="mb-3 h-5 w-5 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground">Loading message…</p>
					</div>
				) : error ? (
					<div className="mx-auto max-w-sm px-6 py-16 text-center">
						<h3 className="text-base font-semibold text-foreground">
							Couldn't load this message
						</h3>
						<p className="mt-1 text-sm text-muted-foreground">{error}</p>
						<Button
							variant="outline"
							className="mt-5"
							onClick={() => window.location.reload()}
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							Try again
						</Button>
					</div>
				) : emailContent ? (
					<div className="space-y-6 py-2">
						{/* Header */}
						<header className="space-y-4">
							<h3 className="text-xl font-semibold leading-snug tracking-[-0.02em] text-foreground">
								{emailContent.subject}
							</h3>
							<dl className="divide-y rounded-md border text-sm">
								<div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
									<dt className="w-12 shrink-0 text-muted-foreground">From</dt>
									<dd className="min-w-0 flex-1 truncate">
										<span className="font-medium text-foreground">
											{parseSender(emailContent.from).name}
										</span>
										{parseSender(emailContent.from).address && (
											<span className="ml-2 text-muted-foreground">
												{parseSender(emailContent.from).address}
											</span>
										)}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
									<dt className="w-12 shrink-0 text-muted-foreground">To</dt>
									<dd className="min-w-0 flex-1 truncate text-foreground">
										{emailContent.to}
									</dd>
								</div>
								<div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
									<dt className="w-12 shrink-0 text-muted-foreground">Date</dt>
									<dd className="min-w-0 flex-1 tabular-nums text-foreground">
										{new Date(emailContent.date).toLocaleDateString("en-US", {
											weekday: "short",
											year: "numeric",
											month: "short",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</dd>
								</div>
							</dl>
						</header>

						{/* Attachments */}
						{emailContent.attachments &&
							emailContent.attachments.length > 0 && (
								<section>
									<h4 className="mb-2 text-sm font-semibold text-foreground">
										Attachments
										<span className="ml-1.5 font-normal text-muted-foreground">
											{emailContent.attachments.length}
										</span>
									</h4>
									<ul className="divide-y rounded-md border">
										{emailContent.attachments.map(
											(attachment: any, index: number) => (
												<li
													key={index}
													className="flex items-center gap-3 px-4 py-2.5"
												>
													<span className="shrink-0">
														{getFileTypeIcon(
															attachment.contentType,
															attachment.filename,
														)}
													</span>
													<span
														className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
														title={attachment.filename}
													>
														{attachment.filename}
													</span>
													<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
														{(
															attachment.contentType.split("/")[1] || "file"
														).toUpperCase()}{" "}
														· {formatFileSize(attachment.size)}
													</span>
												</li>
											),
										)}
									</ul>
								</section>
							)}

						{/* Message */}
						<section>
							{emailContent.htmlContent && emailContent.textContent && (
								<div className="mb-3 flex items-center justify-between">
									<h4 className="text-sm font-semibold text-foreground">
										Message
									</h4>
									<Tabs
										value={viewMode}
										onValueChange={(value) =>
											setViewMode(value as "html" | "text")
										}
									>
										<TabsList>
											<TabsTrigger value="html" className="px-3 text-xs">
												Formatted
											</TabsTrigger>
											<TabsTrigger value="text" className="px-3 text-xs">
												Plain text
											</TabsTrigger>
										</TabsList>
									</Tabs>
								</div>
							)}

							{/* Content Display */}
							{viewMode === "html" && emailContent.htmlContent ? (
								<div className="email-preview-paper border border-border rounded-md overflow-hidden">
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
								<div className="rounded-md border p-5">
									<pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
										{emailContent.textContent || emailContent.htmlContent}
									</pre>
								</div>
							)}
						</section>
					</div>
				) : null}
			</div>
		</ResponsiveOverlay>
	);
}
