import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";
import {
  generateEmailTemplate,
  createDetailRow,
  createInfoBox,
  IEEE_COLORS,
} from "./templates/EmailTemplate";

const CATEGORY_LABELS: Record<string, string> = {
  event: "Event",
  travel: "Travel",
  equipment: "Equipment",
  software: "Software",
  other: "Other",
};

const FUNDING_SOURCE_LABELS: Record<string, string> = {
  department: "Department/Student Org Funds",
  ieee: "IEEE Chapter Funds",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );

export async function sendFundRequestSubmissionEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: { requestId: string },
): Promise<boolean> {
  try {
    const db = getFirestore(app);

    const requestDoc = await db
      .collection("fundRequests")
      .doc(data.requestId)
      .get();
    if (!requestDoc.exists) return false;
    const fundRequest = { id: requestDoc.id, ...requestDoc.data() } as any;

    const userDoc = fundRequest.submittedBy
      ? await db.collection("users").doc(fundRequest.submittedBy).get()
      : null;
    const user = userDoc?.exists
      ? { id: userDoc!.id, ...userDoc!.data() }
      : ({ email: fundRequest.submittedByEmail || "" } as any);

    const financeEmail = "treasurer@ieeeatucsd.org";
    const subjectFinance = `New Fund Request: ${fundRequest.title}`;
    const subjectUser = `Fund Request Submitted: ${fundRequest.title}`;

    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${createDetailRow("Amount", formatCurrency(fundRequest.amount))}
        ${createDetailRow("Category", CATEGORY_LABELS[fundRequest.category] || fundRequest.category)}
        ${createDetailRow("Submitted By", `${fundRequest.submittedByName || "Unknown"} (${fundRequest.submittedByEmail || ""})`)}
        ${createDetailRow("Vendor Links", `${fundRequest.vendorLinks?.length || 0} link(s)`)}
        ${createDetailRow("Attachments", `${fundRequest.attachments?.length || 0} file(s)`)}
      </div>
      
      ${fundRequest.purpose ? createInfoBox(`<h4 style="margin:0 0 8px 0;color:${IEEE_COLORS.gray[800]}">Purpose / Justification</h4><p style="margin:0;white-space:pre-wrap">${fundRequest.purpose}</p>`, "info") : ""}
    `;

    // Finance email
    const financeHtml = generateEmailTemplate({
      title: "New Fund Request Submitted",
      preheader: `New fund request from ${user.name || "Unknown"}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>Fund Request Submitted</h2>
        <p>A new fund request has been submitted and requires your review.</p>
        <h3 style="color: ${IEEE_COLORS.primary}; border-bottom: 2px solid ${IEEE_COLORS.success}; padding-bottom: 8px;">${fundRequest.title}</h3>
        ${detailsHtml}
      `,
      referenceId: fundRequest.id,
      contactEmail: "treasurer@ieeeatucsd.org",
      ctaButton: {
        text: "Review Request",
        url: "https://ieeeatucsd.org/manage-fund-requests",
      },
    });

    await resend.emails.send({
      from: fromEmail,
      to: [financeEmail],
      replyTo: user.email || replyToEmail,
      subject: subjectFinance,
      html: financeHtml,
    });

    // User confirmation
    if (user.email) {
      const userHtml = generateEmailTemplate({
        title: "Fund Request Submitted",
        preheader: "Your fund request has been submitted",
        headerText: "IEEE at UC San Diego",
        bodyContent: `
          <h2>Fund Request Submitted</h2>
          <p>Hello ${user.name || "there"},</p>
          <p>Your fund request "<strong>${fundRequest.title}</strong>" has been successfully submitted and is now under review.</p>
          ${detailsHtml}
          
          <div style="margin-top: 24px;">
            <h4 style="color: ${IEEE_COLORS.primary}; margin-bottom: 8px;">What Happens Next?</h4>
            <ul style="color: ${IEEE_COLORS.gray[700]}; margin-top: 0;">
              <li>An executive officer will review your request.</li>
              <li>You'll receive email updates as the status changes.</li>
              <li>We may contact you if we need additional information.</li>
            </ul>
          </div>
        `,
        referenceId: fundRequest.id,
        contactEmail: "treasurer@ieeeatucsd.org",
        ctaButton: {
          text: "View Your Request",
          url: "https://ieeeatucsd.org/fund-requests",
        },
      });

      await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        replyTo: replyToEmail,
        subject: subjectUser,
        html: userHtml,
      });
    }

    console.log("Fund request submission emails sent successfully!");
    return true;
  } catch (e) {
    console.error("Fund request submission email failed", e);
    return false;
  }
}

export async function sendFundRequestStatusChangeEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: {
    requestId: string;
    newStatus: string;
    reviewNotes?: string;
    infoRequestNotes?: string;
    selectedFundingSource?: string;
    reviewerName?: string;
  },
): Promise<boolean> {
  try {
    const db = getFirestore(app);

    const requestDoc = await db
      .collection("fundRequests")
      .doc(data.requestId)
      .get();
    if (!requestDoc.exists) return false;
    const fundRequest = { id: requestDoc.id, ...requestDoc.data() } as any;

    const userDoc = fundRequest.submittedBy
      ? await db.collection("users").doc(fundRequest.submittedBy).get()
      : null;
    const user = userDoc?.exists
      ? { id: userDoc!.id, ...userDoc!.data() }
      : ({ email: fundRequest.submittedByEmail || "" } as any);

    if (!user.email) {
      console.log(
        "No user email found for fund request status change notification",
      );
      return false;
    }

    let title = "Fund Request Update";
    let statusText = data.newStatus;
    let bodyContent = "";

    switch (data.newStatus) {
      case "approved":
        title = "Fund Request Approved";
        statusText = "Approved";
        bodyContent = `
          <p>Great news! Your fund request "<strong>${fundRequest.title}</strong>" has been <strong style="color:${IEEE_COLORS.success}">approved</strong>.</p>
          
          <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 16px; margin: 16px 0;">
            ${createDetailRow("Amount Approved", formatCurrency(fundRequest.amount))}
            ${data.selectedFundingSource ? createDetailRow("Funding Source", FUNDING_SOURCE_LABELS[data.selectedFundingSource] || data.selectedFundingSource) : ""}
            ${data.reviewNotes ? createDetailRow("Notes", data.reviewNotes) : ""}
          </div>
          
          <p>You may now proceed with your purchase. Keep all receipts for reimbursement.</p>
        `;
        break;

      case "denied":
        title = "Fund Request Denied";
        statusText = "Denied";
        bodyContent = `
          <p>Unfortunately, your fund request "<strong>${fundRequest.title}</strong>" has been <strong style="color:${IEEE_COLORS.danger}">denied</strong>.</p>
          ${data.reviewNotes ? createInfoBox(`<p style="margin:0"><strong>Reason:</strong> ${data.reviewNotes}</p>`, "danger") : ""}
          <p>If you have questions or would like to discuss this decision, please contact the finance team at <a href="mailto:treasurer@ieeeatucsd.org" style="color:${IEEE_COLORS.primary}">treasurer@ieeeatucsd.org</a>.</p>
        `;
        break;

      case "needs_info":
        title = "Additional Information Needed";
        statusText = "Needs Information";
        bodyContent = `
          <p>Your fund request "<strong>${fundRequest.title}</strong>" requires additional information before it can be processed.</p>
          ${data.infoRequestNotes ? createInfoBox(`<h4 style="margin:0 0 8px 0;">Question from Reviewer:</h4><p style="margin:0">${data.infoRequestNotes}</p>`, "warning") : ""}
          <p>Please log in to your dashboard to provide the requested information and resubmit your request.</p>
        `;
        break;

      default:
        statusText = data.newStatus
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        bodyContent = `
          <p>Your fund request "<strong>${fundRequest.title}</strong>" status has been updated to <strong>${statusText}</strong>.</p>
        `;
    }

    const subject = `Fund Request ${statusText}: ${fundRequest.title}`;

    const html = generateEmailTemplate({
      title,
      preheader: `Fund request status update: ${statusText}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>${title}</h2>
        <p>Hello ${user.name || "there"},</p>
        ${bodyContent}
        
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid ${IEEE_COLORS.gray[200]}; color: ${IEEE_COLORS.gray[500]}; font-size: 13px;">
          <p style="margin:0">
            <strong>Request:</strong> ${fundRequest.title}<br>
            <strong>Amount:</strong> ${formatCurrency(fundRequest.amount)}<br>
            ${data.reviewerName ? `<strong>Reviewed by:</strong> ${data.reviewerName}` : ""}
          </p>
        </div>
      `,
      referenceId: fundRequest.id,
      contactEmail: "treasurer@ieeeatucsd.org",
      ctaButton:
        data.newStatus === "needs_info"
          ? {
            text: "Update Your Request",
            url: "https://ieeeatucsd.org/fund-requests",
          }
          : undefined,
    });

    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log(`Fund request status change email sent (${data.newStatus})`);
    return true;
  } catch (e) {
    console.error("Fund request status change email failed", e);
    return false;
  }
}
