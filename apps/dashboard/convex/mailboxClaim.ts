export type MailboxClaimDecision = "allow" | "taken" | "mismatch";

export function canonicalMailbox(value: string): string {
  return value.trim().toLowerCase();
}

export function matchingMailboxHolderIds(
  mailbox: string,
  holders: readonly { id: string; ieeeEmail?: string }[],
): string[] {
  const key = canonicalMailbox(mailbox);
  if (!key) return [];
  return holders
    .filter(
      (holder) =>
        holder.ieeeEmail !== undefined &&
        canonicalMailbox(holder.ieeeEmail) === key,
    )
    .map((holder) => holder.id);
}

export type MailboxIndexRow = { _id: string; ieeeEmail?: string };

export type IeeeEmailIndexedUsers<Range = unknown> = {
  query: (table: "users") => {
    withIndex: (
      indexName: "by_ieeeEmail",
      indexRange?: (q: {
        eq: (field: "ieeeEmail", value: string) => Range;
      }) => Range,
    ) => {
      collect: () => Promise<ReadonlyArray<MailboxIndexRow>>;
    };
  };
};

export function mailboxIndexKeys(
  mailbox: string,
  rawValues: readonly string[] = [],
): string[] {
  const canonical = canonicalMailbox(mailbox);
  if (!canonical) return [];
  const keys = new Set<string>([canonical]);
  for (const raw of rawValues) {
    const trimmed = raw.trim();
    if (!trimmed || canonicalMailbox(trimmed) !== canonical) continue;
    keys.add(trimmed);
  }
  return [...keys];
}

export async function loadMailboxHolders<Range>(
  db: IeeeEmailIndexedUsers<Range>,
  mailbox: string,
  rawValues: readonly string[] = [],
): Promise<{ id: string; ieeeEmail?: string }[]> {
  const canonical = canonicalMailbox(mailbox);
  const seen = new Set<string>();
  const holders: { id: string; ieeeEmail?: string }[] = [];
  for (const key of mailboxIndexKeys(mailbox, rawValues)) {
    const rows = await db
      .query("users")
      .withIndex("by_ieeeEmail", (q) => q.eq("ieeeEmail", key))
      .collect();
    for (const row of rows) {
      if (row.ieeeEmail === undefined) continue;
      if (canonicalMailbox(row.ieeeEmail) !== canonical) continue;
      if (seen.has(row._id)) continue;
      seen.add(row._id);
      holders.push({ id: row._id, ieeeEmail: row.ieeeEmail });
    }
  }
  return holders;
}

export function storedIeeeEmailAfterBackfill(
  value: string | undefined,
): { changed: false } | { changed: true; ieeeEmail: string } {
  if (value === undefined) return { changed: false };
  const ieeeEmail = canonicalMailbox(value);
  if (ieeeEmail === value) return { changed: false };
  return { changed: true, ieeeEmail };
}

export function decideMailboxClaim(args: {
  callerId: string;
  callerEmail: string;
  requestedMailbox: string;
  holderIds: readonly string[];
}): MailboxClaimDecision {
  const mailbox = canonicalMailbox(args.requestedMailbox);
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
