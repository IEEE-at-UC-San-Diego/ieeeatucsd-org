/**
 * Onboarding Email Templates for Dashboard V2
 *
 * Uses the universal email template from email-template.ts for consistent branding.
 * Handles invitation and direct onboarding emails.
 */

import { sendEmail } from "./email";
import { renderEmail, escapeHtml } from "./email-template";

// ── Legacy exports (kept for backward compatibility) ──

export const IEEE_COLORS = {
  primary: "#00629B",
  primaryDark: "#004B7A",
  primaryLight: "#0080C9",
  accent: "#00A9E0",
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

/** @deprecated Use renderEmail from email-template.ts instead */
export function generateEmailTemplate(options: {
  title: string;
  preheader?: string;
  headerText?: string;
  bodyContent: string;
  footerText?: string;
  ctaButton?: { text: string; url: string };
  referenceId?: string;
  contactEmail?: string;
}): string {
  return renderEmail({
    subject: options.title,
    preheader: options.preheader,
    headerTitle: options.headerText,
    introHtml: options.bodyContent,
    ctaButton: options.ctaButton,
    referenceId: options.referenceId,
    contactEmail: options.contactEmail,
    footerText: options.footerText,
  });
}

/** @deprecated Use NotesBox from email-template.ts instead */
export function createInfoBox(
  content: string,
  type: "info" | "success" | "warning" | "danger" = "info",
): string {
  const colors = {
    info: { bg: "#E8F4FD", border: "#0077B6" },
    success: { bg: "#ECFDF5", border: "#059669" },
    warning: { bg: "#FFFBEB", border: "#D97706" },
    danger: { bg: "#FEF2F2", border: "#DC2626" },
  };
  const c = colors[type];
  return `<div style="background:${c.bg};border-left:4px solid ${c.border};padding:16px;margin:20px 0;border-radius:6px;">${content}</div>`;
}

// ── Invitation Email ──

interface InvitationEmailData {
  inviteId: string;
  name: string;
  email: string;
  role: string;
  position: string;
  acceptanceDeadline?: string;
  message?: string;
  leaderName?: string;
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
  try {
    const baseUrl =
      process.env.PUBLIC_DASHBOARD_URL || "https://dashboard.ieeeatucsd.org";
    const acceptLink = `${baseUrl}/accept-invitation/${data.inviteId}`;

    const subject = `You've been elected as ${data.position} for IEEE at UCSD!`;

    const positionHtml = `<strong>${escapeHtml(data.position)}</strong> (${escapeHtml(data.role)})`;

    const introHtml = `
      <h2 style="margin:0 0 16px 0;color:#003B5C;">Congratulations, ${escapeHtml(data.name)}!</h2>
      <p>We are excited to inform you that you have been elected to the IEEE at UCSD general board for the 2025-2026 academic year for the following position:</p>
    `;

    const html = renderEmail({
      subject,
      preheader: `You've been elected as ${data.position}`,
      introHtml,
      details: [
        { label: "Position", value: positionHtml },
        { label: "Role", value: escapeHtml(data.role) },
        { label: "Deadline", value: escapeHtml(data.acceptanceDeadline || "End of the week") },
        ...(data.leaderName ? [{ label: "Team Lead", value: escapeHtml(data.leaderName) }] : []),
      ],
      notes: [
        ...(data.message ? [{ title: "Message from Leadership", content: data.message, variant: "info" as const }] : []),
        {
          title: "What happens next?",
          content: "If you choose to accept the position, we will begin onboarding as soon as possible to get you up to speed on tasks and give you access to everything you need. There will be a follow-up email detailing your next steps.",
          variant: "success" as const,
        },
      ],
      bulletSection: {
        title: "Come Visit Us!",
        items: [
          "IEEE Project Space: 4th floor of Jacobs Hall/EBU1 in EBU1-4710",
          "Turn left after exiting the elevators, go to the very end",
          "It's the last hallway on your left — we can't wait to see you!",
        ],
        variant: "info",
      },
      ctaButton: { text: "Accept Position", url: acceptLink },
      referenceId: data.inviteId,
      footerText: "IEEE at UC San Diego — Officer Onboarding",
    });

    await sendEmail({ to: data.email, subject, html });
    return true;
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return false;
  }
}

// ── Direct Onboarding Email ──

interface DirectOnboardingEmailData {
  name: string;
  email: string;
  role: string;
  position: string;
  leaderName?: string;
  customMessage?: string;
  emailTemplate: string;
}

export async function sendDirectOnboardingEmail(
  data: DirectOnboardingEmailData,
  googleSheetsUrl?: string,
): Promise<boolean> {
  try {
    const subject = `Welcome to IEEE at UCSD - ${data.position} Onboarding`;

    let emailBody = data.emailTemplate;
    emailBody = emailBody.replace(/{NAME}/g, data.name);
    emailBody = emailBody.replace(/{POSITION}/g, data.position);

    const leaderInfo = data.leaderName
      ? `The Vice Chair you'll be working with throughout the year will be ${data.leaderName}.`
      : "";
    emailBody = emailBody.replace(/{LEADER_INFO}/g, leaderInfo);

    const customMsg = data.customMessage ? `\n\n${data.customMessage}\n` : "";
    emailBody = emailBody.replace(/{CUSTOM_MESSAGE}/g, customMsg);

    if (googleSheetsUrl) {
      emailBody = emailBody.replace(
        /https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+[^\s)"]*/g,
        googleSheetsUrl,
      );
    }

    const processedBody = emailBody.replace(/\n/g, "<br>");

    const html = renderEmail({
      subject,
      preheader: `Onboarding instructions for ${data.position}`,
      recipientName: data.name,
      introHtml: `
        <h2 style="margin:0 0 16px 0;color:#003B5C;">Welcome to IEEE at UCSD!</h2>
        <div style="font-size:15px;line-height:1.65;">
          ${processedBody}
        </div>
      `,
      details: [
        { label: "Position", value: escapeHtml(data.position) },
        { label: "Role", value: escapeHtml(data.role) },
        ...(data.leaderName ? [{ label: "Team Lead", value: escapeHtml(data.leaderName) }] : []),
      ],
      footerText: "IEEE at UC San Diego — Officer Onboarding",
    });

    await sendEmail({ to: data.email, subject, html });
    return true;
  } catch (error) {
    console.error("Error sending direct onboarding email:", error);
    return false;
  }
}
