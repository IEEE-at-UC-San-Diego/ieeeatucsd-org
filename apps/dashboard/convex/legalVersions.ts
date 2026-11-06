export const SERVER_LEGAL_VERSIONS = {
  TOS_VERSION: "1.2",
  PRIVACY_POLICY_VERSION: "1.2",
} as const;

export function serverPolicyAcceptance(now: number) {
  return {
    tosAcceptedAt: now,
    tosVersion: SERVER_LEGAL_VERSIONS.TOS_VERSION,
    privacyPolicyAcceptedAt: now,
    privacyPolicyVersion: SERVER_LEGAL_VERSIONS.PRIVACY_POLICY_VERSION,
  };
}
