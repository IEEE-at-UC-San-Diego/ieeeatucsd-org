import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";

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

const baseWrap = (title: string, body: string, refId: string) => `
  <!doctype html><html><body>
    <div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
      <div style="background:#003B5C;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:white">${title}</h2>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;padding:20px">${body}</div>
      <p style="color:#64748b;font-size:12px;margin-top:16px;text-align:center">
        Request ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${refId}</code>
      </p>
      <p style="color:#94a3b8;font-size:11px;text-align:center">IEEE at UC San Diego - Fund Request System</p>
    </div>
  </body></html>
`;

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
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="font-weight:600;width:140px;padding:8px 0;border-bottom:1px solid #e2e8f0">Amount</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#16a34a;font-weight:600">${formatCurrency(fundRequest.amount)}</td></tr>
        <tr><td style="font-weight:600;padding:8px 0;border-bottom:1px solid #e2e8f0">Category</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${CATEGORY_LABELS[fundRequest.category] || fundRequest.category}</td></tr>
        <tr><td style="font-weight:600;padding:8px 0;border-bottom:1px solid #e2e8f0">Submitted By</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fundRequest.submittedByName || "Unknown"} (${fundRequest.submittedByEmail || ""})</td></tr>
        <tr><td style="font-weight:600;padding:8px 0;border-bottom:1px solid #e2e8f0">Vendor Links</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fundRequest.vendorLinks?.length || 0} link(s)</td></tr>
        <tr><td style="font-weight:600;padding:8px 0;border-bottom:1px solid #e2e8f0">Attachments</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fundRequest.attachments?.length || 0} file(s)</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f1f5f9;border-radius:6px">
        <p style="margin:0 0 8px 0;font-weight:600;font-size:14px">Purpose / Justification:</p>
        <p style="margin:0;white-space:pre-wrap">${fundRequest.purpose}</p>
      </div>
    `;

    // Finance email
    await resend.emails.send({
      from: fromEmail,
      to: [financeEmail],
      replyTo: user.email || replyToEmail,
      subject: subjectFinance,
      html: baseWrap(
        "💰 New Fund Request Submitted",
        `
          <p style="margin:0 0 16px 0">A new fund request has been submitted and requires your review.</p>
          <h3 style="margin:0 0 12px 0;color:#1e293b;border-bottom:2px solid #22c55e;padding-bottom:8px">${fundRequest.title}</h3>
          ${detailsHtml}
          <div style="margin-top:24px;text-align:center">
            <a href="https://ieeeatucsd.org/dashboard/manage-fund-requests" style="background:#003B5C;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;display:inline-block">Review Request</a>
          </div>
        `,
        fundRequest.id,
      ),
    });

    // User confirmation
    if (user.email) {
      await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        replyTo: replyToEmail,
        subject: subjectUser,
        html: baseWrap(
          "✅ Fund Request Submitted",
          `
            <p style="margin:0 0 16px 0">Hello ${user.name || "there"},</p>
            <p style="margin:0 0 16px 0">Your fund request "<strong>${fundRequest.title}</strong>" has been successfully submitted and is now under review.</p>
            <h3 style="margin:0 0 12px 0;color:#1e293b;border-bottom:2px solid #3b82f6;padding-bottom:8px">Request Summary</h3>
            ${detailsHtml}
            <div style="margin-top:20px;padding:16px;background:#dbeafe;border:1px solid #bfdbfe;border-radius:8px">
              <h4 style="margin:0 0 8px 0;color:#1d4ed8">⏱️ What Happens Next?</h4>
              <ul style="margin:0;padding-left:20px;color:#1d4ed8;line-height:1.7">
                <li>An executive officer will review your request</li>
                <li>You'll receive email updates as the status changes</li>
                <li>You may be contacted if additional information is needed</li>
              </ul>
            </div>
            <div style="margin-top:24px;text-align:center">
              <a href="https://ieeeatucsd.org/dashboard/fund-requests" style="background:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;display:inline-block">View Your Request</a>
            </div>
          `,
          fundRequest.id,
        ),
      });
    }

    console.log("✅ Fund request submission emails sent successfully!");
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

    let emoji = "📋";
    let title = "Fund Request Update";
    let statusColor = "#64748b";
    let statusText = data.newStatus;
    let bodyContent = "";

    switch (data.newStatus) {
      case "approved":
        emoji = "✅";
        title = "Fund Request Approved!";
        statusColor = "#16a34a";
        statusText = "Approved";
        bodyContent = `
          <p style="margin:0 0 16px 0">Great news! Your fund request "<strong>${fundRequest.title}</strong>" has been <strong style="color:${statusColor}">approved</strong>.</p>
          <div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0"><strong>Amount Approved:</strong> ${formatCurrency(fundRequest.amount)}</p>
            ${data.selectedFundingSource ? `<p style="margin:8px 0 0 0"><strong>Funding Source:</strong> ${FUNDING_SOURCE_LABELS[data.selectedFundingSource] || data.selectedFundingSource}</p>` : ""}
            ${data.reviewNotes ? `<p style="margin:8px 0 0 0"><strong>Notes:</strong> ${data.reviewNotes}</p>` : ""}
          </div>
          <p style="margin:16px 0 0 0">You may now proceed with your purchase. Keep all receipts for reimbursement.</p>
        `;
        break;

      case "denied":
        emoji = "❌";
        title = "Fund Request Denied";
        statusColor = "#dc2626";
        statusText = "Denied";
        bodyContent = `
          <p style="margin:0 0 16px 0">Unfortunately, your fund request "<strong>${fundRequest.title}</strong>" has been <strong style="color:${statusColor}">denied</strong>.</p>
          ${
            data.reviewNotes
              ? `
            <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0"><strong>Reason:</strong> ${data.reviewNotes}</p>
            </div>
          `
              : ""
          }
          <p style="margin:16px 0 0 0">If you have questions or would like to discuss this decision, please contact the finance team at <a href="mailto:treasurer@ieeeatucsd.org" style="color:#3b82f6">treasurer@ieeeatucsd.org</a>.</p>
        `;
        break;

      case "needs_info":
        emoji = "❓";
        title = "Additional Information Needed";
        statusColor = "#d97706";
        statusText = "Needs Information";
        bodyContent = `
          <p style="margin:0 0 16px 0">Your fund request "<strong>${fundRequest.title}</strong>" requires additional information before it can be processed.</p>
          ${
            data.infoRequestNotes
              ? `
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0 0 8px 0;font-weight:600;color:#92400e">Question from Reviewer:</p>
              <p style="margin:0;color:#92400e">${data.infoRequestNotes}</p>
            </div>
          `
              : ""
          }
          <p style="margin:16px 0 0 0">Please log in to your dashboard to provide the requested information and resubmit your request.</p>
          <div style="margin-top:24px;text-align:center">
            <a href="https://ieeeatucsd.org/dashboard/fund-requests" style="background:#d97706;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;display:inline-block">Update Your Request</a>
          </div>
        `;
        break;

      default:
        statusText = data.newStatus
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        bodyContent = `
          <p style="margin:0 0 16px 0">Your fund request "<strong>${fundRequest.title}</strong>" status has been updated to <strong>${statusText}</strong>.</p>
        `;
    }

    const subject = `${emoji} Fund Request ${statusText}: ${fundRequest.title}`;

    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject,
      html: baseWrap(
        `${emoji} ${title}`,
        `
          <p style="margin:0 0 8px 0;color:#64748b;font-size:14px">Hello ${user.name || "there"},</p>
          ${bodyContent}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:13px;color:#64748b">
              <strong>Request:</strong> ${fundRequest.title}<br>
              <strong>Amount:</strong> ${formatCurrency(fundRequest.amount)}<br>
              ${data.reviewerName ? `<strong>Reviewed by:</strong> ${data.reviewerName}` : ""}
            </p>
          </div>
        `,
        fundRequest.id,
      ),
    });

    console.log(`✅ Fund request status change email sent (${data.newStatus})`);
    return true;
  } catch (e) {
    console.error("Fund request status change email failed", e);
    return false;
  }
}
