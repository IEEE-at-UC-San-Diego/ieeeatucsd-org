import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";
import {
  generateEmailTemplate,
  createDetailRow,
  createInfoBox,
  formatDate,
  IEEE_COLORS,
} from "./templates/EmailTemplate";

export async function sendFirebaseEventRequestSubmissionEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: any,
): Promise<boolean> {
  try {
    console.log(
      "Starting Firebase event request submission email process...",
    );

    const db = getFirestore(app);

    // Get event request details
    const eventRequestDoc = await db
      .collection("event_requests")
      .doc(data.eventRequestId)
      .get();
    if (!eventRequestDoc.exists) {
      console.error("Event request not found");
      return false;
    }

    const eventRequest = {
      id: eventRequestDoc.id,
      ...eventRequestDoc.data(),
    } as any;

    // Get user details
    const userDoc = await db
      .collection("users")
      .doc(eventRequest.requestedUser)
      .get();
    if (!userDoc.exists) {
      console.error("User not found");
      return false;
    }

    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const eventsEmail = "events@ieeeatucsd.org";
    const eventsSubject = `New Event Request Submitted: ${eventRequest.name}`;
    const userSubject = `Your Event Request Has Been Submitted: ${eventRequest.name}`;

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
          timeZone: "America/Los_Angeles",
        });
      } catch (error) {
        return "Invalid date";
      }
    };

    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${createDetailRow("Event Name", eventRequest.name)}
        ${createDetailRow("Location", eventRequest.location)}
        ${createDetailRow("Start Date", formatDateTime(eventRequest.startDateTime))}
        ${createDetailRow("End Date", formatDateTime(eventRequest.endDateTime))}
        ${createDetailRow("Attendance", eventRequest.expectedAttendance || "Not specified")}
        ${createDetailRow("Department", eventRequest.department || "General")}
        ${createDetailRow("Submitted By", `${user.name || user.email} (${user.email})`)}
      </div>

      ${eventRequest.eventDescription ? createInfoBox(`<h4 style="margin:0 0 8px 0;color:${IEEE_COLORS.gray[800]}">Description</h4><p style="margin:0;white-space:pre-wrap">${eventRequest.eventDescription}</p>`, "info") : ""}

      ${eventRequest.needsGraphics ||
        eventRequest.needsAsFunding ||
        eventRequest.flyersNeeded ||
        (eventRequest.flyerType && eventRequest.flyerType.length > 0) ||
        eventRequest.photographyNeeded
        ? `
        <div style="margin-top: 20px; background: white; border: 1px solid ${IEEE_COLORS.gray[200]}; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; color: ${IEEE_COLORS.gray[800]};">Special Requirements</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${eventRequest.needsGraphics || (eventRequest.flyerType && eventRequest.flyerType.length > 0) ? `<span style="background:${IEEE_COLORS.gray[100]};color:${IEEE_COLORS.gray[800]};padding:4px 8px;border-radius:12px;font-size:12px;font-weight:500">Graphics Required</span>` : ""}
            ${eventRequest.needsAsFunding ? `<span style="background:${IEEE_COLORS.gray[100]};color:${IEEE_COLORS.gray[800]};padding:4px 8px;border-radius:12px;font-size:12px;font-weight:500">AS Funding</span>` : ""}
            ${eventRequest.flyersNeeded || (eventRequest.flyerType && eventRequest.flyerType.length > 0) ? `<span style="background:${IEEE_COLORS.gray[100]};color:${IEEE_COLORS.gray[800]};padding:4px 8px;border-radius:12px;font-size:12px;font-weight:500">Flyers Needed</span>` : ""}
            ${eventRequest.photographyNeeded ? `<span style="background:${IEEE_COLORS.gray[100]};color:${IEEE_COLORS.gray[800]};padding:4px 8px;border-radius:12px;font-size:12px;font-weight:500">Photography</span>` : ""}
          </div>
        </div>
        `
        : ""
      }
    `;

    // Create beautiful HTML template for events team
    const eventsHtml = generateEmailTemplate({
      title: "New Event Request",
      preheader: `New event request from ${user.name || user.email}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>Review Required</h2>
        <p>A new event request has been submitted by <strong>${user.name || user.email}</strong> and requires your review.</p>
        ${detailsHtml}
      `,
      referenceId: eventRequest.id,
      contactEmail: "events@ieeeatucsd.org",
      ctaButton: {
        text: "Review Request",
        url: "https://ieeeatucsd.org/manage-events",
      },
    });

    // Create confirmation email for the event requester
    const userHtml = generateEmailTemplate({
      title: "Event Request Submitted",
      preheader: "Your event request has been submitted",
      headerText: "IEEE at UC San Diego",
      bodyContent: `
        <h2>Request Submitted!</h2>
        <p>Your event request "<strong>${eventRequest.name}</strong>" has been successfully submitted to the IEEE UCSD Events Team.</p>
        ${detailsHtml}
        
        <div style="margin-top: 24px;">
           <h4 style="color: ${IEEE_COLORS.primary}; margin-bottom: 8px;">What Happens Next?</h4>
           <ul style="color: ${IEEE_COLORS.gray[700]}; margin-top: 0;">
             <li>Our Events Team will review your request.</li>
             <li>You'll receive email updates as the status changes.</li>
             <li>We may contact you if we need additional information.</li>
           </ul>
        </div>
      `,
      referenceId: eventRequest.id,
      contactEmail: "events@ieeeatucsd.org",
    });

    // Send to events team
    await resend.emails.send({
      from: fromEmail,
      to: [eventsEmail],
      replyTo: user.email,
      subject: eventsSubject,
      html: eventsHtml,
    });

    // Send confirmation to event requester
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log(
      "Firebase event request notification emails sent successfully!",
    );
    return true;
  } catch (error) {
    console.error(
      "Failed to send Firebase event request notification email:",
      error,
    );
    return false;
  }
}

export async function sendFirebaseEventRequestStatusChangeEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: any,
): Promise<boolean> {
  try {
    console.log(
      "Starting Firebase event request status change email process...",
    );

    const db = getFirestore(app);

    // Get event request details
    const eventRequestDoc = await db
      .collection("event_requests")
      .doc(data.eventRequestId)
      .get();
    if (!eventRequestDoc.exists) {
      console.error("Event request not found");
      return false;
    }

    const eventRequest = {
      id: eventRequestDoc.id,
      ...eventRequestDoc.data(),
    } as any;

    // Get user details
    const userDoc = await db
      .collection("users")
      .doc(eventRequest.requestedUser)
      .get();
    if (!userDoc.exists) {
      console.error("User not found");
      return false;
    }

    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const getStatusColor = (status: string) => {
      switch (status) {
        case "approved":
          return IEEE_COLORS.success;
        case "declined":
        case "rejected":
          return IEEE_COLORS.danger;
        case "submitted":
        case "pending":
          return IEEE_COLORS.warning;
        default:
          return IEEE_COLORS.gray[500];
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case "approved":
          return "Approved";
        case "declined":
        case "rejected":
          return "Declined";
        case "submitted":
          return "Submitted";
        case "pending":
          return "Pending Review";
        default:
          return status;
      }
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
          timeZone: "America/Los_Angeles",
        });
      } catch (error) {
        return "Invalid date";
      }
    };

    const userSubject = `Your Event Request Status Updated: ${eventRequest.name}`;

    const statusColor = getStatusColor(data.newStatus);
    const statusText = getStatusText(data.newStatus);

    const statusChangeHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-left: 4px solid ${statusColor}; border-radius: 4px; padding: 16px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0; color: ${IEEE_COLORS.gray[800]}; font-size: 18px;">Status Update</h3>
        <div style="margin-bottom: 8px;">
          <span style="font-weight: 600; color: ${IEEE_COLORS.gray[600]};">Current Status:</span>
          <span style="background: ${statusColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-left: 8px; display: inline-block;">${statusText}</span>
        </div>
        ${data.previousStatus && data.previousStatus !== data.newStatus
        ? `<div style="color: ${IEEE_COLORS.gray[600]}; font-size: 14px;">Changed from: <strong>${getStatusText(data.previousStatus)}</strong></div>`
        : ""
      }
        ${(data.newStatus === "declined" || data.newStatus === "rejected") && data.declinedReason
        ? `
          <div style="background: ${IEEE_COLORS.white}; border: 1px solid ${IEEE_COLORS.danger}; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <p style="margin: 0 0 5px 0; color: ${IEEE_COLORS.danger}; font-weight: 600;">Reason for Decline:</p>
            <p style="margin: 0; color: ${IEEE_COLORS.gray[700]};">${data.declinedReason}</p>
          </div>
          `
        : ""
      }
      </div>
    `;

    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
         ${createDetailRow("Event Name", eventRequest.name)}
         ${createDetailRow("Location", eventRequest.location)}
         ${createDetailRow("Date & Time", formatDateTime(eventRequest.startDateTime))}
      </div>
    `;

    const userHtml = generateEmailTemplate({
      title: "Event Status Update",
      preheader: `Your event request status has been updated to ${statusText}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: `
            <h2>Event Request Updated</h2>
            <p>Your event request "<strong>${eventRequest.name}</strong>" has been updated.</p>
            ${statusChangeHtml}
            ${detailsHtml}
            
            <p style="margin-top: 24px;">You can view more details in the dashboard.</p>
        `,
      referenceId: eventRequest.id,
      contactEmail: "events@ieeeatucsd.org",
      ctaButton: {
        text: "View Dashboard",
        url: "https://ieeeatucsd.org/dashboard",
      }
    });

    // Send email to user
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log(
      "Firebase event request status change email sent successfully!",
    );
    return true;
  } catch (error) {
    console.error(
      "Failed to send Firebase event request status change email:",
      error,
    );
    return false;
  }
}

export async function sendFirebaseEventEditEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: any,
): Promise<boolean> {
  try {
    console.log("Starting Firebase event edit email process...");

    const db = getFirestore(app);

    // Get event request details
    const eventRequestDoc = await db
      .collection("event_requests")
      .doc(data.eventRequestId)
      .get();
    if (!eventRequestDoc.exists) {
      console.error("Event request not found");
      return false;
    }

    const eventRequest = {
      id: eventRequestDoc.id,
      ...eventRequestDoc.data(),
    } as any;

    // Get user details
    const userDoc = await db
      .collection("users")
      .doc(eventRequest.requestedUser)
      .get();
    if (!userDoc.exists) {
      console.error("User not found");
      return false;
    }

    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const eventsEmail = "events@ieeeatucsd.org";
    const subject = `Event Request Edited: ${eventRequest.name}`;

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
          timeZone: "America/Los_Angeles",
        });
      } catch (error) {
        return "Invalid date";
      }
    };

    const generateChangesTable = (before: any, after: any) => {
      const changes = [];
      const fieldsToCheck = [
        { key: "name", label: "Event Name" },
        { key: "location", label: "Location" },
        { key: "eventDescription", label: "Description" },
        { key: "department", label: "Department" },
        { key: "expectedAttendance", label: "Expected Attendance" },
        {
          key: "needsGraphics",
          label: "Needs Graphics",
          format: (val: boolean) => (val ? "Yes" : "No"),
        },
        {
          key: "needsAsFunding",
          label: "Needs AS Funding",
          format: (val: boolean) => (val ? "Yes" : "No"),
        },
        {
          key: "flyersNeeded",
          label: "Flyers Needed",
          format: (val: boolean) => (val ? "Yes" : "No"),
        },
        {
          key: "photographyNeeded",
          label: "Photography Needed",
          format: (val: boolean) => (val ? "Yes" : "No"),
        },
      ];

      for (const field of fieldsToCheck) {
        const beforeVal = before[field.key];
        const afterVal = after[field.key];

        if (beforeVal !== afterVal) {
          changes.push({
            field: field.label,
            before: field.format
              ? field.format(beforeVal)
              : beforeVal || "Not specified",
            after: field.format
              ? field.format(afterVal)
              : afterVal || "Not specified",
          });
        }
      }

      // Handle date changes - compare actual time values
      const getTimeValue = (timestamp: any) => {
        if (!timestamp) return null;
        if (timestamp.toDate) return timestamp.toDate().getTime();
        if (timestamp instanceof Date) return timestamp.getTime();
        return new Date(timestamp).getTime();
      };

      const beforeStartTime = getTimeValue(before.startDateTime);
      const afterStartTime = getTimeValue(after.startDateTime);
      const beforeEndTime = getTimeValue(before.endDateTime);
      const afterEndTime = getTimeValue(after.endDateTime);

      if (beforeStartTime !== afterStartTime) {
        changes.push({
          field: "Start Date & Time",
          before: formatDateTime(before.startDateTime),
          after: formatDateTime(after.startDateTime),
        });
      }

      if (beforeEndTime !== afterEndTime) {
        changes.push({
          field: "End Date & Time",
          before: formatDateTime(before.endDateTime),
          after: formatDateTime(after.endDateTime),
        });
      }

      return changes
        .map(
          (change) => `
        <tr>
          <td style="padding: 12px; border: 1px solid ${IEEE_COLORS.gray[200]}; font-weight: 600; color: ${IEEE_COLORS.gray[700]};">${change.field}</td>
          <td style="padding: 12px; border: 1px solid ${IEEE_COLORS.gray[200]}; color: ${IEEE_COLORS.danger}; text-decoration: line-through;">${change.before}</td>
          <td style="padding: 12px; border: 1px solid ${IEEE_COLORS.gray[200]}; color: ${IEEE_COLORS.success}; font-weight: 600;">${change.after}</td>
        </tr>
      `,
        )
        .join("");
    };

    const changesTable = generateChangesTable(data.previousData, data.newData);

    const changesHtml = changesTable
      ? `
            <div style="margin: 20px 0; border: 1px solid ${IEEE_COLORS.gray[200]}; border-radius: 8px; overflow: hidden;">
              <div style="background: ${IEEE_COLORS.gray[50]}; padding: 12px 16px; border-bottom: 1px solid ${IEEE_COLORS.gray[200]};">
                <h3 style="margin: 0; color: ${IEEE_COLORS.gray[800]}; font-size: 16px;">Changes Made</h3>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: ${IEEE_COLORS.gray[50]};">
                  <th style="padding: 12px; border: 1px solid ${IEEE_COLORS.gray[200]}; text-align: left; color: ${IEEE_COLORS.gray[600]}; font-size: 14px;">Field</th>
                  <th style="padding: 12px; border: 1px solid ${IEEE_COLORS.gray[200]}; text-align: left; color: ${IEEE_COLORS.gray[600]}; font-size: 14px;">Before</th>
                  <th style="padding: 12px; border: 1px solid ${IEEE_COLORS.gray[200]}; text-align: left; color: ${IEEE_COLORS.gray[600]}; font-size: 14px;">After</th>
                </tr>
                ${changesTable}
              </table>
            </div>
            `
      : createInfoBox(`<p style="margin:0">Minor changes were made to the event request. Please review the updated details in the dashboard.</p>`, "info");

    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
         <h3 style="margin: 0 0 12px 0; color: ${IEEE_COLORS.gray[800]}; font-size: 16px;">Current Details</h3>
         ${createDetailRow("Event Name", eventRequest.name)}
         ${createDetailRow("Location", eventRequest.location)}
         ${createDetailRow("Date & Time", formatDateTime(eventRequest.startDateTime))}
         ${createDetailRow("Status", eventRequest.status)}
      </div>
    `;

    const html = generateEmailTemplate({
      title: "Event Request Edited",
      preheader: "Changes were made to an event request",
      headerText: "IEEE at UC San Diego",
      bodyContent: `
           <h2>Event Request Edited</h2>
           <p>The event request "<strong>${eventRequest.name}</strong>" submitted by <strong>${user.name || user.email}</strong> has been edited.</p>
           ${changesHtml}
           ${detailsHtml}
        `,
      referenceId: eventRequest.id,
      contactEmail: "events@ieeeatucsd.org",
      ctaButton: {
        text: "View Dashboard",
        url: "https://ieeeatucsd.org/dashboard",
      }
    });

    // Send to events team
    await resend.emails.send({
      from: fromEmail,
      to: [eventsEmail],
      replyTo: user.email,
      subject,
      html,
    });

    // Send to event requester
    const userSubject = `Your Event Request Has Been Updated: ${eventRequest.name}`;
    const userHtml = generateEmailTemplate({
      title: "Event Request Updated",
      preheader: "Your event request has been updated",
      headerText: "IEEE at UC San Diego",
      bodyContent: `
           <h2>Your Event Update</h2>
           <p>Your event request "<strong>${eventRequest.name}</strong>" has been updated.</p>
           ${changesHtml}
           ${detailsHtml}
           <p>You can view the updated details in the dashboard.</p>
        `,
      referenceId: eventRequest.id,
      contactEmail: "events@ieeeatucsd.org",
      ctaButton: {
        text: "View Dashboard",
        url: "https://ieeeatucsd.org/dashboard",
      }
    });

    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log("Firebase event edit emails sent successfully!");
    return true;
  } catch (error) {
    console.error("Failed to send Firebase event edit email:", error);
    return false;
  }
}

export async function sendFirebaseEventDeleteEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: any,
): Promise<boolean> {
  try {
    console.log("Starting Firebase event delete email process...");

    const eventsEmail = "events@ieeeatucsd.org";
    const subject = `Event Request Deleted: ${data.eventName}`;

    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
         ${createDetailRow("Event Name", data.eventName)}
         ${createDetailRow("Location", data.location || "Not specified")}
         ${createDetailRow("Submitted By", `${data.userName} (${data.userEmail})`)}
         ${createDetailRow("Status", data.status || "Unknown")}
         ${createDetailRow("Request ID", data.eventRequestId)}
      </div>
    `;

    const html = generateEmailTemplate({
      title: "Event Request Deleted",
      preheader: "An event request has been deleted",
      headerText: "IEEE at UC San Diego",
      bodyContent: `
           <h2 style="color:${IEEE_COLORS.danger}">Event Deletion Notice</h2>
           <p>The event request "<strong>${data.eventName}</strong>" has been deleted from the system.</p>
           ${detailsHtml}
           
           <div style="background: ${IEEE_COLORS.white}; border: 1px solid ${IEEE_COLORS.danger}; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: ${IEEE_COLORS.danger}; font-size: 16px;">Action Required</h4>
              <ul style="margin: 0; padding-left: 20px; color: ${IEEE_COLORS.danger}; line-height: 1.7;">
                <li>Cancel any ongoing work related to this event</li>
                <li>Notify team members who were assigned to this event</li>
                <li>Update any external communications if necessary</li>
                <li>Contact the submitter if follow-up is needed</li>
              </ul>
            </div>
        `,
      referenceId: data.eventRequestId,
      contactEmail: "events@ieeeatucsd.org"
    });

    // Send to events team
    await resend.emails.send({
      from: fromEmail,
      to: [eventsEmail],
      replyTo: data.userEmail,
      subject,
      html,
    });

    // Send to event requester
    const userSubject = `Your Event Request Has Been Deleted: ${data.eventName}`;
    const userHtml = generateEmailTemplate({
      title: "Event Request Deleted",
      preheader: "Your event request has been deleted",
      headerText: "IEEE at UC San Diego",
      bodyContent: `
           <h2>Hello ${data.userName}!</h2>
           <p>Your event request "<strong>${data.eventName}</strong>" has been deleted.</p>
           ${detailsHtml}
           
           <p>If you have any questions, please contact us.</p>
        `,
      referenceId: data.eventRequestId,
      contactEmail: "events@ieeeatucsd.org"
    });

    await resend.emails.send({
      from: fromEmail,
      to: [data.userEmail],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log("Firebase event delete emails sent successfully!");
    return true;
  } catch (error) {
    console.error("Failed to send Firebase event delete email:", error);
    return false;
  }
}

export async function sendGraphicsUploadEmail(
  resend: any,
  fromEmail: string,
  replyToEmail: string,
  data: {
    eventRequestId: string;
    uploadedByUserId: string;
    filesUploaded: number;
  },
): Promise<boolean> {
  try {
    console.log("Starting graphics upload email process...");

    // Validate input parameters
    if (!data.eventRequestId || typeof data.eventRequestId !== "string") {
      console.error("Invalid eventRequestId parameter");
      return false;
    }

    if (!data.uploadedByUserId || typeof data.uploadedByUserId !== "string") {
      console.error("Invalid uploadedByUserId parameter");
      return false;
    }

    if (
      typeof data.filesUploaded !== "number" ||
      data.filesUploaded < 0 ||
      !Number.isInteger(data.filesUploaded)
    ) {
      console.error(
        "Invalid filesUploaded parameter: must be a non-negative integer",
      );
      return false;
    }

    if (data.filesUploaded === 0) {
      console.log("No files uploaded, skipping email notification");
      return true;
    }

    // Helper to normalize timestamp to Date or null for safe formatting
    const normalizeToDate = (timestamp: any): Date | null => {
      if (!timestamp) return null;
      if (timestamp instanceof Date) return timestamp;
      if (typeof timestamp.toDate === "function") {
        try {
          return timestamp.toDate();
        } catch {
          return null;
        }
      }
      try {
        return new Date(timestamp);
      } catch {
        return null;
      }
    };

    const db = getFirestore(app);

    // Get event request details
    const eventRequestDoc = await db
      .collection("event_requests")
      .doc(data.eventRequestId)
      .get();
    if (!eventRequestDoc.exists) {
      console.error("Event request not found");
      return false;
    }

    const eventRequest = {
      id: eventRequestDoc.id,
      ...eventRequestDoc.data(),
    } as any;

    // Get uploader details
    const uploaderDoc = await db
      .collection("users")
      .doc(data.uploadedByUserId)
      .get();
    if (!uploaderDoc.exists) {
      console.error("Uploader not found");
      return false;
    }
    const uploader = { id: uploaderDoc.id, ...uploaderDoc.data() } as any;

    // Get event submitter details
    const submitterDoc = await db
      .collection("users")
      .doc(eventRequest.requestedUser)
      .get();
    if (!submitterDoc.exists) {
      console.error("Event submitter not found");
      return false;
    }
    const submitter = { id: submitterDoc.id, ...submitterDoc.data() } as any;

    // Build email content
    const normalizedStartDate = normalizeToDate(eventRequest.startDateTime);
    const startDateValue = normalizedStartDate
      ? formatDate(normalizedStartDate)
      : "Not specified";

    const detailsHtml = `
      <div style="background: ${IEEE_COLORS.gray[50]}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${createDetailRow("Event Name", eventRequest.name)}
        ${createDetailRow("Location", eventRequest.location || "Not specified")}
        ${createDetailRow("Start Date", startDateValue)}
        ${createDetailRow("Files Uploaded", data.filesUploaded.toString())}
        ${createDetailRow("Uploaded By", uploader.name || uploader.email)}
      </div>
    `;

    const bodyContent = `
      <h2>Graphics Files Uploaded</h2>
      <p>Graphics files have been uploaded for your event request.</p>
      ${detailsHtml}
      ${createInfoBox(
      `
        <p style="margin: 0;">The graphics team has uploaded ${data.filesUploaded} file(s) for your event. You can view and download these files from the event management dashboard.</p>
      `,
      "success",
    )}
    `;

    const uploaderBodyContent = `
      <h2>Graphics Upload Confirmation</h2>
      <p>Your graphics files have been successfully uploaded.</p>
      ${detailsHtml}
      ${createInfoBox(
      `
        <p style="margin: 0;">You have successfully uploaded ${data.filesUploaded} graphics file(s) for this event. The event organizer has been notified.</p>
      `,
      "success",
    )}
    `;

    // Email to event submitter
    const submitterEmailHtml = generateEmailTemplate({
      title: "Graphics Files Uploaded",
      preheader: `Graphics files have been uploaded for ${eventRequest.name}`,
      headerText: "IEEE at UC San Diego",
      bodyContent,
      referenceId: eventRequest.id,
      contactEmail: "events@ieeeatucsd.org",
      ctaButton: {
        text: "View Event Details",
        url: "https://ieeeatucsd.org/manage-events",
      },
    });

    // Email to uploader
    const uploaderEmailHtml = generateEmailTemplate({
      title: "Graphics Upload Confirmation",
      preheader: `Your graphics files have been uploaded for ${eventRequest.name}`,
      headerText: "IEEE at UC San Diego",
      bodyContent: uploaderBodyContent,
      referenceId: eventRequest.id,
      contactEmail: "events@ieeeatucsd.org",
      ctaButton: {
        text: "View Event Details",
        url: "https://ieeeatucsd.org/manage-events",
      },
    });

    // Send to event submitter
    await resend.emails.send({
      from: fromEmail,
      to: [submitter.email],
      replyTo: uploader.email,
      subject: `Graphics Uploaded: ${eventRequest.name}`,
      html: submitterEmailHtml,
    });

    // Send to uploader
    await resend.emails.send({
      from: fromEmail,
      to: [uploader.email],
      replyTo: replyToEmail,
      subject: `Graphics Upload Confirmation: ${eventRequest.name}`,
      html: uploaderEmailHtml,
    });

    console.log("Graphics upload emails sent successfully!");
    return true;
  } catch (error) {
    console.error("Failed to send graphics upload emails:", error);
    return false;
  }
}
