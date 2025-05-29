import type { APIRoute } from 'astro';
import { initializeEmailServices, authenticatePocketBase } from '../../../scripts/email/EmailHelpers';
import {
  sendEventRequestSubmissionEmail,
  sendEventRequestStatusChangeEmail,
  sendPRCompletedEmail,
  sendDesignPRNotificationEmail
} from '../../../scripts/email/EventRequestEmailFunctions';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📨 Event request email API called');
    
    const { 
      type, 
      eventRequestId,
      previousStatus, 
      newStatus, 
      changedByUserId, 
      declinedReason,
      additionalContext,
      authData
    } = await request.json();

    console.log('📋 Request data:', {
      type,
      eventRequestId,
      hasAuthData: !!authData,
      authDataHasToken: !!(authData?.token),
      authDataHasModel: !!(authData?.model),
      newStatus,
      previousStatus
    });

    if (!type || !eventRequestId) {
      console.error('❌ Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: type and eventRequestId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize services
    const { pb, resend, fromEmail, replyToEmail } = await initializeEmailServices();

    // Authenticate with PocketBase if auth data is provided
    authenticatePocketBase(pb, authData);

    let success = false;

    console.log(`🎯 Processing event request email type: ${type}`);

    switch (type) {
      case 'event_request_submission':
        success = await sendEventRequestSubmissionEmail(pb, resend, fromEmail, replyToEmail, {
          eventRequestId
        });
        break;

      case 'event_request_status_change':
        if (!newStatus) {
          return new Response(
            JSON.stringify({ error: 'Missing newStatus for event request status change notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendEventRequestStatusChangeEmail(pb, resend, fromEmail, replyToEmail, {
          eventRequestId,
          newStatus,
          previousStatus,
          changedByUserId,
          declinedReason: declinedReason || additionalContext?.declinedReason
        });
        break;

      case 'pr_completed':
        success = await sendPRCompletedEmail(pb, resend, fromEmail, replyToEmail, {
          eventRequestId
        });
        break;

      case 'design_pr_notification':
        success = await sendDesignPRNotificationEmail(pb, resend, fromEmail, replyToEmail, {
          eventRequestId,
          action: additionalContext?.action || 'unknown'
        });
        break;

      default:
        console.error('❌ Unknown event request notification type:', type);
        return new Response(
          JSON.stringify({ error: `Unknown event request notification type: ${type}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    console.log(`📊 Event request email operation result: ${success ? 'SUCCESS' : 'FAILED'}`);

    return new Response(
      JSON.stringify({ 
        success, 
        message: success ? 'Event request email notification sent successfully' : 'Failed to send event request email notification' 
      }),
      { 
        status: success ? 200 : 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in event request email notification API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
