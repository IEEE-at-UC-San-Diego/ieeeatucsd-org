import type { APIRoute } from "astro";
import { ImapFlow } from "imapflow";

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
        // Fetch the specific message by UID
        const message = await client.fetchOne(uid, {
          envelope: true,
          flags: true,
          bodyStructure: true,
          bodyParts: ["HEADER", "TEXT", "1", "1.1", "1.2"], // Get various body parts
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

          // Extract email content from body parts
          let htmlContent = "";
          let textContent = "";

          const bodyParts = message.bodyParts;
          if (bodyParts) {
            // Try to get HTML content first
            const htmlPart = bodyParts.get("1.2") || bodyParts.get("TEXT");
            if (htmlPart) {
              try {
                htmlContent = htmlPart.toString("utf-8");
              } catch (e) {
                console.warn("Error parsing HTML content:", e);
              }
            }

            // Try to get plain text content
            const textPart =
              bodyParts.get("1.1") ||
              bodyParts.get("1") ||
              bodyParts.get("TEXT");
            if (textPart) {
              try {
                textContent = textPart.toString("utf-8");
                // Clean up text content
                textContent = textContent
                  .replace(/\r\n/g, "\n")
                  .replace(/\r/g, "\n")
                  .trim();
              } catch (e) {
                console.warn("Error parsing text content:", e);
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
            `Successfully fetched email content. HTML: ${htmlContent.length > 0}, Text: ${textContent.length > 0}, Attachments: ${attachments.length}`,
          );
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
