export function officerContactHtml(input: {
  email: string;
  phone: string;
  message: string;
}) {
  const phoneText = input.phone || "(none)";
  return `
        <p><strong>From:</strong> ${input.email}</p>
        <p><strong>Phone:</strong> ${phoneText}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.message)}</pre>
      `;
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
