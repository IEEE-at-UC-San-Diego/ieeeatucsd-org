import { createFileRoute } from "@tanstack/react-router";
import { ImapFlow } from "imapflow";
import { requireApiAuth } from "@/server/auth";

// Helper function to decode quoted-printable content
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "") // Remove soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/=3D/g, "="); // Common quoted-printable encoding
}

interface EmailContent {
  subject: string;
  from: string;
  to: string;
  date: string;
  htmlContent: string;
  textContent: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

async function handle({ request }: { request: Request }) {
  try {
    const authResult = await requireApiAuth(request);
    if (authResult instanceof Response) return authResult;
    const { body, user } = authResult;
    const { email, password, uid } = body as {
      email?: string;
      password?: string;
      uid?: number;
    };

    if (!email || !password || !uid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing email, password, or uid",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const privilegedRoles = new Set(["Administrator", "Executive Officer", "General Officer"]);
    const isPrivileged = privilegedRoles.has(String(user.role || ""));
    if (!isPrivileged && user.ieeeEmail !== email) {
      return new Response(
        JSON.stringify({ success: false, message: "Forbidden: mailbox ownership mismatch" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // Create IMAP client with MXRoute settings
    const client = new ImapFlow({
      host: "heracles.mxrouting.net",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
      clientInfo: { name: "IEEE UCSD Dashboard", version: "2.0.0" },
      socketTimeout: 30000,
      greetingTimeout: 30000,
      connectionTimeout: 30000,
      disableAutoIdle: true,
    });

    let emailContent: EmailContent | null = null;

    try {
      await client.connect();

      const lock = await client.getMailboxLock("INBOX");

      try {
        // First fetch the message structure to understand the parts
        const messageStructure = await client.fetchOne(uid, {
          envelope: true,
          flags: true,
          bodyStructure: true,
        });

        if (!messageStructure) {
          throw new Error("Message not found");
        }

        // Analyze body structure to determine which parts to fetch
        const partsToFetch: string[] = ["HEADER"];
        let textPartId = "";
        let htmlPartId = "";

        const analyzeStructure = (node: any, partId = "") => {
          const nodeType = node.type || "";
          const isTextPlain =
            nodeType === "text/plain" ||
            (nodeType === "text" && node.subtype === "plain");
          const isTextHtml =
            nodeType === "text/html" ||
            (nodeType === "text" && node.subtype === "html");

          if (isTextPlain && !textPartId) {
            textPartId = partId || "1";
          } else if (isTextHtml && !htmlPartId) {
            htmlPartId = partId || "1";
          }

          if (node.childNodes && Array.isArray(node.childNodes)) {
            node.childNodes.forEach((child: any, index: number) => {
              const childPartId = partId
                ? `${partId}.${index + 1}`
                : `${index + 1}`;
              analyzeStructure(child, childPartId);
            });
          }
        };

        // For multipart messages, analyze child nodes with proper part numbering
        if (
          messageStructure.bodyStructure &&
          (messageStructure.bodyStructure as any).childNodes
        ) {
          (messageStructure.bodyStructure as any).childNodes.forEach(
            (child: any, index: number) => {
              analyzeStructure(child, `${index + 1}`);
            },
          );
        } else if (messageStructure.bodyStructure) {
          analyzeStructure(messageStructure.bodyStructure);
        }

        // Add the identified parts to fetch
        if (textPartId) partsToFetch.push(textPartId);
        if (htmlPartId) partsToFetch.push(htmlPartId);

        // Also try common fallbacks
        partsToFetch.push("TEXT", "1", "2", "1.1", "1.2");

        // Now fetch the message with the identified parts
        const message = await client.fetchOne(uid, {
          envelope: true,
          flags: true,
          bodyStructure: true,
          bodyParts: partsToFetch,
        });

        if (message) {
          // Parse sender information
          let fromAddress = "Unknown sender";
          if (message.envelope?.from && message.envelope.from.length > 0) {
            const sender = message.envelope.from[0];
            fromAddress = sender.name
              ? `${sender.name} <${sender.address}>`
              : sender.address || "Unknown sender";
          }

          // Parse recipient information
          let toAddress = "Unknown recipient";
          if (message.envelope?.to && message.envelope.to.length > 0) {
            const recipient = message.envelope.to[0];
            toAddress = recipient.name
              ? `${recipient.name} <${recipient.address}>`
              : recipient.address || "Unknown recipient";
          }

          // Format date
          let formattedDate = "Unknown date";
          if (message.envelope?.date) {
            try {
              formattedDate = new Date(message.envelope.date).toLocaleString();
            } catch {}
          }

          // Extract email content from body parts
          let htmlContent = "";
          let textContent = "";

          const bodyParts = message.bodyParts;
          if (bodyParts) {
            // Extract HTML content using identified HTML part
            if (htmlPartId && bodyParts.has(htmlPartId)) {
              try {
                const htmlPart = bodyParts.get(htmlPartId);
                if (htmlPart) {
                  const rawHtml = htmlPart.toString("utf-8");
                  htmlContent =
                    rawHtml.includes("=3D") || rawHtml.includes("=\n")
                      ? decodeQuotedPrintable(rawHtml)
                      : rawHtml;
                }
              } catch {}
            }

            // Extract text content using identified text part
            if (textPartId && bodyParts.has(textPartId)) {
              try {
                const textPart = bodyParts.get(textPartId);
                if (textPart) {
                  const rawText = textPart.toString("utf-8");
                  textContent = (
                    rawText.includes("=3D") || rawText.includes("=\n")
                      ? decodeQuotedPrintable(rawText)
                      : rawText
                  )
                    .replace(/\r\n/g, "\n")
                    .replace(/\r/g, "\n")
                    .trim();
                }
              } catch {}
            }

            // Fallback logic if we didn't get content from identified parts
            if (!htmlContent && !textContent) {
              const fallbackParts = ["TEXT", "1", "2", "1.1", "1.2"];
              for (const partId of fallbackParts) {
                if (bodyParts.has(partId)) {
                  try {
                    const part = bodyParts.get(partId);
                    if (part) {
                      let content = part.toString("utf-8");
                      if (
                        content.includes("=3D") ||
                        content.includes("=\n")
                      ) {
                        content = decodeQuotedPrintable(content);
                      }

                      if (
                        content.includes("<html") ||
                        content.includes("<!DOCTYPE") ||
                        content.includes("<body") ||
                        content.includes("<div")
                      ) {
                        if (!htmlContent) htmlContent = content;
                      } else {
                        if (!textContent) {
                          textContent = content
                            .replace(/\r\n/g, "\n")
                            .replace(/\r/g, "\n")
                            .trim();
                        }
                      }
                    }
                  } catch {}
                }
              }
            }
          }

          // Parse attachments from body structure
          const attachments: Array<{
            filename: string;
            contentType: string;
            size: number;
          }> = [];
          if (
            message.bodyStructure &&
            (message.bodyStructure as any).childNodes
          ) {
            const parseAttachments = (node: any) => {
              if (
                node.disposition === "attachment" &&
                node.dispositionParameters?.filename
              ) {
                attachments.push({
                  filename: node.dispositionParameters.filename,
                  contentType: node.type + "/" + node.subtype,
                  size: node.size || 0,
                });
              }
              if (node.childNodes) {
                node.childNodes.forEach(parseAttachments);
              }
            };
            parseAttachments(message.bodyStructure);
          }

          emailContent = {
            subject: message.envelope?.subject || "No subject",
            from: fromAddress,
            to: toAddress,
            date: formattedDate,
            htmlContent,
            textContent,
            attachments,
          };
        }
      } finally {
        lock.release();
      }
    } finally {
      try {
        await client.logout();
      } catch {}
    }

    if (!emailContent) {
      return new Response(
        JSON.stringify({ success: false, message: "Email not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailContent,
        message: "Successfully fetched email content",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error fetching email content:", error);

    let errorMessage = "Failed to fetch email content";
    let statusCode = 500;

    if (error instanceof Error) {
      const err = error as any;
      if (
        err.responseText?.includes("Authentication failed") ||
        err.serverResponseCode === "AUTHENTICATIONFAILED" ||
        err.authenticationFailed === true ||
        error.message.includes("authentication") ||
        error.message.includes("LOGIN failed")
      ) {
        errorMessage = "Authentication failed. Please check your credentials.";
        statusCode = 401;
      } else if (
        error.message.includes("connection") ||
        error.message.includes("ECONNREFUSED")
      ) {
        errorMessage =
          "Could not connect to email server. Please try again later.";
        statusCode = 502;
      } else if (
        error.message.includes("timeout") ||
        error.message.includes("ETIMEDOUT")
      ) {
        errorMessage = "Connection timed out. Please try again.";
        statusCode = 504;
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: statusCode, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/ieee-email/fetch-content")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
