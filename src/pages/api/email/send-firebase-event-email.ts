import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import {
  sendFirebaseEventRequestSubmissionEmail,
  sendFirebaseEventRequestStatusChangeEmail,
  sendFirebaseEventEditEmail,
  sendFirebaseEventDeleteEmail
} from '../../../scripts/email/FirebaseEventEmailFunctions';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📨 Firebase event email API called');
    
    const { 
      type, 
      eventRequestId,
      previousStatus, 
      newStatus, 
      changedByUserId, 
      declinedReason,
      previousData,
      newData,
      eventName,
      location,
      userName,
      userEmail,
      status,
      additionalContext
    } = await request.json();

    console.log('📋 Request data:', {
      type,
      eventRequestId,
      newStatus,
      previousStatus,
      eventName
    });

    if (!type) {
      console.error('❌ Missing required parameter: type');
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Resend
    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    
    if (!import.meta.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const fromEmail = import.meta.env.FROM_EMAIL || 'IEEE UCSD <noreply@ieeeatucsd.org>';
    const replyToEmail = import.meta.env.REPLY_TO_EMAIL || 'ieee@ucsd.edu';

    let success = false;

    console.log(`🎯 Processing Firebase event email type: ${type}`);

    switch (type) {
      case 'event_request_submission':
        if (!eventRequestId) {
          return new Response(
            JSON.stringify({ error: 'Missing eventRequestId for submission notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendFirebaseEventRequestSubmissionEmail(resend, fromEmail, replyToEmail, {
          eventRequestId
        });
        break;

      case 'event_request_status_change':
        if (!eventRequestId || !newStatus) {
          return new Response(
            JSON.stringify({ error: 'Missing eventRequestId or newStatus for status change notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendFirebaseEventRequestStatusChangeEmail(resend, fromEmail, replyToEmail, {
          eventRequestId,
          newStatus,
          previousStatus,
          changedByUserId,
          declinedReason
        });
        break;

      case 'event_edit':
        if (!eventRequestId || !previousData || !newData) {
          return new Response(
            JSON.stringify({ error: 'Missing eventRequestId, previousData, or newData for edit notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendFirebaseEventEditEmail(resend, fromEmail, replyToEmail, {
          eventRequestId,
          previousData,
          newData
        });
        break;

      case 'event_delete':
        if (!eventName || !userName || !userEmail || !eventRequestId) {
          return new Response(
            JSON.stringify({ error: 'Missing required data for delete notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendFirebaseEventDeleteEmail(resend, fromEmail, replyToEmail, {
          eventRequestId,
          eventName,
          location,
          userName,
          userEmail,
          status
        });
        break;

      default:
        console.error('❌ Unknown Firebase event notification type:', type);
        return new Response(
          JSON.stringify({ error: `Unknown event notification type: ${type}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    console.log(`📊 Firebase event email operation result: ${success ? 'SUCCESS' : 'FAILED'}`);

    return new Response(
      JSON.stringify({ 
        success, 
        message: success ? 'Event email notification sent successfully' : 'Failed to send event email notification' 
      }),
      { 
        status: success ? 200 : 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Firebase event email API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}; 