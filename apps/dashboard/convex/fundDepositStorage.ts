/**
 * Proof that the caller already has the bytes behind a Convex storage id.
 *
 * `fundDeposits.getStorageUrl` used to return a download URL for any id after
 * an officer check. Deposit reads are owner-or-admin, and this bucket also
 * holds resumes, reimbursement receipts, and event files. The stored checksum
 * is the check: an officer who only knows the id cannot mint a new URL.
 */
export function storageChecksumMatches(actual: string, provided: string): boolean {
  const left = actual.trim().toLowerCase();
  const right = provided.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}
