export type ReimbursementStatus =
  | "submitted"
  | "declined"
  | "approved"
  | "paid";

export function transitionReimbursementStatus(
  from: ReimbursementStatus,
  to: Exclude<ReimbursementStatus, "paid">,
  reason: string | undefined,
): ReimbursementStatus {
  if (from === "paid") {
    throw new Error("Cannot move a paid reimbursement backward");
  }
  if (to === "declined" && !reason?.trim()) {
    throw new Error("Decline reason is required");
  }
  if (from === "submitted" && (to === "approved" || to === "declined")) {
    return to;
  }
  if (from === to) return from;
  throw new Error(`Cannot move a reimbursement from ${from} to ${to}`);
}

export function transitionReimbursementPayment(
  from: ReimbursementStatus,
): "paid" {
  if (from !== "approved") {
    throw new Error("Payment details can only be recorded on an approved reimbursement");
  }
  return "paid";
}

export function assertReimbursementDeletable(status: ReimbursementStatus) {
  if (status === "paid") {
    throw new Error("Cannot delete a paid reimbursement");
  }
}
