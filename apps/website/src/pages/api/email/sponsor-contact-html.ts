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

export function sponsorContactMessage(input: {
  email: string;
  phone: string;
  message: string;
  from: string;
  contactTo: string;
}) {
  return {
    from: input.from,
    to: [input.contactTo],
    replyTo: input.email,
    subject: "New Contact Form Submission",
    html: officerContactHtml({
      email: input.email,
      phone: input.phone,
      message: input.message,
    }),
  };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
