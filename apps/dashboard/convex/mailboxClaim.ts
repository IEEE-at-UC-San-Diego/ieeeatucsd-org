export type MailboxClaimDecision = "allow" | "taken" | "mismatch";

export function decideMailboxClaim(args: {
  callerId: string;
  callerEmail: string;
  requestedMailbox: string;
  holderIds: readonly string[];
}): MailboxClaimDecision {
  const mailbox = args.requestedMailbox.trim().toLowerCase();
  const at = mailbox.indexOf("@");
  const local = at > 0 ? mailbox.slice(0, at) : "";
  const domain = at > 0 ? mailbox.slice(at + 1) : "";
  const loginLocal =
    args.callerEmail.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ??
    "";

  if (!local || !domain || domain.includes("@") || local !== loginLocal) {
    return "mismatch";
  }
  if (args.holderIds.some((holderId) => holderId !== args.callerId)) {
    return "taken";
  }
  return "allow";
}
