export type FundDepositStatus = "pending" | "verified" | "rejected";

export function transitionFundDeposit(
  from: FundDepositStatus,
  to: "verified" | "rejected",
): { status: "verified" | "rejected"; setVerifiedAt: boolean } {
  if (from !== "pending") {
    throw new Error("Can only change status of pending deposits");
  }
  if (to === "verified") return { status: "verified", setVerifiedAt: true };
  if (to === "rejected") return { status: "rejected", setVerifiedAt: false };
  const unreachable: never = to;
  throw new Error(`Unknown deposit status: ${String(unreachable)}`);
}

export function assertFundDepositDeletable(status: FundDepositStatus) {
  if (status !== "pending") {
    throw new Error("Can only delete pending deposits");
  }
}
