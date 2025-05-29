// Shared email helper functions and utilities

export function getStatusColor(status: string): string {
  switch (status) {
    case 'submitted': return '#ffc107';
    case 'under_review': return '#17a2b8';
    case 'approved': return '#28a745';
    case 'rejected': return '#dc3545';
    case 'in_progress': return '#6f42c1';
    case 'paid': return '#20c997';
    case 'declined': return '#dc3545';
    default: return '#6c757d';
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'submitted': return 'Submitted';
    case 'under_review': return 'Under Review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'in_progress': return 'In Progress';
    case 'paid': return 'Paid';
    case 'declined': return 'Declined';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function getNextStepsText(status: string): string {
  switch (status) {
    case 'submitted':
      return 'Your reimbursement is in the queue for review. We\'ll notify you once it\'s being processed.';
    case 'under_review':
      return 'Our team is currently reviewing your receipts and documentation. No action needed from you.';
    case 'approved':
      return 'Your reimbursement has been approved! Payment processing will begin shortly.';
    case 'rejected':
      return 'Your reimbursement has been rejected. Please review the rejection reason above and reach out to our treasurer if you have questions or need to resubmit with corrections.';
    case 'in_progress':
      return 'Payment is being processed. You should receive your reimbursement within 1-2 business days.';
    case 'paid':
      return 'Your reimbursement has been completed! Please check your account for the payment.';
    default:
      return 'Check your dashboard for more details about your reimbursement status.';
  }
}

export async function initializeEmailServices() {
  // Import Resend and create direct PocketBase connection for server-side use
  const { Resend } = await import('resend');
  const PocketBase = await import('pocketbase').then(module => module.default);
  
  // Initialize services
  const pb = new PocketBase(import.meta.env.POCKETBASE_URL || 'http://127.0.0.1:8090');
  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  
  if (!import.meta.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is required');
  }

  const fromEmail = import.meta.env.FROM_EMAIL || 'IEEE UCSD <noreply@ieeeucsd.org>';
  const replyToEmail = import.meta.env.REPLY_TO_EMAIL || 'treasurer@ieeeucsd.org';

  return { pb, resend, fromEmail, replyToEmail };
}

export function authenticatePocketBase(pb: any, authData: any) {
  if (authData && authData.token && authData.model) {
    console.log('🔐 Authenticating with PocketBase using provided auth data');
    pb.authStore.save(authData.token, authData.model);
    console.log('✅ PocketBase authentication successful');
  } else {
    console.warn('⚠️ No auth data provided, proceeding without authentication');
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    return dateString;
  }
}

export function formatFlyerTypes(flyerTypes: string[]): string {
  if (!flyerTypes || flyerTypes.length === 0) return 'None specified';
  
  const typeMap: Record<string, string> = {
    'digital_with_social': 'Digital with Social Media',
    'digital_no_social': 'Digital without Social Media',
    'physical_with_advertising': 'Physical with Advertising',
    'physical_no_advertising': 'Physical without Advertising',
    'newsletter': 'Newsletter',
    'other': 'Other'
  };
  
  return flyerTypes.map(type => typeMap[type] || type).join(', ');
}

export function formatLogos(logos: string[]): string {
  if (!logos || logos.length === 0) return 'None specified';
  return logos.join(', ');
}