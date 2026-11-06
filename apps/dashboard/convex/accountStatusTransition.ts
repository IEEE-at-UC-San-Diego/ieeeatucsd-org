export const ACCOUNT_STATUSES = ["active", "inactive", "suspended"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function transitionAccountStatus(
  from: string | undefined,
  to: string,
): AccountStatus {
  const current = from ?? "active";
  if (!isAccountStatus(current) || !isAccountStatus(to)) {
    throw new Error("Unknown account status");
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

function isAccountStatus(status: string): status is AccountStatus {
  return status === "active" || status === "inactive" || status === "suspended";
}
