/**
 * Legal Document Versions Configuration
 * 
 * Update these version numbers when Terms of Service or Privacy Policy are modified.
 * Users who have accepted older versions will be prompted to accept the new versions.
 */

export const LEGAL_VERSIONS = {
    // Terms of Service
    TOS_VERSION: "1.2",
    TOS_EFFECTIVE_DATE: "2024-12-29",
    TOS_URL: "/terms-of-service",

    // Privacy Policy
    PRIVACY_POLICY_VERSION: "1.2",
    PRIVACY_POLICY_EFFECTIVE_DATE: "2024-12-29",
    PRIVACY_POLICY_URL: "/privacy-policy",
};

/**
 * Check if user needs to accept updated policies
 */
export function needsPolicyUpdate(
    userTosVersion?: string,
    userPrivacyVersion?: string
): { needsTos: boolean; needsPrivacy: boolean; needsAny: boolean } {
    const needsTos = userTosVersion !== LEGAL_VERSIONS.TOS_VERSION;
    const needsPrivacy = userPrivacyVersion !== LEGAL_VERSIONS.PRIVACY_POLICY_VERSION;

    return {
        needsTos,
        needsPrivacy,
        needsAny: needsTos || needsPrivacy,
    };
}

/**
 * Format effective date for display
 */
export function formatEffectiveDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
