/**
 * Realistic sample data for testing all email notification types.
 * The `to` field will be overridden by the --to CLI argument.
 */

export function getSampleData(toEmail: string) {
  return {
    reimbursement_submitted: {
      reimbursementId: "reimb_test_abc123",
      title: "Conference Travel - IEEE Region 6 Meeting",
      totalAmount: 347.82,
      department: "internal",
      paymentMethod: "Zelle",
      additionalInfo: "john.doe@ucsd.edu",
      submitterName: "John Doe",
      submitterEmail: toEmail,
    },

    reimbursement_status_approved: {
      reimbursementId: "reimb_test_abc123",
      title: "Conference Travel - IEEE Region 6 Meeting",
      totalAmount: 347.82,
      department: "internal",
      newStatus: "approved",
      previousStatus: "submitted",
      changedByName: "Sarah Chen",
      submitterName: "John Doe",
      submitterEmail: toEmail,
    },

    reimbursement_status_declined: {
      reimbursementId: "reimb_test_def456",
      title: "Office Supplies - Printer Ink",
      totalAmount: 89.99,
      department: "projects",
      newStatus: "declined",
      previousStatus: "submitted",
      changedByName: "Sarah Chen",
      rejectionReason:
        "This purchase was not pre-approved. Please submit a fund request before making purchases over $50. You may resubmit with the fund request approval attached.",
      submitterName: "Alex Rivera",
      submitterEmail: toEmail,
    },

    reimbursement_status_paid: {
      reimbursementId: "reimb_test_ghi789",
      title: "Workshop Materials - Soldering Kits",
      totalAmount: 215.0,
      department: "projects",
      newStatus: "paid",
      previousStatus: "approved",
      changedByName: "Sarah Chen",
      paymentDetails: {
        confirmationNumber: "ZEL-2026-0213-4829",
        paymentDate: Date.now(),
        amountPaid: 215.0,
      },
      submitterName: "Maria Garcia",
      submitterEmail: toEmail,
    },

    fund_request_submitted: {
      requestId: "fund_test_jkl012",
      title: "Raspberry Pi Kits for IoT Workshop",
      amount: 450.0,
      category: "equipment",
      department: "projects",
      purpose:
        "We need 10 Raspberry Pi 5 starter kits for the upcoming IoT Workshop series. Each kit includes a Pi 5, power supply, SD card, and breadboard. The workshop is expected to have 30+ attendees across 3 sessions.",
      vendorLinksCount: 2,
      attachmentsCount: 1,
      submitterName: "David Kim",
      submitterEmail: toEmail,
    },

    fund_request_status_approved: {
      requestId: "fund_test_jkl012",
      title: "Raspberry Pi Kits for IoT Workshop",
      amount: 450.0,
      newStatus: "approved",
      previousStatus: "submitted",
      reviewNotes:
        "Approved. Please purchase from the Amazon link provided and submit receipts for reimbursement.",
      selectedFundingSource: "ieee",
      reviewerName: "Sarah Chen",
      submitterName: "David Kim",
      submitterEmail: toEmail,
    },

    fund_request_status_denied: {
      requestId: "fund_test_mno345",
      title: "Team Dinner - End of Quarter",
      amount: 800.0,
      newStatus: "denied",
      previousStatus: "submitted",
      reviewNotes:
        "Unfortunately, social dining events over $500 require AS funding approval. Please submit an AS funding request first, then resubmit.",
      reviewerName: "Sarah Chen",
      submitterName: "Emily Zhang",
      submitterEmail: toEmail,
    },

    fund_request_status_needs_info: {
      requestId: "fund_test_pqr678",
      title: "PCB Fabrication - Custom Sensor Board",
      amount: 320.0,
      newStatus: "needs_info",
      previousStatus: "submitted",
      infoRequestNotes:
        "Could you provide a comparison quote from at least one other PCB manufacturer? Also, please clarify the expected timeline for delivery.",
      reviewerName: "Sarah Chen",
      submitterName: "Chris Park",
      submitterEmail: toEmail,
    },

    event_request_submitted: {
      eventRequestId: "evt_test_stu901",
      name: "IEEE UCSD x Qualcomm Tech Talk: 5G & Beyond",
      location: "CSE 1202, UC San Diego",
      startDateTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
      endDateTime: Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000, // +2 hours
      eventDescription:
        "A technical talk featuring Qualcomm engineers discussing the future of 5G technology, mmWave communications, and opportunities for students in the wireless industry. Includes networking session with refreshments.",
      department: "events",
      expectedAttendance: 120,
      needsGraphics: true,
      needsAsFunding: false,
      flyersNeeded: true,
      photographyNeeded: true,
      submitterName: "Lisa Wang",
      submitterEmail: toEmail,
    },

    event_request_status_approved: {
      eventRequestId: "evt_test_stu901",
      name: "IEEE UCSD x Qualcomm Tech Talk: 5G & Beyond",
      location: "CSE 1202, UC San Diego",
      startDateTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
      newStatus: "approved",
      previousStatus: "submitted",
      changedByName: "Michael Torres",
      submitterName: "Lisa Wang",
      submitterEmail: toEmail,
    },

    event_request_status_declined: {
      eventRequestId: "evt_test_vwx234",
      name: "Movie Night - Interstellar Screening",
      location: "Price Center Theater",
      startDateTime: Date.now() + 14 * 24 * 60 * 60 * 1000,
      newStatus: "declined",
      previousStatus: "submitted",
      declinedReason:
        "The Price Center Theater is already booked for this date. Please check room availability and resubmit with an alternative date or venue.",
      changedByName: "Michael Torres",
      submitterName: "Ryan Patel",
      submitterEmail: toEmail,
    },

    event_request_status_needs_review: {
      eventRequestId: "evt_test_yza567",
      name: "Hackathon: Build for Good",
      location: "Design & Innovation Building",
      startDateTime: Date.now() + 21 * 24 * 60 * 60 * 1000,
      newStatus: "needs_review",
      previousStatus: "submitted",
      reviewFeedback:
        "Great event concept! However, we need more details about the judging criteria, prize structure, and whether you've confirmed the venue booking. Please update the request.",
      changedByName: "Michael Torres",
      submitterName: "Priya Sharma",
      submitterEmail: toEmail,
    },

    audit_request: {
      reimbursementId: "reimb_test_audit001",
      title: "Catering - Industry Night Dinner",
      totalAmount: 1250.0,
      department: "events",
      submitterName: "Lisa Wang",
      requestNote:
        "This is a high-value reimbursement for the Industry Night event. Could you please review the receipts and verify the amounts before I approve?",
      auditorName: "Test Auditor",
      auditorEmail: toEmail,
      requesterName: "Sarah Chen",
    },
  };
}

export const EMAIL_TYPES = [
  "reimbursement_submitted",
  "reimbursement_status_approved",
  "reimbursement_status_declined",
  "reimbursement_status_paid",
  "fund_request_submitted",
  "fund_request_status_approved",
  "fund_request_status_denied",
  "fund_request_status_needs_info",
  "event_request_submitted",
  "event_request_status_approved",
  "event_request_status_declined",
  "event_request_status_needs_review",
  "audit_request",
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

/** Map test type names to the actual notification type used by the API */
export function getNotificationType(testType: EmailType): string {
  if (testType.startsWith("reimbursement_status_")) return "reimbursement_status_changed";
  if (testType.startsWith("fund_request_status_")) return "fund_request_status_changed";
  if (testType.startsWith("event_request_status_")) return "event_request_status_changed";
  return testType;
}
