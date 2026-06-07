import type {
  DeductionResult,
  EarnedPointsResult,
  UserPointTotals,
} from "./types";

type LegacyUserPoints = {
  points?: number;
  lifetimePointsEarned?: number;
  spendablePoints?: number;
  pendingPointCorrection?: number;
};

export function getUserPointTotals(user: LegacyUserPoints): UserPointTotals {
  const legacy = user.points ?? 0;
  return {
    lifetimePointsEarned: user.lifetimePointsEarned ?? legacy,
    spendablePoints: user.spendablePoints ?? legacy,
    pendingPointCorrection: user.pendingPointCorrection ?? 0,
  };
}

export function applyEarnedPoints(
  current: UserPointTotals,
  amount: number,
): EarnedPointsResult {
  if (amount <= 0) {
    return {
      ...current,
      spendableDelta: 0,
      lifetimeDelta: 0,
      pendingRepaid: 0,
    };
  }

  const lifetimePointsEarned = current.lifetimePointsEarned + amount;
  let pendingPointCorrection = current.pendingPointCorrection;
  let spendablePoints = current.spendablePoints;
  let pendingRepaid = 0;

  if (pendingPointCorrection > 0) {
    const repayment = Math.min(amount, pendingPointCorrection);
    pendingRepaid = repayment;
    pendingPointCorrection -= repayment;
    const remainder = amount - repayment;
    spendablePoints += remainder;
  } else {
    spendablePoints += amount;
  }

  return {
    lifetimePointsEarned,
    spendablePoints,
    pendingPointCorrection,
    spendableDelta: amount - pendingRepaid,
    lifetimeDelta: amount,
    pendingRepaid,
  };
}

export function applySpendableDeduction(
  current: UserPointTotals,
  amount: number,
): DeductionResult {
  if (amount <= 0) {
    return {
      ...current,
      spendableDelta: 0,
      pendingAdded: 0,
    };
  }

  if (current.spendablePoints >= amount) {
    return {
      ...current,
      spendablePoints: current.spendablePoints - amount,
      spendableDelta: -amount,
      pendingAdded: 0,
    };
  }

  const deficit = amount - current.spendablePoints;
  return {
    lifetimePointsEarned: current.lifetimePointsEarned,
    spendablePoints: 0,
    pendingPointCorrection: current.pendingPointCorrection + deficit,
    spendableDelta: -current.spendablePoints,
    pendingAdded: deficit,
  };
}

export function applyOfficerAward(
  current: UserPointTotals,
  amount: number,
  affectsLifetime: boolean,
): EarnedPointsResult {
  if (amount <= 0) {
    return {
      ...current,
      spendableDelta: 0,
      lifetimeDelta: 0,
      pendingRepaid: 0,
    };
  }

  if (affectsLifetime) {
    return applyEarnedPoints(current, amount);
  }

  return {
    ...current,
    spendablePoints: current.spendablePoints + amount,
    spendableDelta: amount,
    lifetimeDelta: 0,
    pendingRepaid: 0,
  };
}

export function applySpendableRefund(
  current: UserPointTotals,
  amount: number,
): UserPointTotals & { spendableDelta: number } {
  if (amount <= 0) {
    return { ...current, spendableDelta: 0 };
  }

  return {
    ...current,
    spendablePoints: current.spendablePoints + amount,
    spendableDelta: amount,
  };
}

export function canAffordSpendable(current: UserPointTotals, amount: number) {
  return current.spendablePoints >= amount;
}
