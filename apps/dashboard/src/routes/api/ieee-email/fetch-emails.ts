import { createFileRoute } from "@tanstack/react-router";
import { ImapFlow } from "imapflow";
import { requireApiAuth } from "@/server/auth";

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

async function handle({ request }: { request: Request }) {
  try {
    const authResult = await requireApiAuth(request);
    if (authResult instanceof Response) return authResult;
    const { body, user } = authResult;
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing email or password" }),
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

    let emails: EmailMessage[] = [];

    try {
      await client.connect();

      const lock = await client.getMailboxLock("INBOX");

      try {
        const mailboxExists =
          client.mailbox &&
          typeof client.mailbox === "object" &&
          "exists" in client.mailbox
            ? (client.mailbox as any).exists
            : 0;

        const messageCount = Math.min(mailboxExists, 20);
        const startSeq = Math.max(1, mailboxExists - messageCount + 1);
        const endSeq = mailboxExists;

        if (messageCount > 0) {
          for await (const message of client.fetch(`${startSeq}:${endSeq}`, {
            envelope: true,
            flags: true,
            bodyStructure: true,
            bodyParts: ["1", "TEXT", "HEADER"],
          })) {
            try {
              let preview = "";

              const bodyParts = message.bodyParts;
              if (bodyParts) {
                const textContent =
                  bodyParts.get("TEXT") ||
                  bodyParts.get("1") ||
                  bodyParts.get("1.1");

                if (textContent) {
                  try {
                    let fullText = textContent.toString("utf-8");
                    fullText = fullText.replace(/<[^>]*>/g, " ");
                    fullText = fullText
                      .replace(/\r\n/g, " ")
                      .replace(/\n/g, " ")
                      .replace(/\t/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();

                    const lines = fullText
                      .split(/[.!?]+/)
                      .filter(
                        (line: string) =>
                          line.trim().length > 10 &&
                          !line.toLowerCase().includes("unsubscribe") &&
                          !line.toLowerCase().includes("click here"),
                      );

                    if (lines.length > 0) {
                      preview = lines[0].trim().substring(0, 150);
                      if (lines[0].length > 150) preview += "...";
                    } else {
                      preview = fullText.substring(0, 150);
                      if (fullText.length > 150) preview += "...";
                    }
                  } catch {
                    preview = "Unable to parse email content";
                  }
                }
              }

              if (!preview && message.envelope?.subject) {
                preview = `Email about: ${message.envelope.subject}`;
              } else if (!preview) {
                preview = "No preview available";
              }

              let fromAddress = "Unknown sender";
              if (message.envelope?.from && message.envelope.from.length > 0) {
                const sender = message.envelope.from[0];
                fromAddress = sender.name
                  ? `${sender.name} <${sender.address}>`
                  : sender.address || "Unknown sender";
              }

              let formattedDate = "Unknown date";
              if (message.envelope?.date) {
                try {
                  const dateObj = new Date(message.envelope.date);
                  if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toLocaleDateString();
                  }
                } catch {}
              }

              const isRead = message.flags && message.flags.has("\\Seen");

              let attachmentCount = 0;
              if (message.bodyStructure && (message.bodyStructure as any).childNodes) {
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
                preview,
                isRead: isRead || false,
                uid: message.uid,
                attachmentCount,
              });
            } catch (messageError) {
              console.error(`Error processing message ${message.uid}:`, messageError);
            }
          }
        }

        emails.sort((a, b) => b.uid - a.uid);
      } finally {
        lock.release();
      }
    } finally {
      try {
        await client.logout();
      } catch {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails,
        message: `Successfully fetched ${emails.length} emails`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error fetching emails:", error);

    let errorMessage = "Failed to fetch emails";
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
        errorMessage = "Authentication failed. Please check your email and password.";
        statusCode = 401;
      } else if (
        error.message.includes("connection") ||
        error.message.includes("ECONNREFUSED")
      ) {
        errorMessage = "Could not connect to email server. Please try again later.";
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
      JSON.stringify({
        success: false,
        message: errorMessage,
        emails: [],
      }),
      { status: statusCode, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/ieee-email/fetch-emails")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
