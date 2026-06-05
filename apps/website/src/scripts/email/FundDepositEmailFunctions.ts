import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";

export async function sendFundDepositSubmissionEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: { depositId: string },
): Promise<boolean> {
  try {
    const db = getFirestore(app);

    const depositDoc = await db
      .collection("fundDeposits")
      .doc(data.depositId)
      .get();
    if (!depositDoc.exists) return false;
    const deposit = { id: depositDoc.id, ...depositDoc.data() } as any;

    const userDoc = deposit.depositedBy
      ? await db.collection("users").doc(deposit.depositedBy).get()
      : null;
    const user = userDoc?.exists
      ? { id: userDoc!.id, ...userDoc!.data() }
      : ({ email: deposit.depositedByEmail || "" } as any);

    const financeEmail = "treasurer@ieeeatucsd.org";
    const subjectFinance = `New Fund Deposit Submitted: ${deposit.title}`;
    const subjectUser = `Deposit Submitted: ${deposit.title}`;

    const formatCurrency = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(n || 0);

    const detailsHtml = `
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="font-weight:600;width:140px">Amount</td><td>${formatCurrency(deposit.amount)}</td></tr>
        <tr><td style="font-weight:600">Date</td><td>${deposit.depositDate}</td></tr>
        <tr><td style="font-weight:600">Method</td><td>${deposit.depositMethod}${deposit.otherDepositMethod ? ` (${deposit.otherDepositMethod})` : ""}</td></tr>
        <tr><td style="font-weight:600">Purpose</td><td>${deposit.purpose || "—"}</td></tr>
        <tr><td style="font-weight:600">Reference #</td><td>${deposit.referenceNumber || "—"}</td></tr>
      </table>
    `;

    const baseWrap = (title: string, body: string) => `
      <!doctype html><html><body>
        <div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
          <div style="padding:16px 0"><h2 style="margin:0">${title}</h2></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">${body}</div>
          <p style="color:#64748b;font-size:12px;margin-top:16px">Deposit ID: <code>${deposit.id}</code></p>
        </div>
      </body></html>
    `;

    // Finance email
    await resend.emails.send({
      from: fromEmail,
      to: [financeEmail],
      replyTo: user.email || replyToEmail,
      subject: subjectFinance,
      html: baseWrap(
        "New Fund Deposit Submitted",
        `
          <p>A new fund deposit has been submitted and is pending verification.</p>
          <p><strong>Submitted By:</strong> ${user.name || user.email || "Unknown"}</p>
          ${detailsHtml}
        `,
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
          "Thanks! We've received your deposit",
          `
            <p>Your deposit has been submitted and is pending verification by finance.</p>
            ${detailsHtml}
          `,
        ),
      });
    }

    return true;
  } catch (e) {
    console.error("Fund deposit submission email failed", e);
    return false;
  }
}

export async function sendFundDepositStatusChangeEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: { depositId: string; newStatus: string; rejectionReason?: string },
): Promise<boolean> {
  try {
    const db = getFirestore(app);

    const depositDoc = await db
      .collection("fundDeposits")
      .doc(data.depositId)
      .get();
    if (!depositDoc.exists) return false;
    const deposit = { id: depositDoc.id, ...depositDoc.data() } as any;

    const userDoc = deposit.depositedBy
      ? await db.collection("users").doc(deposit.depositedBy).get()
      : null;
    const user = userDoc?.exists
      ? { id: userDoc!.id, ...userDoc!.data() }
      : ({ email: deposit.depositedByEmail || "" } as any);

    const subject = `Deposit ${data.newStatus === "verified" ? "Verified" : data.newStatus === "rejected" ? "Rejected" : data.newStatus}: ${deposit.title}`;

    const body = `
      <p>Your fund deposit "<strong>${deposit.title}</strong>" status has been updated to <strong>${data.newStatus}</strong>.</p>
      ${data.newStatus === "rejected" && data.rejectionReason ? `<p><strong>Reason:</strong> ${data.rejectionReason}</p>` : ""}
    `;

    if (user.email) {
      await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        replyTo: replyToEmail,
        subject,
        html: `<!doctype html><html><body><div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">${body}</div><p style="color:#64748b;font-size:12px;margin-top:16px">Deposit ID: <code>${deposit.id}</code></p></div></body></html>`,
      });
    }

    return true;
  } catch (e) {
    console.error("Fund deposit status email failed", e);
    return false;
  }
}
