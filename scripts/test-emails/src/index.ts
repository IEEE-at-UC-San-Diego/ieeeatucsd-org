#!/usr/bin/env bun
/**
 * Test script for all email notification types.
 *
 * Usage:
 *   bun run src/index.ts --to you@example.com              # Send all test emails
 *   bun run src/index.ts --to you@example.com --type reimbursement_submitted
 *   bun run src/index.ts --preview                          # Write HTML files to ./preview/
 *   bun run src/index.ts --preview --type fund_request_submitted
 *
 * Environment:
 *   RESEND_API_KEY   — required for sending (not needed for --preview)
 *   FROM_EMAIL       — optional, defaults to IEEE noreply
 *   REPLY_TO_EMAIL   — optional, defaults to ieee@ucsd.edu
 */

import { Resend } from "resend";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  getSampleData,
  EMAIL_TYPES,
  getNotificationType,
  type EmailType,
} from "./sample-data";

// ── Import the actual template from dashboard ──────────────────────────────
// We resolve relative to this script's location in the monorepo.

import {
  renderEmail,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateShort,
  type StatusVariant,
  type DetailRow,
  type NotesBox,
} from "../../../apps/dashboard/src/server/email-template";

// ── CLI Args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const toIndex = args.indexOf("--to");
const typeIndex = args.indexOf("--type");
const isPreview = args.includes("--preview");

const toEmail = toIndex !== -1 ? args[toIndex + 1] : undefined;
const filterType = typeIndex !== -1 ? (args[typeIndex + 1] as EmailType) : undefined;

if (!isPreview && !toEmail) {
  console.error("Usage: bun run src/index.ts --to <email> [--type <type>] [--preview]");
  console.error("\nAvailable types:");
  EMAIL_TYPES.forEach((t) => console.error(`  ${t}`));
  process.exit(1);
}

if (filterType && !EMAIL_TYPES.includes(filterType)) {
  console.error(`Unknown type: ${filterType}`);
  console.error("\nAvailable types:");
  EMAIL_TYPES.forEach((t) => console.error(`  ${t}`));
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DASHBOARD_BASE = "https://dashboard.ieeeatucsd.org";
const TREASURER_EMAIL = "treasurer@ieeeatucsd.org";
const EVENTS_EMAIL = "events@ieeeatucsd.org";

function statusToVariant(status: string): StatusVariant {
  switch (status) {
    case "approved": case "paid": case "verified": case "completed": return "success";
    case "declined": case "denied": case "rejected": return "danger";
    case "needs_info": case "needs_review": case "pending": return "warning";
    case "submitted": return "info";
    default: return "neutral";
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    submitted: "Submitted", approved: "Approved", declined: "Declined",
    denied: "Denied", rejected: "Rejected", paid: "Paid", verified: "Verified",
    needs_info: "Needs Information", needs_review: "Needs Review",
    pending: "Pending Review", completed: "Completed", draft: "Draft",
  };
  return map[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Email Builders ─────────────────────────────────────────────────────────────
// These mirror the notification functions in apps/dashboard/src/server/notifications.ts
// but return { subject, html } instead of sending directly.

interface EmailResult {
  subject: string;
  html: string;
  to: string;
}

function buildReimbursementSubmitted(data: any): EmailResult[] {
  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: `<strong style="color:#059669;">${formatCurrency(data.totalAmount)}</strong>` },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Payment Method", value: escapeHtml(data.paymentMethod) },
    { label: "Submitted By", value: `${escapeHtml(data.submitterName)} (${escapeHtml(data.submitterEmail)})` },
  ];

  const subject = `Reimbursement Submitted: ${data.title}`;
  const html = renderEmail({
    subject,
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

  return [{ subject, html, to: data.submitterEmail }];
}

function buildReimbursementStatusChanged(data: any): EmailResult[] {
  const variant = statusToVariant(data.newStatus);
  const label = statusLabel(data.newStatus);

  let introText = `Your reimbursement request <strong>"${escapeHtml(data.title)}"</strong> has been updated.`;
  if (data.newStatus === "approved") introText = `Great news! Your reimbursement request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>approved</strong> and is being processed for payment.`;
  else if (data.newStatus === "declined") introText = `Your reimbursement request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>declined</strong>. Please review the details below.`;
  else if (data.newStatus === "paid") introText = `Your reimbursement <strong>"${escapeHtml(data.title)}"</strong> has been <strong>paid</strong>! Please check your payment method for the funds.`;

  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: formatCurrency(data.totalAmount) },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Status", value: `<strong>${escapeHtml(label)}</strong>` },
  ];
  if (data.previousStatus) details.push({ label: "Previous Status", value: escapeHtml(statusLabel(data.previousStatus)) });
  if (data.changedByName) details.push({ label: "Updated By", value: escapeHtml(data.changedByName) });

  const notes: NotesBox[] = [];
  if (data.rejectionReason) notes.push({ title: "Reason", content: data.rejectionReason, variant: "danger" });
  if (data.paymentDetails) {
    const parts: string[] = [];
    if (data.paymentDetails.confirmationNumber) parts.push(`Confirmation: ${data.paymentDetails.confirmationNumber}`);
    if (data.paymentDetails.amountPaid) parts.push(`Amount Paid: ${formatCurrency(data.paymentDetails.amountPaid)}`);
    if (data.paymentDetails.paymentDate) parts.push(`Payment Date: ${formatDateShort(data.paymentDetails.paymentDate)}`);
    if (parts.length) notes.push({ title: "Payment Confirmation", content: parts.join(" · "), variant: "success" });
  }

  const subject = `Reimbursement ${label}: ${data.title}`;
  const html = renderEmail({
    subject,
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

  return [{ subject, html, to: data.submitterEmail }];
}

function buildFundRequestSubmitted(data: any): EmailResult[] {
  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: `<strong style="color:#059669;">${formatCurrency(data.amount)}</strong>` },
    { label: "Category", value: escapeHtml(data.category.charAt(0).toUpperCase() + data.category.slice(1)) },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Submitted By", value: `${escapeHtml(data.submitterName)} (${escapeHtml(data.submitterEmail)})` },
  ];
  if (data.vendorLinksCount) details.push({ label: "Vendor Links", value: `${data.vendorLinksCount} link(s)` });

  const subject = `Fund Request Submitted: ${data.title}`;
  const html = renderEmail({
    subject,
    preheader: `Your fund request for ${formatCurrency(data.amount)} has been submitted`,
    recipientName: data.submitterName,
    introHtml: `Your fund request <strong>"${escapeHtml(data.title)}"</strong> has been successfully submitted and is now under review.`,
    statusBadge: { label: "Submitted for Review", variant: "info" },
    details,
    notes: [{ title: "Purpose / Justification", content: data.purpose, variant: "neutral" as StatusVariant }],
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

  return [{ subject, html, to: data.submitterEmail }];
}

function buildFundRequestStatusChanged(data: any): EmailResult[] {
  const variant = statusToVariant(data.newStatus);
  const label = statusLabel(data.newStatus);

  let introText = `Your fund request <strong>"${escapeHtml(data.title)}"</strong> status has been updated.`;
  if (data.newStatus === "approved") introText = `Great news! Your fund request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>approved</strong>. You may now proceed with your purchase.`;
  else if (data.newStatus === "denied") introText = `Unfortunately, your fund request <strong>"${escapeHtml(data.title)}"</strong> has been <strong>denied</strong>.`;
  else if (data.newStatus === "needs_info") introText = `Your fund request <strong>"${escapeHtml(data.title)}"</strong> requires additional information before it can be processed.`;

  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: formatCurrency(data.amount) },
    { label: "Status", value: `<strong>${escapeHtml(label)}</strong>` },
  ];
  if (data.selectedFundingSource) details.push({ label: "Funding Source", value: escapeHtml(data.selectedFundingSource) });
  if (data.reviewerName) details.push({ label: "Reviewed By", value: escapeHtml(data.reviewerName) });

  const notes: NotesBox[] = [];
  if (data.reviewNotes) notes.push({ title: "Review Notes", content: data.reviewNotes, variant: data.newStatus === "denied" ? "danger" : "neutral" as StatusVariant });
  if (data.infoRequestNotes) notes.push({ title: "Information Requested", content: data.infoRequestNotes, variant: "warning" });

  const subject = `Fund Request ${label}: ${data.title}`;
  const html = renderEmail({
    subject,
    preheader: `Your fund request has been ${label.toLowerCase()}`,
    recipientName: data.submitterName,
    introHtml: introText,
    statusBadge: { label, variant },
    details,
    notes,
    ctaButton: { text: data.newStatus === "needs_info" ? "Update Your Request" : "View Details", url: `${DASHBOARD_BASE}/fund-requests` },
    referenceId: data.requestId,
    contactEmail: TREASURER_EMAIL,
    footerText: "IEEE at UC San Diego — Fund Request System",
  });

  return [{ subject, html, to: data.submitterEmail }];
}

function buildEventRequestSubmitted(data: any): EmailResult[] {
  const details: DetailRow[] = [
    { label: "Event Name", value: `<strong>${escapeHtml(data.name)}</strong>` },
    { label: "Location", value: escapeHtml(data.location) },
    { label: "Start", value: formatDate(data.startDateTime) },
    { label: "End", value: formatDate(data.endDateTime) },
  ];
  if (data.expectedAttendance) details.push({ label: "Expected Attendance", value: String(data.expectedAttendance) });
  if (data.department) details.push({ label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) });
  details.push({ label: "Submitted By", value: `${escapeHtml(data.submitterName)} (${escapeHtml(data.submitterEmail)})` });

  const notes: NotesBox[] = [];
  if (data.eventDescription) notes.push({ title: "Event Description", content: data.eventDescription, variant: "neutral" as StatusVariant });

  const reqs: string[] = [];
  if (data.needsGraphics) reqs.push("Graphics Required");
  if (data.needsAsFunding) reqs.push("AS Funding");
  if (data.flyersNeeded) reqs.push("Flyers Needed");
  if (data.photographyNeeded) reqs.push("Photography");
  if (reqs.length) notes.push({ title: "Special Requirements", content: reqs.join(" · "), variant: "info" });

  const subject = `Event Request Submitted: ${data.name}`;
  const html = renderEmail({
    subject,
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

  return [{ subject, html, to: data.submitterEmail }];
}

function buildEventRequestStatusChanged(data: any): EmailResult[] {
  const variant = statusToVariant(data.newStatus);
  const label = statusLabel(data.newStatus);

  let introText = `Your event request <strong>"${escapeHtml(data.name)}"</strong> has been updated.`;
  if (data.newStatus === "approved") introText = `Great news! Your event request <strong>"${escapeHtml(data.name)}"</strong> has been <strong>approved</strong>!`;
  else if (data.newStatus === "declined") introText = `Your event request <strong>"${escapeHtml(data.name)}"</strong> has been <strong>declined</strong>. Please review the details below.`;
  else if (data.newStatus === "needs_review") introText = `Your event request <strong>"${escapeHtml(data.name)}"</strong> requires additional review.`;

  const details: DetailRow[] = [
    { label: "Event Name", value: `<strong>${escapeHtml(data.name)}</strong>` },
    { label: "Location", value: escapeHtml(data.location) },
    { label: "Start", value: formatDate(data.startDateTime) },
    { label: "Status", value: `<strong>${escapeHtml(label)}</strong>` },
  ];
  if (data.previousStatus) details.push({ label: "Previous Status", value: escapeHtml(statusLabel(data.previousStatus)) });
  if (data.changedByName) details.push({ label: "Updated By", value: escapeHtml(data.changedByName) });

  const notes: NotesBox[] = [];
  if (data.declinedReason) notes.push({ title: "Decline Reason", content: data.declinedReason, variant: "danger" });
  if (data.reviewFeedback) notes.push({ title: "Review Feedback", content: data.reviewFeedback, variant: "warning" });

  const subject = `Event Request ${label}: ${data.name}`;
  const html = renderEmail({
    subject,
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

  return [{ subject, html, to: data.submitterEmail }];
}

function buildAuditRequest(data: any): EmailResult[] {
  const details: DetailRow[] = [
    { label: "Title", value: escapeHtml(data.title) },
    { label: "Amount", value: `<strong>${formatCurrency(data.totalAmount)}</strong>` },
    { label: "Department", value: escapeHtml(data.department.charAt(0).toUpperCase() + data.department.slice(1)) },
    { label: "Submitted By", value: escapeHtml(data.submitterName) },
    { label: "Requested By", value: escapeHtml(data.requesterName) },
  ];

  const notes: NotesBox[] = [];
  if (data.requestNote) notes.push({ title: "Request Message", content: data.requestNote, variant: "warning" });

  const subject = `Audit Requested: ${data.title}`;
  const html = renderEmail({
    subject,
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

  return [{ subject, html, to: data.auditorEmail }];
}

// ── Builder Map ────────────────────────────────────────────────────────────────

const builders: Record<EmailType, (data: any) => EmailResult[]> = {
  reimbursement_submitted: buildReimbursementSubmitted,
  reimbursement_status_approved: buildReimbursementStatusChanged,
  reimbursement_status_declined: buildReimbursementStatusChanged,
  reimbursement_status_paid: buildReimbursementStatusChanged,
  fund_request_submitted: buildFundRequestSubmitted,
  fund_request_status_approved: buildFundRequestStatusChanged,
  fund_request_status_denied: buildFundRequestStatusChanged,
  fund_request_status_needs_info: buildFundRequestStatusChanged,
  event_request_submitted: buildEventRequestSubmitted,
  event_request_status_approved: buildEventRequestStatusChanged,
  event_request_status_declined: buildEventRequestStatusChanged,
  event_request_status_needs_review: buildEventRequestStatusChanged,
  audit_request: buildAuditRequest,
};

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const targetEmail = toEmail || "preview@example.com";
  const sampleData = getSampleData(targetEmail);
  const typesToTest = filterType ? [filterType] : [...EMAIL_TYPES];

  console.log(`\n📧 IEEE UCSD Email Test Script`);
  console.log(`${"─".repeat(50)}`);
  console.log(`Mode: ${isPreview ? "Preview (HTML files)" : `Send to ${targetEmail}`}`);
  console.log(`Types: ${typesToTest.length} email(s)`);
  console.log(`${"─".repeat(50)}\n`);

  let resend: Resend | null = null;
  if (!isPreview) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("❌ RESEND_API_KEY is required. Set it in .env or environment.");
      process.exit(1);
    }
    resend = new Resend(apiKey);
  }

  const fromEmail = process.env.FROM_EMAIL || "IEEE at UC San Diego <noreply@transactional.ieeeatucsd.org>";
  const replyTo = process.env.REPLY_TO_EMAIL || "ieee@ucsd.edu";

  if (isPreview) {
    mkdirSync(join(import.meta.dir, "../preview"), { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;

  for (const type of typesToTest) {
    const data = sampleData[type as keyof typeof sampleData];
    if (!data) {
      console.log(`⚠️  No sample data for: ${type}`);
      failCount++;
      continue;
    }

    const builder = builders[type];
    if (!builder) {
      console.log(`⚠️  No builder for: ${type}`);
      failCount++;
      continue;
    }

    try {
      const emails = builder(data);

      for (const email of emails) {
        if (isPreview) {
          const filename = `${type}.html`;
          const filepath = join(import.meta.dir, "../preview", filename);
          writeFileSync(filepath, email.html);
          console.log(`✅ ${type} → preview/${filename}`);
        } else {
          const result = await resend!.emails.send({
            from: fromEmail,
            to: [email.to],
            subject: email.subject,
            html: email.html,
            replyTo,
          });

          if (result.error) {
            console.log(`❌ ${type} → ${result.error.message}`);
            failCount++;
            continue;
          }

          console.log(`✅ ${type} → ${email.to} (${result.data?.id})`);
        }
        successCount++;
      }

      // Small delay between sends to avoid rate limiting
      if (!isPreview) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (error: any) {
      console.log(`❌ ${type} → ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ ${successCount} succeeded, ❌ ${failCount} failed`);
  if (isPreview) {
    console.log(`\nPreview files written to: scripts/test-emails/preview/`);
    console.log(`Open them in a browser to inspect the email templates.`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
