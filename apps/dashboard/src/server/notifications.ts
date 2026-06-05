/**
 * Email Notification Functions for Dashboard V2
 *
 * Each function accepts typed data (no DB reads) and renders
 * the universal email template, then sends via Resend.
 */

import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { sendEmail } from "./email";
import {
  renderEmail,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateShort,
  type StatusVariant,
  type DetailRow,
  type NotesBox,
} from "./email-template";

const DASHBOARD_BASE = "https://dashboard.ieeeatucsd.org";
const TREASURER_EMAIL = "treasurer@ieeeatucsd.org";
const EVENTS_EMAIL = "events@ieeeatucsd.org";

// ── User Lookup ────────────────────────────────────────────────────────────────

interface UserInfo {
  name: string;
  email: string;
}

/**
 * Look up a user's name and email from Convex by their logtoId.
 * Returns fallback values if lookup fails.
 */
export async function lookupUser(logtoId: string): Promise<UserInfo> {
  try {
    const url =
      process.env.CONVEX_URL ||
      process.env.VITE_CONVEX_URL ||
      (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
        .env?.VITE_CONVEX_URL;
    if (!url) return { name: "Unknown", email: "" };

    const client = new ConvexHttpClient(url);
    const fn = "users:getByLogtoId" as unknown as FunctionReference<"query">;
    const user = await client.query(fn, { logtoId });
    if (user) {
      return { name: user.name || "Unknown", email: user.email || "" };
    }
  } catch (e) {
    console.error("[notifications] User lookup failed:", e);
  }
  return { name: "Unknown", email: "" };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusToVariant(status: string): StatusVariant {
  switch (status) {
    case "approved":
    case "paid":
    case "verified":
    case "completed":
      return "success";
    case "declined":
    case "denied":
    case "rejected":
      return "danger";
    case "needs_info":
    case "needs_review":
    case "pending":
      return "warning";
    case "submitted":
      return "info";
    default:
      return "neutral";
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    submitted: "Submitted",
    approved: "Approved",
    declined: "Declined",
    denied: "Denied",
    rejected: "Rejected",
    paid: "Paid",
    verified: "Verified",
    needs_info: "Needs Information",
    needs_review: "Needs Review",
    pending: "Pending Review",
    completed: "Completed",
    draft: "Draft",
  };
  return map[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Reimbursement Emails ───────────────────────────────────────────────────────

export interface ReimbursementSubmittedData {
  reimbursementId: string;
  title: string;
  totalAmount: number;
  department: string;
  paymentMethod: string;
  additionalInfo?: string;
  submitterName: string;
  submitterEmail: string;
}

export async function sendReimbursementSubmitted(data: ReimbursementSubmittedData) {
  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: `<strong style="color:#059669;">${formatCurrency(data.totalAmount)}</strong>` },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Payment Method", value: escapeHtml(data.paymentMethod) },
    { label: "Submitted By", value: `${escapeHtml(data.submitterName)} (${escapeHtml(data.submitterEmail)})` },
  ];

  if (data.additionalInfo) {
    details.push({ label: "Additional Info", value: escapeHtml(data.additionalInfo) });
  }

  // Email to treasurer
  const treasurerHtml = renderEmail({
    subject: `New Reimbursement Request: ${data.title}`,
    preheader: `${data.submitterName} submitted a reimbursement for ${formatCurrency(data.totalAmount)}`,
    introHtml: `A new reimbursement request has been submitted and requires your review.`,
    statusBadge: { label: "Submitted for Review", variant: "info" },
    details,
    bulletSection: {
      title: "Next Steps",
      items: [
        "Review the reimbursement request details and receipts",
        "Contact the submitter if clarification is needed",
        "Update the request status in the dashboard",
      ],
      variant: "info",
    },
    ctaButton: { text: "Review Request", url: `${DASHBOARD_BASE}/manage-reimbursements` },
    referenceId: data.reimbursementId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Reimbursement System",
  });

  // Confirmation to user
  const userHtml = renderEmail({
    subject: `Reimbursement Submitted: ${data.title}`,
    preheader: `Your reimbursement for ${formatCurrency(data.totalAmount)} has been submitted`,
    recipientName: data.submitterName,
    introHtml: `Your reimbursement request <strong>"${escapeHtml(data.title)}"</strong> has been successfully submitted and is now under review.`,
    statusBadge: { label: "Submitted for Review", variant: "info" },
    details,
    bulletSection: {
      title: "What Happens Next?",
      items: [
        "Our treasurer team will review your request and receipts",
        "You'll receive email updates as the status changes",
        "We may contact you if we need additional information",
        "Typical review time is 5–7 business days",
      ],
      variant: "info",
    },
    ctaButton: { text: "View Your Request", url: `${DASHBOARD_BASE}/reimbursement` },
    referenceId: data.reimbursementId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Reimbursement System",
  });

  await Promise.all([
    sendEmail({ to: TREASURER_EMAIL, subject: `New Reimbursement Request: ${data.title}`, html: treasurerHtml }),
    sendEmail({ to: data.submitterEmail, subject: `Reimbursement Submitted: ${data.title}`, html: userHtml }),
  ]);
}

export interface ReimbursementStatusChangedData {
  reimbursementId: string;
  title: string;
  totalAmount: number;
  department: string;
  newStatus: string;
  previousStatus?: string;
  changedByName?: string;
  rejectionReason?: string;
  paymentDetails?: {
    confirmationNumber?: string;
    paymentDate?: number;
    amountPaid?: number;
  };
  submitterName: string;
  submitterEmail: string;
}

export async function sendReimbursementStatusChanged(data: ReimbursementStatusChangedData) {
  const variant = statusToVariant(data.newStatus);
  const label = statusLabel(data.newStatus);

  let introText = `Your reimbursement request <strong>"${escapeHtml(data.title)}"</strong> has been updated.`;
  if (data.newStatus === "approved") {
    introText = `Great news! Your reimbursement request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>approved</strong> and is being processed for payment.`;
  } else if (data.newStatus === "declined") {
    introText = `Your reimbursement request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>declined</strong>. Please review the details below.`;
  } else if (data.newStatus === "paid") {
    introText = `Your reimbursement <strong>"${escapeHtml(data.title)}"</strong> has been <strong>paid</strong>! Please check your payment method for the funds.`;
  }

  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: formatCurrency(data.totalAmount) },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Status", value: `<strong>${escapeHtml(label)}</strong>` },
  ];

  if (data.previousStatus) {
    details.push({ label: "Previous Status", value: escapeHtml(statusLabel(data.previousStatus)) });
  }
  if (data.changedByName) {
    details.push({ label: "Updated By", value: escapeHtml(data.changedByName) });
  }

  const notes: NotesBox[] = [];
  if (data.rejectionReason) {
    notes.push({ title: "Reason", content: data.rejectionReason, variant: "danger" });
  }
  if (data.paymentDetails) {
    const parts: string[] = [];
    if (data.paymentDetails.confirmationNumber) parts.push(`Confirmation: ${data.paymentDetails.confirmationNumber}`);
    if (data.paymentDetails.amountPaid) parts.push(`Amount Paid: ${formatCurrency(data.paymentDetails.amountPaid)}`);
    if (data.paymentDetails.paymentDate) parts.push(`Payment Date: ${formatDateShort(data.paymentDetails.paymentDate)}`);
    if (parts.length) {
      notes.push({ title: "Payment Confirmation", content: parts.join(" · "), variant: "success" });
    }
  }

  const html = renderEmail({
    subject: `Reimbursement ${label}: ${data.title}`,
    preheader: `Your reimbursement has been ${label.toLowerCase()}`,
    recipientName: data.submitterName,
    introHtml: introText,
    statusBadge: { label, variant },
    details,
    notes,
    ctaButton: { text: "View Details", url: `${DASHBOARD_BASE}/reimbursement` },
    referenceId: data.reimbursementId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Reimbursement System",
  });

  await sendEmail({
    to: data.submitterEmail,
    subject: `Reimbursement ${label}: ${data.title}`,
    html,
  });
}

// ── Fund Request Emails ────────────────────────────────────────────────────────

export interface FundRequestSubmittedData {
  requestId: string;
  title: string;
  amount: number;
  category: string;
  department: string;
  purpose: string;
  vendorLinksCount?: number;
  attachmentsCount?: number;
  submitterName: string;
  submitterEmail: string;
}

export async function sendFundRequestSubmitted(data: FundRequestSubmittedData) {
  const categoryLabels: Record<string, string> = {
    event: "Event",
    travel: "Travel",
    equipment: "Equipment",
    software: "Software",
    other: "Other",
    general: "General",
    projects: "Projects",
  };

  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: `<strong style="color:#059669;">${formatCurrency(data.amount)}</strong>` },
    { label: "Category", value: escapeHtml(categoryLabels[data.category] || data.category) },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Submitted By", value: `${escapeHtml(data.submitterName)} (${escapeHtml(data.submitterEmail)})` },
  ];

  if (data.vendorLinksCount) {
    details.push({ label: "Vendor Links", value: `${data.vendorLinksCount} link(s)` });
  }
  if (data.attachmentsCount) {
    details.push({ label: "Attachments", value: `${data.attachmentsCount} file(s)` });
  }

  const purposeNote: NotesBox = {
    title: "Purpose / Justification",
    content: data.purpose,
    variant: "neutral",
  };

  // Email to treasurer
  const treasurerHtml = renderEmail({
    subject: `New Fund Request: ${data.title}`,
    preheader: `${data.submitterName} submitted a fund request for ${formatCurrency(data.amount)}`,
    introHtml: `A new fund request has been submitted and requires your review.`,
    statusBadge: { label: "Submitted for Review", variant: "info" },
    details,
    notes: [purposeNote],
    ctaButton: { text: "Review Request", url: `${DASHBOARD_BASE}/manage-fund-requests` },
    referenceId: data.requestId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Fund Request System",
  });

  // Confirmation to user
  const userHtml = renderEmail({
    subject: `Fund Request Submitted: ${data.title}`,
    preheader: `Your fund request for ${formatCurrency(data.amount)} has been submitted`,
    recipientName: data.submitterName,
    introHtml: `Your fund request <strong>"${escapeHtml(data.title)}"</strong> has been successfully submitted and is now under review.`,
    statusBadge: { label: "Submitted for Review", variant: "info" },
    details,
    notes: [purposeNote],
    bulletSection: {
      title: "What Happens Next?",
      items: [
        "An executive officer will review your request",
        "You'll receive email updates as the status changes",
        "You may be contacted if additional information is needed",
      ],
      variant: "info",
    },
    ctaButton: { text: "View Your Request", url: `${DASHBOARD_BASE}/fund-requests` },
    referenceId: data.requestId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Fund Request System",
  });

  await Promise.all([
    sendEmail({ to: TREASURER_EMAIL, subject: `New Fund Request: ${data.title}`, html: treasurerHtml }),
    sendEmail({ to: data.submitterEmail, subject: `Fund Request Submitted: ${data.title}`, html: userHtml }),
  ]);
}

export interface FundRequestStatusChangedData {
  requestId: string;
  title: string;
  amount: number;
  newStatus: string;
  previousStatus?: string;
  reviewNotes?: string;
  infoRequestNotes?: string;
  selectedFundingSource?: string;
  reviewerName?: string;
  submitterName: string;
  submitterEmail: string;
}

export async function sendFundRequestStatusChanged(data: FundRequestStatusChangedData) {
  const variant = statusToVariant(data.newStatus);
  const label = statusLabel(data.newStatus);

  const fundingSourceLabels: Record<string, string> = {
    ece: "ECE Department",
    ieee: "IEEE",
    other: "Other",
  };

  let introText = `Your fund request <strong>"${escapeHtml(data.title)}"</strong> status has been updated.`;
  if (data.newStatus === "approved") {
    introText = `Great news! Your fund request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>approved</strong>. You may now proceed with your purchase.`;
  } else if (data.newStatus === "denied") {
    introText = `Unfortunately, your fund request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>denied</strong>.`;
  } else if (data.newStatus === "needs_info") {
    introText = `Your fund request <strong>"${escapeHtml(data.title)}"</strong> requires additional information before it can be processed.`;
  }

  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: formatCurrency(data.amount) },
    { label: "Status", value: `<strong>${escapeHtml(label)}</strong>` },
  ];

  if (data.selectedFundingSource) {
    details.push({ label: "Funding Source", value: escapeHtml(fundingSourceLabels[data.selectedFundingSource] || data.selectedFundingSource) });
  }
  if (data.reviewerName) {
    details.push({ label: "Reviewed By", value: escapeHtml(data.reviewerName) });
  }

  const notes: NotesBox[] = [];
  if (data.reviewNotes) {
    notes.push({ title: "Review Notes", content: data.reviewNotes, variant: data.newStatus === "denied" ? "danger" : "neutral" });
  }
  if (data.infoRequestNotes) {
    notes.push({ title: "Information Requested", content: data.infoRequestNotes, variant: "warning" });
  }

  const ctaUrl = data.newStatus === "needs_info"
    ? `${DASHBOARD_BASE}/fund-requests`
    : `${DASHBOARD_BASE}/fund-requests`;

  const html = renderEmail({
    subject: `Fund Request ${label}: ${data.title}`,
    preheader: `Your fund request has been ${label.toLowerCase()}`,
    recipientName: data.submitterName,
    introHtml: introText,
    statusBadge: { label, variant },
    details,
    notes,
    ctaButton: {
      text: data.newStatus === "needs_info" ? "Update Your Request" : "View Details",
      url: ctaUrl,
    },
    referenceId: data.requestId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Fund Request System",
  });

  await sendEmail({
    to: data.submitterEmail,
    subject: `Fund Request ${label}: ${data.title}`,
    html,
  });
}

// ── Event Request Emails ───────────────────────────────────────────────────────

export interface EventRequestSubmittedData {
  eventRequestId: string;
  name: string;
  location: string;
  startDateTime: number;
  endDateTime: number;
  eventDescription?: string;
  department?: string;
  expectedAttendance?: number;
  needsGraphics?: boolean;
  needsAsFunding?: boolean;
  flyersNeeded?: boolean;
  photographyNeeded?: boolean;
  submitterName: string;
  submitterEmail: string;
}

export async function sendEventRequestSubmitted(data: EventRequestSubmittedData) {
  const details: DetailRow[] = [
    { label: "Event Name", value: `<strong>${escapeHtml(data.name)}</strong>` },
    { label: "Location", value: escapeHtml(data.location) },
    { label: "Start", value: formatDate(data.startDateTime) },
    { label: "End", value: formatDate(data.endDateTime) },
  ];

  if (data.expectedAttendance) {
    details.push({ label: "Expected Attendance", value: String(data.expectedAttendance) });
  }
  if (data.department) {
    details.push({ label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) });
  }
  details.push({ label: "Submitted By", value: `${escapeHtml(data.submitterName)} (${escapeHtml(data.submitterEmail)})` });

  // Special requirements badges
  const reqs: string[] = [];
  if (data.needsGraphics) reqs.push("Graphics Required");
  if (data.needsAsFunding) reqs.push("AS Funding");
  if (data.flyersNeeded) reqs.push("Flyers Needed");
  if (data.photographyNeeded) reqs.push("Photography");

  const descriptionNote: NotesBox | undefined = data.eventDescription
    ? { title: "Event Description", content: data.eventDescription, variant: "neutral" as StatusVariant }
    : undefined;

  const reqsNote: NotesBox | undefined = reqs.length
    ? { title: "Special Requirements", content: reqs.join(" · "), variant: "info" as StatusVariant }
    : undefined;

  const notes = [descriptionNote, reqsNote].filter(Boolean) as NotesBox[];

  // Email to events team
  const eventsHtml = renderEmail({
    subject: `New Event Request: ${data.name}`,
    preheader: `${data.submitterName} submitted an event request for "${data.name}"`,
    introHtml: `A new event request has been submitted by <strong>${escapeHtml(data.submitterName)}</strong> and requires your review.`,
    statusBadge: { label: "Review Required", variant: "info" },
    details,
    notes,
    bulletSection: {
      title: "Next Steps",
      items: [
        "Review the event request in the dashboard",
        "Contact the submitter if clarification is needed",
        "Assign tasks to appropriate team members",
        "Update the status once processed",
      ],
      variant: "info",
    },
    ctaButton: { text: "Review Request", url: `${DASHBOARD_BASE}/manage-events` },
    referenceId: data.eventRequestId,
    contactEmail: EVENTS_EMAIL,
    footerText: "IEEE at UC San Diego — Event Management System",
  });

  // Confirmation to user
  const userHtml = renderEmail({
    subject: `Event Request Submitted: ${data.name}`,
    preheader: `Your event request "${data.name}" has been submitted`,
    recipientName: data.submitterName,
    introHtml: `Your event request <strong>"${escapeHtml(data.name)}"</strong> has been successfully submitted to the IEEE UCSD Events Team.`,
    statusBadge: { label: "Submitted for Review", variant: "info" },
    details,
    notes,
    bulletSection: {
      title: "What Happens Next?",
      items: [
        "Our Events Team will review your request",
        "You'll receive email updates as the status changes",
        "We may contact you if we need additional information",
        "Typical review time is 3–5 business days",
      ],
      variant: "info",
    },
    ctaButton: { text: "View Your Request", url: `${DASHBOARD_BASE}/manage-events` },
    referenceId: data.eventRequestId,
    contactEmail: EVENTS_EMAIL,
    footerText: "IEEE at UC San Diego — Event Management System",
  });

  await Promise.all([
    sendEmail({ to: EVENTS_EMAIL, subject: `New Event Request: ${data.name}`, html: eventsHtml }),
    sendEmail({ to: data.submitterEmail, subject: `Event Request Submitted: ${data.name}`, html: userHtml }),
  ]);
}

export interface EventRequestStatusChangedData {
  eventRequestId: string;
  name: string;
  location: string;
  startDateTime: number;
  newStatus: string;
  previousStatus?: string;
  declinedReason?: string;
  reviewFeedback?: string;
  changedByName?: string;
  submitterName: string;
  submitterEmail: string;
}

export async function sendEventRequestStatusChanged(data: EventRequestStatusChangedData) {
  const variant = statusToVariant(data.newStatus);
  const label = statusLabel(data.newStatus);

  let introText = `Your event request <strong>"${escapeHtml(data.name)}"</strong> has been updated.`;
  if (data.newStatus === "approved") {
    introText = `Great news! Your event request <strong>"${escapeHtml(data.name)}"</strong> has been <strong>approved</strong>!`;
  } else if (data.newStatus === "declined") {
    introText = `Your event request <strong>"${escapeHtml(data.name)}"</strong> has been <strong>declined</strong>. Please review the details below.`;
  } else if (data.newStatus === "needs_review") {
    introText = `Your event request <strong>"${escapeHtml(data.name)}"</strong> requires additional review.`;
  }

  const details: DetailRow[] = [
    { label: "Event Name", value: `<strong>${escapeHtml(data.name)}</strong>` },
    { label: "Location", value: escapeHtml(data.location) },
    { label: "Start", value: formatDate(data.startDateTime) },
    { label: "Status", value: `<strong>${escapeHtml(label)}</strong>` },
  ];

  if (data.previousStatus) {
    details.push({ label: "Previous Status", value: escapeHtml(statusLabel(data.previousStatus)) });
  }
  if (data.changedByName) {
    details.push({ label: "Updated By", value: escapeHtml(data.changedByName) });
  }

  const notes: NotesBox[] = [];
  if (data.declinedReason) {
    notes.push({ title: "Decline Reason", content: data.declinedReason, variant: "danger" });
  }
  if (data.reviewFeedback) {
    notes.push({ title: "Review Feedback", content: data.reviewFeedback, variant: "warning" });
  }

  const html = renderEmail({
    subject: `Event Request ${label}: ${data.name}`,
    preheader: `Your event request has been ${label.toLowerCase()}`,
    recipientName: data.submitterName,
    introHtml: introText,
    statusBadge: { label, variant },
    details,
    notes,
    ctaButton: { text: "View Details", url: `${DASHBOARD_BASE}/manage-events` },
    referenceId: data.eventRequestId,
    contactEmail: EVENTS_EMAIL,
    footerText: "IEEE at UC San Diego — Event Management System",
  });

  await sendEmail({
    to: data.submitterEmail,
    subject: `Event Request ${label}: ${data.name}`,
    html,
  });
}

// ── Event Request Edit Email ───────────────────────────────────────────────────

export interface EventRequestEditedData {
  eventRequestId: string;
  name: string;
  location: string;
  startDateTime: number;
  changes: Array<{ field: string; before: string; after: string }>;
  editorName: string;
  editorEmail: string;
  submitterName: string;
  submitterEmail: string;
}

export async function sendEventRequestEdited(data: EventRequestEditedData) {
  const details: DetailRow[] = [
    { label: "Event Name", value: `<strong>${escapeHtml(data.name)}</strong>` },
    { label: "Location", value: escapeHtml(data.location) },
    { label: "Start", value: formatDate(data.startDateTime) },
    { label: "Edited By", value: `${escapeHtml(data.editorName)} (${escapeHtml(data.editorEmail)})` },
  ];

  const notes: NotesBox[] = [];
  if (data.changes.length) {
    const changesHtml = data.changes.map((c) => `${c.field}: "${c.before}" → "${c.after}"`).join("; ");
    notes.push({ title: "Changes Made", content: changesHtml, variant: "warning" });
  }

  // Email to events team
  const eventsHtml = renderEmail({
    subject: `Event Request Edited: ${data.name}`,
    preheader: `${data.editorName} edited the event request "${data.name}"`,
    introHtml: `The event request <strong>"${escapeHtml(data.name)}"</strong> has been edited by <strong>${escapeHtml(data.editorName)}</strong>.`,
    details,
    notes,
    ctaButton: { text: "Review Changes", url: `${DASHBOARD_BASE}/manage-events` },
    referenceId: data.eventRequestId,
    contactEmail: EVENTS_EMAIL,
    footerText: "IEEE at UC San Diego — Event Management System",
  });

  // Notification to submitter (if different from editor)
  const emails = [
    sendEmail({ to: EVENTS_EMAIL, subject: `Event Request Edited: ${data.name}`, html: eventsHtml }),
  ];

  if (data.submitterEmail !== data.editorEmail) {
    const userHtml = renderEmail({
      subject: `Your Event Request Was Updated: ${data.name}`,
      preheader: `Your event request "${data.name}" has been updated`,
      recipientName: data.submitterName,
      introHtml: `Your event request <strong>"${escapeHtml(data.name)}"</strong> has been updated.`,
      details,
      notes,
      ctaButton: { text: "View Details", url: `${DASHBOARD_BASE}/manage-events` },
      referenceId: data.eventRequestId,
      contactEmail: EVENTS_EMAIL,
      footerText: "IEEE at UC San Diego — Event Management System",
    });
    emails.push(sendEmail({ to: data.submitterEmail, subject: `Your Event Request Was Updated: ${data.name}`, html: userHtml }));
  }

  await Promise.all(emails);
}

// ── Graphics Upload Email ──────────────────────────────────────────────────────

export interface GraphicsUploadedData {
  eventRequestId: string;
  eventName: string;
  filesUploaded: number;
  uploaderName: string;
  uploaderEmail: string;
  submitterName: string;
  submitterEmail: string;
}

export async function sendGraphicsUploaded(data: GraphicsUploadedData) {
  const details: DetailRow[] = [
    { label: "Event", value: `<strong>${escapeHtml(data.eventName)}</strong>` },
    { label: "Files Uploaded", value: `${data.filesUploaded} file(s)` },
    { label: "Uploaded By", value: escapeHtml(data.uploaderName) },
  ];

  // Email to submitter
  const submitterHtml = renderEmail({
    subject: `Graphics Uploaded: ${data.eventName}`,
    preheader: `${data.filesUploaded} graphics file(s) uploaded for "${data.eventName}"`,
    recipientName: data.submitterName,
    introHtml: `Graphics files have been uploaded for your event request <strong>"${escapeHtml(data.eventName)}"</strong>.`,
    details,
    notes: [{
      title: "Files Ready",
      content: `The graphics team has uploaded ${data.filesUploaded} file(s) for your event. You can view and download these files from the event management dashboard.`,
      variant: "success",
    }],
    ctaButton: { text: "View Event Details", url: `${DASHBOARD_BASE}/manage-events` },
    referenceId: data.eventRequestId,
    contactEmail: EVENTS_EMAIL,
    footerText: "IEEE at UC San Diego — Event Management System",
  });

  // Confirmation to uploader
  const uploaderHtml = renderEmail({
    subject: `Graphics Upload Confirmed: ${data.eventName}`,
    preheader: `Your graphics upload for "${data.eventName}" was successful`,
    recipientName: data.uploaderName,
    introHtml: `Your graphics files have been successfully uploaded for <strong>"${escapeHtml(data.eventName)}"</strong>. The event organizer has been notified.`,
    details,
    ctaButton: { text: "View Event Details", url: `${DASHBOARD_BASE}/manage-events` },
    referenceId: data.eventRequestId,
    contactEmail: EVENTS_EMAIL,
    footerText: "IEEE at UC San Diego — Event Management System",
  });

  const emails = [
    sendEmail({ to: data.submitterEmail, subject: `Graphics Uploaded: ${data.eventName}`, html: submitterHtml }),
  ];

  if (data.uploaderEmail !== data.submitterEmail) {
    emails.push(sendEmail({ to: data.uploaderEmail, subject: `Graphics Upload Confirmed: ${data.eventName}`, html: uploaderHtml }));
  }

  await Promise.all(emails);
}

// ── Audit Request Email (Reimbursements) ───────────────────────────────────────

export interface AuditRequestData {
  reimbursementId: string;
  title: string;
  totalAmount: number;
  department: string;
  submitterName: string;
  requestNote?: string;
  auditorName: string;
  auditorEmail: string;
  requesterName: string;
}

export async function sendAuditRequest(data: AuditRequestData) {
  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: `<strong>${formatCurrency(data.totalAmount)}</strong>` },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Submitted By", value: escapeHtml(data.submitterName) },
    { label: "Requested By", value: escapeHtml(data.requesterName) },
  ];

  const notes: NotesBox[] = [];
  if (data.requestNote) {
    notes.push({ title: "Request Message", content: data.requestNote, variant: "warning" });
  }

  const html = renderEmail({
    subject: `Audit Requested: ${data.title}`,
    preheader: `${data.requesterName} has requested your review of a reimbursement`,
    recipientName: data.auditorName,
    introHtml: `A fellow executive officer has requested your review for the following reimbursement request.`,
    statusBadge: { label: "Audit Requested", variant: "purple" },
    details,
    notes,
    bulletSection: {
      title: "Next Steps",
      items: [
        "Review the reimbursement details and supporting documentation",
        "Approve, decline, or request additional information",
        "The system will automatically notify all relevant parties",
      ],
      variant: "purple",
    },
    ctaButton: { text: "Review Reimbursement", url: `${DASHBOARD_BASE}/manage-reimbursements` },
    referenceId: data.reimbursementId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Reimbursement System",
  });

  await sendEmail({
    to: data.auditorEmail,
    subject: `Audit Requested: ${data.title}`,
    html,
  });
}
