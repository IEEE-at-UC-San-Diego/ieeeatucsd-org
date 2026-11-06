export const FUND_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "needs_info",
  "approved",
  "denied",
  "completed",
] as const;

export type FundRequestStatus = (typeof FUND_REQUEST_STATUSES)[number];

export type FundAuditAction =
  | "created"
  | "updated"
  | "submitted"
  | "approved"
  | "denied"
  | "info_requested"
  | "info_provided"
  | "completed";

export function countsAsSpentFundRequest(status: string) {
  return status === "approved" || status === "completed";
}

export function spentFundRequestTotal(
  requests: Array<{ status: string; amount: number; department: string }>,
  department: string,
) {
  return requests
    .filter(
      (request) =>
        request.department === department &&
        countsAsSpentFundRequest(request.status),
    )
    .reduce((sum, request) => sum + request.amount, 0);
}

export function transitionFundRequest(
  from: FundRequestStatus,
  to: FundRequestStatus,
  actor: "owner" | "admin",
): FundRequestStatus {
  if (from === "draft" || to === "draft") {
    throw new Error(`Cannot move a fund request from ${from} to ${to}`);
  }
  if (from === to) return from;
  if (actor === "owner" && from === "needs_info" && to === "submitted") {
    return to;
  }
  if (actor === "admin" && from === "submitted") {
    if (to === "needs_info" || to === "approved" || to === "denied") return to;
  }
  if (actor === "admin" && from === "approved" && to === "completed") {
    return to;
  }
  throw new Error(`Cannot move a fund request from ${from} to ${to}`);
}

export function fundAuditAction(
  from: FundRequestStatus,
  to: FundRequestStatus,
): FundAuditAction {
  if (from === to) return "updated";
  if (to === "submitted" && from === "needs_info") return "info_provided";
  if (to === "submitted") return "updated";
  if (to === "needs_info") return "info_requested";
  if (to === "approved") return "approved";
  if (to === "denied") return "denied";
  if (to === "completed") return "completed";
  throw new Error("No audit action for this fund request transition");
}
