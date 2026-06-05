/**
 * Universal Email Template for IEEE at UC San Diego Dashboard V2
 *
 * Design direction: "Refined Editorial"
 * — Warm off-white canvas, deep ink tones, serif/sans pairing
 * — No alert boxes, no colored panels, no pill badges
 * — Status communicated through subtle typographic hierarchy
 * — Notes rendered as elegant blockquotes with thin rules
 * — Generous whitespace, confident restraint
 */

// ── Palette ────────────────────────────────────────────────────────────────────

const C = {
  ink: "#0C1B2A",
  inkSoft: "#1E3044",
  navy: "#003B5C",
  slate: "#3D5468",
  steel: "#5E7A8F",
  muted: "#8A9BAA",
  silver: "#B4C2CE",
  rule: "#D5DDE4",
  wash: "#E9EEF2",
  canvas: "#F4F6F8",
  paper: "#FAFBFC",
  white: "#FFFFFF",
  warmBg: "#F8F7F5",
  accent: "#B8860B",
  accentLight: "#D4A843",
  sage: "#2D6A4F",
  wine: "#8B2252",
  ocean: "#1B6B93",
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== "string") return String(unsafe ?? "");
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeUrl(url: string): string {
  if (typeof url !== "string") return "#";
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return "#";
  return escapeHtml(trimmed);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(ts: number | Date | string): string {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  }).format(d);
}

export function formatDateShort(ts: number | Date | string): string {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

// ── Status Variants ────────────────────────────────────────────────────────────

export type StatusVariant = "info" | "success" | "warning" | "danger" | "purple" | "neutral";

function variantAccent(variant: StatusVariant): string {
  switch (variant) {
    case "success": return C.sage;
    case "warning": return C.accent;
    case "danger": return C.wine;
    case "purple": return "#5B4A9E";
    case "info": return C.ocean;
    default: return C.steel;
  }
}

// ── Template Types ─────────────────────────────────────────────────────────────

export interface DetailRow {
  label: string;
  value: string;
}

export interface NotesBox {
  title: string;
  content: string;
  variant: StatusVariant;
}

export interface UniversalEmailOptions {
  /** Email subject line (also used as <title>) */
  subject: string;
  /** Short preheader text shown in inbox preview */
  preheader?: string;
  /** Header bar title (default: "IEEE at UC San Diego") */
  headerTitle?: string;
  /** Greeting name, e.g. "John" → "Hello John," */
  recipientName?: string;
  /** 1-2 sentence intro paragraph (HTML allowed) */
  introHtml: string;
  /** Key-value detail rows rendered as a table */
  details?: DetailRow[];
  /** Status badge shown above details */
  statusBadge?: {
    label: string;
    variant: StatusVariant;
  };
  /** Optional highlighted notes/reason boxes */
  notes?: NotesBox[];
  /** Optional bullet-point list section */
  bulletSection?: {
    title: string;
    items: string[];
    variant: StatusVariant;
  };
  /** CTA button */
  ctaButton?: {
    text: string;
    url: string;
  };
  /** Reference ID shown in footer */
  referenceId?: string;
  /** Contact email in footer (default: ieee@ucsd.edu) */
  contactEmail?: string;
  /** Footer system name (default: "IEEE at UC San Diego Dashboard") */
  footerText?: string;
}

// ── Shared font stack ──────────────────────────────────────────────────────────

const FONT_SERIF = "Georgia,'Times New Roman',Times,serif";
const FONT_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";
const FONT_MONO = "'SF Mono','Cascadia Code','Fira Code',Consolas,monospace";

// ── Template Renderer ──────────────────────────────────────────────────────────

export function renderEmail(opts: UniversalEmailOptions): string {
  const {
    subject,
    preheader = "",
    headerTitle = "IEEE at UC San Diego",
    recipientName,
    introHtml,
    details,
    statusBadge,
    notes,
    bulletSection,
    ctaButton,
    referenceId,
    contactEmail = "ieee@ucsd.edu",
    footerText = "IEEE at UC San Diego Dashboard",
  } = opts;

  // ── Status line (replaces badge) ──
  const statusHtml = statusBadge
    ? (() => {
        const color = variantAccent(statusBadge.variant);
        return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0 4px 0;">
          <tr>
            <td style="width:3px;background:${color};border-radius:2px;" width="3"></td>
            <td style="padding:0 0 0 14px;">
              <div style="font-family:${FONT_SANS};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${color};">
                ${escapeHtml(statusBadge.label)}
              </div>
            </td>
          </tr>
        </table>`;
      })()
    : "";

  // ── Details (clean rows with thin rules) ──
  const detailsHtml = details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:collapse;">
        ${details
          .map(
            (row) => `
          <tr>
            <td style="padding:11px 16px 11px 0;font-family:${FONT_SANS};font-size:12px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.8px;width:130px;vertical-align:top;border-bottom:1px solid ${C.wash};">
              ${escapeHtml(row.label)}
            </td>
            <td style="padding:11px 0;font-family:${FONT_SANS};font-size:14px;color:${C.inkSoft};vertical-align:top;border-bottom:1px solid ${C.wash};line-height:1.5;">
              ${row.value}
            </td>
          </tr>`,
          )
          .join("")}
      </table>`
    : "";

  // ── Notes (elegant blockquotes — no colored backgrounds) ──
  const notesHtml = notes?.length
    ? notes
        .map((n) => {
          const color = variantAccent(n.variant);
          return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
            <tr>
              <td style="width:2px;background:${color};border-radius:1px;" width="2"></td>
              <td style="padding:2px 0 2px 18px;">
                <div style="font-family:${FONT_SANS};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${color};margin-bottom:6px;">
                  ${escapeHtml(n.title)}
                </div>
                <div style="font-family:${FONT_SERIF};font-size:14px;color:${C.slate};line-height:1.7;font-style:italic;">
                  ${escapeHtml(n.content)}
                </div>
              </td>
            </tr>
          </table>`;
        })
        .join("")
    : "";

  // ── Bullet section (clean list, no box) ──
  const bulletHtml = bulletSection
    ? (() => {
        const color = variantAccent(bulletSection.variant);
        return `<div style="margin:24px 0 20px 0;">
          <div style="font-family:${FONT_SANS};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${color};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid ${C.wash};">
            ${escapeHtml(bulletSection.title)}
          </div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${bulletSection.items
              .map(
                (item) => `
            <tr>
              <td style="width:20px;vertical-align:top;padding:3px 0;font-size:14px;color:${C.silver};">&#8226;</td>
              <td style="padding:3px 0;font-family:${FONT_SANS};font-size:13px;color:${C.slate};line-height:1.65;">
                ${escapeHtml(item)}
              </td>
            </tr>`,
              )
              .join("")}
          </table>
        </div>`;
      })()
    : "";

  // ── CTA button (refined, not chunky) ──
  const ctaHtml = ctaButton
    ? `<div style="text-align:center;margin:32px 0 12px 0;">
        <a href="${sanitizeUrl(ctaButton.url)}" style="display:inline-block;padding:12px 36px;background:${C.ink};color:${C.white};text-decoration:none;border-radius:6px;font-family:${FONT_SANS};font-size:13px;font-weight:600;letter-spacing:0.4px;mso-padding-alt:0;">
          <!--[if mso]><i style="letter-spacing:36px;mso-font-width:-100%;mso-text-raise:24pt">&nbsp;</i><![endif]-->
          <span style="mso-text-raise:12pt;">${escapeHtml(ctaButton.text)}</span>
          <!--[if mso]><i style="letter-spacing:36px;mso-font-width:-100%">&nbsp;</i><![endif]-->
        </a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  ${preheader ? `<meta name="description" content="${escapeHtml(preheader)}">` : ""}
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>body,table,td{font-family:Arial,Helvetica,sans-serif!important;}</style>
  <![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    body{margin:0;padding:0;width:100%!important;-webkit-font-smoothing:antialiased;}
    @media only screen and (max-width:620px){
      .email-wrap{width:100%!important;padding:0 10px!important;}
      .email-body{padding:28px 20px!important;}
      .email-hdr{padding:28px 20px 24px 20px!important;}
      .email-ftr{padding:20px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${C.warmBg};font-family:${FONT_SANS};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${"&zwnj;&nbsp;".repeat(30)}</div>` : ""}

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${C.warmBg};">
    <tr>
      <td style="padding:40px 16px;">

        <!-- Container -->
        <table role="presentation" class="email-wrap" cellspacing="0" cellpadding="0" border="0" width="560" align="center" style="max-width:560px;margin:0 auto;background-color:${C.white};border-radius:4px;border:1px solid ${C.wash};">

          <!-- Header: thin accent bar + wordmark -->
          <tr>
            <td style="background:${C.navy};height:4px;font-size:0;line-height:0;" height="4">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-hdr" style="padding:32px 36px 28px 36px;">
              <div style="font-family:${FONT_SERIF};font-size:18px;font-weight:400;color:${C.ink};letter-spacing:-0.2px;line-height:1.3;">
                ${escapeHtml(headerTitle)}
              </div>
            </td>
          </tr>

          <!-- Thin rule -->
          <tr>
            <td style="padding:0 36px;">
              <div style="border-top:1px solid ${C.wash};"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-body" style="padding:28px 36px 20px 36px;">

              ${recipientName ? `<div style="font-family:${FONT_SANS};font-size:14px;color:${C.slate};margin-bottom:18px;line-height:1.5;">Hello <strong style="color:${C.ink};font-weight:600;">${escapeHtml(recipientName)}</strong>,</div>` : ""}

              <div style="font-family:${FONT_SANS};font-size:14px;color:${C.slate};line-height:1.7;margin-bottom:8px;">
                ${introHtml}
              </div>

              ${statusHtml}

              ${detailsHtml ? `<div style="margin:20px 0;padding:18px 20px;background:${C.canvas};border-radius:4px;">${detailsHtml}</div>` : ""}

              ${notesHtml}

              ${bulletHtml}

              ${ctaHtml}
            </td>
          </tr>

          <!-- Footer rule -->
          <tr>
            <td style="padding:0 36px;">
              <div style="border-top:1px solid ${C.wash};"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-ftr" style="padding:22px 36px 28px 36px;">
              ${referenceId ? `<div style="margin-bottom:14px;font-family:${FONT_SANS};font-size:11px;color:${C.silver};letter-spacing:0.3px;">Ref <span style="font-family:${FONT_MONO};font-size:11px;color:${C.muted};font-weight:500;">${escapeHtml(referenceId)}</span></div>` : ""}
              <div style="font-family:${FONT_SANS};font-size:12px;color:${C.silver};line-height:1.6;">
                Questions? <a href="mailto:${escapeHtml(contactEmail)}" style="color:${C.ocean};text-decoration:none;">${escapeHtml(contactEmail)}</a>
              </div>
              <div style="margin-top:14px;font-family:${FONT_SANS};font-size:10px;color:${C.rule};letter-spacing:0.5px;text-transform:uppercase;">
                ${escapeHtml(footerText)}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
