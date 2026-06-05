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
    console.log("💰 Starting reimbursement submission email process...");

    // Use Admin SDK for server-side operations
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

    // Get user details
    const userDoc = await db
      .collection("users")
      .doc(reimbursement.submittedBy)
      .get();
    if (!userDoc.exists) {
      console.error("❌ User not found:", reimbursement.submittedBy);
      return false;
    }

    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const treasurerEmail = "treasurer@ieeeatucsd.org";
    const treasurerSubject = `New Reimbursement Request Submitted: ${reimbursement.title}`;
    const userSubject = `Your Reimbursement Request Has Been Submitted: ${reimbursement.title}`;

    const formatDateTime = (timestamp: any) => {
      if (!timestamp) return "Not specified";
      try {
        const date = timestamp.toDate
          ? timestamp.toDate()
          : new Date(timestamp);
        return date.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (error) {
        return "Invalid date";
      }
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    };

    // Email to treasurer
    const treasurerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${treasurerSubject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .header { background: #003B5C; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px; }
          .expense-item { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 0; border-bottom: 1px solid #eee; }
          .status-badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: white; margin: 0; font-size: 24px;">💰 New Reimbursement Request</h1>
          </div>
          
          <div class="content">
            <h2 style="margin-top: 0; color: #2c3e50;">Reimbursement Submitted for Review</h2>
            <p>A new reimbursement request has been submitted and requires your review.</p>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057; border-bottom: 2px solid #28a745; padding-bottom: 10px;">${reimbursement.title}</h3>
              
              <table>
                <tr>
                  <td style="font-weight: bold; width: 120px;">Submitted By</td>
                  <td>${user.name} (${user.email})</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Department</td>
                  <td style="text-transform: capitalize;">${reimbursement.department}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Total Amount</td>
                  <td style="color: #28a745; font-weight: bold; font-size: 16px;">${formatCurrency(calculateReimbursementTotal(reimbursement))}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Purchase Date</td>
                  <td>${reimbursement.dateOfPurchase}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Payment Method</td>
                  <td>${reimbursement.paymentMethod}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Status</td>
                  <td><span class="status-badge">Submitted for Review</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #495057;">Organization Purpose</h4>
              <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${reimbursement.businessPurpose}</p>
            </div>

            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #495057;">Itemized Expenses (${reimbursement.expenses?.length || 0} items)</h4>
              ${
                reimbursement.expenses
                  ?.map(
                    (expense: any, index: number) => `
                <div class="expense-item">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <strong>${expense.description}</strong>
                    <span style="color: #28a745; font-weight: bold;">${formatCurrency(expense.amount)}</span>
                  </div>
                  <div style="color: #6c757d; font-size: 14px;">
                    Category: ${expense.category}
                    ${expense.receipt ? " • Receipt attached ✓" : " • No receipt"}
                  </div>
                </div>
              `,
                  )
                  .join("") || "<p>No expenses listed</p>"
              }
            </div>

            ${
              reimbursement.additionalInfo
                ? `
              <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #495057;">Additional Information</h4>
                <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${reimbursement.additionalInfo}</p>
              </div>
            `
                : ""
            }
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #155724; font-size: 16px;">📋 Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.7;">
                <li>Review the reimbursement request details</li>
                <li>Verify all receipts and documentation</li>
                <li>Contact the submitter if clarification is needed</li>
                <li>Update the request status in the dashboard</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Reference ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${reimbursement.id}</code></p>
            <p>Access the dashboard at <a href="https://ieeeatucsd.org/dashboard/manage-reimbursements" style="color: #28a745; text-decoration: none;">ieeeatucsd.org/dashboard</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Reimbursement Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Email to user (confirmation)
    const userHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${userSubject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .header { background: #003B5C; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px; }
          .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 0; border-bottom: 1px solid #eee; }
          .status-badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Reimbursement Submitted</h1>
          </div>
          
          <div class="content">
            <h2 style="margin-top: 0; color: #2c3e50;">Thank you for your submission!</h2>
            <p>Hello ${user.name},</p>
            <p>Your reimbursement request "<strong>${reimbursement.title}</strong>" has been successfully submitted and is now under review by our treasurer team.</p>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Request Summary</h3>
              
              <table>
                <tr>
                  <td style="font-weight: bold; width: 120px;">Title</td>
                  <td>${reimbursement.title}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Department</td>
                  <td style="text-transform: capitalize;">${reimbursement.department}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Total Amount</td>
                  <td style="color: #28a745; font-weight: bold; font-size: 16px;">${formatCurrency(calculateReimbursementTotal(reimbursement))}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Expenses</td>
                  <td>${reimbursement.expenses?.length || 0} item${(reimbursement.expenses?.length || 0) !== 1 ? "s" : ""}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Status</td>
                  <td><span class="status-badge">Submitted for Review</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #1d4ed8; font-size: 16px;">⏱️ What Happens Next?</h4>
              <ul style="margin: 0; padding-left: 20px; color: #1d4ed8; line-height: 1.7;">
                <li>Our treasurer team will review your request and receipts</li>
                <li>You'll receive email updates as the status changes</li>
                <li>We may contact you if we need additional information</li>
                <li>Typical review time is 5-7 business days</li>
                <li>Approved requests are processed for payment weekly</li>
              </ul>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>💡 Tip:</strong> You can track your reimbursement status anytime by visiting your dashboard.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Reference ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${reimbursement.id}</code></p>
            <p>Questions? Contact us at <a href="mailto:treasurer@ieeeatucsd.org" style="color: #3b82f6; text-decoration: none;">treasurer@ieeeatucsd.org</a></p>
            <p>Track your request: <a href="https://ieeeatucsd.org/dashboard/reimbursement" style="color: #3b82f6; text-decoration: none;">Dashboard</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Reimbursement Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

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

    console.log("✅ Reimbursement submission emails sent successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to send reimbursement submission emails:", error);
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
    console.log("🔍 Starting audit request email process with data:", data);

    if (!data.reimbursementId || !data.auditorId) {
      console.error("❌ Missing required data for audit request:", {
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
      console.error("❌ Reimbursement not found:", data.reimbursementId);
      return false;
    }

    const reimbursement = {
      id: reimbursementDoc.id,
      ...reimbursementDoc.data(),
    } as any;

    // Get auditor details
    const auditorDoc = await db.collection("users").doc(data.auditorId).get();
    if (!auditorDoc.exists) {
      console.error("❌ Auditor not found:", data.auditorId);
      return false;
    }

    const auditor = { id: auditorDoc.id, ...auditorDoc.data() } as any;

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

    const subject = `Audit Requested: ${reimbursement.title}`;

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    };

    const formatDateTime = (timestamp: any) => {
      if (!timestamp) return "Not specified";
      try {
        const date = timestamp.toDate
          ? timestamp.toDate()
          : new Date(timestamp);
        return date.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (error) {
        return "Invalid date";
      }
    };

    const auditRequestHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .header { background: #003B5C; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px; }
          .expense-item { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 0; border-bottom: 1px solid #eee; }
          .audit-badge { background: #8b5cf6; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔍 Audit Request</h1>
          </div>
          
          <div class="content">
            <h2 style="margin-top: 0; color: #2c3e50;">Reimbursement Audit Requested</h2>
            <p>Hello ${auditor.name || auditor.email},</p>
            <p>A fellow executive officer has requested your review for the following reimbursement request:</p>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px;">Reimbursement Details</h3>
              
              <table>
                <tr>
                  <td style="font-weight: bold; width: 140px;">Title</td>
                  <td>${reimbursement.title}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Submitted By</td>
                  <td>${submitter.name || submitter.email}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Department</td>
                  <td style="text-transform: capitalize;">${reimbursement.department}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Total Amount</td>
                  <td style="color: #8b5cf6; font-weight: bold; font-size: 16px;">${formatCurrency(calculateReimbursementTotal(reimbursement))}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Date of Purchase</td>
                  <td>${reimbursement.dateOfPurchase}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Status</td>
                  <td><span class="audit-badge">Under Review</span></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Submitted</td>
                  <td>${formatDateTime(reimbursement.submittedAt)}</td>
                </tr>
              </table>
            </div>
            
            ${
              data.requestNote
                ? `
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #856404;">Request Message</h4>
                <p style="margin: 0; color: #856404;">${data.requestNote}</p>
              </div>
            `
                : ""
            }
            
            <div style="background: #e7f3ff; border: 1px solid #b3d4fc; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #004085;">Next Steps</h4>
              <ol style="margin: 0; padding-left: 20px; color: #004085;">
                <li>Review the reimbursement details and supporting documentation</li>
                <li>Log into the reimbursement management portal</li>
                <li>Approve, decline, or request additional information</li>
                <li>The system will automatically notify all relevant parties</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://ieeeatucsd.org/dashboard/manage-reimbursements"
                 style="background: #003B5C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                Review Reimbursement
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from IEEE UCSD Reimbursement System.</p>
            <p>If you have any questions, please contact the requesting executive or <a href="mailto:treasurer@ieeeatucsd.org" style="color: #8b5cf6;">treasurer@ieeeatucsd.org</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send audit request email to the selected auditor
    console.log("📧 Sending email to:", auditor.email);
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: [auditor.email],
      replyTo: replyToEmail,
      subject: subject,
      html: auditRequestHtml,
    });

    console.log("✅ Audit request email sent successfully!", emailResult);
    return true;
  } catch (error) {
    console.error("❌ Failed to send audit request email:", error);
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
    console.log("📧 Starting reimbursement status change email process...");

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
        if (
          partialReason ||
          (approvedAmount !== undefined &&
            approvedAmount < calculateReimbursementTotal(reimbursement))
        ) {
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
      ${
        data.newStatus === "rejected" || data.newStatus === "declined"
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
        url: "https://ieeeatucsd.org/dashboard/reimbursement",
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

    console.log("✅ Reimbursement status change email sent successfully!");
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to send reimbursement status change email:",
      error,
    );
    return false;
  }
}
