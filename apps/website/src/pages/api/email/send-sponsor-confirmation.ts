import type { APIRoute } from "astro";
import { Resend } from "resend";

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!import.meta.env.RESEND_API_KEY) {
      return new Response("Email service not configured", { status: 500 });
    }

    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();

    if (!email || !message) {
      return new Response("Missing required fields", { status: 400 });
    }

    const resend = new Resend(import.meta.env.RESEND_API_KEY);

    const fromEmail =
      import.meta.env.FROM_EMAIL || "IEEE UCSD <onboarding@resend.dev>";

    const toEmail = import.meta.env.CONTACT_TO || "ieee@ucsd.edu";

    const replyToEmail = import.meta.env.REPLY_TO_EMAIL || "ieee@ucsd.edu";

    // Send to IEEE includes user's email + message
    await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      replyTo: email,
      subject: "New Contact Form Submission",
      html: `
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "(none)"}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
      `,
    });

    // User confirmation
    await resend.emails.send({
      from: fromEmail,
      to: [email],
      replyTo: replyToEmail,
      subject: "IEEE UCSD — We received your message",
      html: `
        <p>Hi!</p>
        <p>Thanks for reaching out to IEEE UCSD. We received your message and will get back to you soon.</p>
        <hr/>
        <p><strong>Your message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
        <p>— IEEE UCSD</p>
      `,
    });

    // return back to contact page
    return new Response(null, {
      status: 303,
      headers: { Location: "/sponsors?sent=1" },
    });
  } catch (err) {
    console.error("Contact email failed:", err);
    return new Response("Failed to send", { status: 500 });
  }
};

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
