import { v } from "convex/values";

export const pointLedgerCategory = v.union(
  v.literal("opening_balance_migration"),
  v.literal("event_attendance_award"),
  v.literal("attendance_reversal"),
  v.literal("merchandise_purchase"),
  v.literal("merchandise_refund"),
  v.literal("officer_award"),
  v.literal("officer_correction"),
  v.literal("pending_correction_repayment"),
);

export type PointLedgerCategory =
  | "opening_balance_migration"
  | "event_attendance_award"
  | "attendance_reversal"
  | "merchandise_purchase"
  | "merchandise_refund"
  | "officer_award"
  | "officer_correction"
  | "pending_correction_repayment";

export type UserPointTotals = {
  lifetimePointsEarned: number;
  spendablePoints: number;
  pendingPointCorrection: number;
};

export type EarnedPointsResult = UserPointTotals & {
  spendableDelta: number;
  lifetimeDelta: number;
  pendingRepaid: number;
};

export type DeductionResult = UserPointTotals & {
  spendableDelta: number;
  pendingAdded: number;
};
