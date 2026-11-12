/**
 * Proof that the caller already has the bytes behind a Convex storage id.
 *
 * `fundDeposits.getStorageUrl` used to return a download URL for any id after
 * an officer check. Deposit reads are owner-or-admin, and this bucket also
 * holds resumes, reimbursement receipts, and event files. The stored checksum
 * is the check: an officer who only knows the id cannot mint a new URL.
 */
const SHA256_BASE64 = /^[A-Za-z0-9+/]{43}=$/;

export function storageChecksumMatches(actual: string, provided: string): boolean {
  const left = actual.trim();
  const right = provided.trim();
  if (!SHA256_BASE64.test(left) || !SHA256_BASE64.test(right)) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}
