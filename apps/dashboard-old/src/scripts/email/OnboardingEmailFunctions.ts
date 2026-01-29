import type { Resend } from "resend";
import { generateEmailTemplate, createInfoBox, IEEE_COLORS } from "./templates/EmailTemplate";

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

interface DirectOnboardingEmailData {
  name: string;
  email: string;
  role: string;
  position: string;
  leaderName?: string;
  customMessage?: string;
  emailTemplate: string;
}

interface AcceptanceConfirmationData {
  name: string;
  email: string;
  position: string;
  role: string;
}

/**
 * Send invitation email asking officer to accept their position
 */
export async function sendInvitationEmail(
  resend: Resend,
  fromEmail: string,
  replyToEmail: string,
  data: InvitationEmailData,
): Promise<boolean> {
  try {
    const baseUrl = import.meta.env.PUBLIC_SITE_URL || "https://ieeeatucsd.org";
    const acceptLink = `${baseUrl}/accept-invitation/${data.inviteId}`;

    const subject = `You've been elected as ${data.position} for IEEE at UCSD!`;

    const bodyContent = `
      <h2>Congratulations, ${data.name}!</h2>
      <p>We are excited to inform you that you have been elected to the IEEE at UCSD general board for the 2025-2026 academic year for the following position:</p>
      
      <div style="background: ${IEEE_COLORS.gray[50]}; border-left: 4px solid ${IEEE_COLORS.primary}; padding: 16px; margin: 20px 0;">
        <div style="font-size: 18px; font-weight: bold; color: ${IEEE_COLORS.primary}; margin-bottom: 4px;">${data.position}</div>
        <div style="color: ${IEEE_COLORS.gray[600]};">${data.role}</div>
      </div>

      ${data.message ? createInfoBox(`<p style="margin:0">${data.message}</p>`, "info") : ""}
      
      <p>Please respond by <strong>${data.acceptanceDeadline || "the end of the week"}</strong> with your decision on accepting the position.</p>

      ${createInfoBox(
      `<p style="margin:0"><strong>What happens next?</strong><br>If you choose to accept the position, we will begin onboarding as soon as possible to get you up to speed on tasks and give you access to everything you need. There will be a follow-up email detailing your next steps.</p>`,
      "success"
    )}
      
      <p>Please be sure to come to our IEEE Project Space sometime! It's on the 4th floor of Jacobs Hall/EBU1 in EBU1-4710 (Turn left after exiting the elevators and go to the very end; it's the last hallway on your left). We can't wait to see you and support you throughout the year!</p>
      
      ${data.leaderName ? `<p>Your Team Lead will be <strong>${data.leaderName}</strong>, who will be working with you throughout the year.</p>` : ""}
      
      <div style="margin-top:20px; text-align:center;">
        <p style="font-size:14px; color:${IEEE_COLORS.gray[500]}">Or copy and paste this link into your browser:<br><a href="${acceptLink}" style="color:${IEEE_COLORS.primary}; word-break:break-all;">${acceptLink}</a></p>
      </div>
    `;

    const html = generateEmailTemplate({
      title: "Invitation to Join IEEE UCSD",
      preheader: `You've been elected as ${data.position}`,
      headerText: "IEEE at UC San Diego",
      bodyContent,
      ctaButton: {
        text: "Accept Position",
        url: acceptLink,
      },
      contactEmail: replyToEmail,
    });

    await resend.emails.send({
      from: fromEmail,
      to: [data.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log(`Invitation email sent to ${data.email}`);
    return true;
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return false;
  }
}

/**
 * Send direct onboarding email with all instructions
 */
export async function sendDirectOnboardingEmail(
  resend: Resend,
  fromEmail: string,
  replyToEmail: string,
  data: DirectOnboardingEmailData,
): Promise<boolean> {
  try {
    const subject = `Welcome to IEEE at UCSD - ${data.position} Onboarding`;

    // Process the email template with replacements
    let emailBody = data.emailTemplate;
    emailBody = emailBody.replace(/{NAME}/g, data.name);
    emailBody = emailBody.replace(/{POSITION}/g, data.position);

    const leaderInfo = data.leaderName
      ? `The Vice Chair you'll be working with throughout the year will be ${data.leaderName}.`
      : "";
    emailBody = emailBody.replace(/{LEADER_INFO}/g, leaderInfo);

    const customMsg = data.customMessage ? `\n\n${data.customMessage}\n` : "";
    emailBody = emailBody.replace(/{CUSTOM_MESSAGE}/g, customMsg);

    // Convert newlines to breaks for HTML display if not already HTML
    const processedBody = emailBody.replace(/\n/g, "<br>");

    const html = generateEmailTemplate({
      title: "Welcome to IEEE at UCSD",
      preheader: `Onboarding instructions for ${data.position}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>Welcome to IEEE at UCSD!</h2>
        <div style="font-size: 16px; line-height: 1.6;">
          ${processedBody}
        </div>
      `,
      contactEmail: replyToEmail,
    });

    await resend.emails.send({
      from: fromEmail,
      to: [data.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log(`Direct onboarding email sent to ${data.email}`);
    return true;
  } catch (error) {
    console.error("Error sending direct onboarding email:", error);
    return false;
  }
}

/**
 * Send confirmation email after invitation acceptance
 */
export async function sendAcceptanceConfirmationEmail(
  resend: Resend,
  fromEmail: string,
  replyToEmail: string,
  data: AcceptanceConfirmationData,
): Promise<boolean> {
  try {
    const subject = `Welcome to the Team! Next Steps for ${data.position}`;

    const bodyContent = `
      <h2>Welcome Aboard!</h2>
      <p>Hi ${data.name},</p>
      <p>Thank you for accepting the position of <strong>${data.position}</strong>! We're thrilled to have you on the IEEE at UCSD team.</p>
      
      ${createInfoBox(
      `<p style="margin:0"><strong>Your onboarding process has begun!</strong><br>You've been added to the appropriate Google Groups and granted officer permissions in our system.</p>`,
      "success"
    )}

      <p>You will receive a separate email with detailed onboarding instructions, including:</p>
      <ul>
        <li>How to join our Slack workspace</li>
        <li>Access to Google Drive and shared documents</li>
        <li>Information about IEEE membership</li>
        <li>Next steps and important dates</li>
      </ul>

      <p>We're excited to work with you this year!</p>
    `;

    const html = generateEmailTemplate({
      title: "Welcome to the Team",
      preheader: `Next steps for ${data.position}`,
      headerText: "IEEE at UC San Diego",
      bodyContent,
      ctaButton: {
        text: "Go to Dashboard",
        url: "https://ieeeatucsd.org/dashboard",
      },
      contactEmail: replyToEmail,
    });

    await resend.emails.send({
      from: fromEmail,
      to: [data.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log(`Acceptance confirmation email sent to ${data.email}`);
    return true;
  } catch (error) {
    console.error("Error sending acceptance confirmation email:", error);
    return false;
  }
}
