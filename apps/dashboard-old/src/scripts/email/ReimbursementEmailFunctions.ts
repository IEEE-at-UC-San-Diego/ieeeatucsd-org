import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { app as adminApp } from "../../firebase/server";
import {
  generateEmailTemplate,
  createDetailRow,
  createInfoBox,
  formatCurrency,
  formatDate,
  IEEE_COLORS,
} from "./templates/EmailTemplate";

// Helper function to calculate receipt subtotal from line items
function calculateReceiptSubtotal(receipt: any): number {
  let subtotal = receipt.subtotal || 0;
  if (subtotal === 0 && receipt.lineItems && receipt.lineItems.length > 0) {
    subtotal = receipt.lineItems.reduce(
      (sum: number, item: any) => sum + (item.amount || 0),
      0,
    );
  }
  return subtotal;
}

// Helper function to calculate total for a single receipt
function calculateReceiptTotal(receipt: any): number {
  if (receipt.total && receipt.total > 0) {
    return receipt.total;
  }
  // Fallback: calculate from components
  const subtotal = calculateReceiptSubtotal(receipt);
  return (
    subtotal +
    (receipt.tax || 0) +
    (receipt.tip || 0) +
    (receipt.shipping || 0) +
    (receipt.otherCharges || 0)
  );
}

// Helper function to calculate total amount for a reimbursement
function calculateReimbursementTotal(reimbursement: any): number {
  // Handle new multi-receipt structure
  if (reimbursement.receipts && reimbursement.receipts.length > 0) {
    return reimbursement.receipts.reduce((sum: number, receipt: any) => {
      return sum + calculateReceiptTotal(receipt);
    }, 0);
  }
  // Handle legacy expenses structure
  if (reimbursement.expenses && reimbursement.expenses.length > 0) {
    return reimbursement.expenses.reduce((sum: number, expense: any) => {
      return sum + (expense.amount || 0);
    }, 0);
  }
  return 0;
}

export async function sendReimbursementSubmissionEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: any,
): Promise<boolean> {
  try {
    console.log("Starting reimbursement submission email process...");

    // Use Admin SDK for server-side operations
    const db = getAdminFirestore(adminApp);

    // Get reimbursement details
    const reimbursementDoc = await db
      .collection("reimbursements")
      .doc(data.reimbursementId)
      .get();
    if (!reimbursementDoc.exists) {
      console.error("Reimbursement not found:", data.reimbursementId);
      return false;
    }

    const reimbursement = {
      id: reimbursementDoc.id,
      ...reimbursementDoc.data(),
    } as any;

    // Get user details
    const userDoc = await db
      .collection("users")
      .doc(reimbursement.submittedBy)
      .get();
    if (!userDoc.exists) {
      console.error("User not found:", reimbursement.submittedBy);
      return false;
    }

    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const treasurerEmail = "treasurer@ieeeatucsd.org";
    const treasurerSubject = `New Reimbursement Request Submitted: ${reimbursement.title}`;
    const userSubject = `Your Reimbursement Request Has Been Submitted: ${reimbursement.title}`;

    const totalAmount = calculateReimbursementTotal(reimbursement);

    // Build details HTML
    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${createDetailRow("Title", reimbursement.title)}
        ${createDetailRow("Submitted By", `${user.name} (${user.email})`)}
        ${createDetailRow("Department", reimbursement.department.charAt(0).toUpperCase() + reimbursement.department.slice(1))}
        ${createDetailRow("Total Amount", formatCurrency(totalAmount))}
        ${createDetailRow("Purchase Date", reimbursement.dateOfPurchase)}
        ${createDetailRow("Payment Method", reimbursement.paymentMethod)}
        ${createDetailRow("Status", "Submitted for Review")}
        ${createDetailRow("Submitted At", formatDate(new Date()))}
      </div>
      
      ${reimbursement.businessPurpose ? createInfoBox(`<h4 style="margin:0 0 8px 0;color:${IEEE_COLORS.gray[800]}">Business Purpose</h4><p style="margin:0">${reimbursement.businessPurpose}</p>`, "info") : ""}
      
      ${reimbursement.additionalInfo ? createInfoBox(`<h4 style="margin:0 0 8px 0;color:${IEEE_COLORS.gray[800]}">Additional Information</h4><p style="margin:0">${reimbursement.additionalInfo}</p>`, "info") : ""}

      <div style="margin-top: 20px;">
        <h3 style="color: ${IEEE_COLORS.gray[700]}; margin-bottom: 12px;">Expenses</h3>
        ${(reimbursement.expenses || [])
        .map(
          (expense: any) => `
          <div style="background: white; border: 1px solid ${IEEE_COLORS.gray[200]}; border-radius: 4px; padding: 12px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; color: ${IEEE_COLORS.gray[800]};">${expense.description}</span>
              <span style="font-weight: 600; color: ${IEEE_COLORS.primary};">${formatCurrency(expense.amount)}</span>
            </div>
            <div style="font-size: 14px; color: ${IEEE_COLORS.gray[500]};">
              Category: ${expense.category} ${expense.receipt ? "• Receipt Attached" : ""}
            </div>
          </div>
        `,
        )
        .join("")}
      </div>
    `;

    // Email to treasurer
    const treasurerHtml = generateEmailTemplate({
      title: "New Reimbursement Request",
      preheader: `New reimbursement request from ${user.name}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>Reimbursement Submitted for Review</h2>
        <p>A new reimbursement request has been submitted and requires your review.</p>
        ${detailsHtml}
      `,
      referenceId: reimbursement.id,
      contactEmail: "treasurer@ieeeatucsd.org",
      ctaButton: {
        text: "Review Reimbursement",
        url: "https://ieeeatucsd.org/manage-reimbursements",
      },
    });

    // Email to user (confirmation)
    const userHtml = generateEmailTemplate({
      title: "Reimbursement Submitted",
      preheader: "Your reimbursement request has been submitted",
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>Thank you for your submission!</h2>
        <p>Your reimbursement request "<strong>${reimbursement.title}</strong>" has been successfully submitted and is now under review by our treasurer team.</p>
        ${detailsHtml}
        
        <div style="margin-top: 24px;">
           <h4 style="color: ${IEEE_COLORS.primary}; margin-bottom: 8px;">What Happens Next?</h4>
           <ul style="color: ${IEEE_COLORS.gray[700]}; margin-top: 0;">
             <li>Our treasurer team will review your request and receipts.</li>
             <li>You'll receive email updates as the status changes.</li>
             <li>We may contact you if we need additional information.</li>
           </ul>
        </div>
      `,
      referenceId: reimbursement.id,
      contactEmail: "treasurer@ieeeatucsd.org",
      ctaButton: {
        text: "Track Request",
        url: "https://ieeeatucsd.org/reimbursement",
      },
    });

    // Send to treasurer
    await resend.emails.send({
      from: fromEmail,
      to: [treasurerEmail],
      replyTo: user.email,
      subject: treasurerSubject,
      html: treasurerHtml,
    });

    // Send confirmation to user
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log("Reimbursement submission emails sent successfully!");
    return true;
  } catch (error) {
    console.error("Failed to send reimbursement submission emails:", error);
    return false;
  }
}

export async function sendAuditRequestEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: any,
): Promise<boolean> {
  try {
    console.log("Starting audit request email process with data:", data);

    if (!data.reimbursementId || !data.auditorId) {
      console.error("Missing required data for audit request:", {
        reimbursementId: data.reimbursementId,
        auditorId: data.auditorId,
      });
      return false;
    }

    // Use Admin SDK for server-side operations
    const db = getAdminFirestore(adminApp);

    // Get reimbursement details
    const reimbursementDoc = await db
      .collection("reimbursements")
      .doc(data.reimbursementId)
      .get();
    if (!reimbursementDoc.exists) {
      console.error("Reimbursement not found:", data.reimbursementId);
      return false;
    }

    const reimbursement = {
      id: reimbursementDoc.id,
      ...reimbursementDoc.data(),
    } as any;

    // Get auditor details
    const auditorDoc = await db.collection("users").doc(data.auditorId).get();
    if (!auditorDoc.exists) {
      console.error("Auditor not found:", data.auditorId);
      return false;
    }

    const auditor = { id: auditorDoc.id, ...auditorDoc.data() } as any;

    // Get submitter details
    const submitterDoc = await db
      .collection("users")
      .doc(reimbursement.submittedBy)
      .get();
    if (!submitterDoc.exists) {
      console.error("Submitter not found:", reimbursement.submittedBy);
      return false;
    }

    const submitter = { id: submitterDoc.id, ...submitterDoc.data() } as any;

    const subject = `Audit Requested: ${reimbursement.title}`;
    const totalAmount = calculateReimbursementTotal(reimbursement);

    const auditHtml = generateEmailTemplate({
      title: "Audit Request",
      preheader: "Reimbursement audit requested",
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>Reimbursement Audit Requested</h2>
        <p>Hello ${auditor.name || auditor.email},</p>
        <p>A fellow executive officer has requested your review for the following reimbursement request:</p>
        
        <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
          ${createDetailRow("Title", reimbursement.title)}
          ${createDetailRow("Submitted By", submitter.name || submitter.email)}
          ${createDetailRow("Department", reimbursement.department.charAt(0).toUpperCase() + reimbursement.department.slice(1))}
          ${createDetailRow("Total Amount", formatCurrency(totalAmount))}
          ${createDetailRow("Status", "Under Review")}
        </div>

        ${data.requestNote ? createInfoBox(`<h4 style="margin:0 0 8px 0;color:${IEEE_COLORS.warning}">Request Message</h4><p style="margin:0">${data.requestNote}</p>`, "warning") : ""}
        
        <p>Please log in to the reimbursement management portal to review, approve, or decline this request.</p>
      `,
      referenceId: reimbursement.id,
      contactEmail: "treasurer@ieeeatucsd.org",
      ctaButton: {
        text: "Review Reimbursement",
        url: "https://ieeeatucsd.org/manage-reimbursements",
      },
    });

    // Send audit request email to the selected auditor
    console.log("Sending email to:", auditor.email);
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: [auditor.email],
      replyTo: replyToEmail,
      subject: subject,
      html: auditHtml,
    });

    console.log("Audit request email sent successfully!", emailResult);
    return true;
  } catch (error) {
    console.error("Failed to send audit request email:", error);
    return false;
  }
}

export async function sendReimbursementStatusChangeEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: {
    reimbursementId: string;
    newStatus: string;
    previousStatus?: string;
    changedByUserId?: string;
    rejectionReason?: string;
    paymentConfirmation?: any;
    approvedAmount?: number;
    partialReason?: string;
  },
): Promise<boolean> {
  try {
    console.log("Starting reimbursement status change email process...");

    const db = getAdminFirestore(adminApp);

    // Get reimbursement details
    const reimbursementDoc = await db
      .collection("reimbursements")
      .doc(data.reimbursementId)
      .get();
    if (!reimbursementDoc.exists) {
      console.error("❌ Reimbursement not found:", data.reimbursementId);
      return false;
    }

    const reimbursement = {
      id: reimbursementDoc.id,
      ...reimbursementDoc.data(),
    } as any;

    // Get submitter details
    const submitterDoc = await db
      .collection("users")
      .doc(reimbursement.submittedBy)
      .get();
    if (!submitterDoc.exists) {
      console.error("❌ Submitter not found:", reimbursement.submittedBy);
      return false;
    }
    const submitter = { id: submitterDoc.id, ...submitterDoc.data() } as any;

    // Get user who made the change
    let changedByName = "System";
    if (data.changedByUserId) {
      const changedByDoc = await db
        .collection("users")
        .doc(data.changedByUserId)
        .get();
      if (changedByDoc.exists) {
        const changedByData = changedByDoc.data();
        changedByName =
          changedByData?.name || changedByData?.email || "Unknown User";
      }
    }

    // Determine email content based on status
    let statusColor = IEEE_COLORS.primary;
    let statusText = data.newStatus;
    let statusMessage = "";

    const approvedAmount = data.approvedAmount ?? reimbursement.approvedAmount;
    const partialReason = data.partialReason ?? reimbursement.partialReason;

    switch (data.newStatus) {
      case "approved":
        if (partialReason || (approvedAmount !== undefined && approvedAmount < calculateReimbursementTotal(reimbursement))) {
          statusColor = IEEE_COLORS.warning; // Or specific color for partial?
          statusText = "Partially Approved";
          statusMessage = `Your reimbursement request has been approved for a partial amount of ${formatCurrency(approvedAmount || 0)}. It is being processed for payment.`;
        } else {
          statusColor = IEEE_COLORS.success;
          statusText = "Approved";
          statusMessage =
            "Your reimbursement request has been approved and is being processed for payment.";
        }
        break;
      case "rejected":
      case "declined":
        statusColor = IEEE_COLORS.danger;
        statusText = "Rejected";
        statusMessage =
          "Your reimbursement request has been rejected. Please review the reason below and contact the finance team if you have questions.";
        break;
      case "paid":
        statusColor = IEEE_COLORS.success;
        statusText = "Paid";
        statusMessage =
          "Your reimbursement has been paid! Please check your payment method for the funds.";
        break;
      case "under_review":
        statusColor = IEEE_COLORS.warning;
        statusText = "Under Review";
        statusMessage =
          "Your reimbursement is currently under review by an executive.";
        break;
      default:
        statusText = data.newStatus
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        statusMessage = `Your reimbursement status has been updated to ${statusText}.`;
    }

    const totalAmount = calculateReimbursementTotal(reimbursement);

    // Build details section
    let detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${createDetailRow("Reimbursement Title", reimbursement.title)}
        ${createDetailRow("Requested Amount", formatCurrency(totalAmount))}
        ${approvedAmount && approvedAmount !== totalAmount ? createDetailRow("Approved Amount", formatCurrency(approvedAmount)) : ""}
        ${createDetailRow("Department", reimbursement.department.charAt(0).toUpperCase() + reimbursement.department.slice(1))}
        ${createDetailRow("Previous Status", data.previousStatus ? data.previousStatus.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "N/A")}
        ${createDetailRow("New Status", `<span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>`)}
        ${createDetailRow("Changed By", changedByName)}
      </div>
    `;

    // Add partial reason if applicable
    if (partialReason) {
      detailsHtml += createInfoBox(
        `
        <h4 style="margin: 0 0 8px 0; color: ${IEEE_COLORS.warning};">Partial Approval Notes</h4>
        <p style="margin: 0;">${partialReason}</p>
      `,
        "warning",
      );
    }

    // Add rejection reason if applicable
    if (data.rejectionReason) {
      detailsHtml += createInfoBox(
        `
        <h4 style="margin: 0 0 8px 0; color: ${IEEE_COLORS.danger};">Rejection Reason</h4>
        <p style="margin: 0;">${data.rejectionReason}</p>
      `,
        "danger",
      );
    }

    // Add payment confirmation if applicable
    if (data.paymentConfirmation) {
      const paidAtDate = data.paymentConfirmation.paidAt?.toDate
        ? data.paymentConfirmation.paidAt.toDate()
        : new Date(data.paymentConfirmation.paidAt);

      detailsHtml += createInfoBox(
        `
        <h4 style="margin: 0 0 8px 0; color: ${IEEE_COLORS.success};">Payment Confirmation</h4>
        ${data.paymentConfirmation.confirmationNumber ? `<p style="margin: 4px 0;"><strong>Confirmation Number:</strong> ${data.paymentConfirmation.confirmationNumber}</p>` : ""}
        ${data.paymentConfirmation.paidByName ? `<p style="margin: 4px 0;"><strong>Paid By:</strong> ${data.paymentConfirmation.paidByName}</p>` : ""}
        ${data.paymentConfirmation.paidAt ? `<p style="margin: 4px 0;"><strong>Paid At:</strong> ${formatDate(paidAtDate)}</p>` : ""}
      `,
        "success",
      );
    }

    const bodyContent = `
      <h2>Reimbursement Status Update</h2>
      <p>${statusMessage}</p>
      ${detailsHtml}
      ${data.newStatus === "rejected" || data.newStatus === "declined"
        ? `
        <p style="margin-top: 20px;">If you believe this rejection was made in error or have additional information to provide, please contact the finance team at <a href="mailto:treasurer@ieeeatucsd.org" style="color: ${IEEE_COLORS.primary};">treasurer@ieeeatucsd.org</a>.</p>
      `
        : ""
      }
    `;

    const emailHtml = generateEmailTemplate({
      title: `Reimbursement ${statusText}`,
      preheader: `Your reimbursement request has been ${statusText.toLowerCase()}`,
      headerText: "IEEE at UC San Diego",
      bodyContent,
      referenceId: reimbursement.id,
      contactEmail: "treasurer@ieeeatucsd.org",
      ctaButton: {
        text: "View Reimbursement Details",
        url: "https://ieeeatucsd.org/reimbursement",
      },
    });

    // Send email to submitter
    await resend.emails.send({
      from: fromEmail,
      to: [submitter.email],
      replyTo: replyToEmail,
      subject: `Reimbursement ${statusText}: ${reimbursement.title}`,
      html: emailHtml,
    });

    console.log("Reimbursement status change email sent successfully!");
    return true;
  } catch (error) {
    console.error(
      "Failed to send reimbursement status change email:",
      error,
    );
    return false;
  }
}
