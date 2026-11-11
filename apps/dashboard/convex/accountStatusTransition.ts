export const ACCOUNT_STATUSES = ["active", "inactive", "suspended"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

function allowedAccountStatusTargets(
  from: AccountStatus,
): readonly AccountStatus[] {
  switch (from) {
    case "active":
      return ["inactive", "suspended"];
    case "inactive":
      return ["active", "suspended"];
    case "suspended":
      return ["active", "inactive"];
    default: {
      const unreachable: never = from;
      throw new Error(`Unknown account status: ${String(unreachable)}`);
    }
  }
}

export function transitionAccountStatus(
  from: AccountStatus,
  to: AccountStatus,
): AccountStatus {
  if (from === to) return from;
  if (!allowedAccountStatusTargets(from).includes(to)) {
    throw new Error(`Cannot move an account from ${from} to ${to}`);
  }
  return to;
}

export function assertAccountCanAct(status: string | undefined) {
  if (status === "suspended") {
    throw new Error("Account is suspended");
  }
  if (status === "inactive") {
    throw new Error("Account is inactive");
  }
}
