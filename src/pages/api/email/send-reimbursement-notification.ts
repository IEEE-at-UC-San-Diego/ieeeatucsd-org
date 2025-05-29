import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📨 Email notification API called (legacy endpoint)');
    
    const requestData = await request.json();
    const { type, reimbursementId, eventRequestId } = requestData;

    console.log('📋 Request data:', {
      type,
      reimbursementId,
      eventRequestId
    });

    if (!type) {
      console.error('❌ Missing required parameter: type');
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine which endpoint to redirect to based on email type
    const reimbursementTypes = ['status_change', 'comment', 'submission', 'test'];
    const eventRequestTypes = ['event_request_submission', 'event_request_status_change', 'pr_completed', 'design_pr_notification'];

    let targetEndpoint = '';
    
    if (reimbursementTypes.includes(type)) {
      if (!reimbursementId && type !== 'test') {
        return new Response(
          JSON.stringify({ error: 'Missing reimbursementId for reimbursement notification' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      targetEndpoint = '/api/email/send-reimbursement-email';
    } else if (eventRequestTypes.includes(type)) {
      if (!eventRequestId) {
        return new Response(
          JSON.stringify({ error: 'Missing eventRequestId for event request notification' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      targetEndpoint = '/api/email/send-event-request-email';
    } else {
      console.error('❌ Unknown notification type:', type);
      return new Response(
        JSON.stringify({ error: `Unknown notification type: ${type}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Redirecting ${type} to ${targetEndpoint}`);

    // Forward the request to the appropriate endpoint
    const baseUrl = new URL(request.url).origin;
    const response = await fetch(`${baseUrl}${targetEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    const result = await response.json();
    
    console.log(`📊 Forwarded request result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    return new Response(
      JSON.stringify(result),
      {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error in email notification API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};