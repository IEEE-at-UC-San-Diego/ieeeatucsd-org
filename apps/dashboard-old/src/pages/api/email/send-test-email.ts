import type { APIRoute } from "astro";
import { Resend } from "resend";
import {
  generateEmailTemplate,
  createDetailRow,
  createInfoBox,
  formatCurrency,
  formatDate,
  IEEE_COLORS,
} from "../../../scripts/email/templates/EmailTemplate";

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { testEmail, emailType } = await request.json();

    if (!testEmail || !emailType) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const resendApiKey = import.meta.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Resend API key not configured",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail =
      "IEEE at UC San Diego <noreply@transactional.ieeeatucsd.org>";

    let emailHtml = "";
    let subject = "";

    // Generate test email based on type
    switch (emailType) {
      case "reimbursement_submission":
        subject = "[TEST] Reimbursement Submitted: Test Workshop Supplies";
        emailHtml = generateReimbursementSubmissionTestEmail();
        break;

      case "reimbursement_status_change_approved":
        subject = "[TEST] Reimbursement Approved: Test Workshop Supplies";
        emailHtml = generateReimbursementStatusChangeTestEmail("approved");
        break;

      case "reimbursement_status_change_rejected":
        subject = "[TEST] Reimbursement Rejected: Test Workshop Supplies";
        emailHtml = generateReimbursementStatusChangeTestEmail("rejected");
        break;

      case "reimbursement_status_change_paid":
        subject = "[TEST] Reimbursement Paid: Test Workshop Supplies";
        emailHtml = generateReimbursementStatusChangeTestEmail("paid");
        break;

      case "audit_request":
        subject = "[TEST] Audit Request: Test Workshop Supplies";
        emailHtml = generateAuditRequestTestEmail();
        break;

      case "event_submission":
        subject = "[TEST] New Event Request: Test Tech Workshop";
        emailHtml = generateEventSubmissionTestEmail();
        break;

      case "event_status_change":
        subject = "[TEST] Event Status Changed: Test Tech Workshop";
        emailHtml = generateEventStatusChangeTestEmail();
        break;

      case "event_edit":
        subject = "[TEST] Event Updated: Test Tech Workshop";
        emailHtml = generateEventEditTestEmail();
        break;

      case "event_delete":
        subject = "[TEST] Event Deleted: Test Tech Workshop";
        emailHtml = generateEventDeleteTestEmail();
        break;

      case "graphics_upload":
        subject = "[TEST] Graphics Uploaded: Test Tech Workshop";
        emailHtml = generateGraphicsUploadTestEmail();
        break;

      case "fund_deposit_submission":
        subject = "[TEST] Fund Deposit Submitted: Test Sponsorship";
        emailHtml = generateFundDepositSubmissionTestEmail();
        break;

      case "fund_deposit_status_change":
        subject = "[TEST] Fund Deposit Approved: Test Sponsorship";
        emailHtml = generateFundDepositStatusChangeTestEmail();
        break;

      case "user_profile_update":
        subject = "[TEST] Your Profile Has Been Updated";
        emailHtml = generateUserProfileUpdateTestEmail();
        break;

      case "user_role_change":
        subject =
          "[TEST] Congratulations! You've Been Promoted to Executive Officer";
        emailHtml = generateUserRoleChangeTestEmail();
        break;

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown email type: ${emailType}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    // Send test email
    console.log(`📧 Sending test email with type: ${emailType}`);
    console.log(`📧 Subject: ${subject}`);
    console.log(`📧 From: ${fromEmail}`);

    const result = await resend.emails.send({
      from: fromEmail,
      to: [testEmail],
      subject: subject,
      html: emailHtml,
    });

    console.log(`✅ Resend API response:`, result);

    if (result.error) {
      console.error(`❌ Resend API error:`, result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Resend API error: ${result.error.message || JSON.stringify(result.error)}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test email sent successfully",
        emailId: result.data?.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ Error sending test email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

// Test email generators
function generateReimbursementSubmissionTestEmail(): string {
  const detailsHtml = `
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Title", "Test Workshop Supplies")}
      ${createDetailRow("Amount", formatCurrency(125.5))}
      ${createDetailRow("Department", "Technical")}
      ${createDetailRow("Submitted By", "Test User (test.user@ucsd.edu)")}
      ${createDetailRow("Submission Date", formatDate(new Date()))}
    </div>
  `;

  const bodyContent = `
    <h2>New Reimbursement Request</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>A new reimbursement request has been submitted and requires your review.</p>
    ${detailsHtml}
    ${createInfoBox('<p style="margin: 0;">This is test data generated for email testing purposes.</p>', "info")}
  `;

  return generateEmailTemplate({
    title: "New Reimbursement Request",
    preheader: "A new reimbursement request has been submitted",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-REIMB-001",
    contactEmail: "treasurer@ieeeatucsd.org",
    ctaButton: {
      text: "Review Reimbursement",
      url: "https://ieeeatucsd.org/manage-reimbursements",
    },
  });
}

function generateReimbursementStatusChangeTestEmail(status: string): string {
  let statusColor = IEEE_COLORS.primary;
  let statusText = status;
  let statusMessage = "";

  switch (status) {
    case "approved":
      statusColor = IEEE_COLORS.success;
      statusText = "Approved";
      statusMessage =
        "Your reimbursement request has been approved and is being processed for payment.";
      break;
    case "rejected":
      statusColor = IEEE_COLORS.danger;
      statusText = "Rejected";
      statusMessage = "Your reimbursement request has been rejected.";
      break;
    case "paid":
      statusColor = IEEE_COLORS.success;
      statusText = "Paid";
      statusMessage = "Your reimbursement has been paid!";
      break;
  }

  const detailsHtml = `
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Title", "Test Workshop Supplies")}
      ${createDetailRow("Amount", formatCurrency(125.5))}
      ${createDetailRow("Previous Status", "Pending")}
      ${createDetailRow("New Status", `<span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>`)}
      ${createDetailRow("Changed By", "Test Admin")}
    </div>
  `;

  const bodyContent = `
    <h2>Reimbursement Status Update</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>${statusMessage}</p>
    ${detailsHtml}
    ${status === "rejected" ? createInfoBox('<p style="margin: 0;"><strong>Rejection Reason:</strong> This is a test rejection reason for demonstration purposes.</p>', "danger") : ""}
  `;

  return generateEmailTemplate({
    title: `Reimbursement ${statusText}`,
    preheader: `Your reimbursement request has been ${statusText.toLowerCase()}`,
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-REIMB-001",
    contactEmail: "treasurer@ieeeatucsd.org",
    ctaButton: {
      text: "View Reimbursement",
      url: "https://ieeeatucsd.org/reimbursement",
    },
  });
}

function generateAuditRequestTestEmail(): string {
  const bodyContent = `
    <h2>Audit Request</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>An executive has requested additional information for a reimbursement.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Reimbursement", "Test Workshop Supplies")}
      ${createDetailRow("Amount", formatCurrency(125.5))}
      ${createDetailRow("Requested By", "Test Executive")}
    </div>
    ${createInfoBox('<p style="margin: 0;"><strong>Audit Note:</strong> Please provide additional receipts for the workshop supplies purchase.</p>', "warning")}
  `;

  return generateEmailTemplate({
    title: "Audit Request",
    preheader: "Additional information requested for your reimbursement",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-REIMB-001",
    contactEmail: "treasurer@ieeeatucsd.org",
    ctaButton: {
      text: "View Reimbursement",
      url: "https://ieeeatucsd.org/reimbursement",
    },
  });
}

function generateEventSubmissionTestEmail(): string {
  const bodyContent = `
    <h2>New Event Request Submitted</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>A new event request has been submitted for review.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Event Name", "Test Tech Workshop")}
      ${createDetailRow("Location", "Jacobs Hall 4309")}
      ${createDetailRow("Start Date", formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))}
      ${createDetailRow("Expected Attendance", "50 people")}
      ${createDetailRow("Submitted By", "Test User")}
    </div>
  `;

  return generateEmailTemplate({
    title: "New Event Request",
    preheader: "A new event request has been submitted",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-EVENT-001",
    contactEmail: "events@ieeeatucsd.org",
    ctaButton: {
      text: "Review Event",
      url: "https://ieeeatucsd.org/manage-events",
    },
  });
}

function generateEventStatusChangeTestEmail(): string {
  const bodyContent = `
    <h2>Event Status Changed</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>Your event request status has been updated to <strong style="color: ${IEEE_COLORS.success};">Approved</strong>.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Event Name", "Test Tech Workshop")}
      ${createDetailRow("Previous Status", "Pending")}
      ${createDetailRow("New Status", '<span style="color: ' + IEEE_COLORS.success + '; font-weight: 600;">Approved</span>')}
      ${createDetailRow("Changed By", "Test Operations Officer")}
    </div>
  `;

  return generateEmailTemplate({
    title: "Event Status Changed",
    preheader: "Your event request has been approved",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-EVENT-001",
    contactEmail: "events@ieeeatucsd.org",
    ctaButton: {
      text: "View Event",
      url: "https://ieeeatucsd.org/manage-events",
    },
  });
}

function generateEventEditTestEmail(): string {
  const bodyContent = `
    <h2>Event Updated</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>Your event has been updated.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Event Name", "Test Tech Workshop")}
      ${createDetailRow("Updated By", "Test Operations Officer")}
    </div>
    ${createInfoBox('<p style="margin: 0;"><strong>Changes:</strong> Location changed from "Jacobs Hall 4309" to "Price Center East Ballroom"</p>', "info")}
  `;

  return generateEmailTemplate({
    title: "Event Updated",
    preheader: "Your event has been updated",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-EVENT-001",
    contactEmail: "events@ieeeatucsd.org",
    ctaButton: {
      text: "View Event",
      url: "https://ieeeatucsd.org/manage-events",
    },
  });
}

function generateEventDeleteTestEmail(): string {
  const bodyContent = `
    <h2>Event Deleted</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>An event has been deleted from the system.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Event Name", "Test Tech Workshop")}
      ${createDetailRow("Location", "Jacobs Hall 4309")}
      ${createDetailRow("Deleted By", "Test Admin")}
    </div>
  `;

  return generateEmailTemplate({
    title: "Event Deleted",
    preheader: "An event has been deleted",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    contactEmail: "events@ieeeatucsd.org",
  });
}

function generateGraphicsUploadTestEmail(): string {
  const bodyContent = `
    <h2>Graphics Files Uploaded</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>Graphics files have been uploaded for your event.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Event Name", "Test Tech Workshop")}
      ${createDetailRow("Files Uploaded", "3")}
      ${createDetailRow("Uploaded By", "Test Graphics Officer")}
    </div>
  `;

  return generateEmailTemplate({
    title: "Graphics Uploaded",
    preheader: "Graphics files have been uploaded for your event",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-EVENT-001",
    contactEmail: "events@ieeeatucsd.org",
    ctaButton: {
      text: "View Event",
      url: "https://ieeeatucsd.org/manage-events",
    },
  });
}

function generateFundDepositSubmissionTestEmail(): string {
  const bodyContent = `
    <h2>New Fund Deposit Submitted</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>A new fund deposit has been submitted for review.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Title", "Test Sponsorship")}
      ${createDetailRow("Amount", formatCurrency(500.0))}
      ${createDetailRow("Source", "Corporate Sponsor")}
      ${createDetailRow("Submitted By", "Test User")}
    </div>
  `;

  return generateEmailTemplate({
    title: "New Fund Deposit",
    preheader: "A new fund deposit has been submitted",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-FUND-001",
    contactEmail: "treasurer@ieeeatucsd.org",
    ctaButton: {
      text: "Review Deposit",
      url: "https://ieeeatucsd.org/manage-fund-deposits",
    },
  });
}

function generateFundDepositStatusChangeTestEmail(): string {
  const bodyContent = `
    <h2>Fund Deposit Status Changed</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>Your fund deposit has been approved.</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Title", "Test Sponsorship")}
      ${createDetailRow("Amount", formatCurrency(500.0))}
      ${createDetailRow("Previous Status", "Pending")}
      ${createDetailRow("New Status", '<span style="color: ' + IEEE_COLORS.success + '; font-weight: 600;">Approved</span>')}
    </div>
  `;

  return generateEmailTemplate({
    title: "Fund Deposit Approved",
    preheader: "Your fund deposit has been approved",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    referenceId: "TEST-FUND-001",
    contactEmail: "treasurer@ieeeatucsd.org",
    ctaButton: {
      text: "View Deposit",
      url: "https://ieeeatucsd.org/fund-deposits",
    },
  });
}

function generateUserProfileUpdateTestEmail(): string {
  const changesHtml = `
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <div style="font-weight: 600; color: ${IEEE_COLORS.gray[700]}; margin-bottom: 8px;">Major</div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="flex: 1;">
          <div style="font-size: 12px; color: ${IEEE_COLORS.gray[500]}; margin-bottom: 4px;">Previous Value</div>
          <div style="color: ${IEEE_COLORS.gray[600]};">Computer Science</div>
        </div>
        <div style="color: ${IEEE_COLORS.gray[400]};">→</div>
        <div style="flex: 1;">
          <div style="font-size: 12px; color: ${IEEE_COLORS.gray[500]}; margin-bottom: 4px;">New Value</div>
          <div style="color: ${IEEE_COLORS.primary}; font-weight: 600;">Electrical Engineering</div>
        </div>
      </div>
    </div>
  `;

  const bodyContent = `
    <h2>Your Profile Has Been Updated</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>Your IEEE UCSD profile has been updated by Test Admin.</p>
    <h3 style="color: ${IEEE_COLORS.gray[700]}; margin-top: 24px; margin-bottom: 12px;">Changes Made:</h3>
    ${changesHtml}
  `;

  return generateEmailTemplate({
    title: "Profile Updated",
    preheader: "Your IEEE UCSD profile has been updated",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    contactEmail: "ieee@ucsd.edu",
    ctaButton: {
      text: "View Profile",
      url: "https://ieeeatucsd.org/dashboard",
    },
  });
}

function generateUserRoleChangeTestEmail(): string {
  const bodyContent = `
    <h2>Congratulations!</h2>
    <p><strong>⚠️ THIS IS A TEST EMAIL</strong></p>
    <p>You have been promoted to Executive Officer!</p>
    <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${createDetailRow("Previous Role", "General Officer")}
      ${createDetailRow("New Role", '<span style="color: ' + IEEE_COLORS.success + '; font-weight: 600;">Executive Officer</span>')}
      ${createDetailRow("Changed By", "Test Admin")}
    </div>
    ${createInfoBox('<p style="margin: 0;">With your new role, you now have access to additional features and responsibilities in the IEEE UCSD dashboard.</p>', "success")}
  `;

  return generateEmailTemplate({
    title: "Congratulations on Your Promotion!",
    preheader: "You have been promoted to Executive Officer",
    headerText: "IEEE at UC San Diego",
    bodyContent,
    contactEmail: "ieee@ucsd.edu",
    ctaButton: {
      text: "Access Dashboard",
      url: "https://ieeeatucsd.org/dashboard",
    },
  });
}
