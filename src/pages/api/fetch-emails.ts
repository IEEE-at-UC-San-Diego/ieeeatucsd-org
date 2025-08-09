import type { APIRoute } from "astro";
import { ImapFlow } from "imapflow";

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  preview: string;
  isRead: boolean;
  uid: number;
  attachmentCount: number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Email fetch request received");

    const requestBody = await request.json();
    const { email, password } = requestBody;

    if (!email || !password) {
      console.log("Missing email or password");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing email or password",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log(`Attempting to connect to IMAP for: ${email}`);

    // Create IMAP client with MXRoute settings
    const client = new ImapFlow({
      host: "mail.ieeeucsd.org",
      port: 993,
      secure: true,
      auth: {
        user: email,
        pass: password,
      },
      logger: false, // Disable logging for production
      clientInfo: {
        name: "IEEE UCSD Dashboard",
        version: "1.0.0",
      },
      // Connection timeout settings
      socketTimeout: 30000, // 30 seconds
      greetingTimeout: 30000, // 30 seconds
      connectionTimeout: 30000, // 30 seconds
      // Disable IDLE to prevent connection issues
      disableAutoIdle: true,
    });

    let emails: EmailMessage[] = [];

    try {
      // Connect to the IMAP server
      await client.connect();
      console.log("Successfully connected to IMAP server");

      // Select and lock the INBOX
      let lock = await client.getMailboxLock("INBOX");

      try {
        const mailboxExists =
          client.mailbox &&
          typeof client.mailbox === "object" &&
          "exists" in client.mailbox
            ? client.mailbox.exists
            : 0;
        console.log(`Mailbox info: ${mailboxExists} messages exist`);

        // Fetch recent messages (last 20 or all if less than 20)
        const messageCount = Math.min(mailboxExists, 20);
        const startSeq = Math.max(1, mailboxExists - messageCount + 1);
        const endSeq = mailboxExists;

        if (messageCount > 0) {
          console.log(`Fetching messages ${startSeq}:${endSeq}`);

          // Fetch messages with envelope, flags, and body structure
          for await (let message of client.fetch(`${startSeq}:${endSeq}`, {
            envelope: true,
            flags: true,
            bodyStructure: true,
            bodyParts: ["1", "TEXT", "HEADER"], // Get different body parts for better content extraction
          })) {
            // Extract email preview from body parts
            let preview = "";

            // Try to get text content from different body parts
            const bodyParts = message.bodyParts;
            if (bodyParts) {
              // Try TEXT first (plain text), then fallback to other parts
              let textContent =
                bodyParts.get("TEXT") ||
                bodyParts.get("1") ||
                bodyParts.get("1.1");

              if (textContent) {
                try {
                  // Convert buffer to string and clean up
                  let fullText = textContent.toString("utf-8");

                  // Remove HTML tags if present
                  fullText = fullText.replace(/<[^>]*>/g, " ");

                  // Clean up whitespace and special characters
                  fullText = fullText
                    .replace(/\r\n/g, " ")
                    .replace(/\n/g, " ")
                    .replace(/\t/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                  // Extract meaningful preview (skip common email headers/footers)
                  const lines = fullText
                    .split(/[.!?]+/)
                    .filter(
                      (line) =>
                        line.trim().length > 10 &&
                        !line.toLowerCase().includes("unsubscribe") &&
                        !line.toLowerCase().includes("click here"),
                    );

                  if (lines.length > 0) {
                    preview = lines[0].trim().substring(0, 150);
                    if (lines[0].length > 150) {
                      preview += "...";
                    }
                  } else {
                    preview = fullText.substring(0, 150);
                    if (fullText.length > 150) {
                      preview += "...";
                    }
                  }
                } catch (parseError) {
                  console.warn("Error parsing email content:", parseError);
                  preview = "Unable to parse email content";
                }
              }
            }

            // If no text preview, try to get it from subject or use default
            if (!preview && message.envelope?.subject) {
              preview = `Email about: ${message.envelope.subject}`;
            } else if (!preview) {
              preview = "No preview available";
            }

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

            // Format date
            let formattedDate = "Unknown date";
            if (message.envelope?.date) {
              try {
                formattedDate = new Date(
                  message.envelope.date,
                ).toLocaleDateString();
              } catch (e) {
                console.warn("Error parsing date:", message.envelope.date);
              }
            }

            // Check if message is read (not in \Seen flags means unread)
            const isRead = message.flags && message.flags.has("\\Seen");

            // Count attachments from body structure
            let attachmentCount = 0;
            if (message.bodyStructure && message.bodyStructure.childNodes) {
              const countAttachments = (node: any) => {
                if (
                  node.disposition === "attachment" &&
                  node.dispositionParameters?.filename
                ) {
                  attachmentCount++;
                }
                if (node.childNodes) {
                  node.childNodes.forEach(countAttachments);
                }
              };
              countAttachments(message.bodyStructure);
            }

            emails.push({
              id: message.uid.toString(),
              subject: message.envelope?.subject || "No subject",
              from: fromAddress,
              date: formattedDate,
              preview: preview,
              isRead: isRead || false,
              uid: message.uid,
              attachmentCount: attachmentCount,
            });
          }
        }

        // Sort emails by UID descending (newest first)
        emails.sort((a, b) => b.uid - a.uid);

        // Filter for Slack-related emails (prioritize them)
        const slackEmails = emails.filter(
          (email) =>
            email.subject.toLowerCase().includes("slack") ||
            email.from.toLowerCase().includes("slack") ||
            email.from.toLowerCase().includes("ieeeucsd"),
        );

        const otherEmails = emails.filter(
          (email) =>
            !email.subject.toLowerCase().includes("slack") &&
            !email.from.toLowerCase().includes("slack") &&
            !email.from.toLowerCase().includes("ieeeucsd"),
        );

        // Combine with Slack emails first
        const prioritizedEmails = [...slackEmails, ...otherEmails];

        console.log(
          `Successfully fetched ${emails.length} emails (${slackEmails.length} Slack-related)`,
        );
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

    return new Response(
      JSON.stringify({
        success: true,
        emails: emails,
        message: `Successfully fetched ${emails.length} emails`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    // Provide more specific error messages
    let errorMessage = "Failed to fetch emails";
    if (error instanceof Error) {
      if (error.message.includes("authentication")) {
        errorMessage =
          "Authentication failed. Please check your email and password.";
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
        emails: [],
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
