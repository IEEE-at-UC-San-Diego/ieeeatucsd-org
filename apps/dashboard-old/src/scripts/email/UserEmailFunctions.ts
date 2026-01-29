import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";
import {
  generateEmailTemplate,
  createDetailRow,
  createInfoBox,
  IEEE_COLORS,
} from "./templates/EmailTemplate";

export async function sendUserProfileUpdateEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: {
    userId: string;
    changes: Array<{ field: string; oldValue: string; newValue: string }>;
    changedByUserId: string;
  },
): Promise<boolean> {
  try {
    console.log("Starting user profile update email process...");

    const db = getFirestore(app);

    // Get user details
    const userDoc = await db.collection("users").doc(data.userId).get();
    if (!userDoc.exists) {
      console.error("User not found:", data.userId);
      return false;
    }
    const user = { id: userDoc.id, ...userDoc.data() } as any;

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

    // Build changes list
    const changesHtml = data.changes
      .map((change) => {
        const fieldName = change.field
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();

        return `
        <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <div style="font-weight: 600; color: ${IEEE_COLORS.gray[700]}; margin-bottom: 8px;">${fieldName}</div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="flex: 1;">
              <div style="font-size: 12px; color: ${IEEE_COLORS.gray[500]}; margin-bottom: 4px;">Previous Value</div>
              <div style="color: ${IEEE_COLORS.gray[600]};">${change.oldValue || "Not set"}</div>
            </div>
            <div style="color: ${IEEE_COLORS.gray[400]};">→</div>
            <div style="flex: 1;">
              <div style="font-size: 12px; color: ${IEEE_COLORS.gray[500]}; margin-bottom: 4px;">New Value</div>
              <div style="color: ${IEEE_COLORS.primary}; font-weight: 600;">${change.newValue}</div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    const bodyContent = `
      <h2>Your Profile Has Been Updated</h2>
      <p>Your IEEE UCSD profile information has been updated by ${changedByName}.</p>
      
      <h3 style="color: ${IEEE_COLORS.gray[700]}; margin-top: 24px; margin-bottom: 12px;">Changes Made:</h3>
      ${changesHtml}
      
      ${createInfoBox(
      `
        <p style="margin: 0;">If you believe these changes were made in error or have any questions, please contact the administrator at <a href="mailto:ieee@ucsd.edu" style="color: ${IEEE_COLORS.primary};">ieee@ucsd.edu</a>.</p>
      `,
      "info",
    )}
    `;

    const emailHtml = generateEmailTemplate({
      title: "Profile Updated",
      preheader: "Your IEEE UCSD profile has been updated",
      headerText: "IEEE at UC San Diego",
      bodyContent,
      contactEmail: "ieee@ucsd.edu",
      ctaButton: {
        text: "View Your Profile",
        url: "https://ieeeatucsd.org/dashboard",
      },
    });

    // Send email to user
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: "Your IEEE UCSD Profile Has Been Updated",
      html: emailHtml,
    });

    console.log("User profile update email sent successfully!");
    return true;
  } catch (error) {
    console.error("Failed to send user profile update email:", error);
    return false;
  }
}

export async function sendUserRoleChangeEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: {
    userId: string;
    oldRole: string;
    newRole: string;
    changedByUserId: string;
  },
): Promise<boolean> {
  try {
    console.log("Starting user role change email process...");

    const db = getFirestore(app);

    // Get user details
    const userDoc = await db.collection("users").doc(data.userId).get();
    if (!userDoc.exists) {
      console.error("User not found:", data.userId);
      return false;
    }
    const user = { id: userDoc.id, ...userDoc.data() } as any;

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

    // Determine if this is a promotion or demotion
    const roleHierarchy = [
      "Member",
      "General Officer",
      "Executive Officer",
      "Administrator",
    ];
    const oldRoleIndex = roleHierarchy.indexOf(data.oldRole);
    const newRoleIndex = roleHierarchy.indexOf(data.newRole);
    const isPromotion = newRoleIndex > oldRoleIndex;

    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${createDetailRow("Previous Role", data.oldRole)}
        ${createDetailRow("New Role", `<span style="color: ${isPromotion ? IEEE_COLORS.success : IEEE_COLORS.warning}; font-weight: 600;">${data.newRole}</span>`)}
        ${createDetailRow("Changed By", changedByName)}
      </div>
    `;

    const bodyContent = `
      <h2>${isPromotion ? "Congratulations!" : "Role Update"}</h2>
      <p>${isPromotion
        ? `You have been promoted to ${data.newRole}! This is a recognition of your contributions to IEEE UCSD.`
        : `Your role has been updated to ${data.newRole}.`
      }</p>
      ${detailsHtml}
      ${isPromotion
        ? createInfoBox(
          `
        <p style="margin: 0;">With your new role, you now have access to additional features and responsibilities in the IEEE UCSD dashboard. Log in to explore your new permissions.</p>
      `,
          "success",
        )
        : ""
      }
    `;

    const emailHtml = generateEmailTemplate({
      title: isPromotion ? "Congratulations on Your Promotion!" : "Role Update",
      preheader: `Your role has been updated to ${data.newRole}`,
      headerText: "IEEE at UC San Diego",
      bodyContent,
      contactEmail: "ieee@ucsd.edu",
      ctaButton: {
        text: "Access Dashboard",
        url: "https://ieeeatucsd.org/dashboard",
      },
    });

    // Send email to user
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: isPromotion
        ? `Congratulations! You've Been Promoted to ${data.newRole}`
        : `Your Role Has Been Updated to ${data.newRole}`,
      html: emailHtml,
    });

    console.log("User role change email sent successfully!");
    return true;
  } catch (error) {
    console.error("Failed to send user role change email:", error);
    return false;
  }
}
