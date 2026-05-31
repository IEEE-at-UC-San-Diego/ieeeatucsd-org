import type { Resend } from "resend";

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
    const baseUrl =
      import.meta.env.PUBLIC_DASHBOARD_URL || "https://dashboard.ieeeatucsd.org";
    const acceptLink = `${baseUrl}/accept-invitation/${data.inviteId}`;

    const subject = `You've been elected as ${data.position} for IEEE at UCSD!`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0A2463; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Congratulations, ${data.name}!</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            We are excited to inform you that you have been elected to the IEEE at UCSD general board for the 2025-2026 academic year for the following position:
          </p>

          <div style="background: #f7fafc; border-left: 4px solid #0A2463; padding: 15px; margin: 20px 0;">
            <p style="font-size: 20px; font-weight: bold; color: #0A2463; margin: 0;">
              ${data.position}
            </p>
            <p style="font-size: 14px; color: #718096; margin: 5px 0 0 0;">
              ${data.role}
            </p>
          </div>

          ${
            data.message
              ? `
            <p style="font-size: 16px; margin: 20px 0; padding: 15px; background: #edf2f7; border-radius: 8px;">
              ${data.message}
            </p>
          `
              : ""
          }

          <p style="font-size: 16px; margin: 20px 0;">
            Please respond by <strong>${data.acceptanceDeadline || "the end of the week"}</strong> with your decision on accepting the position.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptLink}"
               style="display: inline-block; background: #0A2463; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Accept Position
            </a>
          </div>

          <p style="font-size: 14px; color: #718096; margin: 20px 0;">
            Or copy and paste this link into your browser:<br>
            <a href="${acceptLink}" style="color: #0A2463; word-break: break-all;">${acceptLink}</a>
          </p>

          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="font-size: 14px; color: #166534; margin: 0;">
              <strong>What happens next?</strong><br>
              If you choose to accept the position, we will begin onboarding as soon as possible to get you up to speed on tasks and give you access to everything you need. There will be a follow-up email detailing your next steps.
            </p>
          </div>

          <p style="font-size: 16px; margin: 20px 0;">
            Please be sure to come to our IEEE Project Space sometime! It's on the 4th floor of Jacobs Hall/EBU1 in EBU1-4710 (Turn left after exiting the elevators and go to the very end; it's the last hallway on your left). We can't wait to see you and support you throughout the year!
          </p>

          ${
            data.leaderName
              ? `
            <p style="font-size: 16px; margin: 20px 0;">
              Your Team Lead will be <strong>${data.leaderName}</strong>, who will be working with you throughout the year.
            </p>
          `
              : ""
          }
        </div>

        <div style="text-align: center; padding: 20px; color: #718096; font-size: 14px;">
          <p style="margin: 5px 0;">IEEE at UC San Diego</p>
          <p style="margin: 5px 0;">Questions? Reply to this email or contact us at <a href="mailto:${replyToEmail}" style="color: #0A2463;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [data.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log(`✅ Invitation email sent to ${data.email}`);
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0A2463; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to IEEE at UCSD!</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.7;">
${emailBody}
          </div>
        </div>

        <div style="text-align: center; padding: 20px; color: #718096; font-size: 14px;">
          <p style="margin: 5px 0;">IEEE at UC San Diego</p>
          <p style="margin: 5px 0;">Questions? Reply to this email or contact us at <a href="mailto:${replyToEmail}" style="color: #0A2463;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [data.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log(`✅ Direct onboarding email sent to ${data.email}`);
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #10b981; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome Aboard!</h1>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hi ${data.name},
          </p>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Thank you for accepting the position of <strong>${data.position}</strong>! We're thrilled to have you on the IEEE at UCSD team.
          </p>

          <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <p style="font-size: 14px; color: #166534; margin: 0;">
              <strong>Your onboarding process has begun!</strong><br>
              You've been added to the appropriate Google Groups and granted officer permissions in our system.
            </p>
          </div>

          <p style="font-size: 16px; margin: 20px 0;">
            You will receive a separate email with detailed onboarding instructions, including:
          </p>

          <ul style="font-size: 15px; line-height: 1.8; color: #4b5563;">
            <li>How to join our Slack workspace</li>
            <li>Access to Google Drive and shared documents</li>
            <li>Information about IEEE membership</li>
            <li>Next steps and important dates</li>
          </ul>

          <p style="font-size: 16px; margin: 20px 0;">
            In the meantime, feel free to explore our dashboard at <a href="https://ieeeatucsd.org/dashboard" style="color: #0A2463;">ieeeatucsd.org/dashboard</a>
          </p>

          <p style="font-size: 16px; margin: 20px 0;">
            We're excited to work with you this year!
          </p>
        </div>

        <div style="text-align: center; padding: 20px; color: #718096; font-size: 14px;">
          <p style="margin: 5px 0;">IEEE at UC San Diego</p>
          <p style="margin: 5px 0;">Questions? Reply to this email or contact us at <a href="mailto:${replyToEmail}" style="color: #0A2463;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [data.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log(`✅ Acceptance confirmation email sent to ${data.email}`);
    return true;
  } catch (error) {
    console.error("Error sending acceptance confirmation email:", error);
    return false;
  }
}
