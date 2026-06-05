import { useState, useEffect } from "react";
import { Mail, AlertCircle, RefreshCw, Paperclip, Download, Image, FileVideo, FileAudio, FileText, Archive, File } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";
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

  if (type.includes("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return <Image className="w-4 h-4 text-blue-500" />;
  }
  if (type.includes("video/") || ["mp4", "avi", "mov", "wmv", "flv"].includes(ext)) {
    return <FileVideo className="w-4 h-4 text-purple-500" />;
  }
  if (type.includes("audio/") || ["mp3", "wav", "flac", "aac"].includes(ext)) {
    return <FileAudio className="w-4 h-4 text-green-500" />;
  }
  if (type.includes("application/pdf") || ext === "pdf") {
    return <FileText className="w-4 h-4 text-red-500" />;
  }
  if (
    type.includes("application/zip") ||
    type.includes("application/x-rar") ||
    ["zip", "rar", "7z", "tar"].includes(ext)
  ) {
    return <Archive className="w-4 h-4 text-orange-500" />;
  }
  if (
    type.includes("application/msword") ||
    type.includes("application/vnd.openxmlformats-officedocument") ||
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)
  ) {
    return <FileText className="w-4 h-4 text-blue-600" />;
  }
  return <File className="w-4 h-4 text-gray-500" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export function EmailModal({ email, credentials, onClose }: EmailModalProps) {
  const { getAuthHeaders } = useAuth();
  const [emailContent, setEmailContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");

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
          setError(result.message || "Unable to load email content. Please try again.");
        }
      } catch (err) {
        console.error("Error fetching email content:", err);
        setError("Network error occurred while loading email. Please check your connection and try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmailContent();
  }, [email?.uid, credentials]);

  if (!email) return null;

  return (
    <Dialog open={!!email} onOpenChange={onClose}>
      <DialogContent aria-describedby="email-modal-desc" className="max-w-[90vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogDescription id="email-modal-desc" className="sr-only">
          Full email content viewer
        </DialogDescription>
        <style>{`
          .email-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
          }
          .email-content img:hover {
            transform: scale(1.02);
            cursor: pointer;
          }
          .email-content table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .email-content td, .email-content th {
            padding: 12px;
            border: 1px solid #e5e7eb;
            text-align: left;
          }
          .email-content th {
            background-color: #f9fafb;
            font-weight: 600;
          }
          .email-content a {
            color: #2563eb;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: all 0.2s ease;
          }
          .email-content a:hover {
            color: #1d4ed8;
            border-bottom-color: #1d4ed8;
          }
          .email-content blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 16px;
            margin: 16px 0;
            background-color: #f8fafc;
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
          }
        `}</style>

        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold text-gray-900 truncate">
                {email.subject.length > 50 ? `${email.subject.substring(0, 50)}...` : email.subject}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 h-full">
              <RefreshCw className="w-8 h-8 text-ieee-blue animate-spin mb-4" />
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Loading Email Content
                </h3>
                <p className="text-gray-600">Please wait while we fetch your email...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 h-full flex items-center justify-center">
              <div className="max-w-md mx-auto text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Unable to Load Email
                </h3>
                <p className="text-gray-600 mb-6">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          ) : emailContent ? (
            <div className="p-6">
              {/* Email Headers */}
              <div className="mb-6 bg-muted/40 rounded-xl p-4 border border-border">
                <div className="flex flex-col space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 leading-tight mb-1">
                        {emailContent.subject}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span className="font-medium">From:</span>
                        <span className="text-gray-800">{emailContent.from}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-border">
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
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span className="font-medium">To:</span>
                    <span className="text-gray-800">{emailContent.to}</span>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              {emailContent.attachments && emailContent.attachments.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="p-1.5 bg-blue-100 rounded-xl">
                      <Paperclip className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      {emailContent.attachments.length} Attachment{emailContent.attachments.length > 1 ? "s" : ""}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {emailContent.attachments.map((attachment: any, index: number) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border hover:border-ieee-blue hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="shrink-0">{getFileTypeIcon(attachment.contentType, attachment.filename)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-ieee-blue transition-colors">
                              {attachment.filename.length > 25
                                ? `${attachment.filename.substring(0, 22)}...${attachment.filename.split(".").pop()}`
                                : attachment.filename}
                            </p>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span className="px-2 py-0.5 bg-white rounded-full border border-border text-xs">
                                {attachment.contentType.split("/")[1]?.toUpperCase() || "FILE"}
                              </span>
                              <span>•</span>
                              <span className="font-medium">{formatFileSize(attachment.size)}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" disabled>
                          <Download className="w-4 h-4 text-gray-400 group-hover:text-ieee-blue" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Content */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <Mail className="w-4 h-4 text-green-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Message Content</h4>
                  </div>
                  {emailContent && (emailContent.htmlContent || emailContent.textContent) && emailContent.htmlContent && emailContent.textContent && (
                    <div className="flex bg-gray-100 rounded-lg p-1">
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
                  <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
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
                          FORBID_TAGS: ["script", "object", "embed", "form", "input", "button"],
                        }).replace(
                          /<a\s+(?:[^>]*?\s+)?href="([^"]*)"(?![^>]*rel=)/gi,
                          '<a href="$1" target="_blank" rel="noopener noreferrer"'
                        ),
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-muted/40 p-6 rounded-xl border border-border">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">
                      {emailContent.textContent || emailContent.htmlContent}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
