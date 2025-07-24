import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { sendReimbursementSubmissionEmail } from '../../../scripts/email/ReimbursementEmailFunctions';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Initialize Resend
    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    const fromEmail = import.meta.env.FROM_EMAIL || 'IEEE UCSD <noreply@ieeeucsd.org>';
    const replyToEmail = import.meta.env.REPLY_TO_EMAIL || 'treasurer@ieeeucsd.org';

    let success = false;

    switch (data.type) {
      case 'reimbursement_submission':
        success = await sendReimbursementSubmissionEmail(resend, fromEmail, replyToEmail, data);
        break;
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown notification type: ${data.type}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
      success,
      message: success ? 'Notification sent successfully' : 'Failed to send notification'
    }), {
      status: success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email notification API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};