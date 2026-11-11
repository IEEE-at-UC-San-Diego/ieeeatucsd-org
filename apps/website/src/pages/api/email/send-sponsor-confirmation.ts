import type { APIRoute } from "astro";
import { Resend } from "resend";
import { sponsorContactMessage } from "./sponsor-contact-html";

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

    const toEmail = import.meta.env.CONTACT_TO || "president@ieeeatucsd.org";

    await resend.emails.send(
      sponsorContactMessage({
        email,
        phone,
        message,
        from: fromEmail,
        contactTo: toEmail,
      }),
    );

    return new Response(null, {
      status: 303,
      headers: { Location: "/sponsors?sent=1" },
    });
  } catch (err) {
    console.error("Contact email failed:", err);
    return new Response("Failed to send", { status: 500 });
  }
};
