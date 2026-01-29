/**
 * Unified Email Template System
 * Uses IEEE blue colors and modern, responsive design
 */

// IEEE Brand Colors
export const IEEE_COLORS = {
  primary: "#00629B", // IEEE Blue
  primaryDark: "#004B7A",
  primaryLight: "#0080C9",
  accent: "#00A9E0", // Light Blue
  success: "#00AB84",
  warning: "#F7A800",
  danger: "#E31C3D",
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },
  white: "#FFFFFF",
  black: "#000000",
};

/**
 * HTML escaping utility to prevent XSS attacks
 */
function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== "string") {
    return String(unsafe);
  }
  return unsafe
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * URL sanitization utility to prevent XSS via javascript: protocol
 */
function sanitizeUrl(url: string): string {
  if (typeof url !== "string") {
    return "#";
  }
  const trimmed = url.trim();
  // Block javascript: and data: protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return "#";
  }
  return escapeHtml(trimmed);
}

interface EmailTemplateOptions {
  title: string;
  preheader?: string;
  headerText?: string;
  bodyContent: string;
  footerText?: string;
  ctaButton?: {
    text: string;
    url: string;
  };
  referenceId?: string;
  contactEmail?: string;
}

/**
 * Generate a modern, responsive email template with IEEE branding
 */
export function generateEmailTemplate(options: EmailTemplateOptions): string {
  const {
    title,
    preheader = "",
    headerText = "IEEE at UC San Diego",
    bodyContent,
    footerText = "IEEE at UC San Diego Dashboard",
    ctaButton,
    referenceId,
    contactEmail = "ieee@ucsd.edu",
  } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${preheader ? `<meta name="description" content="${escapeHtml(preheader)}">` : ""}
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }

    /* Base styles */
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: ${IEEE_COLORS.gray[100]};
    }

    /* Container */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${IEEE_COLORS.white};
    }

    /* Header */
    .email-header {
      background: #003B5C;
      padding: 32px 24px;
      text-align: center;
    }

    .email-header h1 {
      margin: 0;
      color: ${IEEE_COLORS.white};
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }

    /* Body */
    .email-body {
      padding: 32px 24px;
      color: ${IEEE_COLORS.gray[800]};
      font-size: 16px;
      line-height: 1.6;
    }

    .email-body h2 {
      color: ${IEEE_COLORS.primary};
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }

    .email-body h3 {
      color: ${IEEE_COLORS.gray[700]};
      font-size: 18px;
      font-weight: 600;
      margin: 24px 0 12px 0;
    }

    .email-body p {
      margin: 0 0 16px 0;
      color: ${IEEE_COLORS.gray[700]};
    }

    .email-body ul, .email-body ol {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }

    .email-body li {
      margin-bottom: 8px;
      color: ${IEEE_COLORS.gray[700]};
    }

    /* Info Box */
    .info-box {
      background-color: ${IEEE_COLORS.gray[50]};
      border-left: 4px solid ${IEEE_COLORS.primary};
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }

    .info-box-success {
      background-color: #ECFDF5;
      border-left-color: ${IEEE_COLORS.success};
    }

    .info-box-warning {
      background-color: #FFFBEB;
      border-left-color: ${IEEE_COLORS.warning};
    }

    .info-box-danger {
      background-color: #FEF2F2;
      border-left-color: ${IEEE_COLORS.danger};
    }

    /* Detail Row */
    .detail-row {
      padding: 12px 0;
      border-bottom: 1px solid ${IEEE_COLORS.gray[200]};
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      font-weight: 600;
      color: ${IEEE_COLORS.gray[700]};
      min-width: 140px;
      display: inline-block;
      width: 140px;
    }

    .detail-value {
      color: ${IEEE_COLORS.gray[800]};
      display: inline-block;
      width: calc(100% - 140px);
      vertical-align: top;
    }

    /* CTA Button */
    .cta-button {
      display: inline-block;
      padding: 14px 28px;
      background: #003B5C;
      color: ${IEEE_COLORS.white} !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: transform 0.2s;
    }

    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 98, 155, 0.3);
    }

    /* Code/Reference */
    .reference-code {
      background-color: ${IEEE_COLORS.gray[100]};
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: ${IEEE_COLORS.primary};
      font-weight: 600;
    }

    /* Footer */
    .email-footer {
      background-color: ${IEEE_COLORS.gray[50]};
      padding: 24px;
      text-align: center;
      border-top: 1px solid ${IEEE_COLORS.gray[200]};
    }

    .email-footer p {
      margin: 8px 0;
      color: ${IEEE_COLORS.gray[600]};
      font-size: 14px;
    }

    .email-footer a {
      color: ${IEEE_COLORS.primary};
      text-decoration: none;
      font-weight: 500;
    }

    .email-footer a:hover {
      text-decoration: underline;
    }

    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }

      .email-header, .email-body, .email-footer {
        padding: 24px 16px !important;
      }

      .detail-row {
        flex-direction: column;
      }

      .detail-label {
        margin-bottom: 4px;
      }
    }
  </style>
</head>
<body>
  ${
    preheader
      ? `
  <!-- Preheader text (hidden but shows in email preview) -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    ${escapeHtml(preheader)}
  </div>
  `
      : ""
  }

  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${IEEE_COLORS.gray[100]}; padding: 20px 0;">
    <tr>
      <td align="center">
        <div class="email-container">
          <!-- Header -->
          <div class="email-header">
            <h1>${escapeHtml(headerText)}</h1>
          </div>

          <!-- Body -->
          <div class="email-body">
            ${bodyContent}

            ${
              ctaButton
                ? `
            <div style="text-align: center; margin: 32px 0;">
              <a href="${sanitizeUrl(ctaButton.url)}" class="cta-button">${escapeHtml(ctaButton.text)}</a>
            </div>
            `
                : ""
            }
          </div>

          <!-- Footer -->
          <div class="email-footer">
            ${
              referenceId
                ? `
            <p style="margin-bottom: 16px;">
              Reference ID: <span class="reference-code">${escapeHtml(referenceId)}</span>
            </p>
            `
                : ""
            }
            <p>
              Questions? Contact us at
              <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>
            </p>
            <hr style="border: none; border-top: 1px solid ${IEEE_COLORS.gray[300]}; margin: 16px 0;">
            <p style="font-size: 12px; color: ${IEEE_COLORS.gray[500]};">
              ${escapeHtml(footerText)}
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Helper function to create detail rows for displaying data
 */
export function createDetailRow(label: string, value: string | number): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="140" valign="top" style="font-weight: 600; color: ${IEEE_COLORS.gray[700]}; padding: 12px 12px 12px 0; border-bottom: 1px solid ${IEEE_COLORS.gray[200]};">
          ${escapeHtml(label)}:
        </td>
        <td valign="top" style="color: ${IEEE_COLORS.gray[800]}; padding: 12px 0 12px 12px; border-bottom: 1px solid ${IEEE_COLORS.gray[200]};">
          ${escapeHtml(String(value))}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Helper function to create an info box
 */
export function createInfoBox(
  content: string,
  type: "info" | "success" | "warning" | "danger" = "info",
): string {
  const className = type === "info" ? "info-box" : `info-box info-box-${type}`;
  return `<div class="${className}">${escapeHtml(content)}</div>`;
}

/**
 * Helper function to format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Helper function to format date
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${String(date)}`);
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}
