export function officerContactHtml(input: {
  email: string;
  phone: string;
  message: string;
}) {
  const phoneText = input.phone || "(none)";
  return `
        <p><strong>From:</strong> ${escapeHtml(input.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phoneText)}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.message)}</pre>
      `;
}

export function sponsorContactMessages(input: {
  email: string;
  phone: string;
  message: string;
  from: string;
  contactTo: string;
  replyTo: string;
}) {
  return [
    {
      from: input.from,
      to: [input.contactTo],
      replyTo: input.email,
      subject: "New Contact Form Submission",
      html: officerContactHtml({
        email: input.email,
        phone: input.phone,
        message: input.message,
      }),
    },
    {
      from: input.from,
      to: [input.email],
      replyTo: input.replyTo,
      subject: "IEEE UCSD — We received your message",
      html: senderConfirmationHtml(input.message),
    },
  ];
}

export function senderConfirmationHtml(message: string) {
  return `
        <p>Hi!</p>
        <p>Thanks for reaching out to IEEE UCSD. We received your message and will get back to you soon.</p>
        <hr/>
        <p><strong>Your message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
        <p>— IEEE UCSD</p>
      `;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
