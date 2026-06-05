import { Resend } from "resend";

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  return new Resend(apiKey);
}

export function getFromEmail() {
  return (
    process.env.FROM_EMAIL ||
    "IEEE at UC San Diego <noreply@transactional.ieeeatucsd.org>"
  );
}

export function getReplyTo() {
  return process.env.REPLY_TO_EMAIL || "ieee@ucsd.edu";
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const resend = getResend();
  const result = await resend.emails.send({
    from: getFromEmail(),
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    replyTo: getReplyTo(),
  });

  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.message || JSON.stringify(result.error)}`,
    );
  }

  return { success: true, emailId: result.data?.id };
}
