import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";
import {
  generateEmailTemplate,
  createDetailRow,
  IEEE_COLORS,
} from "./templates/EmailTemplate";

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
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${createDetailRow("Amount", formatCurrency(deposit.amount))}
        ${createDetailRow("Date", deposit.depositDate)}
        ${createDetailRow("Method", `${deposit.depositMethod}${deposit.otherDepositMethod ? ` (${deposit.otherDepositMethod})` : ""}`)}
        ${createDetailRow("Purpose", deposit.purpose || "—")}
        ${createDetailRow("Reference #", deposit.referenceNumber || "—")}
      </div>
    `;

    // Finance email
    const financeHtml = generateEmailTemplate({
      title: "New Fund Deposit Submitted",
      preheader: `New fund deposit from ${user.name || user.email || "Unknown"}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>New Fund Deposit Submitted</h2>
        <p>A new fund deposit has been submitted and is pending verification.</p>
        <p><strong>Submitted By:</strong> ${user.name || user.email || "Unknown"}</p>
        ${detailsHtml}
      `,
      referenceId: deposit.id,
      contactEmail: "treasurer@ieeeatucsd.org",
      ctaButton: {
        text: "Verify Deposit",
        url: "https://ieeeatucsd.org/manage-deposits",
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
        title: "Deposit Submitted",
        preheader: "Your deposit has been submitted",
        headerText: "IEEE at UC San Diego",
        bodyContent: `
          <h2>Thanks! We've received your deposit</h2>
          <p>Your deposit has been submitted and is pending verification by finance.</p>
          ${detailsHtml}
        `,
        referenceId: deposit.id,
        contactEmail: "treasurer@ieeeatucsd.org",
      });

      await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        replyTo: replyToEmail,
        subject: subjectUser,
        html: userHtml,
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

    const bodyContent = `
      <p>Your fund deposit "<strong>${deposit.title}</strong>" status has been updated to <strong>${data.newStatus}</strong>.</p>
      ${data.newStatus === "rejected" && data.rejectionReason ? `<p><strong>Reason:</strong> ${data.rejectionReason}</p>` : ""}
    `;

    if (user.email) {
      const html = generateEmailTemplate({
        title: "Deposit Status Update",
        preheader: `Deposit status updated to ${data.newStatus}`,
        headerText: "IEEE at UC San Diego",
        bodyContent,
        referenceId: deposit.id,
        contactEmail: "treasurer@ieeeatucsd.org",
      });

      await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        replyTo: replyToEmail,
        subject,
        html,
      });
    }

    return true;
  } catch (e) {
    console.error("Fund deposit status email failed", e);
    return false;
  }
}

