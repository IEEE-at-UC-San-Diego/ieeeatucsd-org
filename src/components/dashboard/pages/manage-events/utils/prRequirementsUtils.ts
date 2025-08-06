/**
 * Utility functions for handling PR (Public Relations) requirements in event management
 */

export interface PRRequirements {
  flyerType?: string[];
  otherFlyerType?: string;
  requiredLogos?: string[];
  advertisingFormat?: string;
  additionalSpecifications?: string;
  flyerAdditionalRequests?: string;
}

/**
 * Extract PR requirements from an event request object
 */
export function extractPRRequirements(eventRequest: any): PRRequirements {
  return {
    flyerType: eventRequest?.flyerType || [],
    otherFlyerType: eventRequest?.otherFlyerType || '',
    requiredLogos: eventRequest?.requiredLogos || [],
    advertisingFormat: eventRequest?.advertisingFormat || '',
    additionalSpecifications: eventRequest?.additionalSpecifications || '',
    flyerAdditionalRequests: eventRequest?.flyerAdditionalRequests || ''
  };
}

/**
 * Check if an event request has any PR requirements specified
 */
export function hasPRRequirements(eventRequest: any): boolean {
  const requirements = extractPRRequirements(eventRequest);
  
  return !!(
    (requirements.flyerType && requirements.flyerType.length > 0) ||
    requirements.otherFlyerType ||
    (requirements.requiredLogos && requirements.requiredLogos.length > 0) ||
    requirements.advertisingFormat ||
    requirements.additionalSpecifications ||
    requirements.flyerAdditionalRequests
  );
}

/**
 * Get a summary of PR requirements for display
 */
export function getPRRequirementsSummary(eventRequest: any): string {
  const requirements = extractPRRequirements(eventRequest);
  const summary: string[] = [];

  if (requirements.flyerType && requirements.flyerType.length > 0) {
    summary.push(`${requirements.flyerType.length} flyer type(s)`);
  }

  if (requirements.requiredLogos && requirements.requiredLogos.length > 0) {
    summary.push(`${requirements.requiredLogos.length} required logo(s)`);
  }

  if (requirements.advertisingFormat) {
    summary.push(`Format: ${requirements.advertisingFormat}`);
  }

  if (requirements.additionalSpecifications) {
    summary.push('Additional specifications');
  }

  if (requirements.flyerAdditionalRequests) {
    summary.push('Additional requests');
  }

  return summary.length > 0 ? summary.join(', ') : 'No specific requirements';
}
