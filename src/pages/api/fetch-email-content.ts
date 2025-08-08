import type { APIRoute } from "astro";
import { ImapFlow } from "imapflow";

// Helper function to decode quoted-printable content
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "") // Remove soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (match, hex) =>
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

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Email content fetch request received");

    const requestBody = await request.json();
    const { email, password, uid } = requestBody;

    if (!email || !password || !uid) {
      console.log("Missing email, password, or uid");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing email, password, or uid",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log(`Fetching full content for email UID: ${uid}`);

    // Create IMAP client with MXRoute settings
    const client = new ImapFlow({
      host: "mail.ieeeucsd.org",
      port: 993,
      secure: true,
      auth: {
        user: email,
        pass: password,
      },
      logger: false,
      clientInfo: {
        name: "IEEE UCSD Dashboard",
        version: "1.0.0",
      },
      socketTimeout: 30000,
      greetingTimeout: 30000,
      connectionTimeout: 30000,
      disableAutoIdle: true,
    });

    let emailContent: EmailContent | null = null;

    try {
      // Connect to the IMAP server
      await client.connect();
      console.log("Successfully connected to IMAP server");

      // Select and lock the INBOX
      let lock = await client.getMailboxLock("INBOX");

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
          console.log(`Analyzing node: type=${node.type}, partId=${partId}`);

          // Handle both formats: "text/plain" and separate type/subtype
          const nodeType = node.type || "";
          const isTextPlain =
            nodeType === "text/plain" ||
            (nodeType === "text" && node.subtype === "plain");
          const isTextHtml =
            nodeType === "text/html" ||
            (nodeType === "text" && node.subtype === "html");

          if (isTextPlain && !textPartId) {
            textPartId = partId || "1";
            console.log(`Found text/plain part: ${textPartId}`);
          } else if (isTextHtml && !htmlPartId) {
            htmlPartId = partId || "1";
            console.log(`Found text/html part: ${htmlPartId}`);
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

        console.log(
          "Message body structure:",
          JSON.stringify(messageStructure.bodyStructure, null, 2),
        );

        // For multipart messages, analyze child nodes with proper part numbering
        if (
          messageStructure.bodyStructure &&
          messageStructure.bodyStructure.childNodes
        ) {
          messageStructure.bodyStructure.childNodes.forEach(
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

        // Also try common fallbacks including part 2 for HTML
        partsToFetch.push("TEXT", "1", "2", "1.1", "1.2");

        console.log(
          `Fetching parts: ${partsToFetch.join(", ")} for UID ${uid}`,
        );
        console.log(
          `Identified - Text part: ${textPartId}, HTML part: ${htmlPartId}`,
        );

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
            if (sender.name) {
              fromAddress = `${sender.name} <${sender.address}>`;
            } else {
              fromAddress = sender.address || "Unknown sender";
            }
          }

          // Parse recipient information
          let toAddress = "Unknown recipient";
          if (message.envelope?.to && message.envelope.to.length > 0) {
            const recipient = message.envelope.to[0];
            if (recipient.name) {
              toAddress = `${recipient.name} <${recipient.address}>`;
            } else {
              toAddress = recipient.address || "Unknown recipient";
            }
          }

          // Format date
          let formattedDate = "Unknown date";
          if (message.envelope?.date) {
            try {
              formattedDate = new Date(message.envelope.date).toLocaleString();
            } catch (e) {
              console.warn("Error parsing date:", message.envelope.date);
            }
          }

          // Extract email content from body parts using identified part IDs
          let htmlContent = "";
          let textContent = "";

          const bodyParts = message.bodyParts;
          if (bodyParts) {
            console.log("Available body parts:", Array.from(bodyParts.keys()));

            // Extract HTML content using identified HTML part
            if (htmlPartId && bodyParts.has(htmlPartId)) {
              try {
                const htmlPart = bodyParts.get(htmlPartId);
                if (htmlPart) {
                  let rawHtml = htmlPart.toString("utf-8");
                  // Decode quoted-printable if needed
                  if (rawHtml.includes("=3D") || rawHtml.includes("=\n")) {
                    htmlContent = decodeQuotedPrintable(rawHtml);
                    console.log(
                      `HTML content decoded from quoted-printable, part ${htmlPartId}, length: ${htmlContent.length}`,
                    );
                  } else {
                    htmlContent = rawHtml;
                    console.log(
                      `HTML content extracted from part ${htmlPartId}, length: ${htmlContent.length}`,
                    );
                  }
                }
              } catch (e) {
                console.warn("Error parsing HTML content:", e);
              }
            }

            // Extract text content using identified text part
            if (textPartId && bodyParts.has(textPartId)) {
              try {
                const textPart = bodyParts.get(textPartId);
                if (textPart) {
                  let rawText = textPart.toString("utf-8");
                  // Decode quoted-printable if needed
                  if (rawText.includes("=3D") || rawText.includes("=\n")) {
                    textContent = decodeQuotedPrintable(rawText);
                    console.log(
                      `Text content decoded from quoted-printable, part ${textPartId}, length: ${textContent.length}`,
                    );
                  } else {
                    textContent = rawText;
                    console.log(
                      `Text content extracted from part ${textPartId}, length: ${textContent.length}`,
                    );
                  }
                  // Clean up text content
                  textContent = textContent
                    .replace(/\r\n/g, "\n")
                    .replace(/\r/g, "\n")
                    .trim();
                }
              } catch (e) {
                console.warn("Error parsing text content:", e);
              }
            }

            // Fallback logic if we didn't get content from identified parts
            if (!htmlContent && !textContent) {
              console.log(
                "No content from identified parts, trying fallbacks...",
              );

              // Try common part IDs as fallbacks
              const fallbackParts = ["TEXT", "1", "2", "1.1", "1.2"];
              for (const partId of fallbackParts) {
                if (bodyParts.has(partId)) {
                  try {
                    const part = bodyParts.get(partId);
                    if (part) {
                      let content = part.toString("utf-8");

                      // Decode quoted-printable if needed
                      if (content.includes("=3D") || content.includes("=\n")) {
                        content = decodeQuotedPrintable(content);
                        console.log(
                          `Content decoded from quoted-printable for part ${partId}`,
                        );
                      }

                      // Determine if it's HTML or text based on content
                      if (
                        content.includes("<html") ||
                        content.includes("<!DOCTYPE") ||
                        content.includes("<body") ||
                        content.includes("<div")
                      ) {
                        if (!htmlContent) {
                          htmlContent = content;
                          console.log(
                            `HTML content found in fallback part ${partId}, length: ${content.length}`,
                          );
                        }
                      } else {
                        if (!textContent) {
                          textContent = content
                            .replace(/\r\n/g, "\n")
                            .replace(/\r/g, "\n")
                            .trim();
                          console.log(
                            `Text content found in fallback part ${partId}, length: ${textContent.length}`,
                          );
                        }
                      }
                    }
                  } catch (e) {
                    console.warn(`Error parsing fallback part ${partId}:`, e);
                  }
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
          if (message.bodyStructure && message.bodyStructure.childNodes) {
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
            htmlContent: htmlContent,
            textContent: textContent,
            attachments: attachments,
          };

          console.log(
            `Successfully fetched email content. HTML: ${htmlContent.length > 0} (${htmlContent.length} chars), Text: ${textContent.length > 0} (${textContent.length} chars), Attachments: ${attachments.length}`,
          );
          console.log("HTML content preview:", htmlContent.substring(0, 200));
          console.log("Text content preview:", textContent.substring(0, 200));
        }
      } finally {
        // Always release the lock
        lock.release();
      }
    } finally {
      // Always logout and close connection
      try {
        await client.logout();
        console.log("Successfully logged out from IMAP server");
      } catch (logoutError) {
        console.warn("Error during logout:", logoutError);
      }
    }

    if (!emailContent) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email not found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailContent: emailContent,
        message: "Successfully fetched email content",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching email content:", error);

    let errorMessage = "Failed to fetch email content";
    if (error instanceof Error) {
      if (error.message.includes("authentication")) {
        errorMessage = "Authentication failed. Please check your credentials.";
      } else if (error.message.includes("connection")) {
        errorMessage =
          "Could not connect to email server. Please try again later.";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Connection timed out. Please try again.";
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
